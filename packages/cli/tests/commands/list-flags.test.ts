import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listFlags } from '../../src/commands/list-flags';
import ora from 'ora';

/**
 * List Flags Command Specification
 * 
 * t-wada TDD原則:
 * - フラグ一覧取得の完全検証
 * - テーブル表示フォーマット正確性
 * - JSON出力の構造検証
 * - テナントオーバーライド表示確認
 */

// モック設定
const mockApiClient = {
  listFlags: vi.fn(),
  listTenantOverrides: vi.fn(),
};

const mockSpinner = {
  start: vi.fn(() => mockSpinner),
  succeed: vi.fn(),
  fail: vi.fn(),
  text: '',
};

// モジュールレベルモック
vi.mock('../../src/utils/api-client', () => ({
  getApiClient: vi.fn(() => mockApiClient),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner),
}));

vi.mock('table', () => ({
  table: vi.fn((data) => {
    // テーブルライブラリのモック - 基本的な文字列を返す
    return `Table with ${data.length} rows`;
  }),
}));

describe('List Flags Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Flag Listing', () => {
    describe('GIVEN no specific options', () => {
      describe('WHEN listing all flags', () => {
        it('THEN displays all flags in table format', async () => {
          // Given: APIからフラグ一覧を取得
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              flagKey: 'new_dashboard_enable',
              description: 'Enable new dashboard interface',
              defaultEnabled: false,
              owner: 'ui-team',
              createdAt: '2025-01-02T00:00:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);

          // When: コマンド実行
          await listFlags({});

          // Then: APIクライアントが呼ばれる
          expect(mockApiClient.listFlags).toHaveBeenCalledTimes(1);
          
          // Then: テナントオーバーライドは取得されない
          expect(mockApiClient.listTenantOverrides).not.toHaveBeenCalled();

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Found 2 flags')
          );

          // Then: テーブル形式でフラグ情報が表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Feature Flags:')
          );
        });

        it('THEN handles empty flag list correctly', async () => {
          // Given: 空のフラグ一覧
          mockApiClient.listFlags.mockResolvedValue([]);

          // When: コマンド実行
          await listFlags({});

          // Then: フラグ数0の成功メッセージ
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Found 0 flags')
          );

          // Then: 「フラグなし」メッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('No flags found')
          );
        });
      });
    });
  });

  describe('JSON Output Format', () => {
    describe('GIVEN format option set to json', () => {
      describe('WHEN listing flags', () => {
        it('THEN outputs flags in JSON format', async () => {
          // Given: フラグデータ
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);

          // When: JSON形式でコマンド実行
          await listFlags({ format: 'json' });

          // Then: JSONが標準出力に出力される
          const expectedOutput = JSON.stringify(
            { flags: mockFlags, tenantOverrides: [] },
            null,
            2
          );
          expect(console.log).toHaveBeenCalledWith(expectedOutput);
        });

        it('THEN includes tenant overrides in JSON when tenant specified', async () => {
          // Given: フラグデータとテナントオーバーライド
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ];

          const mockTenantOverrides = [
            {
              SK: 'FLAG#billing_v2_enable',
              enabled: false,
              reason: 'Temporarily disabled for testing',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);
          mockApiClient.listTenantOverrides.mockResolvedValue(mockTenantOverrides);

          // When: テナントとJSON形式でコマンド実行
          await listFlags({ 
            tenant: 'tenant-123',
            format: 'json' 
          });

          // Then: テナントオーバーライドが取得される
          expect(mockApiClient.listTenantOverrides).toHaveBeenCalledWith('tenant-123');

          // Then: JSONにオーバーライドが含まれる
          const expectedOutput = JSON.stringify(
            { flags: mockFlags, tenantOverrides: mockTenantOverrides },
            null,
            2
          );
          expect(console.log).toHaveBeenCalledWith(expectedOutput);
        });
      });
    });
  });

  describe('Tenant Override Display', () => {
    describe('GIVEN tenant option provided', () => {
      describe('WHEN listing flags with tenant overrides', () => {
        it('THEN displays tenant-specific overrides in table', async () => {
          // Given: フラグとオーバーライドデータ
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              flagKey: 'new_dashboard_enable',
              description: 'Enable new dashboard',
              defaultEnabled: false,
              owner: 'ui-team',
              createdAt: '2025-01-02T00:00:00.000Z',
            },
          ];

          const mockTenantOverrides = [
            {
              SK: 'FLAG#billing_v2_enable',
              enabled: false, // オーバーライドで無効化
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);
          mockApiClient.listTenantOverrides.mockResolvedValue(mockTenantOverrides);

          // When: テナント指定でコマンド実行
          await listFlags({ tenant: 'tenant-123' });

          // Then: テナントオーバーライドが取得される
          expect(mockApiClient.listTenantOverrides).toHaveBeenCalledWith('tenant-123');

          // Then: テナント情報が表示される
          expect(console.log).toHaveBeenCalledWith(
            'Showing overrides for tenant: tenant-123'
          );
        });

        it('THEN handles flags without tenant overrides', async () => {
          // Given: フラグはあるがオーバーライドはない
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);
          mockApiClient.listTenantOverrides.mockResolvedValue([]);

          // When: テナント指定でコマンド実行
          await listFlags({ tenant: 'tenant-no-overrides' });

          // Then: オーバーライドが取得される（空の配列）
          expect(mockApiClient.listTenantOverrides).toHaveBeenCalledWith('tenant-no-overrides');

          // Then: テナント情報が表示される
          expect(console.log).toHaveBeenCalledWith(
            'Showing overrides for tenant: tenant-no-overrides'
          );
        });
      });
    });
  });

  describe('Table Formatting and Display', () => {
    describe('GIVEN flags with various content lengths', () => {
      describe('WHEN displaying in table format', () => {
        it('THEN displays table with flags correctly', async () => {
          // Given: 長い説明を持つフラグ
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'This is a very long description that exceeds the 40 character limit and should be truncated',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
            {
              flagKey: 'short_desc',
              description: 'Short desc',
              defaultEnabled: false,
              owner: 'ui-team',
              createdAt: '2025-01-02T00:00:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);

          // When: テーブル表示でコマンド実行
          await listFlags({});

          // Then: テーブルが呼ばれる
          const { table } = await import('table');
          expect(table).toHaveBeenCalled();
        });

        it('THEN formats flags data for display', async () => {
          // Given: 様々な形式のデータ
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Test flag',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-15T14:30:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);

          // When: コマンド実行
          await listFlags({});

          // Then: テーブルが呼ばれる
          const { table } = await import('table');
          expect(table).toHaveBeenCalled();
        });

        it('THEN uses table formatting', async () => {
          // Given: 基本フラグデータ
          const mockFlags = [
            {
              flagKey: 'test_flag',
              description: 'Test description',
              defaultEnabled: true,
              owner: 'test-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ];

          mockApiClient.listFlags.mockResolvedValue(mockFlags);

          // When: コマンド実行
          await listFlags({});

          // Then: テーブルが正しく呼ばれる
          const { table } = await import('table');
          expect(table).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
              border: expect.any(Object)
            })
          );
        });
      });
    });
  });

  describe('API Error Handling', () => {
    describe('GIVEN API service failures', () => {
      describe('WHEN listFlags API fails', () => {
        it('THEN handles error gracefully', async () => {
          // Given: API エラー
          const apiError = new Error('Connection failed to flag service');
          mockApiClient.listFlags.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await listFlags({});

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to list flags')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Connection failed to flag service')
          );
        });
      });

      describe('WHEN listTenantOverrides API fails', () => {
        it('THEN handles tenant override error gracefully', async () => {
          // Given: フラグAPIは成功、オーバーライドAPIは失敗
          const mockFlags = [
            {
              flagKey: 'billing_v2_enable',
              description: 'Test flag',
              defaultEnabled: true,
              owner: 'test-team',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ];
          
          mockApiClient.listFlags.mockResolvedValue(mockFlags);
          mockApiClient.listTenantOverrides.mockRejectedValue(new Error('Tenant service unavailable'));

          // When: テナント指定でAPI エラー発生
          await listFlags({ tenant: 'tenant-123' });

          // Then: エラーハンドリングが実行される
          expect(process.exit).toHaveBeenCalledWith(1);
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to list flags')
          );
        });
      });
    });
  });

  describe('Configuration Integration', () => {
    describe('GIVEN configuration loading', () => {
      describe('WHEN command is executed', () => {
        it('THEN loads API client correctly', async () => {
          // Given: 基本フラグデータ
          mockApiClient.listFlags.mockResolvedValue([]);

          // When: コマンド実行
          await listFlags({});

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});