import { FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '../models';
import { ErrorHandlingOptions } from '../types/error-handling';
import { Environment } from '../models';
export interface DynamoDbClientConfig extends ErrorHandlingOptions {
    environment: Environment;
    region?: string;
    tableName?: string;
    endpoint?: string;
}
export declare class DynamoDbClient {
    private dynamoDb;
    private tableName;
    private environment;
    private errorHandler;
    constructor(config: DynamoDbClientConfig);
    /**
     * 構造化エラーハンドリング用のヘルパーメソッド
     * AWS SDK v3 特定エラー型を活用し、運用者向けメッセージを生成
     */
    private handleError;
    getFlag(flagKey: string): Promise<FeatureFlagsTable | null>;
    getTenantOverride(tenantId: string, flagKey: string): Promise<TenantOverridesTable | null>;
    getKillSwitch(flagKey?: string): Promise<EmergencyControlTable | null>;
    createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK' | 'environment'>): Promise<void>;
    updateFlag(flagKey: string, updates: Partial<FeatureFlagsTable>): Promise<void>;
    setTenantOverride(tenantId: string, flagKey: string, enabled: boolean, updatedBy: string): Promise<void>;
    setKillSwitch(flagKey: string | null, enabled: boolean, reason: string, activatedBy: string): Promise<void>;
    listFlags(): Promise<FeatureFlagsTable[]>;
    listFlagsByOwner(owner: string): Promise<FeatureFlagsTable[]>;
    listFlagsWithScan(): Promise<FeatureFlagsTable[]>;
    listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]>;
    batchGetFlags(flagKeys: string[]): Promise<FeatureFlagsTable[]>;
    healthCheck(): Promise<boolean>;
}
