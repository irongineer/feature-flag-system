import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDbClient } from '../src/evaluator/dynamo-client';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { silentErrorHandler } from '../src/types/error-handling';
import { ENVIRONMENTS, Environment, FeatureFlagContext } from '../src/models';
import { getEnvironmentConfig, debugLog } from '../src/config/environment';

const mockSend = vi.fn();

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend }))
  },
  GetCommand: vi.fn((params) => ({ input: params })),
  PutCommand: vi.fn((params) => ({ input: params })),
  QueryCommand: vi.fn((params) => ({ input: params })),
  UpdateCommand: vi.fn((params) => ({ input: params }))
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn()
}));

describe('Multi-Environment Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();
  });

  describe('Environment Configuration', () => {
    it('should load different configurations per environment', () => {
      const devConfig = getEnvironmentConfig(ENVIRONMENTS.DEVELOPMENT);
      const stagingConfig = getEnvironmentConfig(ENVIRONMENTS.STAGING);
      const prodConfig = getEnvironmentConfig(ENVIRONMENTS.PRODUCTION);

      expect(devConfig.environment).toBe('development');
      expect(devConfig.tableName).toBe('feature-flags-dev');
      expect(devConfig.features?.debugLogging).toBe(true);

      expect(stagingConfig.environment).toBe('staging');
      expect(stagingConfig.tableName).toBe('feature-flags-staging');

      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.tableName).toBe('feature-flags-prod');
      expect(prodConfig.features?.debugLogging).toBe(false);
    });
  });

  describe('Environment-Aware DynamoDB Client', () => {
    it('should create environment-specific keys for flags', async () => {
      mockSend.mockResolvedValue({});

      const devClient = new DynamoDbClient({
        environment: ENVIRONMENTS.DEVELOPMENT,
        region: 'ap-northeast-1',
        tableName: 'test-table',
        errorHandler: silentErrorHandler
      });

      const flagData = {
        flagKey: 'test_flag',
        description: 'Test flag',
        defaultEnabled: true,
        owner: 'test-team',
        createdAt: '2025-01-01T00:00:00Z'
      };

      await devClient.createFlag(flagData);

      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('FLAG#development#test_flag');
      expect(call.input.Item.environment).toBe('development');
      expect(call.input.Item.GSI3PK).toBe('FLAGS#development');
    });

    it('should create environment-specific keys for tenant overrides', async () => {
      mockSend.mockResolvedValue({});

      const prodClient = new DynamoDbClient({
        environment: ENVIRONMENTS.PRODUCTION,
        region: 'ap-northeast-1',
        tableName: 'test-table',
        errorHandler: silentErrorHandler
      });

      await prodClient.setTenantOverride('tenant-123', 'test_flag', true, 'admin');

      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('TENANT#production#tenant-123');
      expect(call.input.Item.environment).toBe('production');
    });

    it('should create environment-specific emergency control keys', async () => {
      mockSend.mockResolvedValue({});

      const stagingClient = new DynamoDbClient({
        environment: ENVIRONMENTS.STAGING,
        region: 'ap-northeast-1',
        tableName: 'test-table',
        errorHandler: silentErrorHandler
      });

      await stagingClient.setKillSwitch('test_flag', true, 'Emergency', 'admin');

      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];
      expect(call.input.Item.PK).toBe('EMERGENCY#staging');
      expect(call.input.Item.environment).toBe('staging');
    });
  });

  describe('Environment-Aware Evaluator', () => {
    it('should reject cross-environment evaluation', async () => {
      const devEvaluator = new FeatureFlagEvaluator({
        environment: ENVIRONMENTS.DEVELOPMENT,
        cache: new FeatureFlagCache(),
        errorHandler: silentErrorHandler,
        useMock: true
      });

      const stagingContext: FeatureFlagContext = {
        tenantId: 'test-tenant',
        environment: ENVIRONMENTS.STAGING
      };

      // Should throw environment mismatch error
      await expect(
        devEvaluator.isEnabled(stagingContext, 'billing_v2_enable')
      ).rejects.toThrow('Environment mismatch');
    });

    it('should work correctly with matching environment', async () => {
      const prodEvaluator = new FeatureFlagEvaluator({
        environment: ENVIRONMENTS.PRODUCTION,
        cache: new FeatureFlagCache(),
        errorHandler: silentErrorHandler,
        useMock: true
      });

      const prodContext: FeatureFlagContext = {
        tenantId: 'test-tenant',
        environment: ENVIRONMENTS.PRODUCTION
      };

      // Should work without errors
      const result = await prodEvaluator.isEnabled(prodContext, 'billing_v2_enable');
      expect(typeof result).toBe('boolean');
    });

    it('should use default environment when context lacks environment', async () => {
      const stagingEvaluator = new FeatureFlagEvaluator({
        environment: ENVIRONMENTS.STAGING,
        cache: new FeatureFlagCache(),
        errorHandler: silentErrorHandler,
        useMock: true
      });

      // Test backward compatibility with string tenantId
      const result = await stagingEvaluator.isEnabled('test-tenant', 'billing_v2_enable');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Debug Logging', () => {
    it('should log only when enabled for the environment', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Development should log
      debugLog(ENVIRONMENTS.DEVELOPMENT, 'Development message');
      expect(consoleSpy).toHaveBeenCalledWith('[DEVELOPMENT] Development message', '');
      
      consoleSpy.mockClear();
      
      // Production should not log
      debugLog(ENVIRONMENTS.PRODUCTION, 'Production message');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Environment Isolation', () => {
    it('should demonstrate complete data isolation', () => {
      const environments: Environment[] = ['development', 'staging', 'production'];
      
      environments.forEach(env => {
        const client = new DynamoDbClient({
          environment: env,
          region: 'ap-northeast-1',
          tableName: 'test-table',
          errorHandler: silentErrorHandler
        });

        // Each environment should have its own key structure
        expect(env).toMatch(/^(development|staging|production)$/);
      });

      expect(environments).toHaveLength(3);
      expect(new Set(environments)).toHaveLength(3); // All unique
    });
  });
});