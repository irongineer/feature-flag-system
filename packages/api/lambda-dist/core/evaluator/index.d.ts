import { FeatureFlagKey, FeatureFlagContext, Environment } from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';
import { ErrorHandlingOptions } from '../types/error-handling';
import { RolloutEngine, RolloutConfig, RolloutContext } from '../rollout';
export interface FeatureFlagEvaluatorOptions extends ErrorHandlingOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient?: DynamoDbClient;
    dynamoConfig?: DynamoDbClientConfig;
    environment?: Environment;
    useMock?: boolean;
    rolloutEngine?: RolloutEngine;
}
export interface FeatureFlagEvaluatorConfig extends ErrorHandlingOptions {
    cache?: FeatureFlagCache;
    dynamoDbClient: DynamoDbClient;
    environment?: Environment;
    rolloutEngine?: RolloutEngine;
}
export declare class FeatureFlagEvaluator {
    private cache;
    private dynamoDbClient;
    private errorHandler;
    private environment;
    private rolloutEngine;
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
    /**
     * 段階的ロールアウト対応のフラグ評価
     *
     * @param context ロールアウト対応のコンテキスト
     * @param flagKey フラグキー
     * @param rolloutConfig ロールアウト設定（オプショナル）
     * @returns フラグの有効性
     */
    isEnabledWithRollout(context: RolloutContext, flagKey: FeatureFlagKey, rolloutConfig?: RolloutConfig): Promise<boolean>;
}
