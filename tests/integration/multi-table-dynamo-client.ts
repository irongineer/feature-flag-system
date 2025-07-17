import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  FeatureFlagKey, 
  FeatureFlagsTable, 
  TenantOverridesTable, 
  EmergencyControlTable 
} from '@feature-flag/core';

interface MultiTableConfig {
  featureFlagsTable: string;
  tenantOverridesTable: string;
  emergencyControlTable: string;
}

export class MultiTableDynamoClient {
  private dynamoDb: DynamoDBDocumentClient;
  private tables: MultiTableConfig;

  constructor(dynamoConfig: DynamoDBClientConfig, tables: MultiTableConfig) {
    const client = new DynamoDBClient(dynamoConfig);
    this.dynamoDb = DynamoDBDocumentClient.from(client);
    this.tables = tables;
  }

  // フラグのデフォルト値を取得
  async getFlag(flagKey: string): Promise<FeatureFlagsTable | null> {
    try {
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tables.featureFlagsTable,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
      }));

      return result.Item as FeatureFlagsTable || null;
    } catch (error) {
      console.error('Error getting flag:', error);
      throw error;
    }
  }

  // テナント別オーバーライドを取得
  async getTenantOverride(tenantId: string, flagKey: string): Promise<TenantOverridesTable | null> {
    try {
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tables.tenantOverridesTable,
        Key: {
          PK: `TENANT#${tenantId}`,
          SK: `FLAG#${flagKey}`,
        },
      }));

      return result.Item as TenantOverridesTable || null;
    } catch (error) {
      console.error('Error getting tenant override:', error);
      throw error;
    }
  }

  // Kill-Switchの状態を取得
  async getKillSwitch(flagKey?: string): Promise<EmergencyControlTable | null> {
    try {
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tables.emergencyControlTable,
        Key: {
          PK: 'EMERGENCY',
          SK: sk,
        },
      }));

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

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tables.featureFlagsTable,
        Item: item,
      }));
    } catch (error) {
      console.error('Error creating flag:', error);
      throw error;
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
        TableName: this.tables.tenantOverridesTable,
        Item: item,
      }));
    } catch (error) {
      console.error('Error setting tenant override:', error);
      throw error;
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
        TableName: this.tables.emergencyControlTable,
        Item: item,
      }));
    } catch (error) {
      console.error('Error setting kill switch:', error);
      throw error;
    }
  }

  // Kill-Switchを削除
  async deleteKillSwitch(flagKey: string | null): Promise<void> {
    try {
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      await this.dynamoDb.send(new DeleteCommand({
        TableName: this.tables.emergencyControlTable,
        Key: {
          PK: 'EMERGENCY',
          SK: sk,
        },
      }));
    } catch (error) {
      console.error('Error deleting kill switch:', error);
      throw error;
    }
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      // 各テーブルに対してGetコマンドを実行してヘルスチェック
      const promises = [
        this.dynamoDb.send(new GetCommand({
          TableName: this.tables.featureFlagsTable,
          Key: { PK: 'HEALTH_CHECK', SK: 'HEALTH_CHECK' }
        })),
        this.dynamoDb.send(new GetCommand({
          TableName: this.tables.tenantOverridesTable,
          Key: { PK: 'HEALTH_CHECK', SK: 'HEALTH_CHECK' }
        })),
        this.dynamoDb.send(new GetCommand({
          TableName: this.tables.emergencyControlTable,
          Key: { PK: 'HEALTH_CHECK', SK: 'HEALTH_CHECK' }
        }))
      ];

      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return false;
    }
  }
}