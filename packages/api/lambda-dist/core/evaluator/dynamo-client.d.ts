import { FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '../models';
export interface DynamoDbClientConfig {
    region?: string;
    tableName: string;
    endpoint?: string;
}
export declare class DynamoDbClient {
    private dynamoDb;
    private tableName;
    constructor(config: DynamoDbClientConfig);
    getFlag(flagKey: string): Promise<FeatureFlagsTable | null>;
    getTenantOverride(tenantId: string, flagKey: string): Promise<TenantOverridesTable | null>;
    getKillSwitch(flagKey?: string): Promise<EmergencyControlTable | null>;
    createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK'>): Promise<void>;
    updateFlag(flagKey: string, updates: Partial<FeatureFlagsTable>): Promise<void>;
    setTenantOverride(tenantId: string, flagKey: string, enabled: boolean, updatedBy: string): Promise<void>;
    setKillSwitch(flagKey: string | null, enabled: boolean, reason: string, activatedBy: string): Promise<void>;
    listFlags(): Promise<FeatureFlagsTable[]>;
    listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]>;
    batchGetFlags(flagKeys: string[]): Promise<FeatureFlagsTable[]>;
    healthCheck(): Promise<boolean>;
}
