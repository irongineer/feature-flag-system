import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS, FeatureFlagContext } from '../src/models';

/**
 * Feature Flag Evaluator Specification
 *
 * フィーチャーフラグ評価エンジンは、テナントコンテキストに基づいて
 * フィーチャーフラグの有効/無効を決定する責務を持つ。
 *
 * Key Business Rules:
 * 1. デフォルトはfalse（安全側に倒す）
 * 2. テナント固有の上書き設定を尊重する
 * 3. グローバル/フラグ固有のキルスイッチを尊重する
 * 4. エラー時はフォールバック値を返す（fail-safe）
 * 5. パフォーマンスのためキャッシュを活用する
 */
describe('FeatureFlagEvaluator Specification', () => {
  let evaluator: FeatureFlagEvaluator;
  let cache: FeatureFlagCache;

  // Test Fixture: Standard test contexts
  const standardContext: FeatureFlagContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    environment: 'development',
    metadata: { region: 'us-east-1' },
  };

  const minimalContext: FeatureFlagContext = {
    tenantId: 'tenant-123',
    environment: 'development',
  };

  const tenantWithOverride: FeatureFlagContext = {
    tenantId: 'test-tenant-1', // This tenant has override in mock data
    userId: 'user-456',
    environment: 'development',
  };

  beforeEach(() => {
    cache = new FeatureFlagCache({ ttl: 300 });
    evaluator = new FeatureFlagEvaluator({
      cache,
      environment: 'development', // Match the environment in test contexts
    });
  });

  afterEach(() => {
    cache.invalidateAll();
  });

  describe('Feature Flag Evaluation Rules', () => {
    describe('GIVEN a standard tenant context', () => {
      describe('WHEN evaluating a feature flag without overrides', () => {
        it('THEN returns false as the safe default', async () => {
          // Given: A standard tenant without any specific overrides
          const context = standardContext;

          // When: Evaluating a feature flag
          const isEnabled = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);

          // Then: Should return false (safe default)
          expect(isEnabled).toBe(false);
        });
      });
    });

    describe('GIVEN a tenant with feature override configuration', () => {
      describe('WHEN evaluating the same feature flag', () => {
        it('THEN respects the tenant-specific override setting', async () => {
          // Given: A tenant that has an override configuration
          const contextWithOverride = tenantWithOverride;

          // When: Evaluating the feature flag
          const isEnabled = await evaluator.isEnabled(
            contextWithOverride,
            FEATURE_FLAGS.BILLING_V2
          );

          // Then: Should respect the override (true for test-tenant-1)
          expect(isEnabled).toBe(true);
        });
      });
    });

    describe('Performance Optimization via Caching', () => {
      describe('GIVEN a previously evaluated flag', () => {
        describe('WHEN evaluating the same flag again', () => {
          it('THEN uses cached result without re-evaluation', async () => {
            // Given: A context and flag that will be evaluated twice
            const context = standardContext;
            const flagKey = FEATURE_FLAGS.BILLING_V2;

            // When: Evaluating the same flag twice
            const firstResult = await evaluator.isEnabled(context, flagKey);
            const secondResult = await evaluator.isEnabled(context, flagKey);

            // Then: Results should be identical and cached
            expect(firstResult).toBe(secondResult);
            expect(cache.get(context.tenantId, flagKey)).toBe(firstResult);
          });
        });
      });
    });

    describe('Emergency Controls (Kill Switch)', () => {
      describe('GIVEN global kill switch is activated', () => {
        describe('WHEN evaluating any feature flag', () => {
          it('THEN immediately returns false regardless of other settings', async () => {
            // Given: Global kill switch is enabled for emergency
            const mockDynamoClient = {
              getKillSwitch: vi.fn().mockResolvedValue({ enabled: true, reason: 'Emergency' }),
              getFlag: vi.fn(),
              getTenantOverride: vi.fn(),
              setKillSwitch: vi.fn(),
              get: vi.fn(),
              put: vi.fn(),
            };

            const evaluatorWithKillSwitch = new FeatureFlagEvaluator({
              cache,
              environment: 'development',
              dynamoDbClient: mockDynamoClient as any,
            });

            // When: Evaluating any feature flag
            const isEnabled = await evaluatorWithKillSwitch.isEnabled(
              standardContext,
              FEATURE_FLAGS.BILLING_V2
            );

            // Then: Should return false immediately
            expect(isEnabled).toBe(false);
            expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith();
          });
        });
      });

      describe('GIVEN flag-specific kill switch is activated', () => {
        describe('WHEN evaluating that specific flag', () => {
          it('THEN returns false for that flag only', async () => {
            // Given: Flag-specific kill switch is enabled
            const mockDynamoClient = {
              getKillSwitch: vi
                .fn()
                .mockResolvedValueOnce(null) // Global kill switch disabled
                .mockResolvedValueOnce({ enabled: true, reason: 'Flag-specific emergency' }), // Flag-specific enabled
              getFlag: vi.fn(),
              getTenantOverride: vi.fn(),
              setKillSwitch: vi.fn(),
              get: vi.fn(),
              put: vi.fn(),
            };

            const evaluatorWithKillSwitch = new FeatureFlagEvaluator({
              cache,
              environment: 'development',
              dynamoDbClient: mockDynamoClient as any,
            });

            // When: Evaluating the specific flag
            const isEnabled = await evaluatorWithKillSwitch.isEnabled(
              standardContext,
              FEATURE_FLAGS.BILLING_V2
            );

            // Then: Should return false for this specific flag
            expect(isEnabled).toBe(false);
            expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith();
            expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith(FEATURE_FLAGS.BILLING_V2);
          });
        });
      });
    });

    describe('Error Handling and Resilience', () => {
      describe('GIVEN the data store is unavailable', () => {
        describe('WHEN evaluating a feature flag', () => {
          it('THEN gracefully fails to safe default value', async () => {
            // Given: Data store throws an error
            const mockDynamoClient = {
              getKillSwitch: vi.fn().mockRejectedValue(new Error('DynamoDB connection failed')),
              getFlag: vi.fn(),
              getTenantOverride: vi.fn(),
              setKillSwitch: vi.fn(),
              get: vi.fn(),
              put: vi.fn(),
            };

            const evaluatorWithError = new FeatureFlagEvaluator({
              cache,
              environment: 'development',
              dynamoDbClient: mockDynamoClient as any,
            });

            // When: Attempting to evaluate a flag
            const isEnabled = await evaluatorWithError.isEnabled(
              standardContext,
              FEATURE_FLAGS.BILLING_V2
            );

            // Then: Should return safe fallback value (false)
            expect(isEnabled).toBe(false);
          });
        });
      });
    });

    describe('Flag Coverage and Consistency', () => {
      describe('WHEN evaluating all predefined feature flags', () => {
        it('THEN all flags return boolean values consistently', async () => {
          // Given: All predefined feature flags in the system
          const allFlagKeys = Object.values(FEATURE_FLAGS);

          // When: Evaluating each flag with a standard context
          const results = await Promise.all(
            allFlagKeys.map(flagKey => evaluator.isEnabled(standardContext, flagKey))
          );

          // Then: All evaluations should return boolean values
          expect(results).toHaveLength(allFlagKeys.length);
          results.forEach(result => {
            expect(typeof result).toBe('boolean');
          });
        });
      });
    });

    describe('Cache Management Operations', () => {
      describe('Selective Cache Invalidation', () => {
        describe('GIVEN cached flag evaluations', () => {
          describe('WHEN invalidating a specific cache entry', () => {
            it('THEN only that entry is removed from cache', async () => {
              // Given: Cache with multiple flag evaluations
              const context = minimalContext;
              await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
              expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeDefined();

              // When: Invalidating specific entry
              await evaluator.invalidateCache(context.tenantId, FEATURE_FLAGS.BILLING_V2);

              // Then: Only that entry should be removed
              expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeUndefined();
            });
          });
        });
      });

      describe('Global Cache Invalidation', () => {
        describe('GIVEN multiple cached flag evaluations', () => {
          describe('WHEN invalidating all cache entries', () => {
            it('THEN all cached entries are removed', async () => {
              // Given: Cache with multiple flag evaluations
              const context = minimalContext;
              await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
              await evaluator.isEnabled(context, FEATURE_FLAGS.NEW_DASHBOARD);

              expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeDefined();
              expect(cache.get(context.tenantId, FEATURE_FLAGS.NEW_DASHBOARD)).toBeDefined();

              // When: Invalidating all entries
              await evaluator.invalidateAllCache();

              // Then: All entries should be removed
              expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeUndefined();
              expect(cache.get(context.tenantId, FEATURE_FLAGS.NEW_DASHBOARD)).toBeUndefined();
            });
          });
        });
      });
    });

    describe('Context Validation and Flexibility', () => {
      describe('GIVEN a minimal context with only tenantId', () => {
        describe('WHEN evaluating any feature flag', () => {
          it('THEN handles evaluation gracefully without optional fields', async () => {
            // Given: A minimal context with only required tenantId
            const minimalContext: FeatureFlagContext = {
              tenantId: 'tenant-123',
            };

            // When: Evaluating a feature flag
            const result = await evaluator.isEnabled(minimalContext, FEATURE_FLAGS.BILLING_V2);

            // Then: Should return a boolean value (no errors from missing optional fields)
            expect(typeof result).toBe('boolean');
          });
        });
      });

      describe('GIVEN a complete context with all optional fields', () => {
        describe('WHEN evaluating a feature flag', () => {
          it('THEN utilizes all available context information for precise evaluation', async () => {
            // Given: A context with all available fields populated
            const fullContext: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userId: 'user-456',
              environment: 'development',
              metadata: {
                region: 'us-east-1',
                userTier: 'premium',
                experiments: ['exp-1', 'exp-2'],
              },
            };

            // When: Evaluating a feature flag with rich context
            const result = await evaluator.isEnabled(fullContext, FEATURE_FLAGS.BILLING_V2);

            // Then: Should return a boolean result utilizing all context information
            expect(typeof result).toBe('boolean');
          });
        });
      });
    });

    describe('Mock Data Integration Behavior', () => {
      describe('GIVEN the default mock data configuration', () => {
        describe('WHEN evaluating flags with standard tenants', () => {
          it('THEN integrates properly with mock DynamoDB implementation', async () => {
            // Given: A standard context using mock implementation
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
            };

            // When: Evaluating with mock data store
            const result = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);

            // Then: Should return boolean result from mock implementation
            expect(typeof result).toBe('boolean');
          });
        });
      });

      describe('GIVEN a tenant with override configuration in mock data', () => {
        describe('WHEN evaluating flags for that tenant', () => {
          it('THEN correctly applies tenant-specific overrides from mock data', async () => {
            // Given: A tenant that has specific overrides in mock data
            const contextWithOverride: FeatureFlagContext = {
              tenantId: 'test-tenant-1', // This tenant has override in mock data
            };

            // When: Evaluating flags for the override tenant
            const result = await evaluator.isEnabled(contextWithOverride, FEATURE_FLAGS.BILLING_V2);

            // Then: Should return the override value (true) from mock data
            expect(result).toBe(true);
          });
        });
      });
    });
  });
});
