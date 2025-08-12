"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagEvaluator = void 0;
const models_1 = require("../models");
const cache_1 = require("../cache");
const dynamo_client_1 = require("./dynamo-client");
const dynamo_keys_1 = require("../constants/dynamo-keys");
const error_handling_1 = require("../types/error-handling");
const environment_1 = require("../config/environment");
const rollout_1 = require("../rollout");
class FeatureFlagEvaluator {
    cache;
    dynamoDbClient;
    errorHandler;
    environment;
    rolloutEngine;
    constructor(optionsOrConfig = {}) {
        this.cache = optionsOrConfig.cache || new cache_1.FeatureFlagCache();
        this.errorHandler = optionsOrConfig.errorHandler || error_handling_1.defaultErrorHandler;
        this.environment = optionsOrConfig.environment || (0, environment_1.getCurrentEnvironment)();
        this.rolloutEngine = optionsOrConfig.rolloutEngine || new rollout_1.RolloutEngine();
        (0, environment_1.debugLog)(this.environment, 'FeatureFlagEvaluator initialized', {
            environment: this.environment,
        });
        // 新しい形式（FeatureFlagEvaluatorConfig）の場合
        if ('dynamoDbClient' in optionsOrConfig && optionsOrConfig.dynamoDbClient) {
            this.dynamoDbClient = optionsOrConfig.dynamoDbClient;
        }
        // 既存形式（FeatureFlagEvaluatorOptions）の場合
        else {
            const options = optionsOrConfig;
            if (options.dynamoDbClient) {
                this.dynamoDbClient = options.dynamoDbClient;
            }
            else if (options.dynamoConfig) {
                // 環境情報をDynamoDbClientに渡す
                const configWithEnv = { ...options.dynamoConfig, environment: this.environment };
                this.dynamoDbClient = new dynamo_client_1.DynamoDbClient(configWithEnv);
            }
            else {
                // デフォルト: モック実装
                this.dynamoDbClient = new MockDynamoDbClient(this.environment);
            }
        }
    }
    async isEnabled(contextOrTenantId, flagKey) {
        // パラメータの正規化と環境情報の取得
        let tenantId;
        let environment;
        if (typeof contextOrTenantId === 'string') {
            tenantId = contextOrTenantId;
            environment = this.environment; // デフォルト環境
        }
        else {
            tenantId = contextOrTenantId.tenantId;
            environment = contextOrTenantId.environment || this.environment;
        }
        const normalizedFlagKey = flagKey;
        // 環境が一致しない場合はエラー（try-catchの外で検証）
        if (environment !== this.environment) {
            throw new Error(`Environment mismatch: evaluator is configured for ${this.environment}, but context specifies ${environment}`);
        }
        (0, environment_1.debugLog)(environment, `Evaluating flag: ${normalizedFlagKey}`, { tenantId, environment });
        try {
            // 1. Kill-Switch チェック
            if (await this.checkKillSwitch(normalizedFlagKey)) {
                (0, environment_1.debugLog)(environment, `Kill-switch activated for flag: ${normalizedFlagKey}`);
                return false;
            }
            // 2. キャッシュチェック
            const cached = this.cache.get(tenantId, normalizedFlagKey);
            if (cached !== undefined) {
                (0, environment_1.debugLog)(environment, `Cache hit for flag: ${normalizedFlagKey}`, { value: cached });
                return cached;
            }
            // 3. テナント別オーバーライドチェック
            const tenantOverride = await this.getTenantOverride(tenantId, normalizedFlagKey);
            if (tenantOverride !== undefined) {
                this.cache.set(tenantId, normalizedFlagKey, tenantOverride);
                (0, environment_1.debugLog)(environment, `Tenant override found for flag: ${normalizedFlagKey}`, {
                    value: tenantOverride,
                });
                return tenantOverride;
            }
            // 4. デフォルト値取得
            const defaultValue = await this.getDefaultValue(normalizedFlagKey);
            this.cache.set(tenantId, normalizedFlagKey, defaultValue);
            (0, environment_1.debugLog)(environment, `Default value used for flag: ${normalizedFlagKey}`, {
                value: defaultValue,
            });
            return defaultValue;
        }
        catch (error) {
            const errorInfo = {
                operation: 'feature-flag-evaluation',
                tenantId: typeof contextOrTenantId === 'string' ? contextOrTenantId : contextOrTenantId.tenantId,
                flagKey: flagKey,
                environment: typeof contextOrTenantId === 'string'
                    ? this.environment
                    : contextOrTenantId.environment || this.environment,
                error: error,
                timestamp: new Date().toISOString(),
            };
            this.errorHandler(errorInfo);
            return this.getFallbackValue(flagKey);
        }
    }
    async checkKillSwitch(flagKey) {
        try {
            // グローバル Kill-Switch チェック
            const globalKillSwitch = await this.dynamoDbClient.getKillSwitch();
            if (globalKillSwitch && globalKillSwitch.enabled) {
                return true;
            }
            // 特定フラグの Kill-Switch チェック
            const flagKillSwitch = await this.dynamoDbClient.getKillSwitch(flagKey);
            return flagKillSwitch && flagKillSwitch.enabled;
        }
        catch (error) {
            this.errorHandler(`Kill-switch check failed: ${error.message}`);
            return false;
        }
    }
    async getTenantOverride(tenantId, flagKey) {
        try {
            const result = await this.dynamoDbClient.getTenantOverride(tenantId, flagKey);
            return result ? result.enabled : undefined;
        }
        catch (error) {
            const errorInfo = {
                operation: 'tenant-override-check',
                tenantId,
                flagKey,
                error: error,
                timestamp: new Date().toISOString(),
            };
            this.errorHandler(errorInfo);
            return undefined;
        }
    }
    async getDefaultValue(flagKey) {
        try {
            const result = await this.dynamoDbClient.getFlag(flagKey);
            return result ? result.defaultEnabled : false;
        }
        catch (error) {
            const errorInfo = {
                operation: 'default-value-check',
                flagKey,
                error: error,
                timestamp: new Date().toISOString(),
            };
            this.errorHandler(errorInfo);
            return this.getFallbackValue(flagKey);
        }
    }
    getFallbackValue(flagKey) {
        // フォールバック値（通常は false で安全側に倒す）
        return false;
    }
    async invalidateCache(tenantId, flagKey) {
        this.cache.invalidate(tenantId, flagKey);
    }
    async invalidateAllCache() {
        this.cache.invalidateAll();
    }
    /**
     * 段階的ロールアウト対応のフラグ評価
     *
     * @param context ロールアウト対応のコンテキスト
     * @param flagKey フラグキー
     * @param rolloutConfig ロールアウト設定（オプショナル）
     * @returns フラグの有効性
     */
    async isEnabledWithRollout(context, flagKey, rolloutConfig) {
        // 環境が一致しない場合はエラー
        const environment = context.environment || this.environment;
        if (environment !== this.environment) {
            throw new Error(`Environment mismatch: evaluator is configured for ${this.environment}, but context specifies ${environment}`);
        }
        (0, environment_1.debugLog)(environment, 'Evaluating flag with rollout', {
            tenantId: context.tenantId,
            flagKey,
            hasRolloutConfig: !!rolloutConfig,
        });
        try {
            // 1. Kill-Switch チェック（ロールアウトより優先）
            if (await this.checkKillSwitch(flagKey)) {
                (0, environment_1.debugLog)(environment, `Kill-switch activated for flag: ${flagKey}`);
                return false;
            }
            // 2. キャッシュチェック（ロールアウト設定がない場合のみ）
            if (!rolloutConfig) {
                const cached = this.cache.get(context.tenantId, flagKey);
                if (cached !== undefined) {
                    (0, environment_1.debugLog)(environment, `Cache hit for flag: ${flagKey}`, { value: cached });
                    return cached;
                }
            }
            // 3. テナント別オーバーライドチェック
            const tenantOverride = await this.getTenantOverride(context.tenantId, flagKey);
            if (tenantOverride !== undefined) {
                // ロールアウト設定がある場合の優先順位を明確化
                if (rolloutConfig && tenantOverride !== undefined) {
                    // 仕様: テナントオーバーライドが無効(false)の場合は常にfalseを返す
                    // テナントオーバーライドが有効(true)の場合のみロールアウト判定を適用
                    if (!tenantOverride) {
                        (0, environment_1.debugLog)(environment, `Tenant override disabled for flag: ${flagKey}`, {
                            tenantOverride,
                            finalResult: false,
                        });
                        return false;
                    }
                    // テナントオーバーライドが有効な場合、ロールアウト制御を適用
                    const rolloutResult = await this.rolloutEngine.evaluateRollout(context, flagKey, rolloutConfig);
                    (0, environment_1.debugLog)(environment, `Tenant override with rollout for flag: ${flagKey}`, {
                        tenantOverride,
                        rolloutResult,
                        finalResult: rolloutResult,
                    });
                    return rolloutResult;
                }
                else {
                    // ロールアウト設定がない場合は通常通り
                    if (!rolloutConfig) {
                        this.cache.set(context.tenantId, flagKey, tenantOverride);
                    }
                    (0, environment_1.debugLog)(environment, `Tenant override found for flag: ${flagKey}`, {
                        value: tenantOverride,
                    });
                    return tenantOverride;
                }
            }
            // 4. デフォルト値取得
            const defaultValue = await this.getDefaultValue(flagKey);
            // 5. ロールアウト判定（デフォルト値が有効な場合のみ）
            if (rolloutConfig && defaultValue) {
                const rolloutResult = await this.rolloutEngine.evaluateRollout(context, flagKey, rolloutConfig);
                const finalResult = defaultValue && rolloutResult;
                (0, environment_1.debugLog)(environment, `Default value with rollout for flag: ${flagKey}`, {
                    defaultValue,
                    rolloutResult,
                    finalResult,
                });
                return finalResult;
            }
            else {
                // ロールアウト設定がない場合は通常通り
                if (!rolloutConfig) {
                    this.cache.set(context.tenantId, flagKey, defaultValue);
                }
                (0, environment_1.debugLog)(environment, `Default value used for flag: ${flagKey}`, { value: defaultValue });
                return defaultValue;
            }
        }
        catch (error) {
            const errorInfo = {
                operation: 'feature-flag-evaluation-with-rollout',
                tenantId: context.tenantId,
                flagKey,
                environment,
                error: error,
                timestamp: new Date().toISOString(),
                rolloutConfig: rolloutConfig ? 'enabled' : 'disabled',
            };
            this.errorHandler(errorInfo);
            return this.getFallbackValue(flagKey);
        }
    }
}
exports.FeatureFlagEvaluator = FeatureFlagEvaluator;
// モック実装（ローカル開発用）
class MockDynamoDbClient {
    data;
    environment;
    constructor(environment = models_1.ENVIRONMENTS.DEVELOPMENT) {
        this.environment = environment;
        this.data = new Map();
        this.seedData();
    }
    async getFlag(flagKey) {
        const key = dynamo_keys_1.DynamoKeyBuilder.flagMetadata(flagKey);
        const item = this.data.get(key);
        // 環境が一致するものを返す
        if (item && item.PK.includes(`#${this.environment}#`)) {
            return item;
        }
        return null;
    }
    async getTenantOverride(tenantId, flagKey) {
        const key = dynamo_keys_1.DynamoKeyBuilder.tenantFlag(tenantId, flagKey);
        const item = this.data.get(key);
        // 環境が一致するものを返す
        if (item && item.PK.includes(`#${this.environment}#`)) {
            return item;
        }
        return null;
    }
    async getKillSwitch(flagKey) {
        const key = dynamo_keys_1.DynamoKeyBuilder.emergencyKey(flagKey);
        const item = this.data.get(key);
        // 環境が一致するものを返す
        if (item && item.PK.includes(`#${this.environment}`)) {
            return item;
        }
        return null;
    }
    async setKillSwitch(flagKey, enabled, reason, activatedBy) {
        const key = dynamo_keys_1.DynamoKeyBuilder.emergencyKey(flagKey || undefined);
        const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
        this.data.set(key, {
            PK: `EMERGENCY#${this.environment}`,
            SK: sk,
            enabled,
            environment: this.environment,
            reason,
            activatedAt: new Date().toISOString(),
            activatedBy,
        });
    }
    async get(params) {
        const key = dynamo_keys_1.DynamoKeyBuilder.compositeKey(params.Key.PK, params.Key.SK);
        return this.data.get(key);
    }
    async put(params) {
        const key = dynamo_keys_1.DynamoKeyBuilder.compositeKey(params.Item.PK, params.Item.SK);
        this.data.set(key, params.Item);
    }
    seedData() {
        // デフォルトフラグ設定（環境分離対応）
        Object.values(models_1.FEATURE_FLAGS).forEach(flagKey => {
            const key = dynamo_keys_1.DynamoKeyBuilder.flagMetadata(flagKey);
            this.data.set(key, {
                PK: `FLAG#${this.environment}#${flagKey}`,
                SK: 'METADATA',
                flagKey,
                description: `Feature flag for ${flagKey} in ${this.environment}`,
                defaultEnabled: false,
                owner: 'system',
                environment: this.environment,
                createdAt: new Date().toISOString(),
            });
        });
        // テスト用のテナントオーバーライド（環境分離対応）
        const tenantOverrideKey = dynamo_keys_1.DynamoKeyBuilder.tenantFlag('test-tenant-1', 'billing_v2_enable');
        this.data.set(tenantOverrideKey, {
            PK: `TENANT#${this.environment}#test-tenant-1`,
            SK: 'FLAG#billing_v2_enable',
            enabled: true,
            environment: this.environment,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin',
        });
    }
}
//# sourceMappingURL=index.js.map