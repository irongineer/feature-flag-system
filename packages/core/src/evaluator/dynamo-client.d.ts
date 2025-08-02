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
}
export declare class DynamoDbClient {
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
}
//# sourceMappingURL=dynamo-client.d.ts.map
