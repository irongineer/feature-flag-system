import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFlag } from '../../src/commands/create-flag';
import inquirer from 'inquirer';
import ora from 'ora';

/**
 * Create Flag Command Specification
 * 
 * t-wada TDD原則:
 * - ビジネスシナリオベーステスト
 * - 対話式インターフェースの完全検証
 * - API呼び出し失敗時の堅牢なエラーハンドリング
 * - 引数パターン網羅テスト
 */

// モック設定
const mockApiClient = {
  createFlag: vi.fn(),
};

const mockConfig = {
  apiUrl: 'http://localhost:3001/api',
  timeout: 5000,
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

vi.mock('../../src/utils/config', () => ({
  getConfig: vi.fn(() => mockConfig),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner),
}));

describe('Create Flag Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // コンソールモック（テストセットアップで設定済み）
  });

  describe('Command Line Arguments Processing', () => {
    describe('GIVEN all required arguments provided via command line', () => {
      describe('WHEN creating flag with complete options', () => {
        it('THEN creates flag without prompting user', async () => {
          // Given: 完全なコマンドライン引数
          const options = {
            key: 'billing_v2_enable',
            description: 'Enable billing v2 features',
            enabled: true,
            owner: 'billing-team',
            expires: '2025-12-31T23:59:59.000Z',
          };

          // Given: inquirer.promptは空のオブジェクトを返す（全てのwhenがfalseなので）
          (inquirer.prompt as any).mockResolvedValue({});
          // Given: APIが成功レスポンスを返す
          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: ユーザープロンプトが呼ばれるが、when条件により実際の入力は求められない
          expect(inquirer.prompt).toHaveBeenCalled();
          
          // プロンプト設定を検証 - すべてwhen: falseになっている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          expect(promptCall.every((p: any) => p.when === false)).toBe(true);

          // Then: APIクライアントが正しいデータで呼ばれる
          expect(mockApiClient.createFlag).toHaveBeenCalledWith({
            flagKey: 'billing_v2_enable',
            description: 'Enable billing v2 features',
            defaultEnabled: true,
            owner: 'billing-team',
            expiresAt: '2025-12-31T23:59:59.000Z',
          });

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Flag created successfully')
          );
        });

        it('THEN handles optional expires field correctly', async () => {
          // Given: expires なしのオプション
          const options = {
            key: 'new_dashboard_enable',
            description: 'Enable new dashboard',
            enabled: false,
            owner: 'ui-team',
          };

          // Given: inquirer.promptは空のオブジェクトを返す（全てのwhenがfalseなので）
          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: expiresAt は undefined
          expect(mockApiClient.createFlag).toHaveBeenCalledWith({
            flagKey: 'new_dashboard_enable',
            description: 'Enable new dashboard',
            defaultEnabled: false,
            owner: 'ui-team',
            expiresAt: undefined,
          });
        });
      });
    });

    describe('GIVEN partial command line arguments', () => {
      describe('WHEN some options are missing', () => {
        it('THEN prompts for missing information', async () => {
          // Given: 一部のオプションのみ提供
          const options = {
            key: 'billing_v2_enable',
            enabled: true,
          };

          // Given: ユーザーが対話式で回答
          (inquirer.prompt as any).mockResolvedValue({
            description: 'Interactive description',
            owner: 'interactive-team',
            expires: '2025-06-30T00:00:00.000Z',
          });

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: 不足情報についてプロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'description',
                when: true, // description が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'owner',
                when: true, // owner が未提供なのでプロンプト表示
              }),
            ])
          );

          // Then: コマンドライン引数と対話式回答がマージされる
          expect(mockApiClient.createFlag).toHaveBeenCalledWith({
            flagKey: 'billing_v2_enable',
            description: 'Interactive description',
            defaultEnabled: true,
            owner: 'interactive-team',
            expiresAt: '2025-06-30T00:00:00.000Z',
          });
        });
      });
    });
  });

  describe('Interactive Prompts Validation', () => {
    describe('GIVEN no command line arguments', () => {
      describe('WHEN running in interactive mode', () => {
        it('THEN validates description input correctly', async () => {
          // Given: 対話式モードで実行
          const options = {};

          // Given: プロンプト設定の検証
          (inquirer.prompt as any).mockResolvedValue({
            key: 'billing_v2_enable',
            description: 'Valid description',
            enabled: false,
            owner: 'test-owner',
            expires: '',
          });

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: プロンプト設定が正しく構成されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          
          const descriptionPrompt = promptCall.find((p: any) => p.name === 'description');
          expect(descriptionPrompt.validate('')).toBe('Description is required');
          expect(descriptionPrompt.validate('Valid description')).toBe(true);
        });

        it('THEN validates expires date format correctly', async () => {
          // Given: 対話式モード
          const options = {};

          (inquirer.prompt as any).mockResolvedValue({
            key: 'billing_v2_enable',
            description: 'Test description',
            enabled: true,
            owner: 'test-owner',
            expires: '2025-01-01T00:00:00.000Z',
          });

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: 日付バリデーションが正しく設定されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          const expiresPrompt = promptCall.find((p: any) => p.name === 'expires');
          
          // 空文字は有効（オプションのため）
          expect(expiresPrompt.validate('')).toBe(true);
          
          // 有効な日付は通る
          expect(expiresPrompt.validate('2025-01-01T00:00:00.000Z')).toBe(true);
          
          // 無効な日付は弾かれる
          expect(expiresPrompt.validate('invalid-date')).toBe('Please enter a valid ISO date format');
        });
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    describe('GIVEN valid flag data', () => {
      describe('WHEN API call succeeds', () => {
        it('THEN displays success message with flag details', async () => {
          // Given: 有効なフラグデータ
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            enabled: true,
            owner: 'test-team',
          };

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: API成功
          await createFlag(options);

          // Then: スピナーが成功で終了
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Flag created successfully')
          );

          // Then: APIクライアントが呼ばれる
          expect(mockApiClient.createFlag).toHaveBeenCalled();
        });
      });

      describe('WHEN API call fails', () => {
        it('THEN handles API errors gracefully', async () => {
          // Given: 有効なフラグデータ
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            enabled: true,
            owner: 'test-team',
          };

          // Given: API エラー
          const apiError = new Error('API connection failed');
          mockApiClient.createFlag.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await createFlag(options);

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to create flag')
          );
        });

        it('THEN displays appropriate error messages', async () => {
          // Given: フラグデータ
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            enabled: true,
            owner: 'test-team',
          };

          // Given: 特定のAPIエラー
          mockApiClient.createFlag.mockRejectedValue(new Error('Flag already exists'));

          // When: エラー発生
          await createFlag(options);

          // Then: エラーメッセージが出力される（console.errorはモック済み）
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to create flag')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Flag already exists')
          );
        });
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    describe('GIVEN edge case inputs', () => {
      describe('WHEN enabled flag is explicitly false', () => {
        it('THEN handles boolean false correctly', async () => {
          // Given: enabled が明示的に false
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            enabled: false, // 明示的な false
            owner: 'test-team',
          };

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: false が正しく処理される
          expect(mockApiClient.createFlag).toHaveBeenCalledWith(
            expect.objectContaining({
              defaultEnabled: false,
            })
          );
        });
      });

      describe('WHEN enabled flag is undefined', () => {
        it('THEN prompts for enabled state', async () => {
          // Given: enabled が undefined
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            owner: 'test-team',
            // enabled: undefined (明示的に設定しない)
          };

          (inquirer.prompt as any).mockResolvedValue({
            enabled: true,
          });

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: enabled についてプロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'enabled',
                when: true, // enabled が undefined なのでプロンプト表示
              }),
            ])
          );
        });
      });
    });
  });

  describe('Configuration and Environment', () => {
    describe('GIVEN configuration loading', () => {
      describe('WHEN command is executed', () => {
        it('THEN loads configuration correctly', async () => {
          // Given: 基本オプション
          const options = {
            key: 'billing_v2_enable',
            description: 'Test flag',
            enabled: true,
            owner: 'test-team',
          };

          mockApiClient.createFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await createFlag(options);

          // Then: 設定が読み込まれる
          const { getConfig } = await import('../../src/utils/config');
          expect(getConfig).toHaveBeenCalled();

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});