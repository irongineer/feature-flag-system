import { vi } from 'vitest';

/**
 * SDK Testing Setup
 * 
 * 1Issue1PR原則に従ったSDK基本テスト環境設定
 * Core evaluator・AWS SDK・Lambda環境のモック準備
 */

// AWS SDK のモック
vi.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: vi.fn(() => ({
      get: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Item: {
            flagKey: 'test_flag',
            defaultEnabled: true,
            enabled: true
          }
        })
      }),
      put: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({})
      }),
      scan: vi.fn().mockReturnValue({
        promise: vi.fn().mockResolvedValue({
          Items: []
        })
      })
    }))
  }
}));

// Core evaluator のモック（部分的）
vi.mock('@feature-flag/core', async () => {
  const actual = await vi.importActual('@feature-flag/core');
  return {
    ...actual,
    // 必要に応じて特定の機能をモック
  };
});

// Console出力制御
if (process.env.NODE_ENV === 'test') {
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}