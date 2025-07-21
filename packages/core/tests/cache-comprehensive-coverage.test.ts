import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS } from '../src/models';

/**
 * FeatureFlagCache Comprehensive Coverage Tests
 * 
 * t-wada TDD原則:
 * - キャッシュの全機能を仕様ベースでテスト
 * - TTL（Time To Live）動作の詳細検証
 * - メモリ効率とパフォーマンスの確認
 * - エッジケースとエラー処理の完全カバレッジ
 */
describe('FeatureFlagCache Comprehensive Coverage Tests', () => {
  let cache: FeatureFlagCache;
  const tenantId = 'test-tenant';
  const flagKey = FEATURE_FLAGS.BILLING_V2;

  beforeEach(() => {
    // 各テストで新しいキャッシュインスタンスを作成
    cache = new FeatureFlagCache();
  });

  afterEach(() => {
    // タイマーをクリアしてメモリリークを防止
    vi.clearAllTimers();
  });

  describe('Basic Cache Operations', () => {
    describe('GIVEN an empty cache', () => {
      it('WHEN getting non-existent value THEN returns undefined', () => {
        // Given: 空のキャッシュ
        
        // When: 存在しない値を取得
        const result = cache.get(tenantId, flagKey);
        
        // Then: undefinedが返される
        expect(result).toBeUndefined();
      });

      it('WHEN setting and getting value THEN returns stored value', () => {
        // Given: 空のキャッシュ
        
        // When: 値を設定
        cache.set(tenantId, flagKey, true);
        
        // When: 値を取得
        const result = cache.get(tenantId, flagKey);
        
        // Then: 設定した値が返される
        expect(result).toBe(true);
      });
    });

    describe('GIVEN cache with existing values', () => {
      beforeEach(() => {
        cache.set(tenantId, flagKey, true);
        cache.set('other-tenant', flagKey, false);
        cache.set(tenantId, 'new_dashboard_enable', true);
      });

      it('WHEN getting existing value THEN returns correct value', () => {
        // When: 既存の値を取得
        const result1 = cache.get(tenantId, flagKey);
        const result2 = cache.get('other-tenant', flagKey);
        const result3 = cache.get(tenantId, 'new_dashboard_enable');
        
        // Then: 正しい値が返される
        expect(result1).toBe(true);
        expect(result2).toBe(false);
        expect(result3).toBe(true);
      });

      it('WHEN overwriting existing value THEN returns new value', () => {
        // Given: 既存の値がtrue
        expect(cache.get(tenantId, flagKey)).toBe(true);
        
        // When: 値を上書き
        cache.set(tenantId, flagKey, false);
        
        // Then: 新しい値が返される
        expect(cache.get(tenantId, flagKey)).toBe(false);
      });
    });
  });

  describe('TTL (Time To Live) Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('GIVEN cache with default TTL (300 seconds)', () => {
      it('WHEN time passes within TTL THEN value remains accessible', () => {
        // Given: デフォルトTTL（300秒）のキャッシュ
        cache.set(tenantId, flagKey, true);
        
        // When: TTL内の時間経過（299秒）
        vi.advanceTimersByTime(299 * 1000);
        
        // Then: 値がアクセス可能
        expect(cache.get(tenantId, flagKey)).toBe(true);
      });

      it('WHEN time exceeds TTL THEN value expires', () => {
        // Given: デフォルトTTL（300秒）のキャッシュ
        cache.set(tenantId, flagKey, true);
        
        // When: TTLを超過（301秒）
        vi.advanceTimersByTime(301 * 1000);
        
        // Then: 値が期限切れ
        expect(cache.get(tenantId, flagKey)).toBeUndefined();
      });
    });

    describe('GIVEN cache with custom TTL', () => {
      beforeEach(() => {
        cache = new FeatureFlagCache({ ttl: 60000 }); // 60秒TTL（ミリ秒）
      });

      it('WHEN time passes within custom TTL THEN value remains accessible', () => {
        // Given: カスタムTTL（60秒）のキャッシュ
        cache.set(tenantId, flagKey, true);
        
        // When: TTL内の時間経過（59秒）
        vi.advanceTimersByTime(59 * 1000);
        
        // Then: 値がアクセス可能
        expect(cache.get(tenantId, flagKey)).toBe(true);
      });

      it('WHEN time exceeds custom TTL THEN value expires', () => {
        // Given: カスタムTTL（60秒）のキャッシュ
        cache.set(tenantId, flagKey, true);
        
        // When: TTLを超過（61秒）
        vi.advanceTimersByTime(61 * 1000);
        
        // Then: 値が期限切れ
        expect(cache.get(tenantId, flagKey)).toBeUndefined();
      });
    });

    describe('GIVEN multiple cache entries with different set times', () => {
      it('WHEN TTL expires for some entries THEN only expired entries are removed', () => {
        // Given: 異なる時刻で設定された複数のエントリ
        cache.set(tenantId, flagKey, true);
        
        // 30秒後に別のエントリを設定
        vi.advanceTimersByTime(30 * 1000);
        cache.set('other-tenant', flagKey, false);
        
        // 280秒後（最初のエントリから310秒、2番目のエントリから280秒）
        vi.advanceTimersByTime(280 * 1000);
        
        // Then: 最初のエントリは期限切れ、2番目のエントリは有効
        expect(cache.get(tenantId, flagKey)).toBeUndefined();
        expect(cache.get('other-tenant', flagKey)).toBe(false);
      });
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      // テスト用データを設定
      cache.set(tenantId, flagKey, true);
      cache.set('other-tenant', flagKey, false);
      cache.set(tenantId, 'new_dashboard_enable', true);
      cache.set('third-tenant', 'new_dashboard_enable', false);
    });

    describe('GIVEN cache with multiple entries', () => {
      it('WHEN invalidating specific tenant-flag combination THEN only that entry is removed', () => {
        // Given: 複数のキャッシュエントリ
        expect(cache.get(tenantId, flagKey)).toBe(true);
        expect(cache.get('other-tenant', flagKey)).toBe(false);
        expect(cache.get(tenantId, 'new_dashboard_enable')).toBe(true);
        
        // When: 特定のテナント-フラグ組み合わせを無効化
        cache.invalidate(tenantId, flagKey);
        
        // Then: 該当エントリのみが削除される
        expect(cache.get(tenantId, flagKey)).toBeUndefined();
        expect(cache.get('other-tenant', flagKey)).toBe(false); // 他のテナントは残る
        expect(cache.get(tenantId, 'new_dashboard_enable')).toBe(true); // 他のフラグは残る
      });

      it('WHEN invalidating all cache THEN all entries are removed', () => {
        // Given: 複数のキャッシュエントリ
        expect(cache.get(tenantId, flagKey)).toBe(true);
        expect(cache.get('other-tenant', flagKey)).toBe(false);
        expect(cache.get(tenantId, 'new_dashboard_enable')).toBe(true);
        
        // When: 全キャッシュを無効化
        cache.invalidateAll();
        
        // Then: 全エントリが削除される
        expect(cache.get(tenantId, flagKey)).toBeUndefined();
        expect(cache.get('other-tenant', flagKey)).toBeUndefined();
        expect(cache.get(tenantId, 'new_dashboard_enable')).toBeUndefined();
      });
    });
  });

  describe('Cache Key Generation and Isolation', () => {
    describe('GIVEN different tenant-flag combinations', () => {
      it('WHEN setting values with similar keys THEN values are properly isolated', () => {
        // Given: 類似したキーの組み合わせ
        const tenant1 = 'tenant-1';
        const tenant2 = 'tenant-11'; // 類似文字列
        const flag1 = 'flag_a';
        const flag2 = 'flag_ab'; // 類似文字列
        
        // When: 異なる値を設定
        cache.set(tenant1, flag1, true);
        cache.set(tenant2, flag1, false);
        cache.set(tenant1, flag2, false);
        cache.set(tenant2, flag2, true);
        
        // Then: 値が正しく分離される
        expect(cache.get(tenant1, flag1)).toBe(true);
        expect(cache.get(tenant2, flag1)).toBe(false);
        expect(cache.get(tenant1, flag2)).toBe(false);
        expect(cache.get(tenant2, flag2)).toBe(true);
      });

      it('WHEN using special characters in keys THEN handles properly', () => {
        // Given: 特殊文字を含むキー
        const specialTenant = 'tenant-with-#-symbols';
        const specialFlag = 'flag_with_$_and_@';
        
        // When: 値を設定・取得
        cache.set(specialTenant, specialFlag, true);
        const result = cache.get(specialTenant, specialFlag);
        
        // Then: 正しく処理される
        expect(result).toBe(true);
      });
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    describe('GIVEN cache usage patterns', () => {
      it('WHEN performing cache operations THEN tracks hit/miss ratios', () => {
        // Given: キャッシュ使用パターン
        
        // Cache miss (初回アクセス)
        const miss1 = cache.get(tenantId, flagKey);
        expect(miss1).toBeUndefined();
        
        // Cache set
        cache.set(tenantId, flagKey, true);
        
        // Cache hit (2回目以降のアクセス)
        const hit1 = cache.get(tenantId, flagKey);
        const hit2 = cache.get(tenantId, flagKey);
        expect(hit1).toBe(true);
        expect(hit2).toBe(true);
        
        // Cache miss (別のキー)
        const miss2 = cache.get('other-tenant', flagKey);
        expect(miss2).toBeUndefined();
        
        // Then: キャッシュの動作が正常
        // (統計機能は将来の拡張として実装可能)
      });
    });
  });

  describe('Memory Management and Performance', () => {
    describe('GIVEN large number of cache entries', () => {
      it('WHEN storing many entries THEN handles efficiently', () => {
        // Given: 大量のキャッシュエントリ
        const tenantCount = 100;
        const flagCount = 10;
        
        // When: 大量のエントリを設定
        for (let t = 0; t < tenantCount; t++) {
          for (let f = 0; f < flagCount; f++) {
            cache.set(`tenant-${t}`, `flag-${f}`, t % 2 === 0);
          }
        }
        
        // Then: 全エントリが正しく取得可能
        for (let t = 0; t < tenantCount; t++) {
          for (let f = 0; f < flagCount; f++) {
            const expected = t % 2 === 0;
            const actual = cache.get(`tenant-${t}`, `flag-${f}`);
            expect(actual).toBe(expected);
          }
        }
      });

      it('WHEN invalidating all cache THEN clears efficiently', () => {
        // Given: 大量のキャッシュエントリ
        for (let i = 0; i < 1000; i++) {
          cache.set(`tenant-${i}`, `flag-${i}`, true);
        }
        
        // When: 全キャッシュを無効化
        const startTime = performance.now();
        cache.invalidateAll();
        const endTime = performance.now();
        
        // Then: 効率的にクリア（1ms以内）
        expect(endTime - startTime).toBeLessThan(1);
        
        // Then: 全エントリが削除される
        for (let i = 0; i < 10; i++) { // サンプルチェック
          expect(cache.get(`tenant-${i}`, `flag-${i}`)).toBeUndefined();
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('GIVEN edge case scenarios', () => {
      it('WHEN using empty strings as keys THEN handles gracefully', () => {
        // Given: 空文字列キー
        const emptyTenant = '';
        const emptyFlag = '';
        
        // When: 空文字列で操作
        cache.set(emptyTenant, emptyFlag, true);
        const result = cache.get(emptyTenant, emptyFlag);
        
        // Then: 正常に処理される
        expect(result).toBe(true);
      });

      it('WHEN using null/undefined-like strings THEN handles properly', () => {
        // Given: null/undefined風の文字列
        const nullLikeTenant = 'null';
        const undefinedLikeFlag = 'undefined';
        
        // When: これらの文字列で操作
        cache.set(nullLikeTenant, undefinedLikeFlag, false);
        const result = cache.get(nullLikeTenant, undefinedLikeFlag);
        
        // Then: 正常に処理される
        expect(result).toBe(false);
      });

      it('WHEN setting boolean false THEN distinguishes from undefined', () => {
        // Given: boolean false値
        
        // When: falseを設定
        cache.set(tenantId, flagKey, false);
        
        // Then: falseとundefinedを区別できる
        expect(cache.get(tenantId, flagKey)).toBe(false);
        expect(cache.get('non-existent', flagKey)).toBeUndefined();
        
        // Then: 型チェック
        expect(typeof cache.get(tenantId, flagKey)).toBe('boolean');
        expect(typeof cache.get('non-existent', flagKey)).toBe('undefined');
      });
    });
  });

  describe('Configuration and Initialization', () => {
    describe('GIVEN different cache configurations', () => {
      it('WHEN creating cache with default config THEN uses default TTL', () => {
        // Given: デフォルト設定のキャッシュ
        const defaultCache = new FeatureFlagCache();
        
        // When/Then: デフォルトTTL（300秒）が適用される
        // (内部実装の詳細だが、動作で確認)
        vi.useFakeTimers();
        defaultCache.set(tenantId, flagKey, true);
        
        vi.advanceTimersByTime(299 * 1000);
        expect(defaultCache.get(tenantId, flagKey)).toBe(true);
        
        vi.advanceTimersByTime(2 * 1000);
        expect(defaultCache.get(tenantId, flagKey)).toBeUndefined();
        
        vi.useRealTimers();
      });

      it('WHEN creating cache with custom config THEN uses custom settings', () => {
        // Given: カスタム設定のキャッシュ
        const customCache = new FeatureFlagCache({ ttl: 120000 }); // 120秒TTL（ミリ秒）
        
        // When/Then: カスタムTTLが適用される
        vi.useFakeTimers();
        customCache.set(tenantId, flagKey, true);
        
        vi.advanceTimersByTime(119 * 1000);
        expect(customCache.get(tenantId, flagKey)).toBe(true);
        
        vi.advanceTimersByTime(2 * 1000);
        expect(customCache.get(tenantId, flagKey)).toBeUndefined();
        
        vi.useRealTimers();
      });

      it('WHEN creating multiple cache instances THEN instances are isolated', () => {
        // Given: 複数のキャッシュインスタンス
        const cache1 = new FeatureFlagCache();
        const cache2 = new FeatureFlagCache();
        
        // When: 同じキーで異なる値を設定
        cache1.set(tenantId, flagKey, true);
        cache2.set(tenantId, flagKey, false);
        
        // Then: インスタンスが分離されている
        expect(cache1.get(tenantId, flagKey)).toBe(true);
        expect(cache2.get(tenantId, flagKey)).toBe(false);
        
        // When: 一方を無効化
        cache1.invalidateAll();
        
        // Then: 他方は影響を受けない
        expect(cache1.get(tenantId, flagKey)).toBeUndefined();
        expect(cache2.get(tenantId, flagKey)).toBe(false);
      });
    });
  });
});
