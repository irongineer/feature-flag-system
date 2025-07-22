import { describe, it, expect, vi, beforeEach } from 'vitest';
import { killSwitch } from '../../src/commands/kill-switch';
import inquirer from 'inquirer';
import ora from 'ora';

/**
 * Kill-Switch Command Specification
 * 
 * t-wada TDD原則:
 * - 緊急時操作の安全確認プロセス完全検証
 * - グローバル／個別フラグスコープ処理確認
 * - 操作確認（confirmation）フローの堅牢性
 * - アクティベート／デアクティベートの正確性
 */

// モック設定
const mockApiClient = {
  activateKillSwitch: vi.fn(),
  deactivateKillSwitch: vi.fn(),
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

describe('Kill-Switch Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Activate Kill-Switch Operations', () => {
    describe('GIVEN command line activation parameters', () => {
      describe('WHEN activating global kill-switch', () => {
        it('THEN activates kill-switch globally with confirmation', async () => {
          // Given: グローバル アクティベーション パラメータ
          const options = {
            activate: true,
            reason: 'Critical security vulnerability detected',
            user: 'security-admin',
            // key は未指定（グローバル操作）
          };

          // Given: 確認プロンプトで承認
          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          // Given: APIが成功レスポンスを返す
          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: グローバル kill-switch API が呼ばれる
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            undefined, // グローバル操作のためflagKeyはundefined
            'Critical security vulnerability detected',
            'security-admin'
          );

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Kill-switch activated successfully')
          );

          // Then: アクティブ状態のメッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('🚨 Kill-switch is now ACTIVE')
          );
        });

        it('THEN activates specific flag kill-switch with confirmation', async () => {
          // Given: 特定フラグ アクティベーション
          const options = {
            key: 'billing_v2_enable',
            activate: true,
            reason: 'Billing system malfunction',
            user: 'billing-admin',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: 特定フラグ kill-switch API が呼ばれる
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            'billing_v2_enable',
            'Billing system malfunction',
            'billing-admin'
          );

          // Then: フラグスコープが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Scope: flag: billing_v2_enable')
          );
        });

        it('THEN cancels operation when user declines confirmation', async () => {
          // Given: アクティベーション パラメータ
          const options = {
            activate: true,
            reason: 'Test reason',
            user: 'test-user',
          };

          // Given: 確認プロンプトで拒否
          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: false });
            }
            return Promise.resolve({});
          });

          // When: コマンド実行
          await killSwitch(options);

          // Then: 操作がキャンセルされる
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Operation cancelled')
          );

          // Then: API は呼ばれない
          expect(mockApiClient.activateKillSwitch).not.toHaveBeenCalled();

          // Then: スピナーも開始されない
          expect(mockSpinner.start).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('Deactivate Kill-Switch Operations', () => {
    describe('GIVEN command line deactivation parameters', () => {
      describe('WHEN deactivating kill-switch', () => {
        it('THEN deactivates global kill-switch with confirmation', async () => {
          // Given: グローバル デアクティベーション パラメータ
          const options = {
            deactivate: true,
            reason: 'Issue resolved, resuming normal operations',
            user: 'ops-admin',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.deactivateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: グローバル deactivate API が呼ばれる
          expect(mockApiClient.deactivateKillSwitch).toHaveBeenCalledWith(
            undefined, // グローバル操作
            'ops-admin'
          );

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Kill-switch deactivated successfully')
          );

          // Then: インアクティブ状態のメッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('✅ Kill-switch is now INACTIVE')
          );
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Features will resume normal operation')
          );
        });

        it('THEN deactivates specific flag kill-switch', async () => {
          // Given: 特定フラグ デアクティベーション
          const options = {
            key: 'billing_v2_enable',
            deactivate: true,
            reason: 'Billing fix deployed',
            user: 'billing-admin',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.deactivateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: 特定フラグ deactivate API が呼ばれる
          expect(mockApiClient.deactivateKillSwitch).toHaveBeenCalledWith(
            'billing_v2_enable',
            'billing-admin'
          );
        });
      });
    });
  });

  describe('Interactive Operation Mode', () => {
    describe('GIVEN no operation specified', () => {
      describe('WHEN running in interactive mode', () => {
        it('THEN prompts for action selection and executes activate', async () => {
          // Given: 操作未指定
          const options = {
            key: 'billing_v2_enable',
            reason: 'Interactive test',
            user: 'test-user',
          };

          // Given: 対話式で activate を選択
          (inquirer.prompt as any).mockImplementation((questions) => {
            const actionQuestion = questions.find((q: any) => q.name === 'action');
            if (actionQuestion) {
              return Promise.resolve({ action: 'activate' });
            }
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: アクション選択プロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'action',
                choices: expect.arrayContaining([
                  expect.objectContaining({ value: 'activate' }),
                  expect.objectContaining({ value: 'deactivate' }),
                ]),
              }),
            ])
          );

          // Then: activate API が呼ばれる
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            'billing_v2_enable',
            'Interactive test',
            'test-user'
          );
        });

        it('THEN prompts for scope selection for global operations', async () => {
          // Given: キーとアクション未指定
          const options = {
            activate: true,
            reason: 'Global test',
            user: 'admin-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const scopeQuestion = questions.find((q: any) => q.name === 'scope');
            if (scopeQuestion) {
              return Promise.resolve({ scope: 'global' });
            }
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: スコープ選択プロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'scope',
                choices: expect.arrayContaining([
                  expect.objectContaining({ value: 'global' }),
                  expect.objectContaining({ value: 'flag' }),
                ]),
              }),
            ])
          );

          // Then: グローバル activate が実行される
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            undefined,
            'Global test',
            'admin-user'
          );
        });
      });
    });
  });

  describe('Input Validation', () => {
    describe('GIVEN missing required fields', () => {
      describe('WHEN prompting for required information', () => {
        it('THEN validates reason input correctly', async () => {
          // Given: reasonなしのオプション
          const options = {
            activate: true,
            key: 'billing_v2_enable',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const reasonQuestion = questions.find((q: any) => q.name === 'reason');
            if (reasonQuestion) {
              // バリデーション関数をテスト
              expect(reasonQuestion.validate('')).toBe('Reason is required');
              expect(reasonQuestion.validate('Valid reason')).toBe(true);
              return Promise.resolve({ reason: 'Interactive reason' });
            }
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: プロンプトから取得したreasonが使用される
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            'billing_v2_enable',
            'Interactive reason',
            'test-user'
          );
        });

        it('THEN validates user input correctly', async () => {
          // Given: userなしのオプション
          const options = {
            activate: true,
            key: 'billing_v2_enable',
            reason: 'Test reason',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const userQuestion = questions.find((q: any) => q.name === 'user');
            if (userQuestion) {
              // バリデーション関数をテスト
              expect(userQuestion.validate('')).toBe('Username is required');
              expect(userQuestion.validate('valid-user')).toBe(true);
              return Promise.resolve({ user: 'interactive-user' });
            }
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: プロンプトから取得したuserが使用される
          expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(
            'billing_v2_enable',
            'Test reason',
            'interactive-user'
          );
        });
      });
    });
  });

  describe('Operation Summary and Confirmation', () => {
    describe('GIVEN operation parameters', () => {
      describe('WHEN displaying operation summary', () => {
        it('THEN displays comprehensive summary before confirmation', async () => {
          // Given: 完全なパラメータ
          const options = {
            key: 'billing_v2_enable',
            activate: true,
            reason: 'Critical bug detected',
            user: 'incident-manager',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: 操作サマリーが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('⚠️  Kill-Switch Operation Summary:')
          );
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Action: ACTIVATE')
          );
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Scope: flag: billing_v2_enable')
          );
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('Reason: Critical bug detected')
          );
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('User: incident-manager')
          );
        });

        it('THEN displays warning message for activation', async () => {
          // Given: activate オペレーション
          const options = {
            activate: true,
            reason: 'Test activation',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: 警告メッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('⚠️  WARNING: This will immediately disable the feature(s) for all users!')
          );
        });
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    describe('GIVEN API service failures', () => {
      describe('WHEN kill-switch API fails', () => {
        it('THEN handles activation API errors gracefully', async () => {
          // Given: アクティベーション パラメータ
          const options = {
            activate: true,
            key: 'billing_v2_enable',
            reason: 'Test reason',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          // Given: API エラー
          const apiError = new Error('Kill-switch service unavailable');
          mockApiClient.activateKillSwitch.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await killSwitch(options);

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Kill-switch operation failed')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Kill-switch service unavailable')
          );
        });

        it('THEN handles deactivation API errors gracefully', async () => {
          // Given: デアクティベーション パラメータ
          const options = {
            deactivate: true,
            reason: 'Test reason',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          const apiError = new Error('Deactivation failed');
          mockApiClient.deactivateKillSwitch.mockRejectedValue(apiError);

          // When: API エラー発生
          await killSwitch(options);

          // Then: エラーハンドリングが実行される
          expect(process.exit).toHaveBeenCalledWith(1);
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Deactivation failed')
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
            activate: true,
            key: 'billing_v2_enable',
            reason: 'Test reason',
            user: 'test-user',
          };

          (inquirer.prompt as any).mockImplementation((questions) => {
            const confirmQuestion = questions.find((q: any) => q.name === 'confirm');
            if (confirmQuestion) {
              return Promise.resolve({ confirm: true });
            }
            return Promise.resolve({});
          });

          mockApiClient.activateKillSwitch.mockResolvedValue({ success: true });

          // When: コマンド実行
          await killSwitch(options);

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});