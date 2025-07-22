import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config } from '../../src/commands/config';

/**
 * Config Command Specification
 * 
 * t-wada TDD原則:
 * - 設定管理操作の基本動作検証
 * - エラーハンドリングの確認
 * - コマンドライン引数解析の正確性
 */

// モジュールレベルモック
vi.mock('../../src/utils/config', () => ({
  getConfig: vi.fn(() => ({
    region: 'ap-northeast-1',
    tableName: 'feature-flags',
    endpoint: null,
    profile: 'default',
  })),
  setConfig: vi.fn(),
  resetConfig: vi.fn(),
}));

vi.mock('table', () => ({
  table: vi.fn((data) => {
    return `Table with ${data.length} rows`;
  }),
}));

describe('Config Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Reset', () => {
    describe('GIVEN reset option provided', () => {
      describe('WHEN resetting configuration', () => {
        it('THEN resets configuration to defaults', async () => {
          // Given: リセットオプション
          const options = { reset: true };

          // When: コマンド実行
          await config(options);

          // Then: resetConfig が呼ばれる
          const { resetConfig } = await import('../../src/utils/config');
          expect(resetConfig).toHaveBeenCalledTimes(1);

          // Then: 成功メッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Configuration reset to defaults')
          );
        });
      });
    });
  });

  describe('Configuration Setting', () => {
    describe('GIVEN set option with valid key-value pair', () => {
      describe('WHEN setting configuration values', () => {
        it('THEN sets simple configuration values', async () => {
          // Given: 設定オプション
          const options = { set: 'region=us-east-1' };

          // When: コマンド実行
          await config(options);

          // Then: setConfig が正しいパラメータで呼ばれる
          const { setConfig } = await import('../../src/utils/config');
          expect(setConfig).toHaveBeenCalledWith('region', 'us-east-1');

          // Then: 成功メッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Set region = us-east-1')
          );
        });
      });

      describe('WHEN setting configuration with invalid format', () => {
        it('THEN handles missing value error', async () => {
          // Given: 値が不足している設定
          const options = { set: 'region=' };

          // When: コマンド実行
          await config(options);

          // Then: エラーメッセージが表示される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Invalid format. Use: --set key=value')
          );

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);
        });
      });
    });
  });

  describe('Configuration Getting', () => {
    describe('GIVEN get option with valid key', () => {
      describe('WHEN getting configuration values', () => {
        it('THEN gets simple configuration values', async () => {
          // Given: 取得オプション
          const options = { get: 'region' };

          // When: コマンド実行
          await config(options);

          // Then: getConfig が呼ばれる
          const { getConfig } = await import('../../src/utils/config');
          expect(getConfig).toHaveBeenCalled();

          // Then: 設定値が表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('region = ap-northeast-1')
          );
        });
      });

      describe('WHEN getting non-existent configuration key', () => {
        it('THEN handles missing key error', async () => {
          // Given: 存在しないキーの取得
          const options = { get: 'nonexistent' };

          // When: コマンド実行
          await config(options);

          // Then: エラーメッセージが表示される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Configuration key not found: nonexistent')
          );

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);
        });
      });
    });
  });

  describe('Configuration Listing', () => {
    describe('GIVEN list option provided', () => {
      describe('WHEN listing all configuration', () => {
        it('THEN displays configuration table', async () => {
          // Given: リストオプション
          const options = { list: true };

          // When: コマンド実行
          await config(options);

          // Then: getConfig が呼ばれる
          const { getConfig } = await import('../../src/utils/config');
          expect(getConfig).toHaveBeenCalled();

          // Then: 設定一覧のヘッダーが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Current Configuration:')
          );

          // Then: テーブルが呼ばれる
          const { table } = await import('table');
          expect(table).toHaveBeenCalled();
        });

        it('THEN displays usage examples', async () => {
          // Given: リストオプション
          const options = { list: true };

          // When: コマンド実行
          await config(options);

          // Then: 使用例が表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Examples:')
          );
        });
      });
    });
  });

  describe('Default Behavior', () => {
    describe('GIVEN no specific options', () => {
      describe('WHEN running config command', () => {
        it('THEN defaults to listing configuration', async () => {
          // Given: オプションなし
          const options = {};

          // When: コマンド実行
          await config(options);

          // Then: リスト表示される（デフォルト動作）
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Current Configuration:')
          );

          // Then: getConfig が呼ばれる
          const { getConfig } = await import('../../src/utils/config');
          expect(getConfig).toHaveBeenCalled();
        });
      });
    });
  });
});