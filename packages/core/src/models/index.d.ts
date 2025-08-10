export interface FeatureFlagsTable {
<<<<<<< Updated upstream
  PK: string;
  SK: string;
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
  expiresAt?: string;
  GSI1PK?: string;
  GSI1SK?: string;
||||||| Stash base
    PK: string;
    SK: string;
    flagKey: string;
    description: string;
    defaultEnabled: boolean;
    owner: string;
    createdAt: string;
    expiresAt?: string;
    GSI1PK?: string;
    GSI1SK?: string;
=======
    PK: string;
    SK: string;
    flagKey: string;
    description: string;
    defaultEnabled: boolean;
    owner: string;
    environment: Environment;
    createdAt: string;
    expiresAt?: string;
    GSI1PK?: string;
    GSI1SK?: string;
    GSI2PK?: string;
    GSI2SK?: string;
    GSI3PK?: string;
    GSI3SK?: string;
    GSI4PK?: string;
    GSI4SK?: string;
>>>>>>> Stashed changes
}
export interface TenantOverridesTable {
<<<<<<< Updated upstream
  PK: string;
  SK: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  GSI1PK: string;
  GSI1SK: string;
||||||| Stash base
    PK: string;
    SK: string;
    enabled: boolean;
    updatedAt: string;
    updatedBy: string;
    GSI1PK: string;
    GSI1SK: string;
=======
    PK: string;
    SK: string;
    enabled: boolean;
    environment: Environment;
    updatedAt: string;
    updatedBy: string;
    GSI1PK: string;
    GSI1SK: string;
>>>>>>> Stashed changes
}
export interface EmergencyControlTable {
<<<<<<< Updated upstream
  PK: string;
  SK: string;
  enabled: boolean;
  reason: string;
  activatedAt: string;
  activatedBy: string;
||||||| Stash base
    PK: string;
    SK: string;
    enabled: boolean;
    reason: string;
    activatedAt: string;
    activatedBy: string;
=======
    PK: string;
    SK: string;
    enabled: boolean;
    environment: Environment;
    reason: string;
    activatedAt: string;
    activatedBy: string;
>>>>>>> Stashed changes
}
export declare const FEATURE_FLAGS: {
  readonly BILLING_V2: 'billing_v2_enable';
  readonly NEW_DASHBOARD: 'new_dashboard_enable';
  readonly ADVANCED_ANALYTICS: 'advanced_analytics_enable';
  readonly REAL_TIME_NOTIFICATIONS: 'real_time_notifications_enable';
  readonly ENHANCED_SECURITY: 'enhanced_security_enable';
};
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
export type Environment = 'development' | 'staging' | 'production';
export declare const ENVIRONMENTS: {
    readonly DEVELOPMENT: "development";
    readonly STAGING: "staging";
    readonly PRODUCTION: "production";
};
export interface FeatureFlagContext {
<<<<<<< Updated upstream
  tenantId: string;
  userId?: string;
  environment?: string;
  metadata?: Record<string, any>;
||||||| Stash base
    tenantId: string;
    userId?: string;
    environment?: string;
    metadata?: Record<string, any>;
=======
    tenantId: string;
    userId?: string;
    userRole?: string;
    plan?: string;
    environment?: Environment;
    metadata?: Record<string, any>;
>>>>>>> Stashed changes
}
<<<<<<< Updated upstream
//# sourceMappingURL=index.d.ts.map
||||||| Stash base
//# sourceMappingURL=index.d.ts.map
=======
export interface EnvironmentConfig {
    environment: Environment;
    tableName: string;
    region: string;
    endpoint?: string;
    features?: {
        cacheEnabled: boolean;
        debugLogging: boolean;
        metricsEnabled: boolean;
    };
}
//# sourceMappingURL=index.d.ts.map
>>>>>>> Stashed changes
