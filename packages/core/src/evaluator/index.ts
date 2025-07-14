import { 
  FeatureFlagKey, 
  FeatureFlagContext, 
  FeatureFlagsTable, 
  TenantOverridesTable, 
  EmergencyControlTable,
  FEATURE_FLAGS 
} from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';

export interface FeatureFlagEvaluatorOptions {
  cache?: FeatureFlagCache;
  dynamoDbClient?: DynamoDbClient;
  dynamoConfig?: DynamoDbClientConfig;
  useMock?: boolean;
}

// 統合テスト用の新しいインターフェース
export interface FeatureFlagEvaluatorConfig {
  cache?: FeatureFlagCache;
  dynamoDbClient: DynamoDbClient;
}

export class FeatureFlagEvaluator {
  private cache: FeatureFlagCache;
  private dynamoDbClient: DynamoDbClient | MockDynamoDbClient;

  // 既存コンストラクタ（単体テスト用）
  constructor(options: FeatureFlagEvaluatorOptions);
  // 新コンストラクタ（統合テスト用）
  constructor(config: FeatureFlagEvaluatorConfig);
  constructor(optionsOrConfig: FeatureFlagEvaluatorOptions | FeatureFlagEvaluatorConfig = {}) {
    this.cache = optionsOrConfig.cache || new FeatureFlagCache();
    
    // 新しい形式（FeatureFlagEvaluatorConfig）の場合
    if ('dynamoDbClient' in optionsOrConfig && optionsOrConfig.dynamoDbClient) {
      this.dynamoDbClient = optionsOrConfig.dynamoDbClient;
    }
    // 既存形式（FeatureFlagEvaluatorOptions）の場合  
    else {
      const options = optionsOrConfig as FeatureFlagEvaluatorOptions;
      if (options.dynamoDbClient) {
        this.dynamoDbClient = options.dynamoDbClient;
      } else if (options.dynamoConfig) {
        this.dynamoDbClient = new DynamoDbClient(options.dynamoConfig);
      } else {
        // デフォルト: モック実装
        this.dynamoDbClient = new MockDynamoDbClient();
      }
    }
  }

  // 既存シグネチャ（単体テスト用）
  async isEnabled(context: FeatureFlagContext, flagKey: FeatureFlagKey): Promise<boolean>;
  // 新シグネチャ（統合テスト用）
  async isEnabled(tenantId: string, flagKey: string): Promise<boolean>;
  async isEnabled(
    contextOrTenantId: FeatureFlagContext | string,
    flagKey: FeatureFlagKey | string
  ): Promise<boolean> {
    try {
      // パラメータの正規化
      const tenantId = typeof contextOrTenantId === 'string' 
        ? contextOrTenantId 
        : contextOrTenantId.tenantId;
      const normalizedFlagKey = flagKey as FeatureFlagKey;

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
    } catch (error) {
      console.error('FeatureFlag evaluation failed:', error);
      return this.getFallbackValue(flagKey as FeatureFlagKey);
    }
  }

  private async checkKillSwitch(flagKey: FeatureFlagKey): Promise<boolean> {
    try {
      // グローバル Kill-Switch チェック
      const globalKillSwitch = await this.dynamoDbClient.getKillSwitch();
      if (globalKillSwitch && globalKillSwitch.enabled) {
        return true;
      }

      // 特定フラグの Kill-Switch チェック
      const flagKillSwitch = await this.dynamoDbClient.getKillSwitch(flagKey);
      return flagKillSwitch && flagKillSwitch.enabled;
    } catch (error) {
      console.error('Kill-switch check failed:', error);
      return false;
    }
  }

  private async getTenantOverride(
    tenantId: string,
    flagKey: FeatureFlagKey
  ): Promise<boolean | undefined> {
    try {
      const result = await this.dynamoDbClient.getTenantOverride(tenantId, flagKey);
      return result ? result.enabled : undefined;
    } catch (error) {
      console.error('Tenant override check failed:', error);
      return undefined;
    }
  }

  private async getDefaultValue(flagKey: FeatureFlagKey): Promise<boolean> {
    try {
      const result = await this.dynamoDbClient.getFlag(flagKey);
      return result ? result.defaultEnabled : false;
    } catch (error) {
      console.error('Default value check failed:', error);
      return this.getFallbackValue(flagKey);
    }
  }

  private getFallbackValue(flagKey: FeatureFlagKey): boolean {
    // フォールバック値（通常は false で安全側に倒す）
    return false;
  }

  async invalidateCache(tenantId: string, flagKey: FeatureFlagKey | string): Promise<void> {
    this.cache.invalidate(tenantId, flagKey as FeatureFlagKey);
  }

  async invalidateAllCache(): Promise<void> {
    this.cache.invalidateAll();
  }
}

// モック実装（ローカル開発用）
class MockDynamoDbClient {
  private data: Map<string, any>;

  constructor() {
    this.data = new Map();
    this.seedData();
  }

  async getFlag(flagKey: FeatureFlagKey): Promise<any> {
    const key = `FLAG#${flagKey}#METADATA`;
    return this.data.get(key);
  }

  async getTenantOverride(tenantId: string, flagKey: FeatureFlagKey): Promise<any> {
    const key = `TENANT#${tenantId}#FLAG#${flagKey}`;
    return this.data.get(key);
  }

  async getKillSwitch(flagKey?: FeatureFlagKey): Promise<any> {
    const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
    const key = `EMERGENCY#${sk}`;
    return this.data.get(key);
  }

  async setKillSwitch(flagKey: FeatureFlagKey | null, enabled: boolean, reason: string, activatedBy: string): Promise<void> {
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

  async get(params: { TableName: string; Key: { PK: string; SK: string } }): Promise<any> {
    const key = `${params.Key.PK}#${params.Key.SK}`;
    return this.data.get(key);
  }

  async put(params: { TableName: string; Item: any }): Promise<void> {
    const key = `${params.Item.PK}#${params.Item.SK}`;
    this.data.set(key, params.Item);
  }

  private seedData(): void {
    // デフォルトフラグ設定
    Object.values(FEATURE_FLAGS).forEach(flagKey => {
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