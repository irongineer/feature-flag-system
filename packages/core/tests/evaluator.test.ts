import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS, FeatureFlagContext } from '../src/models';

describe('FeatureFlagEvaluator', () => {
  let evaluator: FeatureFlagEvaluator;
  let cache: FeatureFlagCache;

  beforeEach(() => {
    cache = new FeatureFlagCache({ ttl: 300 });
    evaluator = new FeatureFlagEvaluator({ cache });
  });

  afterEach(() => {
    cache.invalidateAll();
  });

  describe('isEnabled', () => {
    const context: FeatureFlagContext = {
      tenantId: 'tenant-123',
      userId: 'user-456',
      environment: 'test',
      metadata: { region: 'us-east-1' }
    };

    it('should return false for disabled flag by default', async () => {
      const result = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(false);
    });

    it('should return true for tenant with override', async () => {
      const overrideContext: FeatureFlagContext = {
        tenantId: 'test-tenant-1',
        userId: 'user-456',
        environment: 'test'
      };
      
      const result = await evaluator.isEnabled(overrideContext, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(true);
    });

    it('should use cached value on subsequent calls', async () => {
      // First call - should cache the result
      const result1 = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      
      // Second call - should use cached value
      const result2 = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      
      expect(result1).toBe(result2);
      expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBe(result1);
    });

    it('should respect global kill switch', async () => {
      // Mock DynamoDB client with global kill switch enabled
      const mockDynamoClient = {
        getKillSwitch: vi.fn().mockResolvedValue({ enabled: true, reason: 'Emergency' }),
        getFlag: vi.fn(),
        getTenantOverride: vi.fn(),
        setKillSwitch: vi.fn(),
        get: vi.fn(),
        put: vi.fn()
      };

      const evaluatorWithKillSwitch = new FeatureFlagEvaluator({ 
        cache,
        dynamoDbClient: mockDynamoClient as any
      });

      const result = await evaluatorWithKillSwitch.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(false);
      expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith();
    });

    it('should respect flag-specific kill switch', async () => {
      const mockDynamoClient = {
        getKillSwitch: vi.fn()
          .mockResolvedValueOnce(null) // Global kill switch disabled
          .mockResolvedValueOnce({ enabled: true, reason: 'Flag-specific emergency' }), // Flag-specific enabled
        getFlag: vi.fn(),
        getTenantOverride: vi.fn(),
        setKillSwitch: vi.fn(),
        get: vi.fn(),
        put: vi.fn()
      };

      const evaluatorWithKillSwitch = new FeatureFlagEvaluator({ 
        cache,
        dynamoDbClient: mockDynamoClient as any
      });

      const result = await evaluatorWithKillSwitch.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(false);
      expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith();
      expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith(FEATURE_FLAGS.BILLING_V2);
    });

    it('should handle errors gracefully and return fallback value', async () => {
      const mockDynamoClient = {
        getKillSwitch: vi.fn().mockRejectedValue(new Error('DynamoDB error')),
        getFlag: vi.fn(),
        getTenantOverride: vi.fn(),
        setKillSwitch: vi.fn(),
        get: vi.fn(),
        put: vi.fn()
      };

      const evaluatorWithError = new FeatureFlagEvaluator({ 
        cache,
        dynamoDbClient: mockDynamoClient as any
      });

      const result = await evaluatorWithError.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(false); // Should return fallback value
    });

    it('should evaluate all predefined flags', async () => {
      const results = await Promise.all(
        Object.values(FEATURE_FLAGS).map(flagKey => 
          evaluator.isEnabled(context, flagKey)
        )
      );

      expect(results).toHaveLength(Object.keys(FEATURE_FLAGS).length);
      results.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('cache management', () => {
    const context: FeatureFlagContext = {
      tenantId: 'tenant-123',
      userId: 'user-456'
    };

    it('should invalidate specific cache entry', async () => {
      // Prime the cache
      await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeDefined();

      // Invalidate specific entry
      await evaluator.invalidateCache(context.tenantId, FEATURE_FLAGS.BILLING_V2);
      expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeUndefined();
    });

    it('should invalidate all cache entries', async () => {
      // Prime the cache with multiple entries
      await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      await evaluator.isEnabled(context, FEATURE_FLAGS.NEW_DASHBOARD);
      
      expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeDefined();
      expect(cache.get(context.tenantId, FEATURE_FLAGS.NEW_DASHBOARD)).toBeDefined();

      // Invalidate all entries
      await evaluator.invalidateAllCache();
      expect(cache.get(context.tenantId, FEATURE_FLAGS.BILLING_V2)).toBeUndefined();
      expect(cache.get(context.tenantId, FEATURE_FLAGS.NEW_DASHBOARD)).toBeUndefined();
    });
  });

  describe('context validation', () => {
    it('should handle minimal context', async () => {
      const minimalContext: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      const result = await evaluator.isEnabled(minimalContext, FEATURE_FLAGS.BILLING_V2);
      expect(typeof result).toBe('boolean');
    });

    it('should handle context with all fields', async () => {
      const fullContext: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        environment: 'production',
        metadata: {
          region: 'us-east-1',
          userTier: 'premium',
          experiments: ['exp-1', 'exp-2']
        }
      };

      const result = await evaluator.isEnabled(fullContext, FEATURE_FLAGS.BILLING_V2);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('integration with mock DynamoDB', () => {
    it('should work with default mock implementation', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      const result = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      expect(typeof result).toBe('boolean');
    });

    it('should handle tenant overrides from mock data', async () => {
      const contextWithOverride: FeatureFlagContext = {
        tenantId: 'test-tenant-1' // This tenant has override in mock data
      };

      const result = await evaluator.isEnabled(contextWithOverride, FEATURE_FLAGS.BILLING_V2);
      expect(result).toBe(true);
    });
  });
});