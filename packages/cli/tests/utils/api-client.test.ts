import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ApiClient, getApiClient, ApiClientConfig } from '../../src/utils/api-client';
import { DynamoDbClient } from '@feature-flag/core';

// TDD Phase 2: GREEN - Tests should pass with dependency injection
describe('ApiClient TDD Tests', () => {
  let mockDynamoClient: Partial<DynamoDbClient>;
  let testConfig: ApiClientConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock DynamoDB client
    mockDynamoClient = {
      createFlag: vi.fn(),
      listFlags: vi.fn(),
      updateFlag: vi.fn(),
      listTenantOverrides: vi.fn(),
      setTenantOverride: vi.fn(),
      setKillSwitch: vi.fn(),
      getFlag: vi.fn(),
      getTenantOverride: vi.fn(),
      getKillSwitch: vi.fn(),
    };

    // Test configuration
    testConfig = {
      region: 'ap-northeast-1',
      tableName: 'test-table',
      endpoint: 'http://localhost:8000',
      environment: 'development',
    };
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with correct DynamoDB configuration using dependency injection', () => {
      // TDD GREEN: Now works with dependency injection
      const apiClient = new ApiClient(testConfig, mockDynamoClient as DynamoDbClient);
      
      expect(apiClient).toBeInstanceOf(ApiClient);
    });

    it('should use development environment as fallback when not specified', () => {
      const configWithoutEnv = {
        region: 'ap-northeast-1',
        tableName: 'test-table',
        endpoint: 'http://localhost:8000',
        // environment is missing - should fallback to 'development'
      };

      const apiClient = new ApiClient(configWithoutEnv, mockDynamoClient as DynamoDbClient);
      expect(apiClient).toBeDefined();
    });

    it('should initialize without config override (uses getConfig)', () => {
      // This tests the original constructor path without dependency injection
      const apiClient = new ApiClient();
      expect(apiClient).toBeDefined();
    });
  });

  describe('Flag Management Operations', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient(testConfig, mockDynamoClient as DynamoDbClient);
    });

    describe('createFlag', () => {
      it('should create a new feature flag successfully', async () => {
        // RED: This will fail initially
        const flagData = {
          flagKey: 'test_flag',
          description: 'Test flag',
          defaultEnabled: true,
          owner: 'test-user'
        };

        mockDynamoClient.createFlag = vi.fn().mockResolvedValue({ success: true, flagKey: 'test_flag' });

        const result = await apiClient.createFlag(flagData);

        expect(mockDynamoClient.createFlag).toHaveBeenCalledWith(flagData);
        expect(result).toEqual({ success: true, flagKey: 'test_flag' });
      });

      it('should handle createFlag errors gracefully', async () => {
        const flagData = { flagKey: 'test_flag', description: 'Test flag' };
        const error = new Error('DynamoDB error');

        mockDynamoClient.createFlag = vi.fn().mockRejectedValue(error);

        await expect(apiClient.createFlag(flagData)).rejects.toThrow('DynamoDB error');
      });
    });

    describe('listFlags', () => {
      it('should return list of feature flags', async () => {
        const mockFlags = [
          { flagKey: 'flag1', defaultEnabled: true },
          { flagKey: 'flag2', defaultEnabled: false }
        ];

        mockDynamoClient.listFlags = vi.fn().mockResolvedValue(mockFlags);

        const result = await apiClient.listFlags();

        expect(mockDynamoClient.listFlags).toHaveBeenCalled();
        expect(result).toEqual(mockFlags);
      });
    });

    describe('updateFlag', () => {
      it('should update feature flag with provided data', async () => {
        const flagKey = 'test_flag';
        const updates = { defaultEnabled: false, description: 'Updated description' };
        const mockResult = { success: true, updated: flagKey };

        mockDynamoClient.updateFlag = vi.fn().mockResolvedValue(mockResult);

        const result = await apiClient.updateFlag(flagKey, updates);

        expect(mockDynamoClient.updateFlag).toHaveBeenCalledWith(flagKey, updates);
        expect(result).toEqual(mockResult);
      });
    });
  });

  describe('Tenant Override Operations', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient(testConfig, mockDynamoClient as DynamoDbClient);
    });

    describe('listTenantOverrides', () => {
      it('should return tenant overrides for given tenant ID', async () => {
        const tenantId = 'tenant-123';
        const mockOverrides = [
          { flagKey: 'flag1', enabled: true },
          { flagKey: 'flag2', enabled: false }
        ];

        mockDynamoClient.listTenantOverrides = vi.fn().mockResolvedValue(mockOverrides);

        const result = await apiClient.listTenantOverrides(tenantId);

        expect(mockDynamoClient.listTenantOverrides).toHaveBeenCalledWith(tenantId);
        expect(result).toEqual(mockOverrides);
      });
    });

    describe('setTenantOverride', () => {
      it('should set tenant override successfully', async () => {
        const tenantId = 'tenant-123';
        const flagKey = 'test_flag';
        const enabled = true;
        const updatedBy = 'admin@example.com';
        const mockResult = { success: true };

        mockDynamoClient.setTenantOverride = vi.fn().mockResolvedValue(mockResult);

        const result = await apiClient.setTenantOverride(tenantId, flagKey, enabled, updatedBy);

        expect(mockDynamoClient.setTenantOverride).toHaveBeenCalledWith(tenantId, flagKey, enabled, updatedBy);
        expect(result).toEqual(mockResult);
      });
    });
  });

  describe('Kill-Switch Operations', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient(testConfig, mockDynamoClient as DynamoDbClient);
    });

    describe('activateKillSwitch', () => {
      it('should activate kill-switch for specific flag', async () => {
        const flagKey = 'test_flag';
        const reason = 'Security incident';
        const activatedBy = 'admin@example.com';
        const mockResult = { success: true };

        mockDynamoClient.setKillSwitch = vi.fn().mockResolvedValue(mockResult);

        const result = await apiClient.activateKillSwitch(flagKey, reason, activatedBy);

        expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(flagKey, true, reason, activatedBy);
        expect(result).toEqual(mockResult);
      });

      it('should activate global kill-switch when flagKey is null', async () => {
        const flagKey = null;
        const reason = 'System maintenance';
        const activatedBy = 'admin@example.com';

        await apiClient.activateKillSwitch(flagKey, reason, activatedBy);

        expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(null, true, reason, activatedBy);
      });
    });

    describe('deactivateKillSwitch', () => {
      it('should deactivate kill-switch', async () => {
        const flagKey = 'test_flag';
        const deactivatedBy = 'admin@example.com';

        await apiClient.deactivateKillSwitch(flagKey, deactivatedBy);

        expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(
          flagKey,
          false,
          `Deactivated by ${deactivatedBy}`,
          deactivatedBy
        );
      });
    });
  });

  describe('Flag Evaluation Logic', () => {
    let apiClient: ApiClient;

    beforeEach(() => {
      apiClient = new ApiClient(testConfig, mockDynamoClient as DynamoDbClient);
    });

    describe('evaluateFlag', () => {
      it('should return false when kill-switch is active', async () => {
        const tenantId = 'tenant-123';
        const flagKey = 'test_flag';

        mockDynamoClient.getFlag = vi.fn().mockResolvedValue({ defaultEnabled: true });
        mockDynamoClient.getTenantOverride = vi.fn().mockResolvedValue(null);
        mockDynamoClient.getKillSwitch = vi.fn().mockResolvedValue({ enabled: true });

        const result = await apiClient.evaluateFlag(tenantId, flagKey);

        expect(result).toEqual({ enabled: false, reason: 'Kill-switch active' });
      });

      it('should use tenant override when available and no kill-switch', async () => {
        const tenantId = 'tenant-123';
        const flagKey = 'test_flag';

        mockDynamoClient.getFlag = vi.fn().mockResolvedValue({ defaultEnabled: true });
        mockDynamoClient.getTenantOverride = vi.fn().mockResolvedValue({ enabled: false });
        mockDynamoClient.getKillSwitch = vi.fn().mockResolvedValue(null);

        const result = await apiClient.evaluateFlag(tenantId, flagKey);

        expect(result).toEqual({ enabled: false, reason: 'Tenant override' });
      });

      it('should use default flag value when no overrides exist', async () => {
        const tenantId = 'tenant-123';
        const flagKey = 'test_flag';

        mockDynamoClient.getFlag = vi.fn().mockResolvedValue({ defaultEnabled: true });
        mockDynamoClient.getTenantOverride = vi.fn().mockResolvedValue(null);
        mockDynamoClient.getKillSwitch = vi.fn().mockResolvedValue(null);

        const result = await apiClient.evaluateFlag(tenantId, flagKey);

        expect(result).toEqual({ enabled: true, reason: 'Default value' });
      });

      it('should return false when flag does not exist', async () => {
        const tenantId = 'tenant-123';
        const flagKey = 'non_existent_flag';

        mockDynamoClient.getFlag = vi.fn().mockResolvedValue(null);
        mockDynamoClient.getTenantOverride = vi.fn().mockResolvedValue(null);
        mockDynamoClient.getKillSwitch = vi.fn().mockResolvedValue(null);

        const result = await apiClient.evaluateFlag(tenantId, flagKey);

        expect(result).toEqual({ enabled: false, reason: 'Default value' });
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same ApiClient instance from getApiClient', () => {
      const client1 = getApiClient();
      const client2 = getApiClient();

      expect(client1).toBe(client2);
      expect(client1).toBeInstanceOf(ApiClient);
    });

    it('should initialize ApiClient only once', () => {
      // Clear any existing singleton
      vi.resetModules();
      
      const client1 = getApiClient();
      const client2 = getApiClient();
      const client3 = getApiClient();

      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
    });
  });
});