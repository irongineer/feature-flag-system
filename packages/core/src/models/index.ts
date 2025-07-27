export interface FeatureFlagsTable {
  PK: string; // "FLAG#{environment}#{flagKey}"
  SK: string; // "METADATA"
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  environment: Environment; // 環境情報を明示的に保存
  createdAt: string;
  expiresAt?: string;
  
  // GSI1: 有効期限でのクエリ用
  GSI1PK?: string; // "EXPIRES#{environment}"
  GSI1SK?: string; // expiresAt
  
  // GSI2: オーナー別フラグ一覧用
  GSI2PK?: string; // "OWNER#{environment}#{owner}"
  GSI2SK?: string; // "FLAG#{flagKey}"
  
  // GSI3: 全フラグ一覧効率化用 (Scan代替)
  GSI3PK?: string; // "FLAGS#{environment}"
  GSI3SK?: string; // "METADATA#{createdAt}"
  
  // GSI4: 環境横断フラグ一覧用
  GSI4PK?: string; // "GLOBAL_FLAG#{flagKey}"
  GSI4SK?: string; // "ENV#{environment}"
}

export interface TenantOverridesTable {
  PK: string; // "TENANT#{environment}#{tenantId}"
  SK: string; // "FLAG#{flagKey}"
  enabled: boolean;
  environment: Environment; // 環境情報を明示的に保存
  updatedAt: string;
  updatedBy: string;
  
  // GSI1: フラグ別のテナント一覧用
  GSI1PK: string; // "FLAG#{environment}#{flagKey}"
  GSI1SK: string; // "TENANT#{tenantId}"
}

export interface EmergencyControlTable {
  PK: string; // "EMERGENCY#{environment}"
  SK: string; // "GLOBAL" or "FLAG#{flagKey}"
  enabled: boolean;
  environment: Environment; // 環境情報を明示的に保存
  reason: string;
  activatedAt: string;
  activatedBy: string;
}

export const FEATURE_FLAGS = {
  BILLING_V2: 'billing_v2_enable',
  NEW_DASHBOARD: 'new_dashboard_enable',
  ADVANCED_ANALYTICS: 'advanced_analytics_enable',
  REAL_TIME_NOTIFICATIONS: 'real_time_notifications_enable',
  ENHANCED_SECURITY: 'enhanced_security_enable',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export interface FeatureFlagConfig {
  key: FeatureFlagKey;
  description: string;
  defaultEnabled: boolean;
  owner: string;
}

export interface CacheEntry {
  value: boolean;
  timestamp: number;
  ttl: number;
}

// 環境定義の強化
export type Environment = 'development' | 'staging' | 'production';

export const ENVIRONMENTS = {
  DEVELOPMENT: 'development' as const,
  STAGING: 'staging' as const,
  PRODUCTION: 'production' as const,
} as const;

export interface FeatureFlagContext {
  tenantId: string;
  userId?: string;        // オプショナル: ユーザー固有の評価が不要な場合
  userRole?: string;      // オプショナル: 権限ベースの制御が不要な場合
  plan?: string;          // オプショナル: プラン情報が利用できない場合
  environment: Environment; // 必須: マルチ環境サポートで必須化
  metadata?: Record<string, any>;
}

// 環境固有設定インターフェース
export interface EnvironmentConfig {
  environment: Environment;
  tableName: string;
  region: string;
  endpoint?: string; // ローカル開発用
  features?: {
    cacheEnabled: boolean;
    debugLogging: boolean;
    metricsEnabled: boolean;
  };
}