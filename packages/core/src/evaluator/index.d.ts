import { FeatureFlagKey, FeatureFlagContext, Environment } from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';
<<<<<<< Updated upstream
export interface FeatureFlagEvaluatorOptions {
  cache?: FeatureFlagCache;
  dynamoDbClient?: DynamoDbClient;
  dynamoConfig?: DynamoDbClientConfig;
  useMock?: boolean;
||||||| Stash base
export interface FeatureFlagEvaluatorOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient?: DynamoDbClient;
    dynamoConfig?: DynamoDbClientConfig;
    useMock?: boolean;
=======
import { ErrorHandlingOptions } from '../types/error-handling';
export interface FeatureFlagEvaluatorOptions extends ErrorHandlingOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient?: DynamoDbClient;
    dynamoConfig?: DynamoDbClientConfig;
    environment?: Environment;
    useMock?: boolean;
>>>>>>> Stashed changes
}
export interface FeatureFlagEvaluatorConfig extends ErrorHandlingOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient: DynamoDbClient;
    environment?: Environment;
}
export declare class FeatureFlagEvaluator {
<<<<<<< Updated upstream
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
||||||| Stash base
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
=======
    private cache;
    private dynamoDbClient;
    private errorHandler;
    private environment;
    constructor(options: FeatureFlagEvaluatorOptions);
    constructor(config: FeatureFlagEvaluatorConfig);
    isEnabled(context: FeatureFlagContext, flagKey: FeatureFlagKey): Promise<boolean>;
    isEnabled(tenantId: string, flagKey: string): Promise<boolean>;
    private checkKillSwitch;
    private getTenantOverride;
    private getDefaultValue;
    private getFallbackValue;
    invalidateCache(tenantId: string, flagKey: FeatureFlagKey | string): Promise<void>;
    invalidateAllCache(): Promise<void>;
>>>>>>> Stashed changes
}
//# sourceMappingURL=index.d.ts.map
