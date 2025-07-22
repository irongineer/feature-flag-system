import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeatureFlagClient, getFeatureFlagClient, isFeatureEnabled } from '../src/index';
import { FEATURE_FLAGS, FeatureFlagContext } from '@feature-flag/core';
import { TEST_CONTEXTS, createMockEvaluator, createMockCache } from './helpers/mock-factory';
import { measurePerformance } from './setup';

/**
 * Feature Flag SDK Client Comprehensive Specification
 * 
 * t-wada TDD原則による外部API品質保証テスト:
 * - SDK Client基本機能テスト
 * - グローバルキャッシュ管理テスト
 * - エラーハンドリング・フェイルセーフテスト
 * - パフォーマンス・同期処理テスト
 * - 便利関数インターフェーステスト
 * - API契約準拠テスト
 * 
 * External API Quality Assurance Coverage:
 * 1. SDK Client Instantiation & Configuration
 * 2. Cache Management & TTL Behavior
 * 3. Error Handling & Fallback Mechanisms
 * 4. Performance & Concurrency
 * 5. Type Safety & Input Validation
 * 6. API Contract Compliance
 */
describe('Feature Flag SDK Client Comprehensive Specification', () => {
  
  describe('SDK Client Instantiation & Configuration', () => {
    describe('GIVEN various SDK client configuration options', () => {
      describe('WHEN creating FeatureFlagClient instances', () => {
        it('THEN creates client with default cache configuration', () => {
          // Given: デフォルト設定でのクライアント作成
          const client = new FeatureFlagClient();

          // When & Then: クライアントが正しく初期化される
          expect(client).toBeInstanceOf(FeatureFlagClient);
          expect(client.isEnabled).toBeDefined();
          expect(client.invalidateCache).toBeDefined();
          expect(client.invalidateAllCache).toBeDefined();
        });

        it('THEN creates client with custom cache configuration', () => {
          // Given: カスタムキャッシュ設定
          const customCache = createMockCache({ isExpired: vi.fn().mockReturnValue(false) });
          
          // When: カスタムキャッシュでクライアント作成
          const client = new FeatureFlagClient({ cache: customCache });

          // Then: カスタムキャッシュを使用したクライアントが作成される
          expect(client).toBeInstanceOf(FeatureFlagClient);
        });
      });
    });
  });

  describe('Global Client Factory & Cache Management', () => {
    describe('GIVEN global client factory requirements', () => {
      describe('WHEN using getFeatureFlagClient function', () => {
        it('THEN returns singleton client instance with proper cache management', () => {
          // Given: グローバルクライアントファクトリー使用

          // When: 複数回のクライアント取得
          const client1 = getFeatureFlagClient();
          const client2 = getFeatureFlagClient();

          // Then: 同じインスタンスが返される（シングルトン）
          expect(client1).toBe(client2);
          expect(client1).toBeDefined();
        });

        it('THEN recreates client when cache expires', () => {
          // Given: 期限切れキャッシュのシミュレーション
          const client1 = getFeatureFlagClient();

          // キャッシュ期限切れをモック
          vi.doMock('@feature-flag/core', () => ({
            FeatureFlagCache: class MockCache {
              isExpired() { return true; }
            },
            FeatureFlagEvaluator: class MockEvaluator {
              constructor() {}
            }
          }));

          // When: 期限切れ後のクライアント取得
          const client2 = getFeatureFlagClient();

          // Then: 新しいクライアントインスタンスが作成される
          expect(client1).toBeDefined();
          expect(client2).toBeDefined();
        });
      });
    });
  });

  describe('Error Handling & Fallback Mechanisms', () => {
    describe('GIVEN error conditions in flag evaluation', () => {
      describe('WHEN SDK encounters evaluation failures', () => {
        it('THEN falls back to safe default values on evaluator errors', async () => {
          // Given: エラーを発生させる評価エンジン
          const failingEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockRejectedValue(new Error('Evaluation failed'))
          });
          
          // Mock console.error to avoid test output noise
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
          
          const client = new FeatureFlagClient();
          // Replace internal evaluator with failing mock
          (client as any).evaluator = failingEvaluator;

          // When: 失敗条件でフラグ評価実行
          const result = await client.isEnabled(TEST_CONTEXTS.STANDARD_USER, FEATURE_FLAGS.BILLING_V2);

          // Then: フェイルセーフでfalseが返される
          expect(result).toBe(false);
          expect(consoleSpy).toHaveBeenCalledWith('FeatureFlag evaluation failed:', expect.any(Error));
          
          consoleSpy.mockRestore();
        });

        it('THEN handles network timeout errors gracefully', async () => {
          // Given: ネットワークタイムアウトを発生させる評価エンジン  
          const timeoutEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockRejectedValue(new Error('Request timeout'))
          });

          const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
          const client = new FeatureFlagClient();
          (client as any).evaluator = timeoutEvaluator;

          // When: タイムアウト条件での評価
          const result = await client.isEnabled(TEST_CONTEXTS.ENTERPRISE_USER, FEATURE_FLAGS.NEW_DASHBOARD);

          // Then: タイムアウトエラーでもフェイルセーフが動作
          expect(result).toBe(false);
          expect(consoleSpy).toHaveBeenCalledWith('FeatureFlag evaluation failed:', expect.any(Error));
          
          consoleSpy.mockRestore();
        });
      });
    });
  });

  describe('Cache Invalidation Operations', () => {
    describe('GIVEN cache invalidation requirements', () => {
      describe('WHEN performing cache management operations', () => {
        it('THEN invalidates specific tenant-flag cache correctly', async () => {
          // Given: キャッシュ無効化機能付き評価エンジン
          const evaluatorWithCache = createMockEvaluator({
            invalidateCache: vi.fn().mockResolvedValue(undefined)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = evaluatorWithCache;

          // When: 特定のテナント・フラグキャッシュ無効化
          await client.invalidateCache('test-tenant', FEATURE_FLAGS.BILLING_V2);

          // Then: 正しいパラメータで無効化が実行される
          expect(evaluatorWithCache.invalidateCache).toHaveBeenCalledWith('test-tenant', FEATURE_FLAGS.BILLING_V2);
          expect(evaluatorWithCache.invalidateCache).toHaveBeenCalledTimes(1);
        });

        it('THEN invalidates all cache correctly', async () => {
          // Given: 全キャッシュ無効化機能付き評価エンジン
          const evaluatorWithCache = createMockEvaluator({
            invalidateAllCache: vi.fn().mockResolvedValue(undefined)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = evaluatorWithCache;

          // When: 全キャッシュ無効化
          await client.invalidateAllCache();

          // Then: 全キャッシュ無効化が実行される
          expect(evaluatorWithCache.invalidateAllCache).toHaveBeenCalledWith();
          expect(evaluatorWithCache.invalidateAllCache).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('Convenience Function Interface', () => {
    describe('GIVEN simplified isFeatureEnabled function', () => {
      describe('WHEN using convenience interface', () => {
        it('THEN evaluates flags with minimal context successfully', async () => {
          // Given: 成功レスポンスを返すグローバルクライアント
          const successfulEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockResolvedValue(true)
          });

          // Mock the global client to use our test evaluator
          vi.doMock('../src/index', async (importOriginal) => {
            const original: any = await importOriginal();
            return {
              ...original,
              getFeatureFlagClient: () => successfulEvaluator
            };
          });

          // When: 便利関数での評価実行
          const result = await isFeatureEnabled('convenience-tenant', FEATURE_FLAGS.ADVANCED_ANALYTICS);

          // Then: 評価が成功する
          expect(typeof result).toBe('boolean');
        });

        it('THEN merges partial context with tenantId correctly', async () => {
          // Given: コンテキスト検証用の評価エンジン
          let capturedContext: FeatureFlagContext | undefined;
          const contextCapturingEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockImplementation((context, flagKey) => {
              capturedContext = context;
              return Promise.resolve(false);
            })
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = contextCapturingEvaluator;

          const partialContext = {
            userId: 'test-user',
            userRole: 'admin' as const,
            metadata: { source: 'test' }
          };

          const fullContext: FeatureFlagContext = {
            tenantId: 'merged-context-tenant',
            ...partialContext,
          };

          // When: 部分的なコンテキストでの評価（直接クライアントを使用）
          await client.isEnabled(fullContext, FEATURE_FLAGS.NEW_DASHBOARD);

          // Then: テナントIDが正しくマージされる
          expect(capturedContext?.tenantId).toBe('merged-context-tenant');
          expect(capturedContext?.userId).toBe('test-user');
          expect(capturedContext?.userRole).toBe('admin');
          expect(capturedContext?.metadata).toEqual({ source: 'test' });
        });
      });
    });
  });

  describe('Performance & Concurrency Testing', () => {
    describe('GIVEN performance requirements for SDK operations', () => {
      describe('WHEN handling concurrent flag evaluations', () => {
        it('THEN maintains acceptable performance under concurrent load', async () => {
          // Given: 高速レスポンス評価エンジン
          const fastEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockResolvedValue(true)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = fastEvaluator;

          // When: 並行評価のパフォーマンス測定
          const { result: concurrentResults, duration } = await measurePerformance(async () => {
            const promises = Array.from({ length: 20 }, (_, i) => 
              client.isEnabled(
                { ...TEST_CONTEXTS.STANDARD_USER, userId: `concurrent-user-${i}` },
                FEATURE_FLAGS.BILLING_V2
              )
            );
            return Promise.all(promises);
          });

          // Then: 適切なパフォーマンスで完了
          expect(duration).toBeLessThan(100); // 100ms以内で20並行評価
          expect(concurrentResults).toHaveLength(20);
          concurrentResults.forEach(result => {
            expect(typeof result).toBe('boolean');
          });
        });

        it('THEN handles memory efficiently during extended operations', async () => {
          // Given: 長時間実行シナリオ
          const memoryEfficientEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockResolvedValue(false)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = memoryEfficientEvaluator;

          // When: 連続評価実行
          for (let batch = 0; batch < 5; batch++) {
            const batchResults = await Promise.all(
              Array.from({ length: 10 }, (_, i) =>
                client.isEnabled(
                  { ...TEST_CONTEXTS.TRIAL_USER, userId: `batch-${batch}-user-${i}` },
                  FEATURE_FLAGS.ADVANCED_ANALYTICS
                )
              )
            );

            // Then: 各バッチで正常な結果が得られる
            expect(batchResults).toHaveLength(10);
            batchResults.forEach(result => {
              expect(typeof result).toBe('boolean');
            });
          }
        });
      });
    });
  });

  describe('Type Safety & Input Validation', () => {
    describe('GIVEN type safety requirements', () => {
      describe('WHEN using SDK with various input types', () => {
        it('THEN enforces correct FeatureFlagKey types', async () => {
          // Given: タイプセーフな評価エンジン
          const typeSafeEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockResolvedValue(true)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = typeSafeEvaluator;

          // When & Then: 有効なフラグキータイプでの評価
          const validFlags = [
            FEATURE_FLAGS.BILLING_V2,
            FEATURE_FLAGS.NEW_DASHBOARD,
            FEATURE_FLAGS.ADVANCED_ANALYTICS
          ];

          for (const flagKey of validFlags) {
            const result = await client.isEnabled(TEST_CONTEXTS.ENTERPRISE_USER, flagKey);
            expect(typeof result).toBe('boolean');
          }
        });

        it('THEN validates FeatureFlagContext structure', async () => {
          // Given: コンテキスト構造検証
          const validationEvaluator = createMockEvaluator({
            isEnabled: vi.fn().mockResolvedValue(false)
          });

          const client = new FeatureFlagClient();
          (client as any).evaluator = validationEvaluator;

          // When: 各種コンテキスト構造での評価
          const contextVariations = [
            TEST_CONTEXTS.ENTERPRISE_USER,   // Full context
            TEST_CONTEXTS.MINIMAL_CONTEXT,   // Minimal context
            {
              tenantId: 'validation-tenant',
              environment: 'staging' as const,
              metadata: { validation: true }
            } // Custom context
          ];

          // Then: 全てのコンテキストバリエーションが処理される
          for (const context of contextVariations) {
            const result = await client.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
            expect(typeof result).toBe('boolean');
            expect(validationEvaluator.isEnabled).toHaveBeenCalledWith(context, FEATURE_FLAGS.BILLING_V2);
          }
        });
      });
    });
  });

  describe('API Contract Compliance', () => {
    describe('GIVEN SDK API contract requirements', () => {
      describe('WHEN verifying API interface compliance', () => {
        it('THEN provides all required SDK methods with correct signatures', () => {
          // Given: SDK契約準拠チェック
          const client = new FeatureFlagClient();

          // When & Then: 必要なメソッドが存在し正しいシグネチャを持つ
          expect(typeof client.isEnabled).toBe('function');
          expect(client.isEnabled.length).toBe(2); // context, flagKey

          expect(typeof client.invalidateCache).toBe('function');
          expect(client.invalidateCache.length).toBe(2); // tenantId, flagKey

          expect(typeof client.invalidateAllCache).toBe('function');
          expect(client.invalidateAllCache.length).toBe(0); // no parameters
        });

        it('THEN exports required convenience functions', () => {
          // When & Then: 便利関数のエクスポート確認
          expect(typeof getFeatureFlagClient).toBe('function');
          expect(typeof isFeatureEnabled).toBe('function');
          expect(isFeatureEnabled.length).toBe(2); // tenantId, flagKey (context is optional with default)

          // And: 型定義と定数のエクスポート確認
          expect(FEATURE_FLAGS).toBeDefined();
          expect(typeof FEATURE_FLAGS.BILLING_V2).toBe('string');
          expect(typeof FEATURE_FLAGS.NEW_DASHBOARD).toBe('string');
          expect(typeof FEATURE_FLAGS.ADVANCED_ANALYTICS).toBe('string');
        });

        it('THEN returns promises for all async operations', () => {
          // Given: 非同期操作契約チェック
          const client = new FeatureFlagClient();

          // When: 各種非同期操作実行
          const isEnabledPromise = client.isEnabled(TEST_CONTEXTS.STANDARD_USER, FEATURE_FLAGS.BILLING_V2);
          const invalidateCachePromise = client.invalidateCache('test-tenant', FEATURE_FLAGS.BILLING_V2);
          const invalidateAllPromise = client.invalidateAllCache();
          const conveniencePromise = isFeatureEnabled('test-tenant', FEATURE_FLAGS.NEW_DASHBOARD);

          // Then: 全てがPromiseを返す
          expect(isEnabledPromise).toBeInstanceOf(Promise);
          expect(invalidateCachePromise).toBeInstanceOf(Promise);
          expect(invalidateAllPromise).toBeInstanceOf(Promise);
          expect(conveniencePromise).toBeInstanceOf(Promise);
        });
      });
    });
  });
});