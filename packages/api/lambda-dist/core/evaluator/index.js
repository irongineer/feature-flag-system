"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagEvaluator = void 0;
const models_1 = require("../models");
const cache_1 = require("../cache");
const dynamo_client_1 = require("./dynamo-client");
class FeatureFlagEvaluator {
    cache;
    dynamoDbClient;
    constructor(optionsOrConfig = {}) {
        this.cache = optionsOrConfig.cache || new cache_1.FeatureFlagCache();
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
                this.dynamoDbClient = new dynamo_client_1.DynamoDbClient(options.dynamoConfig);
            }
            else {
                // デフォルト: モック実装
                this.dynamoDbClient = new MockDynamoDbClient();
            }
        }
    }
    async isEnabled(contextOrTenantId, flagKey) {
        try {
            // パラメータの正規化
            const tenantId = typeof contextOrTenantId === 'string'
                ? contextOrTenantId
                : contextOrTenantId.tenantId;
            const normalizedFlagKey = flagKey;
            // 1. Kill-Switch チェック
            if (await this.checkKillSwitch(normalizedFlagKey)) {
                return false;
            }
            // 2. キャッシュチェック
            const cached = this.cache.get(tenantId, normalizedFlagKey);
            if (cached !== undefined) {
                return cached;
            }
            // 3. テナント別オーバーライドチェック
            const tenantOverride = await this.getTenantOverride(tenantId, normalizedFlagKey);
            if (tenantOverride !== undefined) {
                this.cache.set(tenantId, normalizedFlagKey, tenantOverride);
                return tenantOverride;
            }
            // 4. デフォルト値取得
            const defaultValue = await this.getDefaultValue(normalizedFlagKey);
            this.cache.set(tenantId, normalizedFlagKey, defaultValue);
            return defaultValue;
        }
        catch (error) {
            console.error('FeatureFlag evaluation failed:', error);
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
            console.error('Kill-switch check failed:', error);
            return false;
        }
    }
    async getTenantOverride(tenantId, flagKey) {
        try {
            const result = await this.dynamoDbClient.getTenantOverride(tenantId, flagKey);
            return result ? result.enabled : undefined;
        }
        catch (error) {
            console.error('Tenant override check failed:', error);
            return undefined;
        }
    }
    async getDefaultValue(flagKey) {
        try {
            const result = await this.dynamoDbClient.getFlag(flagKey);
            return result ? result.defaultEnabled : false;
        }
        catch (error) {
            console.error('Default value check failed:', error);
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
}
exports.FeatureFlagEvaluator = FeatureFlagEvaluator;
// モック実装（ローカル開発用）
class MockDynamoDbClient {
    data;
    constructor() {
        this.data = new Map();
        this.seedData();
    }
    async getFlag(flagKey) {
        const key = `FLAG#${flagKey}#METADATA`;
        return this.data.get(key);
    }
    async getTenantOverride(tenantId, flagKey) {
        const key = `TENANT#${tenantId}#FLAG#${flagKey}`;
        return this.data.get(key);
    }
    async getKillSwitch(flagKey) {
        const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
        const key = `EMERGENCY#${sk}`;
        return this.data.get(key);
    }
    async setKillSwitch(flagKey, enabled, reason, activatedBy) {
        const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
        const key = `EMERGENCY#${sk}`;
        this.data.set(key, {
            PK: 'EMERGENCY',
            SK: sk,
            enabled,
            reason,
            activatedAt: new Date().toISOString(),
            activatedBy,
        });
    }
    async get(params) {
        const key = `${params.Key.PK}#${params.Key.SK}`;
        return this.data.get(key);
    }
    async put(params) {
        const key = `${params.Item.PK}#${params.Item.SK}`;
        this.data.set(key, params.Item);
    }
    seedData() {
        // デフォルトフラグ設定
        Object.values(models_1.FEATURE_FLAGS).forEach(flagKey => {
            const key = `FLAG#${flagKey}#METADATA`;
            this.data.set(key, {
                PK: `FLAG#${flagKey}`,
                SK: 'METADATA',
                flagKey,
                description: `Feature flag for ${flagKey}`,
                defaultEnabled: false,
                owner: 'system',
                createdAt: new Date().toISOString(),
            });
        });
        // テスト用のテナントオーバーライド
        this.data.set('TENANT#test-tenant-1#FLAG#billing_v2_enable', {
            PK: 'TENANT#test-tenant-1',
            SK: 'FLAG#billing_v2_enable',
            enabled: true,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin',
        });
    }
}
//# sourceMappingURL=index.js.map