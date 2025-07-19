import axios, { AxiosInstance } from 'axios';
import { FeatureFlagClient, FeatureFlagContext } from '../../packages/attendance-core/src/types';

export class AttendanceFeatureFlagClient implements FeatureFlagClient {
  private apiClient: AxiosInstance;
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5分

  constructor(
    private baseURL: string = 'http://localhost:3001/api',
    private timeout: number = 5000
  ) {
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * フィーチャーフラグが有効かどうかを判定
   */
  async isEnabled(flagKey: string, context: FeatureFlagContext): Promise<boolean> {
    // userIdがなくてもキャッシュキーを作成（テナントレベルでのキャッシュ）
    const cacheKey = `${flagKey}:${context.tenantId}:${context.userId || 'anonymous'}`;
    
    // キャッシュチェック
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      // オプショナルフィールドはundefinedの場合は送信しない
      const requestPayload: any = {
        tenantId: context.tenantId,
        flagKey,
        environment: context.environment
      };

      // オプショナルフィールドを条件付きで追加
      if (context.userId) requestPayload.userId = context.userId;
      if (context.userRole) requestPayload.userRole = context.userRole;
      if (context.plan) requestPayload.plan = context.plan;
      if (context.metadata) requestPayload.metadata = context.metadata;

      const response = await this.apiClient.post('/evaluate', requestPayload);

      const result = response.data.enabled;
      
      // キャッシュに保存
      this.cache.set(cacheKey, {
        value: result,
        expiry: Date.now() + this.cacheTimeout
      });

      return result;
    } catch (error) {
      console.error(`Feature flag evaluation failed for ${flagKey}:`, error);
      
      // フェイルセーフ: デフォルト値を返す
      return this.getDefaultValue(flagKey, context);
    }
  }

  /**
   * フィーチャーフラグのバリアントを取得
   */
  async getVariant(flagKey: string, context: FeatureFlagContext): Promise<string | null> {
    const cacheKey = `variant:${flagKey}:${context.tenantId}:${context.userId}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const response = await this.apiClient.post('/evaluate', {
        tenantId: context.tenantId,
        flagKey,
        environment: context.environment,
        userId: context.userId,
        userRole: context.userRole,
        plan: context.plan,
        metadata: context.metadata
      });

      const result = response.data.variant || null;
      
      this.cache.set(cacheKey, {
        value: result,
        expiry: Date.now() + this.cacheTimeout
      });

      return result;
    } catch (error) {
      console.error(`Feature flag variant evaluation failed for ${flagKey}:`, error);
      return null;
    }
  }

  /**
   * すべてのフィーチャーフラグを取得
   */
  async getAllFlags(context: FeatureFlagContext): Promise<Record<string, boolean>> {
    const cacheKey = `all:${context.tenantId}:${context.userId}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const response = await this.apiClient.post('/evaluate-all', {
        tenantId: context.tenantId,
        environment: context.environment,
        userId: context.userId,
        userRole: context.userRole,
        plan: context.plan,
        metadata: context.metadata
      });

      const result = response.data.flags || {};
      
      this.cache.set(cacheKey, {
        value: result,
        expiry: Date.now() + this.cacheTimeout
      });

      return result;
    } catch (error) {
      console.error('All feature flags evaluation failed:', error);
      return {};
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 特定のフラグのキャッシュをクリア
   */
  clearCacheForFlag(flagKey: string, tenantId?: string): void {
    if (tenantId) {
      // 特定のテナントのフラグのみクリア
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(`${flagKey}:${tenantId}:`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // すべてのテナントの該当フラグをクリア
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith(`${flagKey}:`)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * デフォルト値を取得（フェイルセーフ）
   */
  private getDefaultValue(flagKey: string, context: FeatureFlagContext): boolean {
    // プラン情報がある場合のプランベースのデフォルト値
    const planDefaults = {
      enterprise: true,
      standard: false,
      basic: false
    };

    // フラグ固有のデフォルト値（プラン情報がない場合にも対応）
    const flagDefaults: Record<string, boolean> = {
      'new_dashboard_v2': false,
      'mobile_app_enabled': true,
      'dark_mode_theme': false,
      'overtime_calculation_v2': false,
      'advanced_leave_management': context.plan === 'enterprise',
      'biometric_authentication': context.plan === 'enterprise',
      'gps_location_tracking': context.plan === 'enterprise',
      'slack_integration': context.plan ? context.plan !== 'basic' : false,
      'teams_integration': context.plan === 'enterprise',
      'api_v2_enabled': context.plan === 'enterprise',
      'webhook_notifications': context.plan === 'enterprise',
      'advanced_analytics': context.plan === 'enterprise',
      'custom_reports': context.plan ? context.plan !== 'basic' : false,
      'real_time_monitoring': context.plan === 'enterprise',
      'maintenance_mode': false,
      'emergency_override': false
    };

    // フラグ固有のデフォルトがあればそれを使用、なければプランベースのデフォルト、最後は安全側のfalse
    return flagDefaults[flagKey] ?? 
           (context.plan ? planDefaults[context.plan as keyof typeof planDefaults] : false) ?? 
           false;
  }

  /**
   * フィーチャーフラグの評価メトリクスを送信
   */
  async trackEvaluation(flagKey: string, context: FeatureFlagContext, result: boolean): Promise<void> {
    try {
      await this.apiClient.post('/metrics/flag-evaluation', {
        flagKey,
        tenantId: context.tenantId,
        userId: context.userId,
        result,
        timestamp: new Date().toISOString(),
        environment: context.environment,
        userRole: context.userRole,
        plan: context.plan
      });
    } catch (error) {
      // メトリクス送信失敗は無視（メイン機能に影響しないため）
      console.debug('Failed to track flag evaluation:', error);
    }
  }
}

/**
 * フィーチャーフラグクライアントのシングルトンインスタンス
 */
export const featureFlagClient = new AttendanceFeatureFlagClient();

/**
 * フィーチャーフラグクライアントの設定
 */
export interface FeatureFlagConfig {
  baseURL?: string;
  timeout?: number;
  cacheTimeout?: number;
}

/**
 * フィーチャーフラグクライアントを設定
 */
export function configureFeatureFlagClient(config: FeatureFlagConfig): AttendanceFeatureFlagClient {
  return new AttendanceFeatureFlagClient(config.baseURL, config.timeout);
}

/**
 * フィーチャーフラグの評価とメトリクス送信を行うヘルパー関数
 */
export async function evaluateFeatureFlag(
  flagKey: string,
  context: FeatureFlagContext,
  trackMetrics: boolean = true
): Promise<boolean> {
  const result = await featureFlagClient.isEnabled(flagKey, context);
  
  if (trackMetrics) {
    await featureFlagClient.trackEvaluation(flagKey, context, result);
  }
  
  return result;
}