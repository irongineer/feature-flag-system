<<<<<<< Updated upstream
import {
  FeatureFlagKey,
  FeatureFlagsTable,
  TenantOverridesTable,
  EmergencyControlTable,
} from '../models';
export interface DynamoDbClientConfig {
  region?: string;
  tableName: string;
  endpoint?: string;
||||||| Stash base
import { FeatureFlagKey, FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '../models';
export interface DynamoDbClientConfig {
    region?: string;
    tableName: string;
    endpoint?: string;
=======
import { FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '../models';
import { ErrorHandlingOptions } from '../types/error-handling';
import { Environment } from '../models';
export interface DynamoDbClientConfig extends ErrorHandlingOptions {
    environment: Environment;
    region?: string;
    tableName?: string;
    endpoint?: string;
>>>>>>> Stashed changes
}
export declare class DynamoDbClient {
<<<<<<< Updated upstream
  private dynamoDb;
  private tableName;
  constructor(config: DynamoDbClientConfig);
  getFlag(flagKey: FeatureFlagKey): Promise<FeatureFlagsTable | null>;
  getTenantOverride(
    tenantId: string,
    flagKey: FeatureFlagKey
  ): Promise<TenantOverridesTable | null>;
  getKillSwitch(flagKey?: FeatureFlagKey): Promise<EmergencyControlTable | null>;
  createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK'>): Promise<void>;
  updateFlag(flagKey: FeatureFlagKey, updates: Partial<FeatureFlagsTable>): Promise<void>;
  setTenantOverride(
    tenantId: string,
    flagKey: FeatureFlagKey,
    enabled: boolean,
    updatedBy: string
  ): Promise<void>;
  setKillSwitch(
    flagKey: FeatureFlagKey | null,
    enabled: boolean,
    reason: string,
    activatedBy: string
  ): Promise<void>;
  listFlags(): Promise<FeatureFlagsTable[]>;
  listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]>;
  batchGetFlags(flagKeys: FeatureFlagKey[]): Promise<FeatureFlagsTable[]>;
  healthCheck(): Promise<boolean>;
||||||| Stash base
    private dynamoDb;
    private tableName;
    constructor(config: DynamoDbClientConfig);
    getFlag(flagKey: FeatureFlagKey): Promise<FeatureFlagsTable | null>;
    getTenantOverride(tenantId: string, flagKey: FeatureFlagKey): Promise<TenantOverridesTable | null>;
    getKillSwitch(flagKey?: FeatureFlagKey): Promise<EmergencyControlTable | null>;
    createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK'>): Promise<void>;
    updateFlag(flagKey: FeatureFlagKey, updates: Partial<FeatureFlagsTable>): Promise<void>;
    setTenantOverride(tenantId: string, flagKey: FeatureFlagKey, enabled: boolean, updatedBy: string): Promise<void>;
    setKillSwitch(flagKey: FeatureFlagKey | null, enabled: boolean, reason: string, activatedBy: string): Promise<void>;
    listFlags(): Promise<FeatureFlagsTable[]>;
    listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]>;
    batchGetFlags(flagKeys: FeatureFlagKey[]): Promise<FeatureFlagsTable[]>;
    healthCheck(): Promise<boolean>;
=======
    private dynamoDb;
    private tableName;
    private environment;
    private errorHandler;
    constructor(config: DynamoDbClientConfig);
    /**
     * 構造化エラーハンドリング用のヘルパーメソッド
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
>>>>>>> Stashed changes
}
//# sourceMappingURL=dynamo-client.d.ts.map
