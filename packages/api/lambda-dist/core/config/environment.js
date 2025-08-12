"use strict";
/**
 * Multi-Environment Configuration Management
 *
 * マルチ環境サポートのための設定管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVIRONMENT_POLICIES = void 0;
exports.getEnvironmentConfig = getEnvironmentConfig;
exports.getCurrentEnvironment = getCurrentEnvironment;
exports.getTableName = getTableName;
exports.getEnvironmentKeyPrefix = getEnvironmentKeyPrefix;
exports.addEnvironmentToKey = addEnvironmentToKey;
exports.validateEnvironmentConfig = validateEnvironmentConfig;
exports.debugLog = debugLog;
exports.getAllEnvironmentConfigs = getAllEnvironmentConfigs;
const models_1 = require("../models");
// デフォルト環境設定
const DEFAULT_CONFIGS = {
    [models_1.ENVIRONMENTS.DEVELOPMENT]: {
        environment: models_1.ENVIRONMENTS.DEVELOPMENT,
        tableName: 'feature-flags-dev',
        region: 'ap-northeast-1',
        endpoint: 'http://localhost:8000', // DynamoDB Local
        features: {
            cacheEnabled: false, // 開発環境ではキャッシュ無効
            debugLogging: true,
            metricsEnabled: false,
        },
    },
    [models_1.ENVIRONMENTS.STAGING]: {
        environment: models_1.ENVIRONMENTS.STAGING,
        tableName: 'feature-flags-staging',
        region: 'ap-northeast-1',
        features: {
            cacheEnabled: true,
            debugLogging: true,
            metricsEnabled: true,
        },
    },
    [models_1.ENVIRONMENTS.PRODUCTION]: {
        environment: models_1.ENVIRONMENTS.PRODUCTION,
        tableName: 'feature-flags-prod',
        region: 'ap-northeast-1',
        features: {
            cacheEnabled: true,
            debugLogging: false,
            metricsEnabled: true,
        },
    },
};
/**
 * 環境固有設定を取得
 */
function getEnvironmentConfig(environment) {
    // 環境パラメータの検証
    if (!environment) {
        throw new Error('Environment parameter is required for getEnvironmentConfig');
    }
    // 有効な環境値かチェック
    if (!Object.values(models_1.ENVIRONMENTS).includes(environment)) {
        throw new Error(`Invalid environment: ${environment}. Must be one of: ${Object.values(models_1.ENVIRONMENTS).join(', ')}`);
    }
    const baseConfig = DEFAULT_CONFIGS[environment];
    if (!baseConfig) {
        throw new Error(`No configuration found for environment: ${environment}`);
    }
    // 環境変数による設定上書き
    const config = {
        ...baseConfig,
        tableName: process.env[`FEATURE_FLAGS_TABLE_NAME_${environment.toUpperCase()}`] || baseConfig.tableName,
        region: process.env[`AWS_REGION_${environment.toUpperCase()}`] ||
            process.env.AWS_REGION ||
            baseConfig.region,
        endpoint: process.env[`DYNAMODB_ENDPOINT_${environment.toUpperCase()}`] || baseConfig.endpoint,
    };
    // 開発環境での特別な設定
    if (environment === models_1.ENVIRONMENTS.DEVELOPMENT) {
        config.endpoint =
            process.env.DYNAMODB_ENDPOINT || process.env.IS_OFFLINE === 'true'
                ? 'http://localhost:8000'
                : config.endpoint;
    }
    return config;
}
/**
 * 現在の環境を判定
 */
function getCurrentEnvironment() {
    const env = process.env.NODE_ENV;
    // 有効な環境値かチェック
    if (env && Object.values(models_1.ENVIRONMENTS).includes(env)) {
        return env;
    }
    // フォールバック: 本番環境
    return models_1.ENVIRONMENTS.PRODUCTION;
}
/**
 * 環境別のテーブル名生成
 */
function getTableName(environment) {
    return getEnvironmentConfig(environment).tableName;
}
/**
 * 環境別のキープレフィックス生成
 */
function getEnvironmentKeyPrefix(environment) {
    return environment.toUpperCase();
}
/**
 * DynamoDBキーに環境プレフィックスを追加
 */
function addEnvironmentToKey(baseKey, environment) {
    return `${baseKey}#${environment}`;
}
/**
 * 環境設定の検証
 */
function validateEnvironmentConfig(config) {
    return !!(config.environment &&
        config.tableName &&
        config.region &&
        Object.values(models_1.ENVIRONMENTS).includes(config.environment));
}
/**
 * 環境固有のデバッグログ出力
 */
function debugLog(environment, message, data) {
    const config = getEnvironmentConfig(environment);
    if (config.features?.debugLogging) {
        console.log(`[${environment.toUpperCase()}] ${message}`, data ? data : '');
    }
}
/**
 * 全環境の設定を取得（管理用）
 */
function getAllEnvironmentConfigs() {
    return {
        [models_1.ENVIRONMENTS.DEVELOPMENT]: getEnvironmentConfig(models_1.ENVIRONMENTS.DEVELOPMENT),
        [models_1.ENVIRONMENTS.STAGING]: getEnvironmentConfig(models_1.ENVIRONMENTS.STAGING),
        [models_1.ENVIRONMENTS.PRODUCTION]: getEnvironmentConfig(models_1.ENVIRONMENTS.PRODUCTION),
    };
}
exports.ENVIRONMENT_POLICIES = {
    [models_1.ENVIRONMENTS.DEVELOPMENT]: {
        environment: models_1.ENVIRONMENTS.DEVELOPMENT,
        allowOverrides: true,
        requireApproval: false,
        maxCacheTtl: 60, // 1分
        auditLevel: 'basic',
    },
    [models_1.ENVIRONMENTS.STAGING]: {
        environment: models_1.ENVIRONMENTS.STAGING,
        allowOverrides: true,
        requireApproval: true,
        maxCacheTtl: 300, // 5分
        auditLevel: 'detailed',
    },
    [models_1.ENVIRONMENTS.PRODUCTION]: {
        environment: models_1.ENVIRONMENTS.PRODUCTION,
        allowOverrides: false,
        requireApproval: true,
        maxCacheTtl: 3600, // 1時間
        auditLevel: 'comprehensive',
    },
};
//# sourceMappingURL=environment.js.map