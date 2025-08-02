import { describe, it, expect } from 'vitest';
import { ABTestEngine, ABTestAnalytics, ABTestConfig, ABTestContext, ABTestVariant } from '../src/ab-test';
import { FEATURE_FLAGS } from '../src/models';

/**
 * A/B Test Engine TDD Tests
 * 
 * A/Bテストエンジンの包括的テスト
 * TDD手法による品質保証とビジネスロジック検証
 */

describe('A/B Test Engine', () => {
  const abTestEngine = new ABTestEngine();

  const baseContext: ABTestContext = {
    tenantId: 'test-tenant',
    userId: 'user-123',
    environment: 'development',
    sessionId: 'session-456',
    timestamp: '2025-07-30T14:00:00.000Z'
  };

  const basicTestConfig: ABTestConfig = {
    testId: 'test-001',
    name: 'Homepage Button Color Test',
    description: 'Testing blue vs green button',
    isActive: true,
    trafficAllocation: 100,
    variants: [
      {
        id: 'control',
        name: 'Blue Button',
        weight: 50,
        config: { buttonColor: 'blue' }
      },
      {
        id: 'variant-a',
        name: 'Green Button',
        weight: 50,
        config: { buttonColor: 'green' }
      }
    ]
  };

  describe('Basic Variant Assignment', () => {
    describe('GIVEN an active A/B test configuration', () => {
      describe('WHEN assigning a variant to a user', () => {
        it('THEN returns a valid variant assignment', async () => {
          // Given: アクティブなA/Bテスト設定
          const config = { ...basicTestConfig };

          // When: ユーザーにバリアント割り当て
          const result = await abTestEngine.assignVariant(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: 有効なバリアントが返される
          expect(result).toEqual({
            testId: 'test-001',
            variantId: expect.any(String),
            variantName: expect.any(String),
            config: expect.any(Object),
            isControl: expect.any(Boolean),
            timestamp: expect.any(String)
          });
          expect(['control', 'variant-a']).toContain(result.variantId);
        });

        it('THEN provides consistent assignments for the same user', async () => {
          // Given: 同じユーザーコンテキスト
          const config = { ...basicTestConfig };

          // When: 同じユーザーで複数回割り当て
          const result1 = await abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, config);
          const result2 = await abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, config);
          const result3 = await abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, config);

          // Then: 一貫した結果が返される
          expect(result1.variantId).toBe(result2.variantId);
          expect(result2.variantId).toBe(result3.variantId);
          expect(result1.variantName).toBe(result2.variantName);
        });

        it('THEN assigns different variants to different users', async () => {
          // Given: 異なるユーザー
          const config = { ...basicTestConfig };
          const users = Array.from({ length: 20 }, (_, i) => ({
            ...baseContext,
            userId: `user-${i}`
          }));

          // When: 複数ユーザーに割り当て
          const results = await Promise.all(
            users.map(context => abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, config))
          );

          // Then: 異なるバリアントが分散される
          const uniqueVariants = new Set(results.map(r => r.variantId));
          expect(uniqueVariants.size).toBeGreaterThan(1);
        });
      });
    });
  });

  describe('Test Configuration Controls', () => {
    describe('GIVEN an inactive A/B test', () => {
      describe('WHEN requesting variant assignment', () => {
        it('THEN returns control variant', async () => {
          // Given: 非アクティブなテスト
          const config: ABTestConfig = {
            ...basicTestConfig,
            isActive: false
          };

          // When: バリアント割り当て要求
          const result = await abTestEngine.assignVariant(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: コントロールバリアントが返される
          expect(result.variantId).toBe('control');
          expect(result.isControl).toBe(true);
        });
      });
    });

    describe('GIVEN a test with time window restrictions', () => {
      describe('WHEN evaluating outside the test period', () => {
        it('THEN returns control variant for past dates', async () => {
          // Given: 過去の期間設定
          const config: ABTestConfig = {
            ...basicTestConfig,
            startDate: '2025-07-01T00:00:00.000Z',
            endDate: '2025-07-29T23:59:59.000Z'
          };

          // When: テスト期間外で評価
          const result = await abTestEngine.assignVariant(
            baseContext, // timestamp: '2025-07-30T14:00:00.000Z' (期間外)
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: コントロールバリアント
          expect(result.variantId).toBe('control');
          expect(result.isControl).toBe(true);
        });

        it('THEN assigns variants within the test period', async () => {
          // Given: 現在時刻を含む期間設定
          const config: ABTestConfig = {
            ...basicTestConfig,
            startDate: '2025-07-30T00:00:00.000Z',
            endDate: '2025-07-31T23:59:59.000Z'
          };

          // When: テスト期間内で評価
          const result = await abTestEngine.assignVariant(
            baseContext, // timestamp: '2025-07-30T14:00:00.000Z' (期間内)
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: 通常のバリアント割り当て
          expect(['control', 'variant-a']).toContain(result.variantId);
        });
      });
    });
  });

  describe('Traffic Allocation', () => {
    describe('GIVEN a test with partial traffic allocation', () => {
      describe('WHEN assigning variants with 50% traffic', () => {
        it('THEN approximately half of users get control', async () => {
          // Given: 50%トラフィック配分
          const config: ABTestConfig = {
            ...basicTestConfig,
            trafficAllocation: 50
          };

          const users = Array.from({ length: 100 }, (_, i) => ({
            ...baseContext,
            userId: `user-${i}`
          }));

          // When: 100ユーザーに割り当て
          const results = await Promise.all(
            users.map(context => abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, config))
          );

          // Then: 約半数がコントロール（トラフィック外）
          const controlCount = results.filter(r => r.isControl).length;
          expect(controlCount).toBeGreaterThan(20); // 最低20%
          expect(controlCount).toBeLessThan(80);    // 最高80%
        });
      });

      describe('WHEN traffic allocation is 0%', () => {
        it('THEN all users get control variant', async () => {
          // Given: 0%トラフィック配分
          const config: ABTestConfig = {
            ...basicTestConfig,
            trafficAllocation: 0
          };

          // When: バリアント割り当て
          const result = await abTestEngine.assignVariant(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: 全てコントロール
          expect(result.variantId).toBe('control');
          expect(result.isControl).toBe(true);
        });
      });
    });
  });

  describe('Segment Targeting', () => {
    describe('GIVEN a test with segment targeting', () => {
      describe('WHEN user matches target segment', () => {
        it('THEN assigns test variants', async () => {
          // Given: セグメントターゲティング設定
          const config: ABTestConfig = {
            ...basicTestConfig,
            targetSegments: ['premium', 'enterprise']
          };

          const contextWithSegment: ABTestContext = {
            ...baseContext,
            metadata: {
              segments: ['premium', 'early-adopter']
            }
          };

          // When: 対象セグメントユーザーで評価
          const result = await abTestEngine.assignVariant(
            contextWithSegment,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: テストバリアントが割り当て可能
          expect(['control', 'variant-a']).toContain(result.variantId);
        });
      });

      describe('WHEN user does not match target segment', () => {
        it('THEN returns control variant', async () => {
          // Given: セグメントターゲティング設定
          const config: ABTestConfig = {
            ...basicTestConfig,
            targetSegments: ['premium', 'enterprise']
          };

          const contextWithDifferentSegment: ABTestContext = {
            ...baseContext,
            metadata: {
              segments: ['basic', 'trial']
            }
          };

          // When: 対象外セグメントユーザーで評価
          const result = await abTestEngine.assignVariant(
            contextWithDifferentSegment,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: コントロールバリアント
          expect(result.variantId).toBe('control');
          expect(result.isControl).toBe(true);
        });
      });
    });
  });

  describe('Weighted Variant Distribution', () => {
    describe('GIVEN variants with unequal weights', () => {
      describe('WHEN assigning variants to many users', () => {
        it('THEN respects weight distribution', async () => {
          // Given: 不均等な重み配分
          const config: ABTestConfig = {
            ...basicTestConfig,
            variants: [
              { id: 'control', name: 'Control', weight: 70, config: {} },
              { id: 'variant-a', name: 'Variant A', weight: 20, config: {} },
              { id: 'variant-b', name: 'Variant B', weight: 10, config: {} }
            ]
          };

          const users = Array.from({ length: 1000 }, (_, i) => ({
            ...baseContext,
            userId: `user-${i}`
          }));

          // When: 大量ユーザーに割り当て
          const results = await Promise.all(
            users.map(context => abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, config))
          );

          // Then: 重みに応じた分散
          const controlCount = results.filter(r => r.variantId === 'control').length;
          const variantACount = results.filter(r => r.variantId === 'variant-a').length;
          const variantBCount = results.filter(r => r.variantId === 'variant-b').length;

          // 許容誤差±10%で重み比率を確認
          expect(controlCount).toBeGreaterThan(600);  // 70% of 1000 ±10%
          expect(controlCount).toBeLessThan(800);
          expect(variantACount).toBeGreaterThan(100);  // 20% of 1000 ±10%
          expect(variantACount).toBeLessThan(300);
          expect(variantBCount).toBeGreaterThan(50);   // 10% of 1000 ±5%
          expect(variantBCount).toBeLessThan(150);
        });
      });
    });
  });

  describe('Multiple Experiments', () => {
    describe('GIVEN multiple concurrent A/B tests', () => {
      describe('WHEN assigning variants for multiple experiments', () => {
        it('THEN provides independent assignments', async () => {
          // Given: 複数の実験設定
          const experiments = [
            {
              flagKey: FEATURE_FLAGS.BILLING_V2,
              testConfig: { ...basicTestConfig, testId: 'test-001' }
            },
            {
              flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
              testConfig: { ...basicTestConfig, testId: 'test-002' }
            }
          ];

          // When: 複数実験でバリアント割り当て
          const results = await abTestEngine.assignMultipleVariants(baseContext, experiments);

          // Then: 独立した結果
          expect(results).toHaveLength(2);
          expect(results[0].testId).toBe('test-001');
          expect(results[1].testId).toBe('test-002');
          
          // バリアントは独立して決定される
          expect(['control', 'variant-a']).toContain(results[0].variantId);
          expect(['control', 'variant-a']).toContain(results[1].variantId);
        });
      });
    });
  });

  describe('Conversion Tracking', () => {
    describe('GIVEN an A/B test with conversion tracking', () => {
      describe('WHEN tracking a conversion event', () => {
        it('THEN records conversion without errors', async () => {
          // Given: コンバージョン追跡設定
          const testId = 'test-001';
          const variantId = 'variant-a';
          const userId = 'user-123';

          // When: コンバージョンイベント追跡
          const trackingPromise = abTestEngine.trackConversion(
            testId,
            variantId,
            userId,
            100, // conversion value
            { source: 'checkout_button' }
          );

          // Then: エラーなく完了
          await expect(trackingPromise).resolves.toBeUndefined();
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('GIVEN invalid test configurations', () => {
      describe('WHEN variants have zero total weight', () => {
        it('THEN returns control variant', async () => {
          // Given: 重み合計が0のバリアント
          const config: ABTestConfig = {
            ...basicTestConfig,
            variants: [
              { id: 'control', name: 'Control', weight: 0, config: {} },
              { id: 'variant-a', name: 'Variant A', weight: 0, config: {} }
            ]
          };

          // When: バリアント割り当て
          const result = await abTestEngine.assignVariant(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: コントロールバリアント
          expect(result.variantId).toBe('control');
        });
      });

      describe('WHEN test has no variants', () => {
        it('THEN returns default control variant', async () => {
          // Given: バリアントなしの設定
          const config: ABTestConfig = {
            ...basicTestConfig,
            variants: []
          };

          // When: バリアント割り当て
          const result = await abTestEngine.assignVariant(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: デフォルトコントロール
          expect(result.variantId).toBe('control');
          expect(result.variantName).toBe('Control');
          expect(result.isControl).toBe(true);
        });
      });

      describe('WHEN user context lacks userId', () => {
        it('THEN handles gracefully with fallback', async () => {
          // Given: userIdなしのコンテキスト
          const contextWithoutUserId: ABTestContext = {
            ...baseContext,
            userId: undefined
          };

          // When: バリアント割り当て
          const result = await abTestEngine.assignVariant(
            contextWithoutUserId,
            FEATURE_FLAGS.BILLING_V2,
            basicTestConfig
          );

          // Then: エラーなく処理される
          expect(result).toBeDefined();
          expect(['control', 'variant-a']).toContain(result.variantId);
        });
      });
    });
  });
});

describe('A/B Test Analytics', () => {
  const analytics = new ABTestAnalytics();

  describe('Statistical Significance Calculation', () => {
    describe('GIVEN control and variant metrics', () => {
      describe('WHEN calculating significance', () => {
        it('THEN provides statistical analysis', () => {
          // Given: コントロールとバリアントのメトリクス
          const controlMetrics = {
            testId: 'test-001',
            variantId: 'control',
            impressions: 1000,
            conversions: 50,
            conversionRate: 5.0,
            lastUpdated: '2025-07-30T14:00:00.000Z'
          };

          const variantMetrics = {
            testId: 'test-001',
            variantId: 'variant-a',
            impressions: 1000,
            conversions: 60,
            conversionRate: 6.0,
            lastUpdated: '2025-07-30T14:00:00.000Z'
          };

          // When: 統計的有意性を計算
          const result = analytics.calculateSignificance(controlMetrics, variantMetrics);

          // Then: 統計分析結果
          expect(result).toEqual({
            pValue: expect.any(Number),
            isSignificant: expect.any(Boolean),
            confidenceInterval: expect.any(Array),
            improvement: expect.any(Number)
          });

          expect(result.improvement).toBeCloseTo(20); // (6.0 - 5.0) / 5.0 * 100 = 20%
          expect(result.confidenceInterval).toHaveLength(2);
        });
      });
    });
  });
});