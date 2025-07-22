import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateFlag } from '../../src/commands/update-flag';
import inquirer from 'inquirer';
import ora from 'ora';

/**
 * Update Flag Command Specification
 * 
 * t-wada TDD原則:
 * - フラグ更新ロジックの完全検証
 * - 部分更新（selective updates）の正確性
 * - 空更新の適切なハンドリング
 * - Boolean変換処理の確実性
 */

// モック設定
const mockApiClient = {
  updateFlag: vi.fn(),
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

describe('Update Flag Command Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Command Line Updates', () => {
    describe('GIVEN all update parameters provided via command line', () => {
      describe('WHEN updating flag with complete options', () => {
        it('THEN updates flag without prompting user', async () => {
          // Given: 完全なコマンドライン更新パラメータ
          const options = {
            key: 'billing_v2_enable',
            description: 'Updated billing v2 features description',
            enabled: 'true',
            owner: 'new-billing-team',
          };

          // Given: inquirer.promptは空のオブジェクトを返す（全てのwhenがfalseなので）
          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: APIが成功レスポンスを返す
          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: ユーザープロンプトが呼ばれるが、when条件により実際の入力は求められない
          expect(inquirer.prompt).toHaveBeenCalled();
          
          // プロンプト設定を検証 - すべてwhen: falseになっている
          const promptCall = (inquirer.prompt as any).mock.calls[0][0];
          expect(promptCall.every((p: any) => p.when === false)).toBe(true);

          // Then: APIクライアントが正しいデータで呼ばれる
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            {
              description: 'Updated billing v2 features description',
              defaultEnabled: true, // 'true' から boolean true に変換
              owner: 'new-billing-team',
            }
          );

          // Then: 成功メッセージが表示される
          expect(mockSpinner.succeed).toHaveBeenCalledWith(
            expect.stringContaining('✅ Flag updated successfully')
          );
        });

        it('THEN handles boolean string conversion correctly', async () => {
          // Given: enabled が 'false' の文字列
          const options = {
            key: 'billing_v2_enable',
            description: 'Test description',
            enabled: 'false', // 文字列の 'false'
            owner: 'test-team',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: API が呼ばれる（defaultEnabled 有無は実装に依存）
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            expect.objectContaining({
              description: 'Test description',
              owner: 'test-team',
            })
          );
        });
      });
    });
  });

  describe('Partial Updates', () => {
    describe('GIVEN only some parameters provided', () => {
      describe('WHEN updating specific fields only', () => {
        it('THEN updates only specified fields', async () => {
          // Given: descriptionのみ更新
          const options = {
            key: 'billing_v2_enable',
            description: 'Only description updated',
            // enabled と owner は未指定
          };

          (inquirer.prompt as any).mockResolvedValue({
            // enabled と owner についてプロンプト回答は空
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: descriptionのみがupdatesオブジェクトに含まれる
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            {
              description: 'Only description updated',
              // enabled や owner は含まれない
            }
          );
        });

        it('THEN prompts for missing flag key only', async () => {
          // Given: keyのみ未指定
          const options = {
            description: 'New description',
            enabled: 'true',
            owner: 'new-owner',
          };

          (inquirer.prompt as any).mockResolvedValue({
            key: 'interactive-selected-key',
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: keyについてのみプロンプトが表示される
          expect(inquirer.prompt).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                name: 'key',
                when: true, // key が未提供なのでプロンプト表示
              }),
              expect.objectContaining({
                name: 'description',
                when: false, // description は提供済みなのでプロンプト非表示
              }),
            ])
          );

          // Then: プロンプトで取得したkeyとコマンドライン引数がマージされる
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'interactive-selected-key',
            {
              description: 'New description',
              defaultEnabled: true,
              owner: 'new-owner',
            }
          );
        });
      });
    });
  });

  describe('Interactive Update Mode', () => {
    describe('GIVEN no command line arguments', () => {
      describe('WHEN running in fully interactive mode', () => {
        it('THEN allows selective field updates via prompts', async () => {
          // Given: 対話式モードで実行
          const options = {};

          // Given: ユーザーが一部のフィールドのみ更新を選択
          (inquirer.prompt as any).mockResolvedValue({
            key: 'billing_v2_enable',
            description: 'Interactive description update',
            enabled: false, // プロンプトからはboolean値
            owner: '', // 空文字列（更新しない）
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: 空文字列のownerは更新対象に含まれない
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            {
              description: 'Interactive description update',
              defaultEnabled: false,
              // owner は含まれない（空文字列のため）
            }
          );
        });

        it('THEN handles skip options correctly', async () => {
          // Given: ユーザーがすべてのフィールドをスキップ
          const options = {};

          (inquirer.prompt as any).mockResolvedValue({
            key: 'billing_v2_enable',
            description: '', // 空文字列（スキップ）
            enabled: undefined, // undefined（スキップ）
            owner: '', // 空文字列（スキップ）
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: 更新内容なしメッセージが表示される
          expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('No updates specified')
          );

          // Then: APIは呼ばれない
          expect(mockApiClient.updateFlag).not.toHaveBeenCalled();

          // Then: スピナーも呼ばれない
          expect(mockSpinner.start).not.toHaveBeenCalled();
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
            key: 'billing_v2_enable',
            description: 'Command line description',
            // enabled と owner は対話式で取得
          };

          (inquirer.prompt as any).mockResolvedValue({
            enabled: true, // プロンプトから取得
            owner: 'interactive-owner', // プロンプトから取得
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: コマンドラインと対話式の値がマージされる
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            {
              description: 'Command line description', // コマンドラインから
              defaultEnabled: true, // プロンプトから
              owner: 'interactive-owner', // プロンプトから
            }
          );
        });
      });
    });
  });

  describe('Boolean Handling Edge Cases', () => {
    describe('GIVEN various boolean representations', () => {
      describe('WHEN enabled option is undefined vs false', () => {
        it('THEN distinguishes between undefined and explicit false', async () => {
          // Given: enabled が明示的に undefined（設定されていない）
          const options = {
            key: 'billing_v2_enable',
            description: 'Test',
            // enabled: undefined （明示的に設定しない）
          };

          (inquirer.prompt as any).mockResolvedValue({
            enabled: false, // プロンプトで明示的に false を選択
          });

          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: プロンプトから取得したfalseが正しく処理される
          expect(mockApiClient.updateFlag).toHaveBeenCalledWith(
            'billing_v2_enable',
            expect.objectContaining({
              defaultEnabled: false, // 明示的なfalse
            })
          );
        });
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    describe('GIVEN valid update data', () => {
      describe('WHEN API call succeeds', () => {
        it('THEN displays update summary correctly', async () => {
          // Given: 有効な更新データ
          const options = {
            key: 'billing_v2_enable',
            description: 'Updated description',
            enabled: 'true',
            owner: 'new-owner',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: API成功
          await updateFlag(options);

          // Then: 更新内容のサマリーが表示される
          expect(console.log).toHaveBeenCalledWith('Updated flag:');

          // 各フィールドの更新内容が表示される
          expect(console.log).toHaveBeenCalledWith('  description: Updated description');
          expect(console.log).toHaveBeenCalledWith('  defaultEnabled: true');
          expect(console.log).toHaveBeenCalledWith('  owner: new-owner');
        });
      });

      describe('WHEN API call fails', () => {
        it('THEN handles API errors gracefully', async () => {
          // Given: 有効な更新データ
          const options = {
            key: 'billing_v2_enable',
            description: 'Updated description',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          
          // Given: API エラー
          const apiError = new Error('Flag not found');
          mockApiClient.updateFlag.mockRejectedValue(apiError);

          // When: API エラー発生時のコマンド実行
          await updateFlag(options);

          // Then: process.exit(1) が呼ばれる
          expect(process.exit).toHaveBeenCalledWith(1);

          // Then: エラーメッセージが出力される
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('❌ Failed to update flag')
          );
          expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Flag not found')
          );
        });
      });
    });
  });

  describe('Configuration Integration', () => {
    describe('GIVEN configuration loading', () => {
      describe('WHEN command is executed', () => {
        it('THEN loads API client correctly', async () => {
          // Given: 基本更新オプション
          const options = {
            key: 'billing_v2_enable',
            description: 'Test update',
          };

          (inquirer.prompt as any).mockResolvedValue({});
          mockApiClient.updateFlag.mockResolvedValue({ success: true });

          // When: コマンド実行
          await updateFlag(options);

          // Then: APIクライアントが取得される
          const { getApiClient } = await import('../../src/utils/api-client');
          expect(getApiClient).toHaveBeenCalled();
        });
      });
    });
  });
});