import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand,
  QueryCommand, 
  BatchGetCommand, 
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
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
  private dynamoDb: DynamoDBDocumentClient;
  private tableName: string;

  constructor(config: DynamoDbClientConfig) {
    const dynamoConfig: DynamoDBClientConfig = {
      region: config.region || process.env.AWS_REGION || 'ap-northeast-1',
    };

    // ローカル開発用の設定
    if (config.endpoint) {
      dynamoConfig.endpoint = config.endpoint;
    }

    const client = new DynamoDBClient(dynamoConfig);
    this.dynamoDb = DynamoDBDocumentClient.from(client);
    this.tableName = config.tableName;
  }

  // フラグのデフォルト値を取得
  async getFlag(flagKey: string): Promise<FeatureFlagsTable | null> {
    try {
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
      }));

      return result.Item as FeatureFlagsTable || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get flag: ${message}`);
    }
  }

  // テナント別オーバーライドを取得
  async getTenantOverride(tenantId: string, flagKey: string): Promise<TenantOverridesTable | null> {
    try {
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `FLAG#${flagKey}`,
        },
      }));

      return result.Item as TenantOverridesTable || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get tenant override: ${message}`);
    }
  }

  // Kill-Switchの状態を取得
  async getKillSwitch(flagKey?: string): Promise<EmergencyControlTable | null> {
    try {
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: 'EMERGENCY',
          SK: sk,
        },
      }));

      return result.Item as EmergencyControlTable || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get kill switch: ${message}`);
    }
  }

  // フラグを作成 (createFlagとputFlagのエイリアス)
  async putFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK'>): Promise<void> {
    return this.createFlag(flag);
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

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)', // 重複防止
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to put flag: ${message}`);
    }
  }

  // フラグを更新
  async updateFlag(flagKey: string, updates: Partial<FeatureFlagsTable>): Promise<FeatureFlagsTable> {
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

      const result = await this.dynamoDb.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(PK)', // 存在確認
        ReturnValues: 'ALL_NEW',
      }));
      
      return result.Attributes as FeatureFlagsTable;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update flag: ${message}`);
    }
  }

  // フラグを削除
  async deleteFlag(flagKey: string): Promise<void> {
    try {
      await this.dynamoDb.send(new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete flag: ${message}`);
    }
  }

  // テナント別オーバーライドを設定
  async setTenantOverride(
    tenantId: string, 
    flagKey: string, 
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

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to set tenant override: ${message}`);
    }
  }

  // Kill-Switchを設定
  async setKillSwitch(
    flagKey: string | null, 
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

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to set kill switch: ${message}`);
    }
  }

  // フラグ一覧を取得
  async listFlags(): Promise<FeatureFlagsTable[]> {
    try {
      // TODO: Issue #29でQuery最適化予定。現在はScanで動作確保
      const result = await this.dynamoDb.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'FLAG#',
          ':sk': 'METADATA',
        },
        ProjectionExpression: 'PK, SK, flagKey, description, defaultEnabled, owner, createdAt, expiresAt',
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list flags: ${message}`);
    }
  }

  // テナント別オーバーライド一覧を取得
  async listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]> {
    try {
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}`,
          ':sk': 'FLAG#',
        },
      }));

      return result.Items as TenantOverridesTable[] || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list tenant overrides: ${message}`);
    }
  }

  // 複数フラグを一括取得
  async batchGetFlags(flagKeys: string[]): Promise<FeatureFlagsTable[]> {
    try {
      const requestItems = flagKeys.map(flagKey => ({
        PK: `FLAG#${flagKey}`,
        SK: 'METADATA',
      }));

      const result = await this.dynamoDb.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: requestItems,
          },
        },
      }));

      return result.Responses?.[this.tableName] as FeatureFlagsTable[] || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to batch get flags: ${message}`);
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      // DocumentClientではdescribeTableが使えないので、代わりにscanを使用
      await this.dynamoDb.send(new ScanCommand({
        TableName: this.tableName,
        Limit: 1,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }
}