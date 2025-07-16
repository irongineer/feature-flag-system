import { FeatureFlagKey, FeatureFlagContext } from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';
export interface FeatureFlagEvaluatorOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient?: DynamoDbClient;
    dynamoConfig?: DynamoDbClientConfig;
    useMock?: boolean;
}
export interface FeatureFlagEvaluatorConfig {
    cache?: FeatureFlagCache;
    dynamoDbClient: DynamoDbClient;
}
export declare class FeatureFlagEvaluator {
    private cache;
    private dynamoDbClient;
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
}
