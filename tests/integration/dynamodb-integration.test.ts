import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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

describe('DynamoDB Local Integration Tests', () => {
  beforeAll(async () => {
    // DynamoDB Local接続確認
    try {
      await docClient.send(new ScanCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Limit: 1
      }));
    } catch (error) {
      throw new Error(
        'DynamoDB Local に接続できません。scripts/start-local-aws.sh を実行してください。\n' +
        `Error: ${error}`
      );
    }
  });

  beforeEach(async () => {
    // テストデータクリーンアップ
    await cleanupTestData();
  });

  afterAll(async () => {
    // 最終クリーンアップ
    await cleanupTestData();
  });

  describe('FeatureFlags テーブル操作', () => {
    it('フィーチャーフラグの作成・取得・削除ができる', async () => {
      const flagKey = 'test_flag_integration';
      const flagData = {
        flagKey,
        description: '統合テスト用フラグ',
        defaultEnabled: true,
        owner: 'integration-test',
        createdAt: new Date().toISOString()
      };

      // 作成
      await docClient.send(new PutCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Item: flagData
      }));

      // 取得
      const getResult = await docClient.send(new GetCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Key: { flagKey }
      }));

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.flagKey).toBe(flagKey);
      expect(getResult.Item?.description).toBe('統合テスト用フラグ');
      expect(getResult.Item?.defaultEnabled).toBe(true);

      // 削除
      await docClient.send(new DeleteCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Key: { flagKey }
      }));

      // 削除確認
      const deletedResult = await docClient.send(new GetCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Key: { flagKey }
      }));

      expect(deletedResult.Item).toBeUndefined();
    });

    it('複数のフィーチャーフラグをバッチ処理できる', async () => {
      const flags = [
        {
          flagKey: 'batch_test_1',
          description: 'バッチテスト1',
          defaultEnabled: true,
          owner: 'batch-test',
          createdAt: new Date().toISOString()
        },
        {
          flagKey: 'batch_test_2', 
          description: 'バッチテスト2',
          defaultEnabled: false,
          owner: 'batch-test',
          createdAt: new Date().toISOString()
        },
        {
          flagKey: 'batch_test_3',
          description: 'バッチテスト3',
          defaultEnabled: true,
          owner: 'batch-test',
          createdAt: new Date().toISOString()
        }
      ];

      // バッチ作成
      for (const flag of flags) {
        await docClient.send(new PutCommand({
          TableName: TABLES.FEATURE_FLAGS,
          Item: flag
        }));
      }

      // スキャンして確認
      const scanResult = await docClient.send(new ScanCommand({
        TableName: TABLES.FEATURE_FLAGS,
        FilterExpression: 'begins_with(flagKey, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': 'batch_test_'
        }
      }));

      expect(scanResult.Items).toBeDefined();
      expect(scanResult.Items?.length).toBe(3);

      // 作成したフラグが全て存在することを確認
      const flagKeys = scanResult.Items?.map(item => item.flagKey) || [];
      expect(flagKeys).toContain('batch_test_1');
      expect(flagKeys).toContain('batch_test_2');
      expect(flagKeys).toContain('batch_test_3');
    });
  });

  describe('TenantOverrides テーブル操作', () => {
    it('テナント別オーバーライドの管理ができる', async () => {
      const tenantId = 'integration-tenant-001';
      const flagKey = FEATURE_FLAGS.BILLING_V2;
      
      const overrideData = {
        tenantId,
        flagKey,
        enabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 'integration-test@example.com'
      };

      // オーバーライド作成
      await docClient.send(new PutCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        Item: overrideData
      }));

      // 取得
      const getResult = await docClient.send(new GetCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        Key: { tenantId, flagKey }
      }));

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.tenantId).toBe(tenantId);
      expect(getResult.Item?.flagKey).toBe(flagKey);
      expect(getResult.Item?.enabled).toBe(true);

      // 更新
      const updatedData = { ...overrideData, enabled: false };
      await docClient.send(new PutCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        Item: updatedData
      }));

      const updatedResult = await docClient.send(new GetCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        Key: { tenantId, flagKey }
      }));

      expect(updatedResult.Item?.enabled).toBe(false);
    });

    it('同一テナントで複数フラグのオーバーライドができる', async () => {
      const tenantId = 'multi-flag-tenant';
      const overrides = [
        {
          tenantId,
          flagKey: FEATURE_FLAGS.BILLING_V2,
          enabled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: 'multi-test@example.com'
        },
        {
          tenantId,
          flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
          enabled: false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'multi-test@example.com'
        },
        {
          tenantId,
          flagKey: FEATURE_FLAGS.ADVANCED_ANALYTICS,
          enabled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: 'multi-test@example.com'
        }
      ];

      // 複数オーバーライド作成
      for (const override of overrides) {
        await docClient.send(new PutCommand({
          TableName: TABLES.TENANT_OVERRIDES,
          Item: override
        }));
      }

      // テナント別にスキャン
      const scanResult = await docClient.send(new ScanCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        FilterExpression: 'tenantId = :tenantId',
        ExpressionAttributeValues: {
          ':tenantId': tenantId
        }
      }));

      expect(scanResult.Items).toBeDefined();
      expect(scanResult.Items?.length).toBe(3);

      // 各フラグのオーバーライド設定を確認
      const items = scanResult.Items || [];
      const billingOverride = items.find(item => item.flagKey === FEATURE_FLAGS.BILLING_V2);
      const dashboardOverride = items.find(item => item.flagKey === FEATURE_FLAGS.NEW_DASHBOARD);
      const analyticsOverride = items.find(item => item.flagKey === FEATURE_FLAGS.ADVANCED_ANALYTICS);

      expect(billingOverride?.enabled).toBe(true);
      expect(dashboardOverride?.enabled).toBe(false);
      expect(analyticsOverride?.enabled).toBe(true);
    });
  });

  describe('EmergencyControl テーブル操作', () => {
    it('Kill-Switch機能の管理ができる', async () => {
      const killSwitchData = {
        controlType: 'GLOBAL',
        flagKey: 'ALL',
        enabled: false,
        reason: '統合テスト: 緊急停止テスト',
        activatedAt: new Date().toISOString(),
        activatedBy: 'integration-test-admin'
      };

      // Kill-Switch設定
      await docClient.send(new PutCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Item: killSwitchData
      }));

      // 取得
      const getResult = await docClient.send(new GetCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Key: { 
          controlType: 'GLOBAL',
          flagKey: 'ALL'
        }
      }));

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.controlType).toBe('GLOBAL');
      expect(getResult.Item?.enabled).toBe(false);
      expect(getResult.Item?.reason).toContain('緊急停止テスト');

      // 解除
      const enabledData = { ...killSwitchData, enabled: true, reason: '統合テスト: 復旧テスト' };
      await docClient.send(new PutCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Item: enabledData
      }));

      const enabledResult = await docClient.send(new GetCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Key: { 
          controlType: 'GLOBAL',
          flagKey: 'ALL'
        }
      }));

      expect(enabledResult.Item?.enabled).toBe(true);
    });

    it('特定フラグのKill-Switch管理ができる', async () => {
      const flagSpecificKillSwitch = {
        controlType: 'FLAG',
        flagKey: FEATURE_FLAGS.BILLING_V2,
        enabled: false,
        reason: '統合テスト: 請求システムの緊急停止',
        activatedAt: new Date().toISOString(),
        activatedBy: 'billing-admin'
      };

      await docClient.send(new PutCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Item: flagSpecificKillSwitch
      }));

      const getResult = await docClient.send(new GetCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Key: { 
          controlType: 'FLAG',
          flagKey: FEATURE_FLAGS.BILLING_V2
        }
      }));

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.flagKey).toBe(FEATURE_FLAGS.BILLING_V2);
      expect(getResult.Item?.enabled).toBe(false);
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量データでのスキャン性能をテストする', async () => {
      const startTime = Date.now();
      
      // 100件のテストデータを作成
      const testData = Array.from({ length: 100 }, (_, i) => ({
        flagKey: `perf_test_flag_${i.toString().padStart(3, '0')}`,
        description: `パフォーマンステスト用フラグ ${i}`,
        defaultEnabled: i % 2 === 0,
        owner: 'performance-test',
        createdAt: new Date().toISOString()
      }));

      // バッチ挿入
      for (const data of testData) {
        await docClient.send(new PutCommand({
          TableName: TABLES.FEATURE_FLAGS,
          Item: data
        }));
      }

      const insertTime = Date.now();

      // 全件スキャン
      const scanResult = await docClient.send(new ScanCommand({
        TableName: TABLES.FEATURE_FLAGS,
        FilterExpression: 'begins_with(flagKey, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': 'perf_test_flag_'
        }
      }));

      const scanTime = Date.now();

      // パフォーマンス検証
      expect(scanResult.Items?.length).toBe(100);
      
      const insertDuration = insertTime - startTime;
      const scanDuration = scanTime - insertTime;
      
      // パフォーマンス要件: 100件の挿入は30秒以内、スキャンは5秒以内
      expect(insertDuration).toBeLessThan(30000);
      expect(scanDuration).toBeLessThan(5000);

      console.log(`📊 パフォーマンステスト結果:`);
      console.log(`   挿入時間: ${insertDuration}ms (100件)`);
      console.log(`   スキャン時間: ${scanDuration}ms`);
      console.log(`   平均挿入時間: ${(insertDuration / 100).toFixed(2)}ms/件`);
    });
  });
});

// ヘルパー関数
async function cleanupTestData(): Promise<void> {
  // テスト用データの削除
  const testPrefixes = [
    'test_flag_',
    'batch_test_',
    'perf_test_flag_'
  ];

  for (const prefix of testPrefixes) {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLES.FEATURE_FLAGS,
      FilterExpression: 'begins_with(flagKey, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': prefix
      }
    }));

    if (scanResult.Items) {
      for (const item of scanResult.Items) {
        await docClient.send(new DeleteCommand({
          TableName: TABLES.FEATURE_FLAGS,
          Key: { flagKey: item.flagKey }
        }));
      }
    }
  }

  // TenantOverridesのテストデータ削除
  const tenantScanResult = await docClient.send(new ScanCommand({
    TableName: TABLES.TENANT_OVERRIDES,
    FilterExpression: 'contains(tenantId, :testMarker)',
    ExpressionAttributeValues: {
      ':testMarker': 'integration'
    }
  }));

  if (tenantScanResult.Items) {
    for (const item of tenantScanResult.Items) {
      await docClient.send(new DeleteCommand({
        TableName: TABLES.TENANT_OVERRIDES,
        Key: { 
          tenantId: item.tenantId,
          flagKey: item.flagKey
        }
      }));
    }
  }

  // EmergencyControlのテストデータ削除
  const emergencyScanResult = await docClient.send(new ScanCommand({
    TableName: TABLES.EMERGENCY_CONTROL
  }));

  if (emergencyScanResult.Items) {
    for (const item of emergencyScanResult.Items) {
      await docClient.send(new DeleteCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Key: { 
          controlType: item.controlType,
          flagKey: item.flagKey
        }
      }));
    }
  }
}