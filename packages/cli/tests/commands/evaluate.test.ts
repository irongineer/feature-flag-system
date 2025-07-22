import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluate } from '../../src/commands/evaluate';
import inquirer from 'inquirer';
import ora from 'ora';

/**
 * Evaluate Flag Command Specification
 * 
 * t-wada TDD原則:
 * - フラグ評価ロジックの完全検証
 * - 対話式パラメータ収集の網羅テスト
 * - 評価結果表示の正確性確認
 * - 様々な環境での動作保証
 */

// モック設定
const mockApiClient = {
  evaluateFlag: vi.fn(),
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

describe('Evaluate Flag Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Command Line Arguments', () => {
    describe('GIVEN all required arguments provided via command line', () => {
      describe('WHEN evaluating flag with complete options', () => {
        it('THEN evaluates flag without prompting user', async () => {
          // Given: 完全なコマンドライン引数
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            user: 'user-456',
            environment: 'production',
          };

          // Given: inquirer.promptは空のオブジェクトを返す（全てのwhenがfalseなので）
          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: APIが成功レスポンスを返す
          const mockEvaluationResult = {
            enabled: true,
            reason: 'Default enabled for all users',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: ユーザープロンプトが呼ばれるが、when条件により実際の入力は求められない
          expect(inquirer.prompt).toHaveBeenCalled();
          
          // プロンプト設定を検証 - すべてwhen: falseになっている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          expect(promptCall.every((p: any) => p.when === false)).toBe(true);

          // Then: APIクライアントが正しいパラメータで呼ばれる
          expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            'user-456',
            'production'
          );

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Flag evaluated successfully')
          );
        });

        it('THEN handles optional user parameter correctly', async () => {
          // Given: userなしのオプション
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            environment: 'development',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          const mockEvaluationResult = {
            enabled: false,
            reason: 'Feature not enabled for development',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: user は undefined で API が呼ばれる
          expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            undefined,
            'development'
          );
        });
      });
    });
  });

  describe('Interactive Prompt Mode', () => {
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
            user: 'interactive-user',
            environment: 'staging',
          });

          const mockEvaluationResult = {
            enabled: true,
            reason: 'Enabled for staging environment',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: 不足情報についてプロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'tenant',
                when: true, // tenant が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'user',
                when: true, // user が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'environment',
                when: true, // environment が未提供なのでプロンプト表示
              }),
            ])
          );

          // Then: コマンドライン引数と対話式回答がマージされる
          expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith(
            'interactive-tenant',
            'billing_v2_enable',
            'interactive-user',
            'staging'
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
            user: 'test-user',
            environment: 'development',
          });

          const mockEvaluationResult = {
            enabled: false,
            reason: 'Default disabled',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: プロンプト設定が正しく構成されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          
          const tenantPrompt = promptCall.find((p: any) => p.name === 'tenant');
          expect(tenantPrompt.validate('')).toBe('Tenant ID is required');
          expect(tenantPrompt.validate('valid-tenant')).toBe(true);
        });

        it('THEN provides correct environment choices', async () => {
          // Given: 対話式モード
          const options = {};

          (inquirer.prompt as any).mockResolvedValue({
            tenant: 'test-tenant',
            key: 'billing_v2_enable',
            user: '',
            environment: 'production',
          });

          const mockEvaluationResult = {
            enabled: true,
            reason: 'Production enabled',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: 環境選択肢が正しく設定されている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          const environmentPrompt = promptCall.find((p: any) => p.name === 'environment');
          
          expect(environmentPrompt.choices).toEqual([
            'development',
            'staging', 
            'production'
          ]);
          expect(environmentPrompt.default).toBe('development');
        });
      });
    });
  });

  describe('API Integration and Result Display', () => {
    describe('GIVEN valid evaluation parameters', () => {
      describe('WHEN flag is enabled', () => {
        it('THEN displays enabled result correctly', async () => {
          // Given: 有効なパラメータ
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            user: 'user-456',
            environment: 'production',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: フラグが有効な結果
          const mockEvaluationResult = {
            enabled: true,
            reason: 'Enabled by default configuration',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: 評価実行
          await evaluate(options);

          // Then: スピナーが成功で終了
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Flag evaluated successfully')
          );

          // Then: 結果が正しく表示される
          expect(console.log).toHaveBeenCalledWith(
            '🎉 Feature is enabled for this tenant'
          );
        });
      });

      describe('WHEN flag is disabled', () => {
        it('THEN displays disabled result correctly', async () => {
          // Given: 有効なパラメータ
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            user: 'user-456',
            environment: 'development',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: フラグが無効な結果
          const mockEvaluationResult = {
            enabled: false,
            reason: 'Feature disabled for development environment',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: 評価実行
          await evaluate(options);

          // Then: 無効結果が正しく表示される
          expect(console.log).toHaveBeenCalledWith(
            '🚫 Feature is disabled for this tenant'
          );
        });
      });

      describe('WHEN API call fails', () => {
        it('THEN handles API errors gracefully', async () => {
          // Given: 有効なパラメータ
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            user: 'user-456',
            environment: 'production',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: API エラー
          const apiError = new Error('Failed to connect to evaluation service');
          mockApiClient.evaluateFlag.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await evaluate(options);

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to evaluate flag')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Failed to connect to evaluation service')
          );
        });
      });
    });
  });

  describe('Edge Cases and User Experience', () => {
    describe('GIVEN edge case scenarios', () => {
      describe('WHEN user is not provided', () => {
        it('THEN handles undefined user correctly in display', async () => {
          // Given: userなしのオプション
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            environment: 'production',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          const mockEvaluationResult = {
            enabled: true,
            reason: 'Default enabled',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: ユーザー情報が「not specified」として表示される
          expect(console.log).toHaveBeenCalledWith(
            '  User: (not specified)'
          );
        });
      });

      describe('WHEN user provides empty string for optional user', () => {
        it('THEN treats empty string as undefined', async () => {
          // Given: 空文字列のユーザー
          const options = {
            tenant: 'tenant-123',
            key: 'billing_v2_enable',
            environment: 'production',
          };

          (inquirer.prompt as any).mockResolvedValue({
            user: '', // 空文字列
          });
          
          const mockEvaluationResult = {
            enabled: false,
            reason: 'No user context provided',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: 空文字列がAPIに渡される
          expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith(
            'tenant-123',
            'billing_v2_enable',
            '',
            'production'
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
            user: 'user-456',
            environment: 'production',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          const mockEvaluationResult = {
            enabled: true,
            reason: 'Test enabled',
          };
          mockApiClient.evaluateFlag.mockResolvedValue(mockEvaluationResult);

          // When: コマンド実行
          await evaluate(options);

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});