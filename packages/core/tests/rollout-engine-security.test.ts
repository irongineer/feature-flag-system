import { describe, it, expect } from 'vitest';
import { RolloutEngine, RolloutConfig, RolloutContext } from '../src/rollout';
import { FEATURE_FLAGS } from '../src/models';

/**
 * Rollout Engine Security Tests
 *
 * ハッシュ関数のセキュリティ特性とロールアウト分散の均等性を検証
 * FNV-1aアルゴリズムの安全性とパフォーマンスをテスト
 */

describe('Rollout Engine Security', () => {
  const rolloutEngine = new RolloutEngine();

  describe('Hash Function Security', () => {
    describe('GIVEN FNV-1a hash algorithm', () => {
      describe('WHEN generating hashes for different inputs', () => {
        it('THEN produces uniform distribution', async () => {
          // Given: 大量のユーザーIDとフラグの組み合わせ
          const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
          const rolloutConfig: RolloutConfig = { percentage: 50 };

          const results = await Promise.all(
            users.map(userId => {
              const context: RolloutContext = {
                tenantId: 'security-test-tenant',
                userId,
                environment: 'development',
              };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // When: 50%ロールアウトでの分散確認
          const enabledCount = results.filter(r => r).length;
          const enabledPercentage = (enabledCount / users.length) * 100;

          // Then: 均等分散（±5%の誤差許容）
          expect(enabledPercentage).toBeGreaterThan(45);
          expect(enabledPercentage).toBeLessThan(55);
        });

        it('THEN ensures consistent results for same input', async () => {
          // Given: 同一ユーザー・フラグの組み合わせ
          const context: RolloutContext = {
            tenantId: 'consistency-test',
            userId: 'consistent-user-123',
            environment: 'development',
          };
          const rolloutConfig: RolloutConfig = { percentage: 30 };

          // When: 複数回評価
          const results = await Promise.all(
            Array.from({ length: 10 }, () =>
              rolloutEngine.evaluateRollout(context, FEATURE_FLAGS.BILLING_V2, rolloutConfig)
            )
          );

          // Then: 全て同一結果
          const firstResult = results[0];
          results.forEach(result => {
            expect(result).toBe(firstResult);
          });
        });

        it('THEN prevents hash collision attacks', async () => {
          // Given: 意図的に類似した入力パターン
          const similarUsers = [
            'user-attack-1',
            'user-attack-2',
            'user-attack-3',
            'user-1-attack',
            'user-2-attack',
            'user-3-attack',
          ];

          const rolloutConfig: RolloutConfig = { percentage: 50 };

          const results = await Promise.all(
            similarUsers.map(userId => {
              const context: RolloutContext = {
                tenantId: 'collision-test',
                userId,
                environment: 'development',
              };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // When: 類似パターンでの結果確認
          const uniqueResults = new Set(results);

          // Then: 衝突が発生していない（複数の異なる結果）
          expect(uniqueResults.size).toBeGreaterThan(1);
        });
      });
    });
  });

  describe('Percentage Distribution Security', () => {
    describe('GIVEN percentage-based rollout', () => {
      describe('WHEN testing edge case percentages', () => {
        it('THEN handles 0% rollout securely', async () => {
          // Given: 0%ロールアウト設定
          const rolloutConfig: RolloutConfig = { percentage: 0 };
          const testUsers = Array.from({ length: 100 }, (_, i) => `user-${i}`);

          // When: 複数ユーザーで評価
          const results = await Promise.all(
            testUsers.map(userId => {
              const context: RolloutContext = {
                tenantId: 'zero-percent-test',
                userId,
                environment: 'development',
              };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // Then: 全てfalse
          results.forEach(result => {
            expect(result).toBe(false);
          });
        });

        it('THEN handles 100% rollout securely', async () => {
          // Given: 100%ロールアウト設定
          const rolloutConfig: RolloutConfig = { percentage: 100 };
          const testUsers = Array.from({ length: 100 }, (_, i) => `user-${i}`);

          // When: 複数ユーザーで評価
          const results = await Promise.all(
            testUsers.map(userId => {
              const context: RolloutContext = {
                tenantId: 'hundred-percent-test',
                userId,
                environment: 'development',
              };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // Then: 全てtrue
          results.forEach(result => {
            expect(result).toBe(true);
          });
        });

        it('THEN prevents percentage manipulation attacks', async () => {
          // Given: 悪意のある入力パターン
          const maliciousInputs = [
            { userId: 'admin', percentage: 1 },
            { userId: 'root', percentage: 1 },
            { userId: '../../etc/passwd', percentage: 1 },
            { userId: '<script>alert("xss")</script>', percentage: 1 },
          ];

          // When: 悪意のある入力での評価
          const results = await Promise.all(
            maliciousInputs.map(({ userId, percentage }) => {
              const context: RolloutContext = {
                tenantId: 'security-test',
                userId,
                environment: 'development',
              };
              const rolloutConfig: RolloutConfig = { percentage };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // Then: 安全に処理される（エラーが発生しない）
          results.forEach(result => {
            expect(typeof result).toBe('boolean');
          });
        });
      });
    });
  });

  describe('Performance Security', () => {
    describe('GIVEN high-frequency evaluation scenarios', () => {
      describe('WHEN performing many evaluations', () => {
        it('THEN maintains consistent performance', async () => {
          // Given: 大量評価のシナリオ
          const context: RolloutContext = {
            tenantId: 'performance-test',
            userId: 'performance-user',
            environment: 'development',
          };
          const rolloutConfig: RolloutConfig = { percentage: 50 };

          // When: パフォーマンス測定
          const startTime = Date.now();

          await Promise.all(
            Array.from({ length: 1000 }, () =>
              rolloutEngine.evaluateRollout(context, FEATURE_FLAGS.BILLING_V2, rolloutConfig)
            )
          );

          const endTime = Date.now();
          const totalTime = endTime - startTime;

          // Then: 1000回の評価が妥当な時間内で完了
          expect(totalTime).toBeLessThan(1000); // 1秒以内
        });
      });
    });
  });

  describe('Input Validation Security', () => {
    describe('GIVEN various input edge cases', () => {
      describe('WHEN handling extreme inputs', () => {
        it('THEN safely processes empty user IDs', async () => {
          // Given: 空のユーザーID
          const context: RolloutContext = {
            tenantId: 'empty-user-test',
            userId: '',
            environment: 'development',
          };
          const rolloutConfig: RolloutConfig = { percentage: 50 };

          // When: 空のユーザーIDで評価
          const result = await rolloutEngine.evaluateRollout(
            context,
            FEATURE_FLAGS.BILLING_V2,
            rolloutConfig
          );

          // Then: 安全に処理される
          expect(typeof result).toBe('boolean');
        });

        it('THEN safely processes very long user IDs', async () => {
          // Given: 非常に長いユーザーID
          const longUserId = 'a'.repeat(10000);
          const context: RolloutContext = {
            tenantId: 'long-user-test',
            userId: longUserId,
            environment: 'development',
          };
          const rolloutConfig: RolloutConfig = { percentage: 50 };

          // When: 長いユーザーIDで評価
          const result = await rolloutEngine.evaluateRollout(
            context,
            FEATURE_FLAGS.BILLING_V2,
            rolloutConfig
          );

          // Then: 安全に処理される
          expect(typeof result).toBe('boolean');
        });

        it('THEN safely processes Unicode user IDs', async () => {
          // Given: Unicode文字を含むユーザーID
          const unicodeUserIds = [
            '用户-123',
            'пользователь-456',
            'ユーザー-789',
            '🚀user-emoji',
            'user@例.テスト',
          ];

          const rolloutConfig: RolloutConfig = { percentage: 50 };

          // When: Unicode文字で評価
          const results = await Promise.all(
            unicodeUserIds.map(userId => {
              const context: RolloutContext = {
                tenantId: 'unicode-test',
                userId,
                environment: 'development',
              };
              return rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.BILLING_V2,
                rolloutConfig
              );
            })
          );

          // Then: 全て安全に処理される
          results.forEach(result => {
            expect(typeof result).toBe('boolean');
          });
        });
      });
    });
  });
});
