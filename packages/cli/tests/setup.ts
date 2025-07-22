import { vi } from 'vitest';

/**
 * CLI Test Setup
 * 
 * t-wada TDD原則:
 * - 外部依存性の適切なモック
 * - 一貫したテスト環境
 * - 明確なテスト境界設定
 */

// 環境変数のモック設定
process.env.NODE_ENV = 'test';
process.env.FEATURE_FLAG_API_URL = 'http://localhost:3001/api';
process.env.FEATURE_FLAG_CONFIG_FILE = './test-config.json';

// Console出力のモック（テストノイズ削減）
const originalConsole = global.console;
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

// Process.exit のモック（テスト中に実際に終了しないように）
process.exit = vi.fn() as any;

// Inquirer（対話式プロンプト）のモック
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Chalk（色付きテキスト）のモック
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
  },
}));

// Ora（スピナー）のモック
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      text: '',
    })),
    succeed: vi.fn(),
    fail: vi.fn(),
    text: '',
  })),
}));

// AWS SDK のモック
vi.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      scan: vi.fn(),
      query: vi.fn(),
    })),
  },
  config: {
    update: vi.fn(),
  },
}));

// File system operations のモック
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// HTTP リクエストのモック
global.fetch = vi.fn();

// テストの後処理
afterEach(() => {
  vi.clearAllMocks();
});