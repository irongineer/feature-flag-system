"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbClient = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const error_handling_1 = require("../types/error-handling");
const environment_1 = require("../config/environment");
class DynamoDbClient {
    dynamoDb;
    tableName;
    environment;
    errorHandler;
    constructor(config) {
        this.environment = config.environment;
        // 環境固有設定を取得
        const envConfig = (0, environment_1.getEnvironmentConfig)(this.environment);
        const dynamoConfig = {
            region: config.region || envConfig.region,
        };
        // 環境固有のエンドポイント設定
        if (config.endpoint || envConfig.endpoint) {
            dynamoConfig.endpoint = config.endpoint || envConfig.endpoint;
        }
        const client = new client_dynamodb_1.DynamoDBClient(dynamoConfig);
        this.dynamoDb = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
        this.tableName = config.tableName || envConfig.tableName;
        // エラーハンドラーの設定
        this.errorHandler = config.errorHandler || error_handling_1.enhancedErrorHandler;
        (0, environment_1.debugLog)(this.environment, 'DynamoDbClient initialized', {
            tableName: this.tableName,
            region: dynamoConfig.region,
            endpoint: dynamoConfig.endpoint
        });
    }
    /**
     * 構造化エラーハンドリング用のヘルパーメソッド
     */
    handleError(operation, error, context) {
        const structuredError = (0, error_handling_1.createStructuredError)(operation, error, context);
        this.errorHandler(structuredError);
        // ビジネスロジック向けエラー分類
        if ((0, error_handling_1.isResourceNotFound)(error)) {
            throw new Error(`Resource not found: ${context?.flagKey || 'unknown resource'}`);
        }
        if ((0, error_handling_1.isConditionalCheckFailed)(error)) {
            throw new Error(`Condition check failed: Resource already exists or has been modified`);
        }
        if ((0, error_handling_1.isValidationError)(error)) {
            throw new Error(`Validation error: Invalid request parameters`);
        }
        if ((0, error_handling_1.isThrottlingError)(error)) {
            throw new Error(`Service temporarily unavailable: Request rate exceeded`);
        }
        // 一般的なエラー
        throw error;
    }
    // フラグのデフォルト値を取得
    async getFlag(flagKey) {
        try {
            const pk = `FLAG#${this.environment}#${flagKey}`;
            (0, environment_1.debugLog)(this.environment, `Getting flag: ${flagKey}`, { pk });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.GetCommand({
                TableName: this.tableName,
                Key: {
                    PK: pk,
                    SK: 'METADATA',
                },
            }));
            return result.Item || null;
        }
        catch (error) {
            this.handleError('getFlag', error, { flagKey, environment: this.environment });
        }
    }
    // テナント別オーバーライドを取得
    async getTenantOverride(tenantId, flagKey) {
        try {
            const pk = `TENANT#${this.environment}#${tenantId}`;
            (0, environment_1.debugLog)(this.environment, `Getting tenant override: ${tenantId}/${flagKey}`, { pk });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.GetCommand({
                TableName: this.tableName,
                Key: {
                    PK: pk,
                    SK: `FLAG#${flagKey}`,
                },
            }));
            return result.Item || null;
        }
        catch (error) {
            this.handleError('getTenantOverride', error, { tenantId, flagKey, environment: this.environment });
        }
    }
    // Kill-Switchの状態を取得
    async getKillSwitch(flagKey) {
        try {
            const pk = `EMERGENCY#${this.environment}`;
            const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
            (0, environment_1.debugLog)(this.environment, `Getting kill switch: ${flagKey || 'GLOBAL'}`, { pk, sk });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.GetCommand({
                TableName: this.tableName,
                Key: {
                    PK: pk,
                    SK: sk,
                },
            }));
            return result.Item || null;
        }
        catch (error) {
            this.handleError('getKillSwitch', error, { flagKey, environment: this.environment });
        }
    }
    // フラグを作成
    async createFlag(flag) {
        try {
            const item = {
                PK: `FLAG#${this.environment}#${flag.flagKey}`,
                SK: 'METADATA',
                environment: this.environment, // 環境情報を明示的に設定
                ...flag,
            };
            // 有効期限がある場合はGSI1用のキーを追加
            if (flag.expiresAt) {
                item.GSI1PK = `EXPIRES#${this.environment}`;
                item.GSI1SK = flag.expiresAt;
            }
            // GSI2: オーナー別フラグ一覧用
            if (flag.owner) {
                item.GSI2PK = `OWNER#${this.environment}#${flag.owner}`;
                item.GSI2SK = `FLAG#${flag.flagKey}`;
            }
            // GSI3: 全フラグ一覧効率化用
            item.GSI3PK = `FLAGS#${this.environment}`;
            item.GSI3SK = `METADATA#${flag.createdAt}`;
            // GSI4: 環境横断フラグ一覧用
            item.GSI4PK = `GLOBAL_FLAG#${flag.flagKey}`;
            item.GSI4SK = `ENV#${this.environment}`;
            (0, environment_1.debugLog)(this.environment, `Creating flag: ${flag.flagKey}`, { item });
            await this.dynamoDb.send(new lib_dynamodb_1.PutCommand({
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(PK)', // 重複防止
            }));
        }
        catch (error) {
            this.handleError('createFlag', error, { flagKey: flag.flagKey, environment: this.environment });
        }
    }
    // フラグを更新
    async updateFlag(flagKey, updates) {
        try {
            const updateExpression = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (key !== 'PK' && key !== 'SK' && key !== 'flagKey' && key !== 'environment') {
                    updateExpression.push(`#${key} = :${key}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[`:${key}`] = value;
                }
            });
            // GSI2キーの更新（オーナーが変更された場合）
            if (updates.owner) {
                updateExpression.push('#GSI2PK = :gsi2pk', '#GSI2SK = :gsi2sk');
                expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
                expressionAttributeNames['#GSI2SK'] = 'GSI2SK';
                expressionAttributeValues[':gsi2pk'] = `OWNER#${this.environment}#${updates.owner}`;
                expressionAttributeValues[':gsi2sk'] = `FLAG#${flagKey}`;
            }
            // GSI1キーの更新（有効期限が変更された場合）
            if (updates.expiresAt) {
                updateExpression.push('#GSI1PK = :gsi1pk', '#GSI1SK = :gsi1sk');
                expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
                expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
                expressionAttributeValues[':gsi1pk'] = `EXPIRES#${this.environment}`;
                expressionAttributeValues[':gsi1sk'] = updates.expiresAt;
            }
            (0, environment_1.debugLog)(this.environment, `Updating flag: ${flagKey}`, { updates, environment: this.environment });
            await this.dynamoDb.send(new lib_dynamodb_1.UpdateCommand({
                TableName: this.tableName,
                Key: {
                    PK: `FLAG#${this.environment}#${flagKey}`,
                    SK: 'METADATA',
                },
                UpdateExpression: `SET ${updateExpression.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ConditionExpression: 'attribute_exists(PK)', // 存在確認
            }));
        }
        catch (error) {
            this.handleError('updateFlag', error, { flagKey, environment: this.environment });
        }
    }
    // テナント別オーバーライドを設定
    async setTenantOverride(tenantId, flagKey, enabled, updatedBy) {
        try {
            const item = {
                PK: `TENANT#${this.environment}#${tenantId}`,
                SK: `FLAG#${flagKey}`,
                enabled,
                environment: this.environment,
                updatedAt: new Date().toISOString(),
                updatedBy,
                GSI1PK: `FLAG#${this.environment}#${flagKey}`,
                GSI1SK: `TENANT#${tenantId}`,
            };
            (0, environment_1.debugLog)(this.environment, `Setting tenant override: ${tenantId}/${flagKey}`, { enabled, environment: this.environment });
            await this.dynamoDb.send(new lib_dynamodb_1.PutCommand({
                TableName: this.tableName,
                Item: item,
            }));
        }
        catch (error) {
            this.handleError('setTenantOverride', error, { tenantId, flagKey, environment: this.environment });
        }
    }
    // Kill-Switchを設定
    async setKillSwitch(flagKey, enabled, reason, activatedBy) {
        try {
            const pk = `EMERGENCY#${this.environment}`;
            const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
            const item = {
                PK: pk,
                SK: sk,
                enabled,
                environment: this.environment,
                reason,
                activatedAt: new Date().toISOString(),
                activatedBy,
            };
            (0, environment_1.debugLog)(this.environment, `Setting kill switch: ${flagKey || 'GLOBAL'}`, { enabled, reason, environment: this.environment });
            await this.dynamoDb.send(new lib_dynamodb_1.PutCommand({
                TableName: this.tableName,
                Item: item,
            }));
        }
        catch (error) {
            this.handleError('setKillSwitch', error, { flagKey: flagKey || undefined, environment: this.environment });
        }
    }
    // フラグ一覧を取得 (GSI3 Query最適化)
    async listFlags() {
        try {
            const gsi3pk = `FLAGS#${this.environment}`;
            (0, environment_1.debugLog)(this.environment, `Listing flags for environment: ${this.environment}`, { gsi3pk });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                IndexName: 'GSI3-FLAGS-INDEX',
                KeyConditionExpression: 'GSI3PK = :gsi3pk',
                ExpressionAttributeValues: {
                    ':gsi3pk': gsi3pk,
                },
                ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
                ScanIndexForward: false, // 新しいフラグから順に取得
            }));
            return result.Items || [];
        }
        catch (error) {
            this.handleError('listFlags', error, { environment: this.environment });
        }
    }
    // オーナー別フラグ一覧を取得 (GSI2 Query最適化)
    async listFlagsByOwner(owner) {
        try {
            const gsi2pk = `OWNER#${this.environment}#${owner}`;
            (0, environment_1.debugLog)(this.environment, `Listing flags by owner: ${owner}`, { gsi2pk, environment: this.environment });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                IndexName: 'GSI2-OWNER-INDEX',
                KeyConditionExpression: 'GSI2PK = :gsi2pk',
                ExpressionAttributeValues: {
                    ':gsi2pk': gsi2pk,
                },
                ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
            }));
            return result.Items || [];
        }
        catch (error) {
            this.handleError('listFlagsByOwner', error, { owner, environment: this.environment });
        }
    }
    // 従来のScan方式（フォールバック用）
    async listFlagsWithScan() {
        try {
            const pkPrefix = `FLAG#${this.environment}#`;
            (0, environment_1.debugLog)(this.environment, `Scanning flags with prefix: ${pkPrefix}`, { environment: this.environment });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.ScanCommand({
                TableName: this.tableName,
                FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': pkPrefix,
                    ':sk': 'METADATA',
                },
                ProjectionExpression: 'PK, SK, flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
            }));
            return result.Items || [];
        }
        catch (error) {
            this.handleError('listFlagsWithScan', error, { environment: this.environment });
        }
    }
    // テナント別オーバーライド一覧を取得
    async listTenantOverrides(tenantId) {
        try {
            const pk = `TENANT#${this.environment}#${tenantId}`;
            (0, environment_1.debugLog)(this.environment, `Listing tenant overrides: ${tenantId}`, { pk, environment: this.environment });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':sk': 'FLAG#',
                },
            }));
            return result.Items;
        }
        catch (error) {
            this.handleError('listTenantOverrides', error, { tenantId, environment: this.environment });
        }
    }
    // バッチ操作用のヘルパー
    async batchGetFlags(flagKeys) {
        try {
            const requestItems = flagKeys.map(flagKey => ({
                PK: `FLAG#${this.environment}#${flagKey}`,
                SK: 'METADATA',
            }));
            (0, environment_1.debugLog)(this.environment, `Batch getting flags: ${flagKeys.join(', ')}`, { flagKeys, environment: this.environment });
            const result = await this.dynamoDb.send(new lib_dynamodb_1.BatchGetCommand({
                RequestItems: {
                    [this.tableName]: {
                        Keys: requestItems,
                    },
                },
            }));
            return result.Responses?.[this.tableName] || [];
        }
        catch (error) {
            this.handleError('batchGetFlags', error, { flagKeys, environment: this.environment });
        }
    }
    // ヘルスチェック
    async healthCheck() {
        try {
            // DocumentClientではdescribeTableが使えないので、代わりにscanを使用
            await this.dynamoDb.send(new lib_dynamodb_1.ScanCommand({
                TableName: this.tableName,
                Limit: 1,
            }));
            return true;
        }
        catch (error) {
            // ヘルスチェックではエラーログだけ出力し、falseを返す
            const structuredError = (0, error_handling_1.createStructuredError)('healthCheck', error);
            this.errorHandler(structuredError);
            return false;
        }
    }
}
exports.DynamoDbClient = DynamoDbClient;
//# sourceMappingURL=dynamo-client.js.map