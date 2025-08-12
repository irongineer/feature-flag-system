import { FeatureFlagKey, FeatureFlagContext, FEATURE_FLAGS, Environment, ENVIRONMENTS } from '../models';
import { FeatureFlagCache } from '../cache';
import { DynamoDbClient, DynamoDbClientConfig } from './dynamo-client';
import { DynamoKeyBuilder } from '../constants/dynamo-keys';
import {
  ErrorHandler,
  ErrorHandlingOptions,
  defaultErrorHandler,
  StructuredError,
} from '../types/error-handling';
import { getCurrentEnvironment, debugLog } from '../config/environment';
import { RolloutEngine, RolloutConfig, RolloutContext } from '../rollout';

export interface FeatureFlagEvaluatorOptions extends ErrorHandlingOptions {
  cache?: FeatureFlagCache;
  dynamoDbClient?: DynamoDbClient;
  dynamoConfig?: DynamoDbClientConfig;
  environment?: Environment; // 環境指定の追加
  useMock?: boolean;
  rolloutEngine?: RolloutEngine; // 段階的ロールアウトエンジン
}

// 統合テスト用の新しいインターフェース
export interface FeatureFlagEvaluatorConfig extends ErrorHandlingOptions {
  cache?: FeatureFlagCache;
  dynamoDbClient: DynamoDbClient;
  environment?: Environment; // 環境指定の追加
  rolloutEngine?: RolloutEngine; // 段階的ロールアウトエンジン
}

export class FeatureFlagEvaluator {
  private cache: FeatureFlagCache;
  private dynamoDbClient: DynamoDbClient | MockDynamoDbClient;
  private errorHandler: ErrorHandler;
  private environment: Environment;
  private rolloutEngine: RolloutEngine;

  // 既存コンストラクタ（単体テスト用）
  constructor(options: FeatureFlagEvaluatorOptions);
  // 新コンストラクタ（統合テスト用）
  constructor(config: FeatureFlagEvaluatorConfig);
  constructor(optionsOrConfig: FeatureFlagEvaluatorOptions | FeatureFlagEvaluatorConfig = {}) {
    this.cache = optionsOrConfig.cache || new FeatureFlagCache();
    this.errorHandler = optionsOrConfig.errorHandler || defaultErrorHandler;
    this.environment = optionsOrConfig.environment || getCurrentEnvironment();
    this.rolloutEngine = optionsOrConfig.rolloutEngine || new RolloutEngine();

    debugLog(this.environment, 'FeatureFlagEvaluator initialized', {
      environment: this.environment,
    });

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
        // 環境情報をDynamoDbClientに渡す
        const configWithEnv = { ...options.dynamoConfig, environment: this.environment };
        this.dynamoDbClient = new DynamoDbClient(configWithEnv);
      } else {
        // デフォルト: モック実装
        this.dynamoDbClient = new MockDynamoDbClient(this.environment);
      }
    }
  }

  // オーバーロード（単体テスト用）
  async isEnabled(context: FeatureFlagContext, flagKey: FeatureFlagKey): Promise<boolean>;
  // オーバーロード（統合テスト用）
  async isEnabled(tenantId: string, flagKey: string): Promise<boolean>;
  async isEnabled(
    contextOrTenantId: FeatureFlagContext | string,
    flagKey: FeatureFlagKey | string
  ): Promise<boolean> {
    // パラメータの正規化と環境情報の取得
    let tenantId: string;
    let environment: Environment;

    if (typeof contextOrTenantId === 'string') {
      tenantId = contextOrTenantId;
      environment = this.environment; // デフォルト環境
    } else {
      tenantId = contextOrTenantId.tenantId;
      environment = contextOrTenantId.environment || this.environment;
    }

    const normalizedFlagKey = flagKey as FeatureFlagKey;

    // 環境が一致しない場合はエラー（try-catchの外で検証）
    if (environment !== this.environment) {
      throw new Error(
        `Environment mismatch: evaluator is configured for ${this.environment}, but context specifies ${environment}`
      );
    }

    debugLog(environment, `Evaluating flag: ${normalizedFlagKey}`, { tenantId, environment });

    try {
      // 1. Kill-Switch チェック
      if (await this.checkKillSwitch(normalizedFlagKey)) {
        debugLog(environment, `Kill-switch activated for flag: ${normalizedFlagKey}`);
        return false;
      }

      // 2. キャッシュチェック
      const cached = this.cache.get(tenantId, normalizedFlagKey);
      if (cached !== undefined) {
        debugLog(environment, `Cache hit for flag: ${normalizedFlagKey}`, { value: cached });
        return cached;
      }

      // 3. テナント別オーバーライドチェック
      const tenantOverride = await this.getTenantOverride(tenantId, normalizedFlagKey);
      if (tenantOverride !== undefined) {
        this.cache.set(tenantId, normalizedFlagKey, tenantOverride);
        debugLog(environment, `Tenant override found for flag: ${normalizedFlagKey}`, {
          value: tenantOverride,
        });
        return tenantOverride;
      }

      // 4. デフォルト値取得
      const defaultValue = await this.getDefaultValue(normalizedFlagKey);
      this.cache.set(tenantId, normalizedFlagKey, defaultValue);
      debugLog(environment, `Default value used for flag: ${normalizedFlagKey}`, {
        value: defaultValue,
      });
      return defaultValue;
    } catch (error) {
      const errorInfo: StructuredError = {
        operation: 'feature-flag-evaluation',
        tenantId:
          typeof contextOrTenantId === 'string' ? contextOrTenantId : contextOrTenantId.tenantId,
        flagKey: flagKey as string,
        environment:
          typeof contextOrTenantId === 'string'
            ? this.environment
            : contextOrTenantId.environment || this.environment,
        error: error as Error,
        timestamp: new Date().toISOString(),
      };
      this.errorHandler(errorInfo);
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
      this.errorHandler(`Kill-switch check failed: ${(error as Error).message}`);
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
      const errorInfo: StructuredError = {
        operation: 'tenant-override-check',
        tenantId,
        flagKey,
        error: error as Error,
        timestamp: new Date().toISOString(),
      };
      this.errorHandler(errorInfo);
      return undefined;
    }
  }

  private async getDefaultValue(flagKey: FeatureFlagKey): Promise<boolean> {
    try {
      const result = await this.dynamoDbClient.getFlag(flagKey);
      return result ? result.defaultEnabled : false;
    } catch (error) {
      const errorInfo: StructuredError = {
        operation: 'default-value-check',
        flagKey,
        error: error as Error,
        timestamp: new Date().toISOString(),
      };
      this.errorHandler(errorInfo);
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

  /**
   * 段階的ロールアウト対応のフラグ評価
   *
   * @param context ロールアウト対応のコンテキスト
   * @param flagKey フラグキー
   * @param rolloutConfig ロールアウト設定（オプショナル）
   * @returns フラグの有効性
   */
  async isEnabledWithRollout(
    context: RolloutContext,
    flagKey: FeatureFlagKey,
    rolloutConfig?: RolloutConfig
  ): Promise<boolean> {
    // 環境が一致しない場合はエラー
    const environment = context.environment || this.environment;
    if (environment !== this.environment) {
      throw new Error(
        `Environment mismatch: evaluator is configured for ${this.environment}, but context specifies ${environment}`
      );
    }

    debugLog(environment, 'Evaluating flag with rollout', {
      tenantId: context.tenantId,
      flagKey,
      hasRolloutConfig: !!rolloutConfig,
    });

    try {
      // 1. Kill-Switch チェック（ロールアウトより優先）
      if (await this.checkKillSwitch(flagKey)) {
        debugLog(environment, `Kill-switch activated for flag: ${flagKey}`);
        return false;
      }

      // 2. キャッシュチェック（ロールアウト設定がない場合のみ）
      if (!rolloutConfig) {
        const cached = this.cache.get(context.tenantId, flagKey);
        if (cached !== undefined) {
          debugLog(environment, `Cache hit for flag: ${flagKey}`, { value: cached });
          return cached;
        }
      }

      // 3. テナント別オーバーライドチェック
      const tenantOverride = await this.getTenantOverride(context.tenantId, flagKey);
      if (tenantOverride !== undefined) {
        // ロールアウト設定がある場合の優先順位を明確化
        if (rolloutConfig && tenantOverride !== undefined) {
          // 仕様: テナントオーバーライドが無効(false)の場合は常にfalseを返す
          // テナントオーバーライドが有効(true)の場合のみロールアウト判定を適用
          if (!tenantOverride) {
            debugLog(environment, `Tenant override disabled for flag: ${flagKey}`, {
              tenantOverride,
              finalResult: false,
            });
            return false;
          }

          // テナントオーバーライドが有効な場合、ロールアウト制御を適用
          const rolloutResult = await this.rolloutEngine.evaluateRollout(
            context,
            flagKey,
            rolloutConfig
          );

          debugLog(environment, `Tenant override with rollout for flag: ${flagKey}`, {
            tenantOverride,
            rolloutResult,
            finalResult: rolloutResult,
          });
          return rolloutResult;
        } else {
          // ロールアウト設定がない場合は通常通り
          if (!rolloutConfig) {
            this.cache.set(context.tenantId, flagKey, tenantOverride);
          }
          debugLog(environment, `Tenant override found for flag: ${flagKey}`, {
            value: tenantOverride,
          });
          return tenantOverride;
        }
      }

      // 4. デフォルト値取得
      const defaultValue = await this.getDefaultValue(flagKey);

      // 5. ロールアウト判定（デフォルト値が有効な場合のみ）
      if (rolloutConfig && defaultValue) {
        const rolloutResult = await this.rolloutEngine.evaluateRollout(
          context,
          flagKey,
          rolloutConfig
        );
        const finalResult = defaultValue && rolloutResult;

        debugLog(environment, `Default value with rollout for flag: ${flagKey}`, {
          defaultValue,
          rolloutResult,
          finalResult,
        });
        return finalResult;
      } else {
        // ロールアウト設定がない場合は通常通り
        if (!rolloutConfig) {
          this.cache.set(context.tenantId, flagKey, defaultValue);
        }
        debugLog(environment, `Default value used for flag: ${flagKey}`, { value: defaultValue });
        return defaultValue;
      }
    } catch (error) {
      const errorInfo: StructuredError = {
        operation: 'feature-flag-evaluation-with-rollout',
        tenantId: context.tenantId,
        flagKey,
        environment,
        error: error as Error,
        timestamp: new Date().toISOString(),
        rolloutConfig: rolloutConfig ? 'enabled' : 'disabled',
      };
      this.errorHandler(errorInfo);
      return this.getFallbackValue(flagKey);
    }
  }
}

// モック実装（ローカル開発用）
class MockDynamoDbClient {
  private data: Map<string, any>;
  private environment: Environment;

  constructor(environment: Environment = ENVIRONMENTS.DEVELOPMENT) {
    this.environment = environment;
    this.data = new Map();
    this.seedData();
  }

  async getFlag(flagKey: FeatureFlagKey): Promise<any> {
    const key = DynamoKeyBuilder.flagMetadata(flagKey);
    const item = this.data.get(key);
    // 環境が一致するものを返す
    if (item && item.PK.includes(`#${this.environment}#`)) {
      return item;
    }
    return null;
  }

  async getTenantOverride(tenantId: string, flagKey: FeatureFlagKey): Promise<any> {
    const key = DynamoKeyBuilder.tenantFlag(tenantId, flagKey);
    const item = this.data.get(key);
    // 環境が一致するものを返す
    if (item && item.PK.includes(`#${this.environment}#`)) {
      return item;
    }
    return null;
  }

  async getKillSwitch(flagKey?: FeatureFlagKey): Promise<any> {
    const key = DynamoKeyBuilder.emergencyKey(flagKey);
    const item = this.data.get(key);
    // 環境が一致するものを返す
    if (item && item.PK.includes(`#${this.environment}`)) {
      return item;
    }
    return null;
  }

  async setKillSwitch(
    flagKey: FeatureFlagKey | null,
    enabled: boolean,
    reason: string,
    activatedBy: string
  ): Promise<void> {
    const key = DynamoKeyBuilder.emergencyKey(flagKey || undefined);
    const sk = flagKey ? `FLAG#${flagKey}` : 'GLOBAL';
    this.data.set(key, {
      PK: `EMERGENCY#${this.environment}`,
      SK: sk,
      enabled,
      environment: this.environment,
      reason,
      activatedAt: new Date().toISOString(),
      activatedBy,
    });
  }

  async get(params: { TableName: string; Key: { PK: string; SK: string } }): Promise<any> {
    const key = DynamoKeyBuilder.compositeKey(params.Key.PK, params.Key.SK);
    return this.data.get(key);
  }

  async put(params: { TableName: string; Item: any }): Promise<void> {
    const key = DynamoKeyBuilder.compositeKey(params.Item.PK, params.Item.SK);
    this.data.set(key, params.Item);
  }

  private seedData(): void {
    // デフォルトフラグ設定（環境分離対応）
    Object.values(FEATURE_FLAGS).forEach(flagKey => {
      const key = DynamoKeyBuilder.flagMetadata(flagKey);
      this.data.set(key, {
        PK: `FLAG#${this.environment}#${flagKey}`,
        SK: 'METADATA',
        flagKey,
        description: `Feature flag for ${flagKey} in ${this.environment}`,
        defaultEnabled: false,
        owner: 'system',
        environment: this.environment,
        createdAt: new Date().toISOString(),
      });
    });

    // テスト用のテナントオーバーライド（環境分離対応）
    const tenantOverrideKey = DynamoKeyBuilder.tenantFlag('test-tenant-1', 'billing_v2_enable');
    this.data.set(tenantOverrideKey, {
      PK: `TENANT#${this.environment}#test-tenant-1`,
      SK: 'FLAG#billing_v2_enable',
      enabled: true,
      environment: this.environment,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    });
  }
}
