import { vi } from 'vitest';

/**
 * CLI Testing Setup
 * 
 * テスト環境の共通設定とモック準備
 * 1Issue1PR原則に従った基本設定
 */

// Chalk（色付きテキスト）のモック
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
  },
}));

// Ora（スピナー）のモック
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

// Console出力を制御（テスト時のノイズ削減）
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