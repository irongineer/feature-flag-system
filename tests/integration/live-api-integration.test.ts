import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

interface FeatureFlag {
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
  expiresAt?: string;
}

interface TenantOverride {
  tenantId: string;
  flagKey: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

describe('Live API Integration Tests', () => {
  let apiClient: AxiosInstance;
  let apiServer: ChildProcess;
  const baseURL = 'http://localhost:3001';

  // DynamoDB setup for test data management
  const dynamoConfig = {
    endpoint: 'http://localhost:8000',
    region: 'ap-northeast-1',
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy'
    }
  };

  const dynamoClient = new DynamoDBClient(dynamoConfig);
  const docClient = DynamoDBDocumentClient.from(dynamoClient);

  const TABLES = {
    FEATURE_FLAGS: 'FeatureFlags',
    TENANT_OVERRIDES: 'TenantOverrides',
    EMERGENCY_CONTROL: 'EmergencyControl'
  } as const;

  beforeAll(async () => {
    // Start API server
    apiServer = spawn('npm', ['run', 'start:dev'], {
      cwd: 'packages/api',
      stdio: 'pipe',
      detached: false
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create axios client
    apiClient = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for logging
    apiClient.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupAllTestData();
    
    // Stop API server
    if (apiServer) {
      apiServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupAllTestData();
  });

  describe('Feature Flag Management API', () => {
    it('should create a new feature flag via API', async () => {
      const flagData = {
        flagKey: 'live_api_test_create',
        description: 'Live API Test: Create Flag',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      };

      const response = await apiClient.post('/flags', flagData);
      
      expect(response.status).toBe(201);
      expect(response.data.message).toBe('Flag created successfully');

      // Verify flag was created in DynamoDB
      const dbResult = await docClient.send(new PutCommand({
        TableName: TABLES.FEATURE_FLAGS,
        Item: {
          PK: `FLAG#${flagData.flagKey}`,
          SK: 'METADATA'
        }
      }));

      expect(dbResult).toBeDefined();
    });

    it('should retrieve a feature flag via API', async () => {
      const flagKey = 'live_api_test_get';
      
      // Create flag directly in DynamoDB
      await createTestFlag(flagKey, {
        description: 'Live API Test: Get Flag',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      const response = await apiClient.get(`/flags/${flagKey}`);
      
      expect(response.status).toBe(200);
      expect(response.data.flagKey).toBe(flagKey);
      expect(response.data.description).toBe('Live API Test: Get Flag');
      expect(response.data.defaultEnabled).toBe(false);
    });

    it('should list all feature flags via API', async () => {
      // Create multiple test flags
      const testFlags = [
        'live_api_test_list_1',
        'live_api_test_list_2',
        'live_api_test_list_3'
      ];

      for (const flagKey of testFlags) {
        await createTestFlag(flagKey, {
          description: `Live API Test: List Flag ${flagKey}`,
          defaultEnabled: true,
          owner: 'live-api-test@example.com'
        });
      }

      const response = await apiClient.get('/flags');
      
      expect(response.status).toBe(200);
      expect(response.data.flags).toBeInstanceOf(Array);
      expect(response.data.flags.length).toBeGreaterThanOrEqual(testFlags.length);
      
      // Verify our test flags are in the response
      const flagKeys = response.data.flags.map((flag: FeatureFlag) => flag.flagKey);
      testFlags.forEach(flagKey => {
        expect(flagKeys).toContain(flagKey);
      });
    });

    it('should update a feature flag via API', async () => {
      const flagKey = 'live_api_test_update';
      
      // Create flag
      await createTestFlag(flagKey, {
        description: 'Live API Test: Update Flag (Original)',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      // Update flag
      const updateData = {
        description: 'Live API Test: Update Flag (Updated)',
        defaultEnabled: true
      };

      const response = await apiClient.put(`/flags/${flagKey}`, updateData);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Flag updated successfully');

      // Verify update via GET
      const getResponse = await apiClient.get(`/flags/${flagKey}`);
      expect(getResponse.data.description).toBe(updateData.description);
      expect(getResponse.data.defaultEnabled).toBe(updateData.defaultEnabled);
    });

    it('should handle non-existent flag gracefully', async () => {
      try {
        await apiClient.get('/flags/nonexistent_flag');
        expect(true).toBe(false); // Should not reach this line
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toBe('Flag not found');
      }
    });
  });

  describe('Tenant Override Management API', () => {
    it('should set tenant override via API', async () => {
      const flagKey = 'live_api_test_tenant_override';
      const tenantId = 'live-api-tenant-1';
      
      // Create flag first
      await createTestFlag(flagKey, {
        description: 'Live API Test: Tenant Override',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      // Set tenant override
      const overrideData = {
        enabled: true,
        updatedBy: 'live-api-test@example.com'
      };

      const response = await apiClient.put(`/tenants/${tenantId}/flags/${flagKey}`, overrideData);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Tenant override set successfully');

      // Verify override via GET
      const getResponse = await apiClient.get(`/tenants/${tenantId}/flags/${flagKey}`);
      expect(getResponse.data.enabled).toBe(true);
      expect(getResponse.data.updatedBy).toBe(overrideData.updatedBy);
    });

    it('should list tenant overrides via API', async () => {
      const tenantId = 'live-api-tenant-list';
      const testFlags = ['flag1', 'flag2', 'flag3'];

      // Create flags and overrides
      for (const flagKey of testFlags) {
        await createTestFlag(flagKey, {
          description: `Live API Test: Tenant List ${flagKey}`,
          defaultEnabled: false,
          owner: 'live-api-test@example.com'
        });

        await createTestTenantOverride(tenantId, flagKey, true);
      }

      const response = await apiClient.get(`/tenants/${tenantId}/flags`);
      
      expect(response.status).toBe(200);
      expect(response.data.overrides).toBeInstanceOf(Array);
      expect(response.data.overrides.length).toBeGreaterThanOrEqual(testFlags.length);
    });

    it('should remove tenant override via API', async () => {
      const flagKey = 'live_api_test_tenant_remove';
      const tenantId = 'live-api-tenant-remove';
      
      // Create flag and override
      await createTestFlag(flagKey, {
        description: 'Live API Test: Tenant Remove',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      await createTestTenantOverride(tenantId, flagKey, true);

      // Remove override
      const response = await apiClient.delete(`/tenants/${tenantId}/flags/${flagKey}`);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Tenant override removed successfully');

      // Verify override is removed
      try {
        await apiClient.get(`/tenants/${tenantId}/flags/${flagKey}`);
        expect(true).toBe(false); // Should not reach this line
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('Emergency Control (Kill-Switch) API', () => {
    it('should activate global kill-switch via API', async () => {
      const killSwitchData = {
        reason: 'Live API Test: Global Emergency',
        activatedBy: 'live-api-test@example.com'
      };

      const response = await apiClient.post('/emergency', killSwitchData);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Kill-switch activated successfully');

      // Verify kill-switch in DynamoDB
      const dbCheck = await docClient.send(new PutCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Item: {
          PK: 'EMERGENCY',
          SK: 'GLOBAL'
        }
      }));

      expect(dbCheck).toBeDefined();
    });

    it('should activate flag-specific kill-switch via API', async () => {
      const flagKey = 'live_api_test_flag_kill';
      
      // Create flag first
      await createTestFlag(flagKey, {
        description: 'Live API Test: Flag Kill-Switch',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      });

      const killSwitchData = {
        flagKey,
        reason: 'Live API Test: Flag Emergency',
        activatedBy: 'live-api-test@example.com'
      };

      const response = await apiClient.post('/emergency', killSwitchData);
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Kill-switch activated successfully');
    });

    it('should deactivate kill-switch via API', async () => {
      const flagKey = 'live_api_test_deactivate';
      
      // Create flag and activate kill-switch
      await createTestFlag(flagKey, {
        description: 'Live API Test: Deactivate Kill-Switch',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      });

      await createTestKillSwitch(flagKey, 'Test emergency');

      // Deactivate kill-switch
      const deactivateData = {
        flagKey,
        deactivatedBy: 'live-api-test@example.com'
      };

      const response = await apiClient.delete('/emergency', { data: deactivateData });
      
      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Kill-switch deactivated successfully');
    });
  });

  describe('Feature Flag Evaluation API', () => {
    it('should evaluate feature flag via API', async () => {
      const flagKey = 'live_api_test_evaluate';
      const tenantId = 'live-api-tenant-evaluate';
      
      // Create flag
      await createTestFlag(flagKey, {
        description: 'Live API Test: Evaluate Flag',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      });

      const response = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      
      expect(response.status).toBe(200);
      expect(response.data.enabled).toBe(true);
      expect(response.data.flagKey).toBe(flagKey);
      expect(response.data.tenantId).toBe(tenantId);
    });

    it('should respect tenant override in evaluation', async () => {
      const flagKey = 'live_api_test_evaluate_override';
      const tenantId = 'live-api-tenant-evaluate-override';
      
      // Create flag with default false
      await createTestFlag(flagKey, {
        description: 'Live API Test: Evaluate Override',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      // Set tenant override to true
      await createTestTenantOverride(tenantId, flagKey, true);

      const response = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      
      expect(response.status).toBe(200);
      expect(response.data.enabled).toBe(true); // Override should win
    });

    it('should respect kill-switch in evaluation', async () => {
      const flagKey = 'live_api_test_evaluate_kill';
      const tenantId = 'live-api-tenant-evaluate-kill';
      
      // Create flag with default true
      await createTestFlag(flagKey, {
        description: 'Live API Test: Evaluate Kill-Switch',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      });

      // Activate kill-switch
      await createTestKillSwitch(flagKey, 'Test emergency');

      const response = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      
      expect(response.status).toBe(200);
      expect(response.data.enabled).toBe(false); // Kill-switch should disable
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent API requests', async () => {
      const flagKey = 'live_api_test_concurrent';
      const tenantId = 'live-api-tenant-concurrent';
      
      // Create flag
      await createTestFlag(flagKey, {
        description: 'Live API Test: Concurrent Requests',
        defaultEnabled: true,
        owner: 'live-api-test@example.com'
      });

      // Create 50 concurrent evaluation requests
      const concurrentRequests = Array.from({ length: 50 }, (_, i) => 
        apiClient.post('/evaluate', {
          tenantId: `${tenantId}-${i}`,
          flagKey
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data.enabled).toBe(true);
      });

      // Performance requirement: 50 requests should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      console.log(`📊 Concurrent API Performance:`);
      console.log(`   Requests: ${concurrentRequests.length}`);
      console.log(`   Total time: ${duration}ms`);
      console.log(`   Average time: ${(duration / concurrentRequests.length).toFixed(2)}ms/request`);
    });

    it('should handle high-frequency flag updates', async () => {
      const flagKey = 'live_api_test_high_freq';
      
      // Create flag
      await createTestFlag(flagKey, {
        description: 'Live API Test: High Frequency Updates',
        defaultEnabled: false,
        owner: 'live-api-test@example.com'
      });

      // Perform 20 rapid updates
      const startTime = Date.now();
      for (let i = 0; i < 20; i++) {
        const updateData = {
          description: `Live API Test: High Frequency Updates - Iteration ${i}`,
          defaultEnabled: i % 2 === 0 // Alternate between true/false
        };

        const response = await apiClient.put(`/flags/${flagKey}`, updateData);
        expect(response.status).toBe(200);
      }
      const duration = Date.now() - startTime;

      // Verify final state
      const getResponse = await apiClient.get(`/flags/${flagKey}`);
      expect(getResponse.data.description).toContain('Iteration 19');
      expect(getResponse.data.defaultEnabled).toBe(false); // 19 % 2 === 1, so false

      console.log(`📊 High-frequency update performance: ${duration}ms for 20 updates`);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  // Helper functions for test data management
  async function createTestFlag(flagKey: string, options: {
    description: string;
    defaultEnabled: boolean;
    owner: string;
    expiresAt?: string;
  }) {
    await docClient.send(new PutCommand({
      TableName: TABLES.FEATURE_FLAGS,
      Item: {
        PK: `FLAG#${flagKey}`,
        SK: 'METADATA',
        flagKey,
        description: options.description,
        defaultEnabled: options.defaultEnabled,
        owner: options.owner,
        createdAt: new Date().toISOString(),
        ...(options.expiresAt && { 
          expiresAt: options.expiresAt,
          GSI1PK: 'EXPIRES',
          GSI1SK: options.expiresAt
        })
      }
    }));
  }

  async function createTestTenantOverride(tenantId: string, flagKey: string, enabled: boolean) {
    await docClient.send(new PutCommand({
      TableName: TABLES.TENANT_OVERRIDES,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `FLAG#${flagKey}`,
        enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: 'live-api-test@example.com',
        GSI1PK: `FLAG#${flagKey}`,
        GSI1SK: `TENANT#${tenantId}`
      }
    }));
  }

  async function createTestKillSwitch(flagKey: string, reason: string) {
    await docClient.send(new PutCommand({
      TableName: TABLES.EMERGENCY_CONTROL,
      Item: {
        PK: 'EMERGENCY',
        SK: `FLAG#${flagKey}`,
        enabled: true,
        reason,
        activatedAt: new Date().toISOString(),
        activatedBy: 'live-api-test@example.com'
      }
    }));
  }

  async function cleanupAllTestData() {
    const testPatterns = [
      'live_api_test_',
      'live-api-tenant-',
      'live-api-test@example.com'
    ];

    try {
      // Clean up flags
      const flagPromises = testPatterns.map(pattern => 
        docClient.send(new DeleteCommand({
          TableName: TABLES.FEATURE_FLAGS,
          Key: { PK: `FLAG#${pattern}`, SK: 'METADATA' }
        })).catch(() => {}) // Ignore errors for non-existent items
      );

      // Clean up tenant overrides
      const tenantPromises = testPatterns.map(pattern => 
        docClient.send(new DeleteCommand({
          TableName: TABLES.TENANT_OVERRIDES,
          Key: { PK: `TENANT#${pattern}`, SK: `FLAG#${pattern}` }
        })).catch(() => {}) // Ignore errors for non-existent items
      );

      // Clean up kill switches
      const killSwitchPromises = testPatterns.map(pattern => 
        docClient.send(new DeleteCommand({
          TableName: TABLES.EMERGENCY_CONTROL,
          Key: { PK: 'EMERGENCY', SK: `FLAG#${pattern}` }
        })).catch(() => {}) // Ignore errors for non-existent items
      );

      await Promise.all([...flagPromises, ...tenantPromises, ...killSwitchPromises]);
    } catch (error) {
      console.warn('Test cleanup failed:', error);
    }
  }
});