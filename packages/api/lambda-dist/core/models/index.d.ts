export interface FeatureFlagsTable {
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
}
export interface TenantOverridesTable {
    PK: string;
    SK: string;
    enabled: boolean;
    environment: Environment;
    updatedAt: string;
    updatedBy: string;
    GSI1PK: string;
    GSI1SK: string;
}
export interface EmergencyControlTable {
    PK: string;
    SK: string;
    enabled: boolean;
    environment: Environment;
    reason: string;
    activatedAt: string;
    activatedBy: string;
}
export declare const FEATURE_FLAGS: {
    readonly BILLING_V2: "billing_v2_enable";
    readonly NEW_DASHBOARD: "new_dashboard_enable";
    readonly ADVANCED_ANALYTICS: "advanced_analytics_enable";
    readonly REAL_TIME_NOTIFICATIONS: "real_time_notifications_enable";
    readonly ENHANCED_SECURITY: "enhanced_security_enable";
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
    tenantId: string;
    userId?: string;
    userRole?: string;
    plan?: string;
    environment?: Environment;
    metadata?: Record<string, any>;
}
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
