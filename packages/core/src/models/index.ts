export interface FeatureFlagsTable {
  PK: string; // "FLAG#${flagKey}"
  SK: string; // "METADATA"
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
  expiresAt?: string;
  
  // GSI1: 有効期限でのクエリ用
  GSI1PK?: string; // "EXPIRES"
  GSI1SK?: string; // expiresAt
}

export interface TenantOverridesTable {
  PK: string; // "TENANT#${tenantId}"
  SK: string; // "FLAG#${flagKey}"
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  
  // GSI1: フラグ別のテナント一覧用
  GSI1PK: string; // "FLAG#${flagKey}"
  GSI1SK: string; // "TENANT#${tenantId}"
}

export interface EmergencyControlTable {
  PK: string; // "EMERGENCY"
  SK: string; // "GLOBAL" or "FLAG#${flagKey}"
  enabled: boolean;
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

export interface FeatureFlagContext {
  tenantId: string;
  userId?: string;        // オプショナル: ユーザー固有の評価が不要な場合
  userRole?: string;      // オプショナル: 権限ベースの制御が不要な場合
  plan?: string;          // オプショナル: プラン情報が利用できない場合
  environment?: 'development' | 'staging' | 'production'; // オプショナル
  metadata?: Record<string, any>;
}