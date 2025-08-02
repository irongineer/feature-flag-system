import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { ABTestEngine, ABTestConfig, ABTestContext } from '../src/ab-test';
import { RolloutEngine, RolloutConfig, RolloutContext } from '../src/rollout';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS } from '../src/models';
import { silentErrorHandler } from '../src/types/error-handling';

/**
 * A/B Test Integration Tests
 * 
 * A/Bテストエンジンとフィーチャーフラグシステムの統合テスト
 * 実際のビジネスシナリオでの動作を検証
 */

describe('A/B Test Integration', () => {
  let evaluator: FeatureFlagEvaluator;
  let abTestEngine: ABTestEngine;
  let rolloutEngine: RolloutEngine;
  let cache: FeatureFlagCache;

  beforeEach(() => {
    cache = new FeatureFlagCache({ ttl: 300 });
    abTestEngine = new ABTestEngine();
    rolloutEngine = new RolloutEngine();
    evaluator = new FeatureFlagEvaluator({
      cache,
      environment: 'development',
      rolloutEngine,
      errorHandler: silentErrorHandler
    });
  });

  describe('A/B Test with Feature Flag Integration', () => {
    describe('GIVEN a feature flag with A/B test configuration', () => {
      describe('WHEN evaluating for different user segments', () => {
        it('THEN provides consistent A/B test experiences', async () => {
          // Given: A/Bテスト設定
          const abTestConfig: ABTestConfig = {
            testId: 'checkout-button-test',
            name: 'Checkout Button Optimization',
            description: 'Testing different button colors and text',
            isActive: true,
            trafficAllocation: 100,
            variants: [
              {
                id: 'control',
                name: 'Blue Button - Buy Now',
                weight: 40,
                config: {
                  buttonColor: 'blue',
                  buttonText: 'Buy Now',
                  showUrgency: false
                }
              },
              {
                id: 'variant-green',
                name: 'Green Button - Purchase',
                weight: 30,
                config: {
                  buttonColor: 'green',
                  buttonText: 'Purchase',
                  showUrgency: false
                }
              },
              {
                id: 'variant-urgent',
                name: 'Red Button with Urgency',
                weight: 30,
                config: {
                  buttonColor: 'red',
                  buttonText: 'Buy Now - Limited Time!',
                  showUrgency: true
                }
              }
            ]
          };

          const baseContext: ABTestContext = {
            tenantId: 'ecommerce-tenant',
            userId: 'user-consistent-test',
            environment: 'development',
            sessionId: 'session-123',
            timestamp: '2025-07-30T14:00:00.000Z'
          };

          // When: 同じユーザーで複数回A/Bテスト評価
          const results = await Promise.all([
            abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, abTestConfig),
            abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, abTestConfig),
            abTestEngine.assignVariant(baseContext, FEATURE_FLAGS.BILLING_V2, abTestConfig)
          ]);

          // Then: 一貫したバリアント割り当て
          expect(results[0].variantId).toBe(results[1].variantId);
          expect(results[1].variantId).toBe(results[2].variantId);
          expect(results[0].config).toEqual(results[1].config);
          
          // バリアントは設定されたもののいずれか
          const validVariantIds = ['control', 'variant-green', 'variant-urgent'];
          expect(validVariantIds).toContain(results[0].variantId);
        });

        it('THEN supports segment-based A/B testing', async () => {
          // Given: セグメント特化A/Bテスト
          const premiumTestConfig: ABTestConfig = {
            testId: 'premium-feature-test',
            name: 'Premium Feature A/B Test',
            isActive: true,
            trafficAllocation: 100,
            targetSegments: ['premium', 'enterprise'],
            variants: [
              {
                id: 'control',
                name: 'Standard Premium Features',
                weight: 50,
                config: { premiumFeatures: 'standard' }
              },
              {
                id: 'enhanced',
                name: 'Enhanced Premium Features',
                weight: 50,
                config: { premiumFeatures: 'enhanced' }
              }
            ]
          };

          const premiumUserContext: ABTestContext = {
            tenantId: 'segment-test-tenant',
            userId: 'premium-user-1',
            environment: 'development',
            metadata: {
              segments: ['premium', 'early-adopter']
            }
          };

          const basicUserContext: ABTestContext = {
            tenantId: 'segment-test-tenant',
            userId: 'basic-user-1',
            environment: 'development',
            metadata: {
              segments: ['basic']
            }
          };

          // When: 異なるセグメントユーザーで評価
          const premiumResult = await abTestEngine.assignVariant(
            premiumUserContext,
            FEATURE_FLAGS.ADVANCED_ANALYTICS,
            premiumTestConfig
          );

          const basicResult = await abTestEngine.assignVariant(
            basicUserContext,
            FEATURE_FLAGS.ADVANCED_ANALYTICS,
            premiumTestConfig
          );

          // Then: セグメントに応じた結果
          expect(['control', 'enhanced']).toContain(premiumResult.variantId);
          expect(basicResult.variantId).toBe('control');
          expect(basicResult.isControl).toBe(true);
        });
      });
    });
  });

  describe('A/B Test with Rollout Engine Integration', () => {
    describe('GIVEN both A/B test and rollout configurations', () => {
      describe('WHEN combining progressive rollout with A/B testing', () => {
        it('THEN applies both rollout and A/B test logic', async () => {
          // Given: ロールアウトとA/Bテストの組み合わせ
          const rolloutConfig: RolloutConfig = {
            percentage: 50, // 50%のユーザーにのみロールアウト
            targetRegions: ['US'],
            businessHoursOnly: false
          };

          const abTestConfig: ABTestConfig = {
            testId: 'rollout-ab-test',
            name: 'Feature Rollout A/B Test',
            isActive: true,
            trafficAllocation: 100, // ロールアウト対象ユーザーの100%をA/Bテスト
            variants: [
              {
                id: 'control',
                name: 'Control Version',
                weight: 50,
                config: { version: 'v1' }
              },
              {
                id: 'variant-new',  
                name: 'New Version',
                weight: 50,
                config: { version: 'v2' }
              }
            ]
          };

          // シミュレーション用の複数ユーザー
          const users = Array.from({ length: 100 }, (_, i) => ({
            tenantId: 'rollout-ab-tenant',
            userId: `user-${i}`,
            environment: 'development' as const,
            region: 'US',
            timestamp: '2025-07-30T14:00:00.000Z'
          }));

          // When: ロールアウトとA/Bテストを組み合わせて評価
          const results = await Promise.all(
            users.map(async (context) => {
              // まずロールアウト対象かチェック
              const rolloutResult = await rolloutEngine.evaluateRollout(
                context,
                FEATURE_FLAGS.NEW_DASHBOARD,
                rolloutConfig
              );

              if (rolloutResult) {
                // ロールアウト対象の場合、A/Bテスト実行
                const abTestResult = await abTestEngine.assignVariant(
                  context,
                  FEATURE_FLAGS.NEW_DASHBOARD,
                  abTestConfig
                );
                return { userId: context.userId, rollout: true, abTest: abTestResult };
              } else {
                // ロールアウト対象外の場合
                return { userId: context.userId, rollout: false, abTest: null };
              }
            })
          );

          // Then: ロールアウトとA/Bテストが適切に連携
          const rolloutUsers = results.filter(r => r.rollout);
          const nonRolloutUsers = results.filter(r => !r.rollout);

          // ロールアウト対象ユーザーの約50%
          expect(rolloutUsers.length).toBeGreaterThan(30);
          expect(rolloutUsers.length).toBeLessThan(70);

          // ロールアウト対象ユーザーにはA/Bテスト結果
          rolloutUsers.forEach(user => {
            expect(user.abTest).not.toBeNull();
            expect(['control', 'variant-new']).toContain(user.abTest!.variantId);
          });

          // ロールアウト対象外ユーザーにはA/Bテストなし
          nonRolloutUsers.forEach(user => {
            expect(user.abTest).toBeNull();
          });
        });
      });
    });
  });

  describe('Multi-Experiment A/B Testing', () => {
    describe('GIVEN multiple concurrent A/B experiments', () => {
      describe('WHEN running experiments independently', () => {
        it('THEN provides independent variant assignments', async () => {
          // Given: 複数の独立したA/Bテスト
          const checkoutTest: ABTestConfig = {
            testId: 'checkout-optimization',
            name: 'Checkout Flow Optimization',
            isActive: true,
            trafficAllocation: 100,
            variants: [
              { id: 'control', name: 'Standard Checkout', weight: 50, config: { flow: 'standard' } },
              { id: 'simplified', name: 'Simplified Checkout', weight: 50, config: { flow: 'simplified' } }
            ]
          };

          const pricingTest: ABTestConfig = {
            testId: 'pricing-display',
            name: 'Pricing Display Test',
            isActive: true,
            trafficAllocation: 100,
            variants: [
              { id: 'control', name: 'Monthly Pricing', weight: 60, config: { pricing: 'monthly' } },
              { id: 'annual', name: 'Annual Pricing Focus', weight: 40, config: { pricing: 'annual' } }
            ]
          };

          const experiments = [
            { flagKey: FEATURE_FLAGS.BILLING_V2, testConfig: checkoutTest },
            { flagKey: FEATURE_FLAGS.NEW_DASHBOARD, testConfig: pricingTest }
          ];

          const context: ABTestContext = {
            tenantId: 'multi-experiment-tenant',
            userId: 'multi-test-user',
            environment: 'development',
            sessionId: 'session-multi'
          };

          // When: 複数実験を同時実行
          const results = await abTestEngine.assignMultipleVariants(context, experiments);

          // Then: 独立した実験結果
          expect(results).toHaveLength(2);
          
          const checkoutResult = results.find(r => r.testId === 'checkout-optimization');
          const pricingResult = results.find(r => r.testId === 'pricing-display');

          expect(checkoutResult).toBeDefined();
          expect(pricingResult).toBeDefined();
          
          expect(['control', 'simplified']).toContain(checkoutResult!.variantId);
          expect(['control', 'annual']).toContain(pricingResult!.variantId);

          // 実験間の独立性確認（同じユーザーでも異なる結果可能）
          expect(checkoutResult!.testId).not.toBe(pricingResult!.testId);
        });

        it('THEN maintains consistency across experiment contexts', async () => {
          // Given: 実験コンテキストを更新した複数実験
          const baseExperiments = [
            {
              flagKey: FEATURE_FLAGS.BILLING_V2,
              testConfig: {
                testId: 'consistency-test-1',
                name: 'Test 1',
                isActive: true,
                trafficAllocation: 100,
                variants: [
                  { id: 'control', name: 'Control', weight: 50, config: {} },
                  { id: 'variant', name: 'Variant', weight: 50, config: {} }
                ]
              }
            },
            {
              flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
              testConfig: {
                testId: 'consistency-test-2',
                name: 'Test 2',
                isActive: true,
                trafficAllocation: 100,
                variants: [
                  { id: 'control', name: 'Control', weight: 50, config: {} },
                  { id: 'variant', name: 'Variant', weight: 50, config: {} }
                ]
              }
            }
          ];

          const context: ABTestContext = {
            tenantId: 'consistency-tenant',
            userId: 'consistency-user',
            environment: 'development'
          };

          // When: 同じコンテキストで複数回実行
          const results1 = await abTestEngine.assignMultipleVariants(context, baseExperiments);
          const results2 = await abTestEngine.assignMultipleVariants(context, baseExperiments);

          // Then: 一貫した結果
          expect(results1[0].variantId).toBe(results2[0].variantId);
          expect(results1[1].variantId).toBe(results2[1].variantId);
        });
      });
    });
  });

  describe('A/B Test Performance and Scale', () => {
    describe('GIVEN high-volume A/B test scenarios', () => {
      describe('WHEN processing many concurrent assignments', () => {
        it('THEN maintains performance within acceptable limits', async () => {
          // Given: 大量ユーザーとA/Bテスト
          const users = Array.from({ length: 1000 }, (_, i) => ({
            tenantId: 'performance-tenant',
            userId: `user-${i}`,
            environment: 'development' as const,
            sessionId: `session-${i}`
          }));

          const testConfig: ABTestConfig = {
            testId: 'performance-test',
            name: 'Performance Test',
            isActive: true,
            trafficAllocation: 100,
            variants: [
              { id: 'control', name: 'Control', weight: 50, config: {} },
              { id: 'variant', name: 'Variant', weight: 50, config: {} }
            ]
          };

          // When: パフォーマンス測定
          const startTime = Date.now();
          
          const results = await Promise.all(
            users.map(context => 
              abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, testConfig)
            )
          );

          const endTime = Date.now();
          const totalTime = endTime - startTime;

          // Then: 許容可能なパフォーマンス
          expect(totalTime).toBeLessThan(5000); // 5秒以内
          expect(results).toHaveLength(1000);
          
          // 全結果が有効
          results.forEach(result => {
            expect(['control', 'variant']).toContain(result.variantId);
            expect(result.testId).toBe('performance-test');
          });
        });
      });
    });
  });

  describe('A/B Test Error Resilience', () => {
    describe('GIVEN invalid or problematic test configurations', () => {
      describe('WHEN handling edge cases', () => {
        it('THEN gracefully handles invalid configurations', async () => {
          // Given: 問題のある設定
          const invalidConfigs: ABTestConfig[] = [
            {
              testId: 'invalid-1',
              name: 'No Variants',
              isActive: true,
              trafficAllocation: 100,
              variants: [] // バリアントなし
            },
            {
              testId: 'invalid-2',
              name: 'Zero Weight Total',
              isActive: true,
              trafficAllocation: 100,
              variants: [
                { id: 'control', name: 'Control', weight: 0, config: {} },
                { id: 'variant', name: 'Variant', weight: 0, config: {} }
              ]
            }
          ];

          const context: ABTestContext = {
            tenantId: 'error-test-tenant',
            userId: 'error-test-user',
            environment: 'development'
          };

          // When: 無効な設定で評価
          const results = await Promise.all(
            invalidConfigs.map(config =>
              abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, config)
            )
          );

          // Then: エラーなく安全にフォールバック
          results.forEach(result => {
            expect(result).toBeDefined();
            expect(result.variantId).toBe('control');
            expect(result.isControl).toBe(true);
          });
        });

        it('THEN handles missing user context gracefully', async () => {
          // Given: 不完全なユーザーコンテキスト
          const incompleteContexts: ABTestContext[] = [
            {
              tenantId: 'incomplete-tenant',
              userId: '', // 空のユーザーID
              environment: 'development'
            },
            {
              tenantId: 'incomplete-tenant',
              userId: undefined as any, // undefinedユーザーID
              environment: 'development'
            }
          ];

          const testConfig: ABTestConfig = {
            testId: 'resilience-test',
            name: 'Resilience Test',
            isActive: true,
            trafficAllocation: 100,
            variants: [
              { id: 'control', name: 'Control', weight: 50, config: {} },
              { id: 'variant', name: 'Variant', weight: 50, config: {} }
            ]
          };

          // When: 不完全なコンテキストで評価
          const results = await Promise.all(
            incompleteContexts.map(context =>
              abTestEngine.assignVariant(context, FEATURE_FLAGS.BILLING_V2, testConfig)
            )
          );

          // Then: エラーなく処理される
          results.forEach(result => {
            expect(result).toBeDefined();
            expect(['control', 'variant']).toContain(result.variantId);
          });
        });
      });
    });
  });
});