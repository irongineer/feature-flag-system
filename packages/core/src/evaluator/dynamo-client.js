"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbClient = void 0;
const AWS = __importStar(require("aws-sdk"));
class DynamoDbClient {
    dynamoDb;
    tableName;
    constructor(config) {
        const dynamoConfig = {
            region: config.region || process.env.AWS_REGION || 'ap-northeast-1',
        };
        // ローカル開発用の設定
        if (config.endpoint) {
            dynamoConfig.endpoint = config.endpoint;
        }
        this.dynamoDb = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        this.tableName = config.tableName;
    }
    // フラグのデフォルト値を取得
    async getFlag(flagKey) {
        try {
            const result = await this.dynamoDb.get({
                TableName: this.tableName,
                Key: {
                    PK: `FLAG#${flagKey}`,
                    SK: 'METADATA',
                },
            }).promise();
            return result.Item || null;
        }
        catch (error) {
            console.error('Error getting flag:', error);
            throw error;
        }
    }
    // テナント別オーバーライドを取得
    async getTenantOverride(tenantId, flagKey) {
        try {
            const result = await this.dynamoDb.get({
                TableName: this.tableName,
                Key: {
                    PK: `TENANT#${tenantId}`,
                    SK: `FLAG#${flagKey}`,
                },
            }).promise();
            return result.Item || null;
        }
        catch (error) {
            console.error('Error getting tenant override:', error);
            throw error;
        }
    }
    // Kill-Switchの状態を取得
    async getKillSwitch(flagKey) {
        try {
            const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
            const result = await this.dynamoDb.get({
                TableName: this.tableName,
                Key: {
                    PK: 'EMERGENCY',
                    SK: sk,
                },
            }).promise();
            return result.Item || null;
        }
        catch (error) {
            console.error('Error getting kill switch:', error);
            throw error;
        }
    }
    // フラグを作成
    async createFlag(flag) {
        try {
            const item = {
                PK: `FLAG#${flag.flagKey}`,
                SK: 'METADATA',
                ...flag,
            };
            // 有効期限がある場合はGSI1用のキーを追加
            if (flag.expiresAt) {
                item.GSI1PK = 'EXPIRES';
                item.GSI1SK = flag.expiresAt;
            }
            await this.dynamoDb.put({
                TableName: this.tableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(PK)', // 重複防止
            }).promise();
        }
        catch (error) {
            console.error('Error creating flag:', error);
            throw error;
        }
    }
    // フラグを更新
    async updateFlag(flagKey, updates) {
        try {
            const updateExpression = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (key !== 'PK' && key !== 'SK' && key !== 'flagKey') {
                    updateExpression.push(`#${key} = :${key}`);
                    expressionAttributeNames[`#${key}`] = key;
                    expressionAttributeValues[`:${key}`] = value;
                }
            });
            await this.dynamoDb.update({
                TableName: this.tableName,
                Key: {
                    PK: `FLAG#${flagKey}`,
                    SK: 'METADATA',
                },
                UpdateExpression: `SET ${updateExpression.join(', ')}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
                ConditionExpression: 'attribute_exists(PK)', // 存在確認
            }).promise();
        }
        catch (error) {
            console.error('Error updating flag:', error);
            throw error;
        }
    }
    // テナント別オーバーライドを設定
    async setTenantOverride(tenantId, flagKey, enabled, updatedBy) {
        try {
            const item = {
                PK: `TENANT#${tenantId}`,
                SK: `FLAG#${flagKey}`,
                enabled,
                updatedAt: new Date().toISOString(),
                updatedBy,
                GSI1PK: `FLAG#${flagKey}`,
                GSI1SK: `TENANT#${tenantId}`,
            };
            await this.dynamoDb.put({
                TableName: this.tableName,
                Item: item,
            }).promise();
        }
        catch (error) {
            console.error('Error setting tenant override:', error);
            throw error;
        }
    }
    // Kill-Switchを設定
    async setKillSwitch(flagKey, enabled, reason, activatedBy) {
        try {
            const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
            const item = {
                PK: 'EMERGENCY',
                SK: sk,
                enabled,
                reason,
                activatedAt: new Date().toISOString(),
                activatedBy,
            };
            await this.dynamoDb.put({
                TableName: this.tableName,
                Item: item,
            }).promise();
        }
        catch (error) {
            console.error('Error setting kill switch:', error);
            throw error;
        }
    }
    // フラグ一覧を取得
    async listFlags() {
        try {
            const result = await this.dynamoDb.query({
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': 'FLAG#',
                    ':sk': 'FLAG#',
                },
                ProjectionExpression: 'PK, SK, flagKey, description, defaultEnabled, owner, createdAt, expiresAt',
            }).promise();
            return result.Items;
        }
        catch (error) {
            console.error('Error listing flags:', error);
            throw error;
        }
    }
    // テナント別オーバーライド一覧を取得
    async listTenantOverrides(tenantId) {
        try {
            const result = await this.dynamoDb.query({
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `TENANT#${tenantId}`,
                    ':sk': 'FLAG#',
                },
            }).promise();
            return result.Items;
        }
        catch (error) {
            console.error('Error listing tenant overrides:', error);
            throw error;
        }
    }
    // バッチ操作用のヘルパー
    async batchGetFlags(flagKeys) {
        try {
            const requestItems = flagKeys.map(flagKey => ({
                PK: `FLAG#${flagKey}`,
                SK: 'METADATA',
            }));
            const result = await this.dynamoDb.batchGet({
                RequestItems: {
                    [this.tableName]: {
                        Keys: requestItems,
                    },
                },
            }).promise();
            return result.Responses?.[this.tableName] || [];
        }
        catch (error) {
            console.error('Error batch getting flags:', error);
            throw error;
        }
    }
    // ヘルスチェック
    async healthCheck() {
        try {
            // DocumentClientではdescribeTableが使えないので、代わりにscanを使用
            await this.dynamoDb.scan({
                TableName: this.tableName,
                Limit: 1,
            }).promise();
            return true;
        }
        catch (error) {
            console.error('DynamoDB health check failed:', error);
            return false;
        }
    }
}
exports.DynamoDbClient = DynamoDbClient;
//# sourceMappingURL=dynamo-client.js.map