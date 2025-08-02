import { FeatureFlagKey, FeatureFlagContext } from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';
export interface FeatureFlagEvaluatorOptions {
  cache?: FeatureFlagCache;
  dynamoDbClient?: DynamoDbClient;
  dynamoConfig?: DynamoDbClientConfig;
  useMock?: boolean;
}
export declare class FeatureFlagEvaluator {
  private cache;
  private dynamoDbClient;
  constructor(options?: FeatureFlagEvaluatorOptions);
  isEnabled(context: FeatureFlagContext, flagKey: FeatureFlagKey): Promise<boolean>;
  private checkKillSwitch;
  private getTenantOverride;
  private getDefaultValue;
  private getFallbackValue;
  invalidateCache(tenantId: string, flagKey: FeatureFlagKey): Promise<void>;
  invalidateAllCache(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map
