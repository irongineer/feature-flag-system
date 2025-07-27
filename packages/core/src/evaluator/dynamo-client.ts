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
import { Environment, ENVIRONMENTS } from '../models';
import { getEnvironmentConfig, addEnvironmentToKey, debugLog } from '../config/environment';

export interface DynamoDbClientConfig extends ErrorHandlingOptions {
  environment: Environment; // 必須: 環境指定
  region?: string;
  tableName?: string; // オプション: 環境設定から自動取得
  endpoint?: string; // ローカル開発用
}

export class DynamoDbClient {
  private dynamoDb: DynamoDBDocumentClient;
  private tableName: string;
  private environment: Environment;
  private errorHandler: ErrorHandler;

  constructor(config: DynamoDbClientConfig) {
    this.environment = config.environment;
    
    // 環境固有設定を取得
    const envConfig = getEnvironmentConfig(this.environment);
    
    const dynamoConfig: DynamoDBClientConfig = {
      region: config.region || envConfig.region,
    };

    // 環境固有のエンドポイント設定
    if (config.endpoint || envConfig.endpoint) {
      dynamoConfig.endpoint = config.endpoint || envConfig.endpoint;
    }

    const client = new DynamoDBClient(dynamoConfig);
    this.dynamoDb = DynamoDBDocumentClient.from(client);
    this.tableName = config.tableName || envConfig.tableName;
    
    // エラーハンドラーの設定
    this.errorHandler = config.errorHandler || enhancedErrorHandler;
    
    debugLog(this.environment, 'DynamoDbClient initialized', {
      tableName: this.tableName,
      region: dynamoConfig.region,
      endpoint: dynamoConfig.endpoint
    });
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
      const pk = `FLAG#${this.environment}#${flagKey}`;
      
      debugLog(this.environment, `Getting flag: ${flagKey}`, { pk });
      
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: 'METADATA',
        },
      }));

      return result.Item as FeatureFlagsTable || null;
    } catch (error) {
      this.handleError('getFlag', error, { flagKey, environment: this.environment });
    }
  }

  // テナント別オーバーライドを取得
  async getTenantOverride(tenantId: string, flagKey: string): Promise<TenantOverridesTable | null> {
    try {
      const pk = `TENANT#${this.environment}#${tenantId}`;
      
      debugLog(this.environment, `Getting tenant override: ${tenantId}/${flagKey}`, { pk });
      
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: `FLAG#${flagKey}`,
        },
      }));

      return result.Item as TenantOverridesTable || null;
    } catch (error) {
      this.handleError('getTenantOverride', error, { tenantId, flagKey, environment: this.environment });
    }
  }

  // Kill-Switchの状態を取得
  async getKillSwitch(flagKey?: string): Promise<EmergencyControlTable | null> {
    try {
      const pk = `EMERGENCY#${this.environment}`;
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      
      debugLog(this.environment, `Getting kill switch: ${flagKey || 'GLOBAL'}`, { pk, sk });
      
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: sk,
        },
      }));

      return result.Item as EmergencyControlTable || null;
    } catch (error) {
      this.handleError('getKillSwitch', error, { flagKey, environment: this.environment });
    }
  }

  // フラグを作成
  async createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK' | 'environment'>): Promise<void> {
    try {
      const item: FeatureFlagsTable = {
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

      debugLog(this.environment, `Creating flag: ${flag.flagKey}`, { item });

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)', // 重複防止
      }));
    } catch (error) {
      this.handleError('createFlag', error, { flagKey: flag.flagKey, environment: this.environment });
    }
  }

  // フラグを更新
  async updateFlag(flagKey: string, updates: Partial<FeatureFlagsTable>): Promise<void> {
    try {
      const updateExpression: string[] = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

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

      debugLog(this.environment, `Updating flag: ${flagKey}`, { updates, environment: this.environment });

      await this.dynamoDb.send(new UpdateCommand({
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
    } catch (error) {
      this.handleError('updateFlag', error, { flagKey, environment: this.environment });
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
        PK: `TENANT#${this.environment}#${tenantId}`,
        SK: `FLAG#${flagKey}`,
        enabled,
        environment: this.environment,
        updatedAt: new Date().toISOString(),
        updatedBy,
        GSI1PK: `FLAG#${this.environment}#${flagKey}`,
        GSI1SK: `TENANT#${tenantId}`,
      };

      debugLog(this.environment, `Setting tenant override: ${tenantId}/${flagKey}`, { enabled, environment: this.environment });

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
      }));
    } catch (error) {
      this.handleError('setTenantOverride', error, { tenantId, flagKey, environment: this.environment });
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
      const pk = `EMERGENCY#${this.environment}`;
      const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
      const item: EmergencyControlTable = {
        PK: pk,
        SK: sk,
        enabled,
        environment: this.environment,
        reason,
        activatedAt: new Date().toISOString(),
        activatedBy,
      };

      debugLog(this.environment, `Setting kill switch: ${flagKey || 'GLOBAL'}`, { enabled, reason, environment: this.environment });

      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
      }));
    } catch (error) {
      this.handleError('setKillSwitch', error, { flagKey: flagKey || undefined, environment: this.environment });
    }
  }

  // フラグ一覧を取得 (GSI3 Query最適化)
  async listFlags(): Promise<FeatureFlagsTable[]> {
    try {
      const gsi3pk = `FLAGS#${this.environment}`;
      
      debugLog(this.environment, `Listing flags for environment: ${this.environment}`, { gsi3pk });
      
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI3-FLAGS-INDEX',
        KeyConditionExpression: 'GSI3PK = :gsi3pk',
        ExpressionAttributeValues: {
          ':gsi3pk': gsi3pk,
        },
        ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
        ScanIndexForward: false, // 新しいフラグから順に取得
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('listFlags', error, { environment: this.environment });
    }
  }

  // オーナー別フラグ一覧を取得 (GSI2 Query最適化)
  async listFlagsByOwner(owner: string): Promise<FeatureFlagsTable[]> {
    try {
      const gsi2pk = `OWNER#${this.environment}#${owner}`;
      
      debugLog(this.environment, `Listing flags by owner: ${owner}`, { gsi2pk, environment: this.environment });
      
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2-OWNER-INDEX',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: {
          ':gsi2pk': gsi2pk,
        },
        ProjectionExpression: 'flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('listFlagsByOwner', error, { owner, environment: this.environment });
    }
  }

  // 従来のScan方式（フォールバック用）
  async listFlagsWithScan(): Promise<FeatureFlagsTable[]> {
    try {
      const pkPrefix = `FLAG#${this.environment}#`;
      
      debugLog(this.environment, `Scanning flags with prefix: ${pkPrefix}`, { environment: this.environment });
      
      const result = await this.dynamoDb.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': pkPrefix,
          ':sk': 'METADATA',
        },
        ProjectionExpression: 'PK, SK, flagKey, description, defaultEnabled, owner, createdAt, expiresAt, environment',
      }));

      return result.Items as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('listFlagsWithScan', error, { environment: this.environment });
    }
  }

  // テナント別オーバーライド一覧を取得
  async listTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]> {
    try {
      const pk = `TENANT#${this.environment}#${tenantId}`;
      
      debugLog(this.environment, `Listing tenant overrides: ${tenantId}`, { pk, environment: this.environment });
      
      const result = await this.dynamoDb.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': 'FLAG#',
        },
      }));

      return result.Items as TenantOverridesTable[];
    } catch (error) {
      this.handleError('listTenantOverrides', error, { tenantId, environment: this.environment });
    }
  }

  // バッチ操作用のヘルパー
  async batchGetFlags(flagKeys: string[]): Promise<FeatureFlagsTable[]> {
    try {
      const requestItems = flagKeys.map(flagKey => ({
        PK: `FLAG#${this.environment}#${flagKey}`,
        SK: 'METADATA',
      }));

      debugLog(this.environment, `Batch getting flags: ${flagKeys.join(', ')}`, { flagKeys, environment: this.environment });

      const result = await this.dynamoDb.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: requestItems,
          },
        },
      }));

      return result.Responses?.[this.tableName] as FeatureFlagsTable[] || [];
    } catch (error) {
      this.handleError('batchGetFlags', error, { flagKeys, environment: this.environment });
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