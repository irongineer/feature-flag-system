export interface FeatureFlagsTable {
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
}
export interface TenantOverridesTable {
    PK: string;
    SK: string;
    enabled: boolean;
    updatedAt: string;
    updatedBy: string;
    GSI1PK: string;
    GSI1SK: string;
}
export interface EmergencyControlTable {
    PK: string;
    SK: string;
    enabled: boolean;
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
export interface FeatureFlagContext {
    tenantId: string;
    userId?: string;
    environment?: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=index.d.ts.map