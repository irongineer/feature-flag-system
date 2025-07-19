import { beforeAll, afterAll } from 'vitest';
import { featureFlagClient } from '../../feature-flag-integration/client/feature-flag-client';

// テスト開始前の設定
beforeAll(async () => {
  console.log('🚀 Starting attendance SaaS integration tests...');
  
  // フィーチャーフラグクライアントのキャッシュをクリア
  featureFlagClient.clearCache();
  
  // テスト用の環境変数設定
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // テスト時はエラーログのみ
  
  console.log('✅ Test environment initialized');
});

// テスト終了後のクリーンアップ
afterAll(async () => {
  console.log('🧹 Cleaning up after tests...');
  
  // キャッシュをクリア
  featureFlagClient.clearCache();
  
  console.log('✅ Test cleanup completed');
});

// グローバルテストヘルパー
global.testHelpers = {
  createTestHeaders: (tenantId: string, userId: string, userRole: string, plan: string) => ({
    'x-tenant-id': tenantId,
    'x-user-id': userId,
    'x-user-role': userRole,
    'x-tenant-plan': plan,
    'x-environment': 'test'
  }),
  
  expectFeatureFlag: (response: any, flagKey: string, expectedValue: boolean) => {
    expect(response.body).toHaveProperty('features');
    expect(response.body.features).toHaveProperty(flagKey, expectedValue);
  }
};

// TypeScript用の型定義
declare global {
  var testHelpers: {
    createTestHeaders: (tenantId: string, userId: string, userRole: string, plan: string) => Record<string, string>;
    expectFeatureFlag: (response: any, flagKey: string, expectedValue: boolean) => void;
  };
}