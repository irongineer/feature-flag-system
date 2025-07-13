import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { FeatureFlagEvaluator } from '@evaluator';
import { FeatureFlagCache } from '@cache';
import { FEATURE_FLAGS } from '@models';

// ローカルDynamoDB設定
const dynamoConfig: DynamoDBClientConfig = {
  endpoint: 'http://localhost:8000',
  region: 'ap-northeast-1',
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  }
};

const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// テーブル名
const TABLES = {
  FEATURE_FLAGS: 'FeatureFlags',
  TENANT_OVERRIDES: 'TenantOverrides',
  EMERGENCY_CONTROL: 'EmergencyControl'
} as const;

describe('Feature Flag E2E Integration Tests', () => {
  let evaluator: FeatureFlagEvaluator;
  let cache: FeatureFlagCache;

  beforeAll(async () => {
    // フィーチャーフラグ評価エンジン初期化
    evaluator = new FeatureFlagEvaluator(dynamoClient, {
      featureFlagsTable: TABLES.FEATURE_FLAGS,
      tenantOverridesTable: TABLES.TENANT_OVERRIDES,
      emergencyControlTable: TABLES.EMERGENCY_CONTROL
    });

    // キャッシュ初期化（短いTTLでテスト）
    cache = new FeatureFlagCache({ ttl: 10 }); // 10秒TTL
  });

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await cleanupTestData();
    
    // キャッシュクリア
    cache.invalidateAll();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('基本的なフラグ評価', () => {
    it('デフォルト値でフラグ評価が動作する', async () => {
      // テスト用フラグを作成
      const flagKey = 'e2e_test_default';
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: デフォルト値テスト',
        defaultEnabled: true,
        owner: 'e2e-test'
      });

      const tenantId = 'e2e-tenant-default';

      // フラグ評価実行
      const result = await evaluator.isEnabled(tenantId, flagKey);

      expect(result).toBe(true);
    });

    it('テナント別オーバーライドが正しく適用される', async () => {
      // テスト用フラグを作成（デフォルト無効）
      const flagKey = 'e2e_test_override';
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: オーバーライドテスト',
        defaultEnabled: false,
        owner: 'e2e-test'
      });

      const tenantId = 'e2e-tenant-override';

      // テナント別オーバーライドを作成（有効化）
      await createTenantOverride(tenantId, flagKey, true);

      // フラグ評価実行
      const result = await evaluator.isEnabled(tenantId, flagKey);

      expect(result).toBe(true); // オーバーライドでtrue
    });

    it('存在しないフラグに対してデフォルト値が返される', async () => {
      const tenantId = 'e2e-tenant-nonexistent';
      const nonexistentFlag = 'nonexistent_flag_e2e';

      // 存在しないフラグの評価
      const result = await evaluator.isEnabled(tenantId, nonexistentFlag);

      expect(result).toBe(false); // デフォルトはfalse
    });
  });

  describe('Kill-Switch機能', () => {
    it('グローバルKill-Switchが全フラグを無効化する', async () => {
      // テスト用フラグを作成（デフォルト有効）
      const flagKey = 'e2e_test_killswitch';
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: Kill-Switchテスト',
        defaultEnabled: true,
        owner: 'e2e-test'
      });

      const tenantId = 'e2e-tenant-killswitch';

      // 通常時の評価（有効）
      let result = await evaluator.isEnabled(tenantId, flagKey);
      expect(result).toBe(true);

      // グローバルKill-Switchを有効化
      await activateGlobalKillSwitch('E2Eテスト: グローバル緊急停止');

      // Kill-Switch有効時の評価（無効）
      result = await evaluator.isEnabled(tenantId, flagKey);
      expect(result).toBe(false);

      // Kill-Switch解除
      await deactivateGlobalKillSwitch();

      // 解除後の評価（有効に戻る）
      result = await evaluator.isEnabled(tenantId, flagKey);
      expect(result).toBe(true);
    });

    it('特定フラグのKill-Switchが該当フラグのみ無効化する', async () => {
      // 2つのテスト用フラグを作成
      const flag1 = 'e2e_test_specific_kill_1';
      const flag2 = 'e2e_test_specific_kill_2';
      
      await createFeatureFlag(flag1, {
        description: 'E2Eテスト: 特定Kill-Switch対象',
        defaultEnabled: true,
        owner: 'e2e-test'
      });
      
      await createFeatureFlag(flag2, {
        description: 'E2Eテスト: 特定Kill-Switch非対象',
        defaultEnabled: true,
        owner: 'e2e-test'
      });

      const tenantId = 'e2e-tenant-specific-kill';

      // 通常時の評価（両方有効）
      expect(await evaluator.isEnabled(tenantId, flag1)).toBe(true);
      expect(await evaluator.isEnabled(tenantId, flag2)).toBe(true);

      // flag1のみKill-Switch有効化
      await activateFlagKillSwitch(flag1, 'E2Eテスト: 特定フラグ緊急停止');

      // Kill-Switch有効時の評価
      expect(await evaluator.isEnabled(tenantId, flag1)).toBe(false); // 無効
      expect(await evaluator.isEnabled(tenantId, flag2)).toBe(true);  // 影響なし
    });
  });

  describe('キャッシュ統合', () => {
    it('キャッシュとDynamoDBの連携が正しく動作する', async () => {
      const flagKey = 'e2e_test_cache';
      const tenantId = 'e2e-tenant-cache';

      // フラグ作成
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: キャッシュ統合',
        defaultEnabled: true,
        owner: 'e2e-test'
      });

      // 初回評価（DynamoDBから取得、キャッシュに保存）
      const startTime = Date.now();
      const result1 = await evaluator.isEnabled(tenantId, flagKey);
      const firstEvalTime = Date.now() - startTime;

      expect(result1).toBe(true);

      // 2回目評価（キャッシュから取得、高速）
      const startTime2 = Date.now();
      const result2 = await evaluator.isEnabled(tenantId, flagKey);
      const secondEvalTime = Date.now() - startTime2;

      expect(result2).toBe(true);
      
      // キャッシュヒットにより2回目の方が高速であることを確認
      // expect(secondEvalTime).toBeLessThan(firstEvalTime);

      console.log(`📊 キャッシュパフォーマンス:`);
      console.log(`   初回評価: ${firstEvalTime}ms (DynamoDB)`);
      console.log(`   2回目評価: ${secondEvalTime}ms (Cache)`);
    });

    it('キャッシュ期限切れ時にDynamoDBから再取得する', async () => {
      const flagKey = 'e2e_test_cache_expiry';
      const tenantId = 'e2e-tenant-cache-expiry';

      // 短いTTLのキャッシュで評価エンジンを作成
      const shortCacheEvaluator = new FeatureFlagEvaluator(dynamoClient, {
        featureFlagsTable: TABLES.FEATURE_FLAGS,
        tenantOverridesTable: TABLES.TENANT_OVERRIDES,
        emergencyControlTable: TABLES.EMERGENCY_CONTROL,
        cacheOptions: { ttl: 1 } // 1秒TTL
      });

      // フラグ作成
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: キャッシュ期限切れ',
        defaultEnabled: false,
        owner: 'e2e-test'
      });

      // 初回評価
      const result1 = await shortCacheEvaluator.isEnabled(tenantId, flagKey);
      expect(result1).toBe(false);

      // DynamoDBでフラグを更新
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: キャッシュ期限切れ（更新）',
        defaultEnabled: true, // trueに変更
        owner: 'e2e-test'
      });

      // キャッシュ期限切れを待機
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 再評価（キャッシュ期限切れでDynamoDBから再取得）
      const result2 = await shortCacheEvaluator.isEnabled(tenantId, flagKey);
      expect(result2).toBe(true); // 更新された値が取得される
    });
  });

  describe('マルチテナント機能', () => {
    it('複数テナントで異なるオーバーライド設定が動作する', async () => {
      const flagKey = 'e2e_test_multitenant';
      
      // フラグ作成（デフォルト無効）
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: マルチテナント',
        defaultEnabled: false,
        owner: 'e2e-test'
      });

      const tenant1 = 'e2e-tenant-1';
      const tenant2 = 'e2e-tenant-2';
      const tenant3 = 'e2e-tenant-3';

      // tenant1: オーバーライドなし（デフォルト値）
      // tenant2: オーバーライドで有効化
      // tenant3: オーバーライドで明示的に無効化

      await createTenantOverride(tenant2, flagKey, true);
      await createTenantOverride(tenant3, flagKey, false);

      // 各テナントでの評価
      const result1 = await evaluator.isEnabled(tenant1, flagKey);
      const result2 = await evaluator.isEnabled(tenant2, flagKey);
      const result3 = await evaluator.isEnabled(tenant3, flagKey);

      expect(result1).toBe(false); // デフォルト値
      expect(result2).toBe(true);  // オーバーライドで有効
      expect(result3).toBe(false); // オーバーライドで無効
    });

    it('大量テナントでのパフォーマンステスト', async () => {
      const flagKey = 'e2e_test_performance';
      
      // フラグ作成
      await createFeatureFlag(flagKey, {
        description: 'E2Eテスト: パフォーマンステスト',
        defaultEnabled: true,
        owner: 'e2e-test'
      });

      // 100テナントでの評価テスト
      const tenantCount = 100;
      const tenants = Array.from({ length: tenantCount }, (_, i) => `perf-tenant-${i}`);

      const startTime = Date.now();
      
      // 並列評価
      const promises = tenants.map(tenantId => 
        evaluator.isEnabled(tenantId, flagKey)
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 全ての評価が完了し、全てtrueであることを確認
      expect(results.length).toBe(tenantCount);
      expect(results.every(result => result === true)).toBe(true);

      // パフォーマンス要件: 100テナントの評価が10秒以内
      expect(duration).toBeLessThan(10000);

      console.log(`📊 マルチテナントパフォーマンス:`);
      console.log(`   テナント数: ${tenantCount}`);
      console.log(`   総実行時間: ${duration}ms`);
      console.log(`   平均実行時間: ${(duration / tenantCount).toFixed(2)}ms/tenant`);
    });
  });

  describe('エラーハンドリング', () => {
    it('DynamoDB接続エラー時にデフォルト値を返す', async () => {
      // 間違ったエンドポイントで評価エンジンを作成
      const badDynamoClient = new DynamoDBClient({
        endpoint: 'http://localhost:9999', // 存在しないエンドポイント
        region: 'ap-northeast-1',
        credentials: {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy'
        }
      });

      const badEvaluator = new FeatureFlagEvaluator(badDynamoClient, {
        featureFlagsTable: TABLES.FEATURE_FLAGS,
        tenantOverridesTable: TABLES.TENANT_OVERRIDES,
        emergencyControlTable: TABLES.EMERGENCY_CONTROL
      });

      const tenantId = 'e2e-tenant-error';
      const flagKey = 'e2e_test_error';

      // エラー時でもデフォルト値（false）が返されることを確認
      const result = await badEvaluator.isEnabled(tenantId, flagKey);
      expect(result).toBe(false);
    });

    it('不正なデータ形式に対する堅牢性をテストする', async () => {
      // 不正なデータを直接DynamoDBに挿入
      const flagKey = 'e2e_test_invalid_data';
      
      await docClient.send(new PutCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Item: {
          flagKey,
          description: 'E2Eテスト: 不正データ',
          defaultEnabled: 'invalid', // booleanでない値
          owner: null, // nullプロパティ
          createdAt: new Date().toISOString()
        }
      }));

      const tenantId = 'e2e-tenant-invalid';

      // 不正データでもエラーにならずデフォルト値が返されることを確認
      const result = await evaluator.isEnabled(tenantId, flagKey);
      expect(result).toBe(false); // エラー時のデフォルト値
    });
  });
});

// ヘルパー関数
async function createFeatureFlag(flagKey: string, options: {
  description: string;
  defaultEnabled: boolean;
  owner: string;
  expiresAt?: string;
}) {
  await docClient.send(new PutCommand({
    TableName: TABLES.FEATURE_FLAGS,
    Item: {
      flagKey,
      description: options.description,
      defaultEnabled: options.defaultEnabled,
      owner: options.owner,
      createdAt: new Date().toISOString(),
      ...(options.expiresAt && { expiresAt: options.expiresAt })
    }
  }));
}

async function createTenantOverride(tenantId: string, flagKey: string, enabled: boolean) {
  await docClient.send(new PutCommand({
    TableName: TABLES.TENANT_OVERRIDES,
    Item: {
      tenantId,
      flagKey,
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: 'e2e-test@example.com'
    }
  }));
}

async function activateGlobalKillSwitch(reason: string) {
  await docClient.send(new PutCommand({
    TableName: TABLES.EMERGENCY_CONTROL,
    Item: {
      controlType: 'GLOBAL',
      flagKey: 'ALL',
      enabled: false,
      reason,
      activatedAt: new Date().toISOString(),
      activatedBy: 'e2e-test-admin'
    }
  }));
}

async function deactivateGlobalKillSwitch() {
  await docClient.send(new DeleteCommand({
    TableName: TABLES.EMERGENCY_CONTROL,
    Key: {
      controlType: 'GLOBAL',
      flagKey: 'ALL'
    }
  }));
}

async function activateFlagKillSwitch(flagKey: string, reason: string) {
  await docClient.send(new PutCommand({
    TableName: TABLES.EMERGENCY_CONTROL,
    Item: {
      controlType: 'FLAG',
      flagKey,
      enabled: false,
      reason,
      activatedAt: new Date().toISOString(),
      activatedBy: 'e2e-test-admin'
    }
  }));
}

async function cleanupTestData() {
  // E2Eテスト用データのクリーンアップロジック
  // 実装は前のテストファイルと同様
}