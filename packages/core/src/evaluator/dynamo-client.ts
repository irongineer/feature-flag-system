import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
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
import {
  createStructuredError,
  enhancedErrorHandler,
  isResourceNotFound,
  isConditionalCheckFailed,
  isValidationError,
  isThrottlingError,
  isRetryableError,
  ErrorHandler,
  ErrorHandlingOptions
} from '../types/error-handling';

export interface DynamoDbClientConfig extends ErrorHandlingOptions {
  region?: string;
  tableName: string;
  endpoint?: string; // ローカル開発用
}

export class DynamoDbClient {
  private dynamoDb: DynamoDBDocumentClient;
  private tableName: string;
  private errorHandler: ErrorHandler;

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
    
    // エラーハンドラーの設定
    this.errorHandler = config.errorHandler || enhancedErrorHandler;
  }

  /**
   * 構造化エラーハンドリング用のヘルパーメソッド
   */
  private handleError(operation: string, error: unknown, context?: { tenantId?: string; flagKey?: string; [key: string]: any }): never {
    const structuredError = createStructuredError(operation, error, context);
    this.errorHandler(structuredError);
    
    // ビジネスロジック向けエラー分類
    if (isResourceNotFound(error)) {
      throw new Error(`Resource not found: ${context?.flagKey || 'unknown resource'}`);
    }
    if (isConditionalCheckFailed(error)) {
      throw new Error(`Condition check failed: Resource already exists or has been modified`);
    }
    if (isValidationError(error)) {
      throw new Error(`Validation error: Invalid request parameters`);
    }
    if (isThrottlingError(error)) {
      throw new Error(`Service temporarily unavailable: Request rate exceeded`);
    }
    
    // 一般的なエラー
    throw error;
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
      this.handleError('getFlag', error, { flagKey });
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
      this.handleError('getTenantOverride', error, { tenantId, flagKey });
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
      this.handleError('getKillSwitch', error, { flagKey });
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

      // GSI2: オーナー別フラグ一覧用
      if (flag.owner) {
        item.GSI2PK = `OWNER#${flag.owner}`;
        item.GSI2SK = `FLAG#${flag.flagKey}`;
      }

      // GSI3: 全フラグ一覧効率化用
      item.GSI3PK = 'FLAGS';
      item.GSI3SK = `METADATA#${flag.createdAt}`;

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)', // 重複防止
      }));
    } catch (error) {
      this.handleError('createFlag', error, { flagKey: flag.flagKey });
    }
  }

  // フラグを更新
  async updateFlag(flagKey: string, updates: Partial<FeatureFlagsTable>): Promise<void> {
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

      // GSI2キーの更新（オーナーが変更された場合）
      if (updates.owner) {
        updateExpression.push('#GSI2PK = :gsi2pk', '#GSI2SK = :gsi2sk');
        expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
        expressionAttributeNames['#GSI2SK'] = 'GSI2SK';
        expressionAttributeValues[':gsi2pk'] = `OWNER#${updates.owner}`;
        expressionAttributeValues[':gsi2sk'] = `FLAG#${flagKey}`;
      }

      // GSI1キーの更新（有効期限が変更された場合）
      if (updates.expiresAt) {
        updateExpression.push('#GSI1PK = :gsi1pk', '#GSI1SK = :gsi1sk');
        expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
        expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
        expressionAttributeValues[':gsi1pk'] = 'EXPIRES';
        expressionAttributeValues[':gsi1sk'] = updates.expiresAt;
      }

      await this.dynamoDb.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(PK)', // 存在確認
      }));
    } catch (error) {
      this.handleError('updateFlag', error, { flagKey });
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
      this.handleError('setTenantOverride', error, { tenantId, flagKey });
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
      this.handleError('setKillSwitch', error, { flagKey: flagKey || undefined });
    }
  }

  // フラグ一覧を取得 (GSI3 Query最適化)
  async listFlags(): Promise<FeatureFlagsTable[]> {
    try {
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI3-FLAGS-INDEX',
        KeyConditionExpression: 'GSI3PK = :gsi3pk',
        ExpressionAttributeValues: {
          ':gsi3pk': 'FLAGS',
        },
        ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt',
        ScanIndexForward: false, // 新しいフラグから順に取得
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('listFlags', error);
    }
  }

  // オーナー別フラグ一覧を取得 (GSI2 Query最適化)
  async listFlagsByOwner(owner: string): Promise<FeatureFlagsTable[]> {
    try {
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2-OWNER-INDEX',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: {
          ':gsi2pk': `OWNER#${owner}`,
        },
        ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt',
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('listFlagsByOwner', error, { owner });
    }
  }

  // 従来のScan方式（フォールバック用）
  async listFlagsWithScan(): Promise<FeatureFlagsTable[]> {
    try {
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
      this.handleError('listFlagsWithScan', error);
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

      return result.Items as TenantOverridesTable[];
    } catch (error) {
      this.handleError('listTenantOverrides', error, { tenantId });
    }
  }

  // バッチ操作用のヘルパー
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
      this.handleError('batchGetFlags', error, { flagKeys });
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
      // ヘルスチェックではエラーログだけ出力し、falseを返す
      const structuredError = createStructuredError('healthCheck', error);
      this.errorHandler(structuredError);
      return false;
    }
  }
}