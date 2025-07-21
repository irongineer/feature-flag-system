import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS } from '../src/models';
import type { StructuredError } from '../src/types/error-handling';

describe('FeatureFlagEvaluator Complete Coverage Tests', () => {
  let evaluator: FeatureFlagEvaluator;
  let mockDynamoClient: any;
  let mockCache: FeatureFlagCache;
  let errorCapture: StructuredError[];

  beforeEach(() => {
    // エラーキャプチャのセットアップ
    errorCapture = [];
    const errorHandler = (error: StructuredError) => {
      errorCapture.push(error);
    };

    // Mock DynamoDB client
    mockDynamoClient = {
      getFlag: vi.fn(),
      getTenantOverride: vi.fn(),
      getKillSwitch: vi.fn(),
      setKillSwitch: vi.fn(),
    };

    // Real cache for integration testing
    mockCache = new FeatureFlagCache();

    evaluator = new FeatureFlagEvaluator({
      dynamoDbClient: mockDynamoClient,
      cache: mockCache,
      errorHandler,
    });
  });

  describe('Kill-Switch Priority Tests', () => {
    describe('GIVEN global kill-switch is active', () => {
      beforeEach(() => {
        mockDynamoClient.getKillSwitch.mockResolvedValueOnce({
          enabled: true,
          reason: 'emergency-maintenance',
          activatedBy: 'ops-team',
        });
      });

      it('WHEN evaluating any flag THEN returns false immediately', async () => {
        const result = await evaluator.isEnabled('test-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false);
        expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith(); // グローバルチェック
        expect(mockDynamoClient.getTenantOverride).not.toHaveBeenCalled();
        expect(mockDynamoClient.getFlag).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN flag-specific kill-switch is active', () => {
      beforeEach(() => {
        // グローバルkill-switchは無効
        mockDynamoClient.getKillSwitch.mockResolvedValueOnce(null);
        // 特定フラグのkill-switchは有効
        mockDynamoClient.getKillSwitch.mockResolvedValueOnce({
          enabled: true,
          reason: 'critical-bug-detected',
          activatedBy: 'security-team',
        });
      });

      it('WHEN evaluating that specific flag THEN returns false', async () => {
        const result = await evaluator.isEnabled('test-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false);
        expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledTimes(2);
        expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith(); // グローバル
        expect(mockDynamoClient.getKillSwitch).toHaveBeenCalledWith(FEATURE_FLAGS.BILLING_V2); // 特定フラグ
      });
    });

    describe('GIVEN kill-switch check fails', () => {
      beforeEach(() => {
        mockDynamoClient.getKillSwitch.mockRejectedValue(new Error('DynamoDB connection failed'));
      });

      it('WHEN evaluating flag THEN continues with evaluation (fail-safe)', async () => {
        mockDynamoClient.getTenantOverride.mockResolvedValueOnce(null);
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          defaultEnabled: true,
        });

        const result = await evaluator.isEnabled('test-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true); // kill-switchエラーを無視して続行
        expect(mockDynamoClient.getTenantOverride).toHaveBeenCalled();
        expect(mockDynamoClient.getFlag).toHaveBeenCalled();
      });
    });
  });

  describe('Cache Behavior Tests', () => {
    describe('GIVEN cache contains flag value', () => {
      beforeEach(() => {
        mockCache.set('cached-tenant', FEATURE_FLAGS.BILLING_V2, true);
        mockDynamoClient.getKillSwitch.mockResolvedValue(null); // kill-switch無効
      });

      it('WHEN evaluating cached flag THEN returns cached value without DB access', async () => {
        const result = await evaluator.isEnabled('cached-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true);
        expect(mockDynamoClient.getTenantOverride).not.toHaveBeenCalled();
        expect(mockDynamoClient.getFlag).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN cache miss', () => {
      beforeEach(() => {
        mockDynamoClient.getKillSwitch.mockResolvedValue(null);
      });

      it('WHEN evaluating uncached flag THEN stores result in cache', async () => {
        mockDynamoClient.getTenantOverride.mockResolvedValueOnce(null);
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          defaultEnabled: true,
        });

        const result = await evaluator.isEnabled('uncached-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true);
        
        // 2回目の評価でキャッシュが使用されることを確認
        const cachedResult = await evaluator.isEnabled('uncached-tenant', FEATURE_FLAGS.BILLING_V2);
        expect(cachedResult).toBe(true);
        expect(mockDynamoClient.getFlag).toHaveBeenCalledTimes(1); // 1回のみ
      });
    });
  });

  describe('Tenant Override Priority Tests', () => {
    beforeEach(() => {
      mockDynamoClient.getKillSwitch.mockResolvedValue(null); // kill-switch無効
    });

    describe('GIVEN tenant has override enabled', () => {
      beforeEach(() => {
        mockDynamoClient.getTenantOverride.mockResolvedValueOnce({
          enabled: true,
          updatedBy: 'tenant-admin',
          updatedAt: new Date().toISOString(),
        });
      });

      it('WHEN evaluating flag THEN returns override value', async () => {
        // デフォルト値はfalseだが、オーバーライドでtrue
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          defaultEnabled: false,
        });

        const result = await evaluator.isEnabled('override-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true); // オーバーライド値
        expect(mockDynamoClient.getFlag).not.toHaveBeenCalled(); // デフォルト値は取得しない
      });
    });

    describe('GIVEN tenant has override disabled', () => {
      beforeEach(() => {
        mockDynamoClient.getTenantOverride.mockResolvedValueOnce({
          enabled: false,
          updatedBy: 'tenant-admin',
          updatedAt: new Date().toISOString(),
        });
      });

      it('WHEN evaluating flag THEN returns override value (false)', async () => {
        const result = await evaluator.isEnabled('override-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false); // オーバーライド値
        expect(mockDynamoClient.getFlag).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN tenant has no override', () => {
      beforeEach(() => {
        mockDynamoClient.getTenantOverride.mockResolvedValueOnce(null);
      });

      it('WHEN evaluating flag THEN falls back to default value', async () => {
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          defaultEnabled: true,
        });

        const result = await evaluator.isEnabled('no-override-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true); // デフォルト値
        expect(mockDynamoClient.getFlag).toHaveBeenCalledWith(FEATURE_FLAGS.BILLING_V2);
      });
    });
  });

  describe('Default Value Fallback Tests', () => {
    beforeEach(() => {
      mockDynamoClient.getKillSwitch.mockResolvedValue(null);
      mockDynamoClient.getTenantOverride.mockResolvedValue(null);
    });

    describe('GIVEN flag exists with default enabled', () => {
      beforeEach(() => {
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          flagKey: FEATURE_FLAGS.BILLING_V2,
          defaultEnabled: true,
          description: 'Billing V2 feature',
        });
      });

      it('WHEN evaluating flag THEN returns default enabled value', async () => {
        const result = await evaluator.isEnabled('default-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true);
      });
    });

    describe('GIVEN flag exists with default disabled', () => {
      beforeEach(() => {
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          flagKey: FEATURE_FLAGS.BILLING_V2,
          defaultEnabled: false,
          description: 'Billing V2 feature',
        });
      });

      it('WHEN evaluating flag THEN returns default disabled value', async () => {
        const result = await evaluator.isEnabled('default-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false);
      });
    });

    describe('GIVEN flag does not exist', () => {
      beforeEach(() => {
        mockDynamoClient.getFlag.mockResolvedValueOnce(null);
      });

      it('WHEN evaluating flag THEN returns safe fallback (false)', async () => {
        const result = await evaluator.isEnabled('default-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false); // 安全側のフォールバック
      });
    });
  });

  describe('Error Handling and Structured Logging Tests', () => {
    beforeEach(() => {
      mockDynamoClient.getKillSwitch.mockResolvedValue(null);
    });

    describe('GIVEN tenant override check fails', () => {
      beforeEach(() => {
        mockDynamoClient.getTenantOverride.mockRejectedValue(new Error('Network timeout'));
        mockDynamoClient.getFlag.mockResolvedValueOnce({
          defaultEnabled: true,
        });
      });

      it('WHEN evaluating flag THEN logs structured error and continues', async () => {
        const result = await evaluator.isEnabled('error-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(true); // デフォルト値で続行
        expect(errorCapture).toHaveLength(1);
        expect(errorCapture[0]).toMatchObject({
          operation: 'tenant-override-check',
          tenantId: 'error-tenant',
          flagKey: FEATURE_FLAGS.BILLING_V2,
          error: expect.objectContaining({ message: 'Network timeout' }),
          timestamp: expect.any(String),
        });
      });
    });

    describe('GIVEN default value check fails', () => {
      beforeEach(() => {
        mockDynamoClient.getTenantOverride.mockResolvedValue(null);
        mockDynamoClient.getFlag.mockRejectedValue(new Error('Table not found'));
      });

      it('WHEN evaluating flag THEN logs structured error and returns fallback', async () => {
        const result = await evaluator.isEnabled('error-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false); // フェイルセーフフォールバック
        expect(errorCapture).toHaveLength(1);
        expect(errorCapture[0]).toMatchObject({
          operation: 'default-value-check',
          flagKey: FEATURE_FLAGS.BILLING_V2,
          error: expect.objectContaining({ message: 'Table not found' }),
          timestamp: expect.any(String),
        });
      });
    });

    describe('GIVEN complete evaluation failure', () => {
      beforeEach(() => {
        mockDynamoClient.getKillSwitch.mockRejectedValue(new Error('Complete failure'));
      });

      it('WHEN evaluating flag THEN logs kill-switch error and returns fallback', async () => {
        const result = await evaluator.isEnabled('complete-error-tenant', FEATURE_FLAGS.BILLING_V2);
        
        expect(result).toBe(false); // 完全なフェイルセーフ
        expect(errorCapture).toHaveLength(1);
        expect(errorCapture[0]).toMatchObject({
          operation: 'kill-switch-check',
          flagKey: FEATURE_FLAGS.BILLING_V2,
          error: expect.objectContaining({ message: 'Complete failure' }),
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe('Cache Management Tests', () => {
    beforeEach(() => {
      mockDynamoClient.getKillSwitch.mockResolvedValue(null);
      mockDynamoClient.getTenantOverride.mockResolvedValue(null);
      mockDynamoClient.getFlag.mockResolvedValue({
        defaultEnabled: true,
      });
    });

    describe('GIVEN cached flag values exist', () => {
      beforeEach(async () => {
        // キャッシュを事前に設定
        await evaluator.isEnabled('cache-tenant', FEATURE_FLAGS.BILLING_V2);
      });

      it('WHEN invalidating specific flag THEN removes only that cache entry', async () => {
        await evaluator.invalidateCache('cache-tenant', FEATURE_FLAGS.BILLING_V2);
        
        // 次回評価でDBアクセスが発生することを確認
        const result = await evaluator.isEnabled('cache-tenant', FEATURE_FLAGS.BILLING_V2);
        expect(result).toBe(true);
        expect(mockDynamoClient.getFlag).toHaveBeenCalledTimes(2); // 初回 + invalidate後
      });

      it('WHEN invalidating all cache THEN removes all cache entries', async () => {
        await evaluator.invalidateAllCache();
        
        const result = await evaluator.isEnabled('cache-tenant', FEATURE_FLAGS.BILLING_V2);
        expect(result).toBe(true);
        expect(mockDynamoClient.getFlag).toHaveBeenCalledTimes(2); // 初回 + invalidateAll後
      });
    });
  });

  describe('Context vs TenantId Parameter Overload Tests', () => {
    beforeEach(() => {
      mockDynamoClient.getKillSwitch.mockResolvedValue(null);
      mockDynamoClient.getTenantOverride.mockResolvedValue(null);
      mockDynamoClient.getFlag.mockResolvedValue({
        defaultEnabled: true,
      });
    });

    it('GIVEN FeatureFlagContext parameter WHEN evaluating THEN extracts tenantId correctly', async () => {
      const context = {
        tenantId: 'context-tenant',
        userId: 'user123',
        userRole: 'admin',
      };

      const result = await evaluator.isEnabled(context, FEATURE_FLAGS.BILLING_V2);
      
      expect(result).toBe(true);
      expect(mockDynamoClient.getTenantOverride).toHaveBeenCalledWith(
        'context-tenant',
        FEATURE_FLAGS.BILLING_V2
      );
    });

    it('GIVEN direct tenantId string WHEN evaluating THEN uses tenantId directly', async () => {
      const result = await evaluator.isEnabled('direct-tenant', FEATURE_FLAGS.BILLING_V2);
      
      expect(result).toBe(true);
      expect(mockDynamoClient.getTenantOverride).toHaveBeenCalledWith(
        'direct-tenant',
        FEATURE_FLAGS.BILLING_V2
      );
    });
  });
});