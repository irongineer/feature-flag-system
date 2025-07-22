import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setTenantOverride } from '../../src/commands/set-tenant-override';
import inquirer from 'inquirer';
import ora from 'ora';

/**
 * Set Tenant Override Command Specification
 * 
 * t-wada TDD原則:
 * - テナント固有オーバーライド設定の完全検証
 * - Boolean値変換の正確性確認
 * - 対話式入力バリデーションの網羅テスト
 * - テナント管理操作の安全性確保
 */

// モック設定
const mockApiClient = {
  setTenantOverride: vi.fn(),
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

describe('Set Tenant Override Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Command Line Parameters', () => {
    describe('GIVEN all required parameters provided via command line', () => {
      describe('WHEN setting tenant override with complete options', () => {
        it('THEN sets override without prompting user', async () => {
          // Given: 完全なコマンドライン引数
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'admin-user',
          };

          // Given: inquirer.promptは空のオブジェクトを返す（全てのwhenがfalseなので）
          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: APIが成功レスポンスを返す
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: ユーザープロンプトが呼ばれるが、when条件により実際の入力は求められない
          expect(inquirer.prompt).toHaveBeenCalled();
          
          // プロンプト設定を検証 - すべてwhen: falseになっている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          expect(promptCall.every((p: any) => p.when === false)).toBe(true);

          // Then: APIクライアントが正しいパラメータで呼ばれる
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            true, // 'true' から boolean true に変換
            'admin-user'
          );

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Tenant override set successfully')
          );
        });

        it('THEN handles boolean string conversion correctly', async () => {
          // Given: enabled が 'false' の文字列
          const options = {
            tenant: 'tenant-456',
            key: 'new_dashboard_enable',
            enabled: 'false', // 文字列の 'false'
            user: 'test-admin',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: 'false' が boolean false に変換される
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'tenant-456',
            'new_dashboard_enable',
            false, // 'false' === 'true' は false
            'test-admin'
          );
        });
      });
    });
  });

  describe('Interactive Parameter Collection', () => {
    describe('GIVEN partial command line arguments', () => {
      describe('WHEN some options are missing', () => {
        it('THEN prompts for missing information', async () => {
          // Given: 一部のオプションのみ提供
          const options = {
            key: 'billing_v2_enable',
          };

          // Given: ユーザーが対話式で回答
          (inquirer.prompt as any).mockResolvedValue({
            tenant: 'interactive-tenant',
            enabled: true, // プロンプトから boolean
            user: 'interactive-user',
          });

          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: 不足情報についてプロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'tenant',
                when: true, // tenant が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'enabled',
                when: true, // enabled が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'user',
                when: true, // user が未提供なのでプロンプト表示
              }),
            ])
          );

          // Then: コマンドライン引数と対話式回答がマージされる
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'interactive-tenant',
            'billing_v2_enable',
            true,
            'interactive-user'
          );
        });
      });
    });

    describe('GIVEN no command line arguments', () => {
      describe('WHEN running in fully interactive mode', () => {
        it('THEN validates tenant input correctly', async () => {
          // Given: 対話式モードで実行
          const options = {};

          // Given: プロンプト設定の検証
          (inquirer.prompt as any).mockResolvedValue({
            tenant: 'interactive-tenant',
            key: 'billing_v2_enable',
            enabled: false,
            user: 'interactive-admin',
          });

          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: プロンプト設定が正しく構成されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          
          const tenantPrompt = promptCall.find((p: any) => p.name === 'tenant');
          expect(tenantPrompt.validate('')).toBe('Tenant ID is required');
          expect(tenantPrompt.validate('valid-tenant')).toBe(true);
        });

        it('THEN validates user input correctly', async () => {
          // Given: 対話式モード
          const options = {};

          (inquirer.prompt as any).mockResolvedValue({
            tenant: 'test-tenant',
            key: 'billing_v2_enable',
            enabled: true,
            user: 'admin-user',
          });

          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: ユーザーバリデーションが正しく設定されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          const userPrompt = promptCall.find((p: any) => p.name === 'user');
          
          expect(userPrompt.validate('')).toBe('Username is required');
          expect(userPrompt.validate('valid-user')).toBe(true);
        });
      });
    });
  });

  describe('Mixed Input Sources', () => {
    describe('GIVEN partial command line and partial interactive input', () => {
      describe('WHEN combining both input sources', () => {
        it('THEN merges command line and prompt inputs correctly', async () => {
          // Given: コマンドラインで一部、対話式で残り
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            // enabled と user は対話式で取得
          };

          (inquirer.prompt as any).mockResolvedValue({
            enabled: false, // プロンプトから取得
            user: 'interactive-admin', // プロンプトから取得
          });

          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: コマンドラインと対話式の値がマージされる
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'tenant-123', // コマンドラインから
            'billing_v2_enable', // コマンドラインから
            false, // プロンプトから
            'interactive-admin' // プロンプトから
          );
        });
      });
    });
  });

  describe('Result Display and Formatting', () => {
    describe('GIVEN successful tenant override operation', () => {
      describe('WHEN override is set to enabled', () => {
        it('THEN displays correct status information', async () => {
          // Given: 有効化オーバーライド
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'admin-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: オーバーライド設定
          await setTenantOverride(options);

          // Then: 設定サマリーが表示される
          expect(console.log).toHaveBeenCalledWith('Tenant override set:');
          expect(console.log).toHaveBeenCalledWith('  Tenant: tenant-123');
          expect(console.log).toHaveBeenCalledWith('  Flag: billing_v2_enable');
          expect(console.log).toHaveBeenCalledWith('  Enabled: true');
          expect(console.log).toHaveBeenCalledWith('  Updated by: admin-user');

          // タイムスタンプが含まれることを確認
          expect(console.log).toHaveBeenCalledWith(
            expect.stringMatching(/Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
          );
        });

        it('THEN displays disabled status correctly', async () => {
          // Given: 無効化オーバーライド
          const options = {
            tenant: 'tenant-456',
            key: 'new_dashboard_enable',
            enabled: 'false',
            user: 'test-admin',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: オーバーライド設定
          await setTenantOverride(options);

          // Then: 無効状態が正しく表示される
          expect(console.log).toHaveBeenCalledWith('  Enabled: false');
        });
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    describe('GIVEN valid tenant override parameters', () => {
      describe('WHEN API call succeeds', () => {
        it('THEN completes operation successfully', async () => {
          // Given: 有効なパラメータ
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'admin-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: API成功
          await setTenantOverride(options);

          // Then: スピナーが成功で終了
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Tenant override set successfully')
          );

          // Then: APIクライアントが呼ばれる
          expect(mockApiClient.setTenantOverride).toHaveBeenCalled();
        });
      });

      describe('WHEN API call fails', () => {
        it('THEN handles API errors gracefully', async () => {
          // Given: 有効なパラメータ
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'admin-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: API エラー
          const apiError = new Error('Tenant not found');
          mockApiClient.setTenantOverride.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await setTenantOverride(options);

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to set tenant override')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Tenant not found')
          );
        });

        it('THEN displays appropriate error messages', async () => {
          // Given: オーバーライドパラメータ
          const options = {
            tenant: 'invalid-tenant',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: 特定のAPIエラー
          mockApiClient.setTenantOverride.mockRejectedValue(new Error('Permission denied'));

          // When: エラー発生
          await setTenantOverride(options);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to set tenant override')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Permission denied')
          );
        });
      });
    });
  });

  describe('Boolean Handling Edge Cases', () => {
    describe('GIVEN various enabled value formats', () => {
      describe('WHEN enabled is provided as different string values', () => {
        it('THEN converts non-"true" strings to false', async () => {
          // Given: enabled が 'false' 以外の文字列
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'invalid', // 'true' ではない文字列
            user: 'test-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: 'true' でない場合は false に変換される
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            false, // 'invalid' === 'true' は false
            'test-user'
          );
        });

        it('THEN handles interactive boolean prompt correctly', async () => {
          // Given: enabled が対話式で取得される場合
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockResolvedValue({
            enabled: true, // プロンプトから直接 boolean
          });

          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: プロンプトからの boolean 値が使用される
          expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            true, // プロンプトからの boolean true
            'test-user'
          );
        });
      });
    });
  });

  describe('Configuration Integration', () => {
    describe('GIVEN configuration loading', () => {
      describe('WHEN command is executed', () => {
        it('THEN loads API client correctly', async () => {
          // Given: 基本オプション
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            enabled: 'true',
            user: 'admin-user',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.setTenantOverride.mockResolvedValue({ success: true });

          // When: コマンド実行
          await setTenantOverride(options);

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});