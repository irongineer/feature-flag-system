import { FeatureFlagHttpClient } from '../src/client/http-client';
import { FeatureFlagContext, FEATURE_FLAGS } from '../src/models';

import { vi } from 'vitest';

// Fetch のモック
global.fetch = vi.fn();
const mockFetch = fetch as any;

describe('FeatureFlagHttpClient', () => {
  let client: FeatureFlagHttpClient;

  beforeEach(() => {
    client = new FeatureFlagHttpClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      timeout: 1000,
      retries: 1
    });
    
    vi.clearAllMocks();
  });

  describe('Context Flexibility', () => {
    it('should work with minimal context (tenantId only)', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
            tenantId: 'tenant-123',
            flagKey: 'new_dashboard_enable',
            environment: 'production'
      });
    });

    it('should include userId when provided', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userId: 'user-456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
        tenantId: 'tenant-123',
        userId: 'user-456',
        flagKey: 'new_dashboard_enable',
        environment: 'production'
      });
    });

    it('should include userRole when provided', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userRole: 'admin'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
            tenantId: 'tenant-123',
            userRole: 'admin',
            flagKey: 'new_dashboard_enable',
            environment: 'production'
      });
    });

    it('should include plan when provided', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        plan: 'enterprise'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
            tenantId: 'tenant-123',
            plan: 'enterprise',
            flagKey: 'new_dashboard_enable',
            environment: 'production'
      });
    });

    it('should include all optional fields when provided', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        userRole: 'admin',
        plan: 'enterprise',
        environment: 'staging',
        metadata: {
          region: 'us-east-1',
          experimentGroup: 'variant-A'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/evaluate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          })
        })
      );

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
            tenantId: 'tenant-123',
            userId: 'user-456',
            userRole: 'admin',
            plan: 'enterprise',
            flagKey: 'new_dashboard_enable',
            environment: 'staging',
            metadata: {
              region: 'us-east-1',
              experimentGroup: 'variant-A'
            }
      });
    });

    it('should NOT include undefined optional fields', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userId: undefined,
        userRole: undefined,
        plan: undefined,
        metadata: undefined
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
      } as Response);

      await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      
      expect(callBody).toMatchObject({
        tenantId: 'tenant-123',
        flagKey: 'new_dashboard_enable',
        environment: 'production'
      });
      
      expect(callBody).not.toHaveProperty('userId');
      expect(callBody).not.toHaveProperty('userRole');
      expect(callBody).not.toHaveProperty('plan');
      expect(callBody).not.toHaveProperty('metadata');
    });
  });

  describe('Error Handling', () => {
    it('should return default value when tenantId is missing', async () => {
      const context = {} as FeatureFlagContext;

      const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return default value on network error', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(result).toBe(false);
    });

    it('should use custom default values', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      client.setDefaultValue(FEATURE_FLAGS.NEW_DASHBOARD, true);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(result).toBe(true);
    });

    it('should retry on failure', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
        } as Response);

      const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAllFlags', () => {
    it('should work with minimal context', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          flags: {
            'new_dashboard_enable': true,
            'billing_v2_enable': false
          }
        })
      } as Response);

      const result = await client.getAllFlags(context);

      expect(result).toEqual({
        'new_dashboard_enable': true,
        'billing_v2_enable': false
      });
    });

    it('should include optional fields when provided', async () => {
      const context: FeatureFlagContext = {
        tenantId: 'tenant-123',
        userId: 'user-456',
        userRole: 'admin'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ flags: {} })
      } as Response);

      await client.getAllFlags(context);

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(callBody).toMatchObject({
        tenantId: 'tenant-123',
        userId: 'user-456',
        userRole: 'admin',
        environment: 'production'
      });
    });
  });
});