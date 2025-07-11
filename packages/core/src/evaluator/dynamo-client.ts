import * as AWS from 'aws-sdk';
import { 
  FeatureFlagKey, 
  FeatureFlagsTable, 
  TenantOverridesTable, 
  EmergencyControlTable 
} from '../models';

export interface DynamoDbClientConfig {
  region?: string;
  tableName: string;
  endpoint?: string; // ローカル開発用
}

export class DynamoDbClient {
  private dynamoDb: AWS.DynamoDB.DocumentClient;
  private tableName: string;

  constructor(config: DynamoDbClientConfig) {
    const dynamoConfig: AWS.DynamoDB.ClientConfiguration = {
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
  async getFlag(flagKey: FeatureFlagKey): Promise<FeatureFlagsTable | null> {
    try {
      const result = await this.dynamoDb.get({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
      }).promise();

      return result.Item as FeatureFlagsTable || null;
    } catch (error) {
      console.error('Error getting flag:', error);
      throw error;
    }
  }

  // テナント別オーバーライドを取得
  async getTenantOverride(tenantId: string, flagKey: FeatureFlagKey): Promise<TenantOverridesTable | null> {
    try {
      const result = await this.dynamoDb.get({
        TableName: this.tableName,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `FLAG#${flagKey}`,
        },
      }).promise();

      return result.Item as TenantOverridesTable || null;
    } catch (error) {
      console.error('Error getting tenant override:', error);
      throw error;
    }
  }

  // Kill-Switchの状態を取得
  async getKillSwitch(flagKey?: FeatureFlagKey): Promise<EmergencyControlTable | null> {
    try {
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      const result = await this.dynamoDb.get({
        TableName: this.tableName,
        Key: {
          PK: 'EMERGENCY',
          SK: sk,
        },
      }).promise();

      return result.Item as EmergencyControlTable || null;
    } catch (error) {
      console.error('Error getting kill switch:', error);
      throw error;
    }
  }

  // フラグを作成
  async createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK'>): Promise<void> {
    try {
      const item: FeatureFlagsTable = {
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
    } catch (error) {
      console.error('Error creating flag:', error);
      throw error;
    }
  }

  // フラグを更新
  async updateFlag(flagKey: FeatureFlagKey, updates: Partial<FeatureFlagsTable>): Promise<void> {
    try {
      const updateExpression: string[] = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

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
    } catch (error) {
      console.error('Error updating flag:', error);
      throw error;
    }
  }

  // テナント別オーバーライドを設定
  async setTenantOverride(
    tenantId: string, 
    flagKey: FeatureFlagKey, 
    enabled: boolean, 
    updatedBy: string
  ): Promise<void> {
    try {
      const item: TenantOverridesTable = {
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
    } catch (error) {
      console.error('Error setting tenant override:', error);
      throw error;
    }
  }

  // Kill-Switchを設定
  async setKillSwitch(
    flagKey: FeatureFlagKey | null, 
    enabled: boolean, 
    reason: string, 
    activatedBy: string
  ): Promise<void> {
    try {
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      const item: EmergencyControlTable = {
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
    } catch (error) {
      console.error('Error setting kill switch:', error);
      throw error;
    }
  }

  // フラグ一覧を取得
  async listFlags(): Promise<FeatureFlagsTable[]> {
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

      return result.Items as FeatureFlagsTable[];
    } catch (error) {
      console.error('Error listing flags:', error);
      throw error;
    }
  }

  // テナント別オーバーライド一覧を取得
  async listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]> {
    try {
      const result = await this.dynamoDb.query({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'FLAG#',
        },
      }).promise();

      return result.Items as TenantOverridesTable[];
    } catch (error) {
      console.error('Error listing tenant overrides:', error);
      throw error;
    }
  }

  // バッチ操作用のヘルパー
  async batchGetFlags(flagKeys: FeatureFlagKey[]): Promise<FeatureFlagsTable[]> {
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

      return result.Responses?.[this.tableName] as FeatureFlagsTable[] || [];
    } catch (error) {
      console.error('Error batch getting flags:', error);
      throw error;
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      // DocumentClientではdescribeTableが使えないので、代わりにscanを使用
      await this.dynamoDb.scan({
        TableName: this.tableName,
        Limit: 1,
      }).promise();
      return true;
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return false;
    }
  }
}