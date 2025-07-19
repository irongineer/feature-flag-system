import { Request, Response, NextFunction } from 'express';
import { featureFlagClient } from '../../../../feature-flag-integration/client/feature-flag-client';
import { FeatureFlagContext } from '../../../attendance-core/src/types';
import { logger } from '../utils/logger';

// 拡張されたRequestオブジェクトの型定義
declare module 'express-serve-static-core' {
  interface Request {
    featureFlags?: Record<string, boolean>;
    featureFlagContext?: FeatureFlagContext;
    isFeatureEnabled?: (flagKey: string) => boolean;
  }
}

/**
 * フィーチャーフラグミドルウェア
 * リクエストヘッダーからテナント情報を取得し、フィーチャーフラグを評価
 */
export async function featureFlagMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ヘッダーからテナント情報を取得
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;
    const plan = req.headers['x-tenant-plan'] as string;
    const environment = (req.headers['x-environment'] as string) || 'development';

    // テナント情報が不足している場合は、デフォルト値を使用
    if (!tenantId) {
      logger.warn('No tenant ID provided in request headers');
      return next();
    }

    // フィーチャーフラグコンテキストを作成
    const featureFlagContext: FeatureFlagContext = {
      tenantId,
      userId: userId || 'anonymous',
      userRole: userRole || 'employee',
      plan: plan || 'basic',
      environment: environment as any,
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    };

    // すべてのフィーチャーフラグを評価
    const allFlags = await featureFlagClient.getAllFlags(featureFlagContext);
    
    // リクエストオブジェクトにフィーチャーフラグ情報を追加
    req.featureFlags = allFlags;
    req.featureFlagContext = featureFlagContext;
    
    // 便利なヘルパー関数を追加
    req.isFeatureEnabled = (flagKey: string): boolean => {
      return allFlags[flagKey] || false;
    };

    // デバッグ情報をログに出力
    logger.debug('Feature flags evaluated', {
      tenantId,
      userId,
      userRole,
      plan,
      environment,
      flagCount: Object.keys(allFlags).length,
      enabledFlags: Object.entries(allFlags)
        .filter(([_, enabled]) => enabled)
        .map(([key, _]) => key)
    });

    next();
  } catch (error) {
    logger.error('Feature flag middleware error:', error);
    
    // エラーが発生した場合でも、リクエストは続行
    // デフォルトのフィーチャーフラグを設定
    req.featureFlags = {};
    req.isFeatureEnabled = () => false;
    
    next();
  }
}

/**
 * 特定のフィーチャーフラグが有効かどうかをチェックするミドルウェア
 */
export function requireFeatureFlag(flagKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isFeatureEnabled || !req.isFeatureEnabled(flagKey)) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `Feature '${flagKey}' is not enabled for this tenant`,
        featureFlag: flagKey
      });
    }
    next();
  };
}

/**
 * 複数のフィーチャーフラグのうち、いずれかが有効かチェックするミドルウェア
 */
export function requireAnyFeatureFlag(flagKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isFeatureEnabled) {
      return res.status(403).json({
        error: 'Feature not available',
        message: 'Feature flags not available',
        featureFlags: flagKeys
      });
    }

    const hasAnyFlag = flagKeys.some(flagKey => req.isFeatureEnabled!(flagKey));
    
    if (!hasAnyFlag) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `None of the required features are enabled: ${flagKeys.join(', ')}`,
        featureFlags: flagKeys
      });
    }
    
    next();
  };
}

/**
 * テナントプランに基づいてアクセス制御を行うミドルウェア
 */
export function requirePlan(requiredPlans: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPlan = req.featureFlagContext?.plan || 'basic';
    
    if (!requiredPlans.includes(userPlan)) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        message: `This feature requires one of the following plans: ${requiredPlans.join(', ')}`,
        currentPlan: userPlan,
        requiredPlans
      });
    }
    
    next();
  };
}

/**
 * メンテナンスモードをチェックするミドルウェア
 */
export function checkMaintenanceMode(req: Request, res: Response, next: NextFunction) {
  if (req.isFeatureEnabled && req.isFeatureEnabled('maintenance_mode')) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'System is currently under maintenance',
      maintenanceMode: true
    });
  }
  
  next();
}