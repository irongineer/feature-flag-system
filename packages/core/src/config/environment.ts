/**
 * Multi-Environment Configuration Management
 *
 * マルチ環境サポートのための設定管理
 */

import { Environment, EnvironmentConfig, ENVIRONMENTS } from '../models';

// デフォルト環境設定
const DEFAULT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  [ENVIRONMENTS.DEVELOPMENT]: {
    environment: ENVIRONMENTS.DEVELOPMENT,
    tableName: 'feature-flags-dev',
    region: 'ap-northeast-1',
    endpoint: 'http://localhost:8000', // DynamoDB Local
    features: {
      cacheEnabled: false, // 開発環境ではキャッシュ無効
      debugLogging: true,
      metricsEnabled: false,
    },
  },
  [ENVIRONMENTS.STAGING]: {
    environment: ENVIRONMENTS.STAGING,
    tableName: 'feature-flags-staging',
    region: 'ap-northeast-1',
    features: {
      cacheEnabled: true,
      debugLogging: true,
      metricsEnabled: true,
    },
  },
  [ENVIRONMENTS.PRODUCTION]: {
    environment: ENVIRONMENTS.PRODUCTION,
    tableName: 'feature-flags-prod',
    region: 'ap-northeast-1',
    features: {
      cacheEnabled: true,
      debugLogging: false,
      metricsEnabled: true,
    },
  },
};

/**
 * 環境固有設定を取得
 */
export function getEnvironmentConfig(environment: Environment): EnvironmentConfig {
  // 環境パラメータの検証
  if (!environment) {
    throw new Error('Environment parameter is required for getEnvironmentConfig');
  }

  // 有効な環境値かチェック
  if (!Object.values(ENVIRONMENTS).includes(environment)) {
    throw new Error(
      `Invalid environment: ${environment}. Must be one of: ${Object.values(ENVIRONMENTS).join(', ')}`
    );
  }

  const baseConfig = DEFAULT_CONFIGS[environment];
  if (!baseConfig) {
    throw new Error(`No configuration found for environment: ${environment}`);
  }

  // 環境変数による設定上書き
  const config: EnvironmentConfig = {
    ...baseConfig,
    tableName:
      process.env[`FEATURE_FLAGS_TABLE_NAME_${environment.toUpperCase()}`] || baseConfig.tableName,
    region:
      process.env[`AWS_REGION_${environment.toUpperCase()}`] ||
      process.env.AWS_REGION ||
      baseConfig.region,
    endpoint: process.env[`DYNAMODB_ENDPOINT_${environment.toUpperCase()}`] || baseConfig.endpoint,
  };

  // 開発環境での特別な設定
  if (environment === ENVIRONMENTS.DEVELOPMENT) {
    config.endpoint =
      process.env.DYNAMODB_ENDPOINT || process.env.IS_OFFLINE === 'true'
        ? 'http://localhost:8000'
        : config.endpoint;
  }

  return config;
}

/**
 * 現在の環境を判定
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment;

  // 有効な環境値かチェック
  if (env && Object.values(ENVIRONMENTS).includes(env)) {
    return env;
  }

  // フォールバック: 本番環境
  return ENVIRONMENTS.PRODUCTION;
}

/**
 * 環境別のテーブル名生成
 */
export function getTableName(environment: Environment): string {
  return getEnvironmentConfig(environment).tableName;
}

/**
 * 環境別のキープレフィックス生成
 */
export function getEnvironmentKeyPrefix(environment: Environment): string {
  return environment.toUpperCase();
}

/**
 * DynamoDBキーに環境プレフィックスを追加
 */
export function addEnvironmentToKey(baseKey: string, environment: Environment): string {
  return `${baseKey}#${environment}`;
}

/**
 * 環境設定の検証
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): boolean {
  return !!(
    config.environment &&
    config.tableName &&
    config.region &&
    Object.values(ENVIRONMENTS).includes(config.environment)
  );
}

/**
 * 環境固有のデバッグログ出力
 */
export function debugLog(environment: Environment, message: string, data?: any): void {
  const config = getEnvironmentConfig(environment);

  if (config.features?.debugLogging) {
    console.log(`[${environment.toUpperCase()}] ${message}`, data ? data : '');
  }
}

/**
 * 全環境の設定を取得（管理用）
 */
export function getAllEnvironmentConfigs(): Record<Environment, EnvironmentConfig> {
  return {
    [ENVIRONMENTS.DEVELOPMENT]: getEnvironmentConfig(ENVIRONMENTS.DEVELOPMENT),
    [ENVIRONMENTS.STAGING]: getEnvironmentConfig(ENVIRONMENTS.STAGING),
    [ENVIRONMENTS.PRODUCTION]: getEnvironmentConfig(ENVIRONMENTS.PRODUCTION),
  };
}

/**
 * 環境間でのフラグ設定同期チェック
 */
export interface EnvironmentSyncStatus {
  flagKey: string;
  environments: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
  };
  isConsistent: boolean;
  recommendations: string[];
}

/**
 * 環境固有の機能フラグ評価ポリシー
 */
export interface EnvironmentPolicy {
  environment: Environment;
  allowOverrides: boolean;
  requireApproval: boolean;
  maxCacheTtl: number;
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
}

export const ENVIRONMENT_POLICIES: Record<Environment, EnvironmentPolicy> = {
  [ENVIRONMENTS.DEVELOPMENT]: {
    environment: ENVIRONMENTS.DEVELOPMENT,
    allowOverrides: true,
    requireApproval: false,
    maxCacheTtl: 60, // 1分
    auditLevel: 'basic',
  },
  [ENVIRONMENTS.STAGING]: {
    environment: ENVIRONMENTS.STAGING,
    allowOverrides: true,
    requireApproval: true,
    maxCacheTtl: 300, // 5分
    auditLevel: 'detailed',
  },
  [ENVIRONMENTS.PRODUCTION]: {
    environment: ENVIRONMENTS.PRODUCTION,
    allowOverrides: false,
    requireApproval: true,
    maxCacheTtl: 3600, // 1時間
    auditLevel: 'comprehensive',
  },
};
