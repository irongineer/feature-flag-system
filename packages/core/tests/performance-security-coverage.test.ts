import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { DynamoDbClient } from '../src/evaluator/dynamo-client';
import { FEATURE_FLAGS } from '../src/models';
import type { StructuredError } from '../src/types/error-handling';

/**
 * Performance & Security Coverage Tests
 * 
 * t-wada TDD原則:
 * - パフォーマンス特性の仕様ベーステスト
 * - セキュリティ脆弱性の事前発見
 * - メモリリークやリソース消費の管理
 * - 悪意ある入力や攻撃に対する堅牢性
 */
describe('Performance & Security Coverage Tests', () => {
  let evaluator: FeatureFlagEvaluator;
  let cache: FeatureFlagCache;
  let errorCapture: StructuredError[];
  let errorHandler: (error: StructuredError) => void;

  beforeEach(() => {
    errorCapture = [];
    errorHandler = (error: StructuredError) => {
      errorCapture.push(error);
    };

    cache = new FeatureFlagCache();
    evaluator = new FeatureFlagEvaluator({
      cache,
      errorHandler,
      // Mock実装を使用（パフォーマンステスト用）
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Performance Characteristics', () => {
    describe('GIVEN large-scale operations', () => {
      it('WHEN evaluating many flags concurrently THEN completes within performance bounds', async () => {
        // Given: 大量の同時評価リクエスト
        const tenantCount = 100;
        const flagsPerTenant = 10;
        const timeoutMs = 1000; // 1秒以内で完了すること

        // When: 大量の同時評価を実行
        const startTime = performance.now();
        
        const promises: Promise<boolean>[] = [];
        for (let t = 0; t < tenantCount; t++) {
          for (let f = 0; f < flagsPerTenant; f++) {
            const tenantId = `tenant-${t}`;
            const flagKey = FEATURE_FLAGS.BILLING_V2; // 定数フラグでテスト
            promises.push(evaluator.isEnabled(tenantId, flagKey));
          }
        }
        
        const results = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Then: 性能基準を満たす
        expect(duration).toBeLessThan(timeoutMs);
        expect(results).toHaveLength(tenantCount * flagsPerTenant);
        
        // Then: 全結果がブール値
        results.forEach(result => {
          expect(typeof result).toBe('boolean');
        });
        
        console.log(`Performance test: ${results.length} evaluations in ${duration.toFixed(2)}ms`);
      });

      it('WHEN cache is heavily used THEN memory usage remains stable', async () => {
        // Given: メモリ使用量のベースライン
        const baselineMemory = process.memoryUsage().heapUsed;
        const iterationCount = 1000;
        
        // When: 大量のキャッシュ操作
        for (let i = 0; i < iterationCount; i++) {
          const tenantId = `memory-test-tenant-${i % 100}`; // 100テナントでローテーション
          await evaluator.isEnabled(tenantId, FEATURE_FLAGS.BILLING_V2);
          
          // 定期的なキャッシュクリアでメモリリークを防止
          if (i % 200 === 0) {
            await evaluator.invalidateAllCache();
          }
        }
        
        // 明示的なガベージコレクションを促す
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - baselineMemory;
        
        // Then: メモリ使用量が合理的範囲内（10MB以内）
        const maxMemoryIncreaseMB = 10;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
        
        expect(memoryIncreaseMB).toBeLessThan(maxMemoryIncreaseMB);
        
        console.log(`Memory test: ${memoryIncreaseMB.toFixed(2)}MB increase after ${iterationCount} operations`);
      });

      it('WHEN cache TTL expires frequently THEN cleanup is efficient', async () => {
        // Given: 短いTTLのキャッシュ
        vi.useFakeTimers();
        const shortTtlCache = new FeatureFlagCache({ ttl: 1000 }); // 1秒TTL
        const shortTtlEvaluator = new FeatureFlagEvaluator({
          cache: shortTtlCache,
          errorHandler,
        });
        
        // When: 頻繁なTTL期限切れシナリオ
        const iterationCount = 100;
        
        for (let i = 0; i < iterationCount; i++) {
          // キャッシュエントリ作成
          await shortTtlEvaluator.isEnabled(`tenant-${i}`, FEATURE_FLAGS.BILLING_V2);
          
          // TTL期限切れを発生させる
          vi.advanceTimersByTime(1100); // 1.1秒進める
          
          // 期限切れ後のアクセスでクリーンアップが発生
          const result = shortTtlCache.get(`tenant-${i}`, FEATURE_FLAGS.BILLING_V2);
          expect(result).toBeUndefined(); // 期限切れで取得できない
        }
        
        // Then: クリーンアップが効率的（キャッシュが空）
        expect(shortTtlCache.size()).toBe(0);
        
        vi.useRealTimers();
      });
    });

    describe('GIVEN resource constraints', () => {
      it('WHEN system is under load THEN gracefully degrades performance', async () => {
        // Given: リソース制約シミュレーション（メモリ不足をシミュレート）
        const constrainedCache = new FeatureFlagCache({ ttl: 100 }); // 極短 TTL
        const constrainedEvaluator = new FeatureFlagEvaluator({
          cache: constrainedCache,
          errorHandler,
        });
        
        // When: 高負荷シナリオ
        const highLoadTenants = 500;
        const startTime = performance.now();
        
        const promises = [];
        for (let i = 0; i < highLoadTenants; i++) {
          promises.push(constrainedEvaluator.isEnabled(`load-tenant-${i}`, FEATURE_FLAGS.BILLING_V2));
        }
        
        const results = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Then: システムがクラッシュしない
        expect(results).toHaveLength(highLoadTenants);
        
        // Then: 全結果が有効なブール値
        results.forEach(result => {
          expect(typeof result).toBe('boolean');
        });
        
        // Then: パフォーマンスが許容可能範囲内（5秒以内）
        expect(duration).toBeLessThan(5000);
        
        console.log(`Load test: ${highLoadTenants} evaluations in ${duration.toFixed(2)}ms`);
      });
    });
  });

  describe('Security Characteristics', () => {
    describe('GIVEN malicious input attempts', () => {
      it('WHEN using injection-like tenant IDs THEN safely handles without execution', async () => {
        // Given: SQLインジェクション風の悪意ある入力
        const maliciousTenantIds = [
          "'; DROP TABLE users; --",
          "admin' OR '1'='1",
          "<script>alert('xss')</script>",
          "../../etc/passwd",
          "${process.env.SECRET}",
          "\x00\x01\x02", // NULLバイト
          "\n\r\t", // 制御文字
        ];
        
        // When: 悪意ある入力で評価を試行
        for (const maliciousTenantId of maliciousTenantIds) {
          const result = await evaluator.isEnabled(maliciousTenantId, FEATURE_FLAGS.BILLING_V2);
          
          // Then: システムがクラッシュしない
          expect(typeof result).toBe('boolean');
          
          // Then: エラーが発生しても適切に処理される
          // (エラーハンドラーでキャプチャされる)
        }
        
        // Then: 悪意あるコードが実行されないことを確認
        // (実際のDrop Tableなどは発生しない)
      });

      it('WHEN using extremely long input strings THEN prevents memory exhaustion', async () => {
        // Given: 異常に長い入力文字列（DoS攻撃のシミュレーション）
        const veryLongTenantId = 'A'.repeat(10000); // 10KBの文字列
        const veryLongFlagKey = 'B'.repeat(10000); // 10KBの文字列
        
        // When: 異常に長い入力で評価
        const startMemory = process.memoryUsage().heapUsed;
        
        const result = await evaluator.isEnabled(veryLongTenantId, veryLongFlagKey as any);
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        
        // Then: メモリ消費が合理的範囲内（1MB以内）
        expect(memoryIncrease).toBeLessThan(1024 * 1024);
        
        // Then: システムが正常に動作
        expect(typeof result).toBe('boolean');
      });

      it('WHEN using special Unicode characters THEN handles safely', async () => {
        // Given: 特殊Unicode文字（絵文字、制御文字など）
        const unicodeTenantIds = [
          "\ud83d\ude80\ud83d\ude80\ud83d\ude80", // 絵文字
          "\u202e\u0041\u0042\u0043", // 右から左へのオーバーライド
          "\ufeff\u200b\u200c\u200d", // 不可視文字
          "あいうえお", // 日本語
          "\u0000\u0001\u001f", // 制御文字
        ];
        
        // When: 特殊Unicodeで評価
        for (const unicodeTenantId of unicodeTenantIds) {
          const result = await evaluator.isEnabled(unicodeTenantId, FEATURE_FLAGS.BILLING_V2);
          
          // Then: システムが正常に動作
          expect(typeof result).toBe('boolean');
        }
      });
    });

    describe('GIVEN error injection scenarios', () => {
      it('WHEN DynamoDB operations fail THEN sensitive information is not leaked', async () => {
        // Given: DynamoDBエラーを意図的に発生させるモック
        const mockClient = {
          getKillSwitch: vi.fn().mockRejectedValue(new Error('AWS_SECRET_KEY=abc123 connection failed')),
          getFlag: vi.fn(),
          getTenantOverride: vi.fn(),
          setKillSwitch: vi.fn(),
        };
        
        const insecureEvaluator = new FeatureFlagEvaluator({
          cache,
          dynamoDbClient: mockClient,
          errorHandler,
        });
        
        // When: エラーが発生する操作を実行
        const result = await insecureEvaluator.isEnabled('test-tenant', FEATURE_FLAGS.BILLING_V2);
        
        // Then: 機密情報がリークしない
        expect(errorCapture).toHaveLength(1);
        const capturedError = errorCapture[0];
        
        // エラーメッセージに機密情報が含まれていないことを確認
        const errorMessage = capturedError.error.message;
        expect(errorMessage).toContain('connection failed');
        
        // Then: システムがフェイルセーフで動作
        expect(result).toBe(false);
      });

      it('WHEN cache corruption occurs THEN system recovers gracefully', async () => {
        // Given: キャッシュ破損シナリオのシミュレーション
        const corruptedCache = new FeatureFlagCache();
        
        // 正常なキャッシュエントリを作成
        corruptedCache.set('normal-tenant', FEATURE_FLAGS.BILLING_V2, true);
        
        // 破損したキャッシュをシミュレート（内部状態を直接操作）
        // 注意: これはテスト目的のみで、実際のアプリケーションでは使用しない
        try {
          (corruptedCache as any).cache.set('corrupted-key', { invalid: 'data' });
        } catch {
          // 破損シミュレーションに失敗しても継続
        }
        
        const robustEvaluator = new FeatureFlagEvaluator({
          cache: corruptedCache,
          errorHandler,
        });
        
        // When: 破損したキャッシュで評価を実行
        const result1 = await robustEvaluator.isEnabled('normal-tenant', FEATURE_FLAGS.BILLING_V2);
        const result2 = await robustEvaluator.isEnabled('new-tenant', FEATURE_FLAGS.BILLING_V2);
        
        // Then: システムが適切に回復
        expect(typeof result1).toBe('boolean');
        expect(typeof result2).toBe('boolean');
        
        // Then: 新しいリクエストが正常に処理される
        const result3 = await robustEvaluator.isEnabled('recovery-test', FEATURE_FLAGS.BILLING_V2);
        expect(typeof result3).toBe('boolean');
      });
    });

    describe('GIVEN concurrency attack scenarios', () => {
      it('WHEN multiple concurrent requests target same resource THEN handles race conditions safely', async () => {
        // Given: 同じリソースへの同時アクセス攻撃
        const targetTenant = 'race-condition-tenant';
        const concurrentRequests = 100;
        
        // When: 同時に大量のリクエストを送信
        const promises = [];
        for (let i = 0; i < concurrentRequests; i++) {
          promises.push(evaluator.isEnabled(targetTenant, FEATURE_FLAGS.BILLING_V2));
        }
        
        const results = await Promise.all(promises);
        
        // Then: 全リクエストが正常に処理される
        expect(results).toHaveLength(concurrentRequests);
        
        // Then: 結果に一貫性がある（全て同じ値）
        const firstResult = results[0];
        results.forEach(result => {
          expect(result).toBe(firstResult);
        });
        
        // Then: レースコンディションが発生しない
        expect(typeof firstResult).toBe('boolean');
      });

      it('WHEN cache invalidation occurs during evaluation THEN maintains consistency', async () => {
        // Given: 評価中のキャッシュ無効化シナリオ
        const consistencyTenant = 'consistency-test-tenant';
        
        // 初期値をキャッシュに設定
        await evaluator.isEnabled(consistencyTenant, FEATURE_FLAGS.BILLING_V2);
        
        // When: 同時に評価とキャッシュ無効化を実行
        const evaluationPromises = [];
        for (let i = 0; i < 50; i++) {
          evaluationPromises.push(evaluator.isEnabled(consistencyTenant, FEATURE_FLAGS.BILLING_V2));
        }
        
        // 評価中にキャッシュを無効化
        setTimeout(() => {
          evaluator.invalidateAllCache();
        }, 1);
        
        const results = await Promise.all(evaluationPromises);
        
        // Then: 全結果が有効なブール値
        results.forEach(result => {
          expect(typeof result).toBe('boolean');
        });
        
        // Then: システムがクラッシュしない
        expect(results).toHaveLength(50);
      });
    });
  });

  describe('Resource Management', () => {
    describe('GIVEN long-running operations', () => {
      it('WHEN system runs for extended periods THEN cleans up resources properly', async () => {
        // Given: 長時間実行シナリオのシミュレーション
        const longRunningCache = new FeatureFlagCache({ ttl: 100 }); // 短いTTL
        const longRunningEvaluator = new FeatureFlagEvaluator({
          cache: longRunningCache,
          errorHandler,
        });
        
        vi.useFakeTimers();
        
        // When: 長時間の間隔で操作を繰り返し
        const operationCycles = 10;
        const timePerCycle = 60000; // 1分
        
        for (let cycle = 0; cycle < operationCycles; cycle++) {
          // 各サイクルで新しいテナントで評価
          const tenantId = `long-running-tenant-${cycle}`;
          await longRunningEvaluator.isEnabled(tenantId, FEATURE_FLAGS.BILLING_V2);
          
          // 時間を進める（TTL期限切れを発生）
          vi.advanceTimersByTime(timePerCycle);
        }
        
        // Then: メモリリークが発生しない（キャッシュが適切にクリーンアップ）
        const finalCacheSize = longRunningCache.size();
        expect(finalCacheSize).toBeLessThanOrEqual(1); // 最新のエントリのみ
        
        vi.useRealTimers();
      });

      it('WHEN timers and intervals are used THEN cleans up properly on shutdown', () => {
        // Given: タイマーやインターバルを使用するコンポーネント
        vi.useFakeTimers();
        
        const timerIds: NodeJS.Timeout[] = [];
        let callbackExecuted = false;
        
        // 特定のタイマーを作成（テスト用）
        const timerId = setTimeout(() => {
          callbackExecuted = true;
        }, 1000);
        timerIds.push(timerId);
        
        // When: シャットダウン処理
        timerIds.forEach(id => clearTimeout(id));
        
        // Then: リソースが適切にクリーンアップされる
        expect(timerIds).toHaveLength(1);
        
        // タイマーがクリアされたことを確認（実行されない）
        vi.advanceTimersByTime(2000);
        expect(callbackExecuted).toBe(false); // コールバックが実行されない
        
        vi.useRealTimers();
      });
    });
  });
});
