/**
 * API Package Test Setup
 * 
 * テスト環境の初期化とモック設定
 */

import { vi } from 'vitest';

// 環境変数のモック設定
process.env.FEATURE_FLAGS_TABLE_NAME = 'test-feature-flags';
process.env.AWS_REGION = 'us-east-1';
process.env.NODE_ENV = 'test';

// AWS SDK のモック
vi.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      scan: vi.fn(),
      query: vi.fn()
    }))
  }
}));

// @feature-flag/core のモック（必要に応じて）
vi.mock('@feature-flag/core', () => ({
  FeatureFlagEvaluator: vi.fn(),
  FeatureFlagCache: vi.fn(),
  FEATURE_FLAGS: {
    BILLING_V2: 'billing_v2_enable',
    NEW_DASHBOARD: 'new_dashboard_enable',
    ADVANCED_ANALYTICS: 'advanced_analytics_enable'
  }
}));

// console のスパイ設定（必要に応じて静音化）
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};