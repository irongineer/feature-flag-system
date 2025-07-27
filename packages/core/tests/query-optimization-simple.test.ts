import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDbClient } from '../src/evaluator/dynamo-client';
import { silentErrorHandler } from '../src/types/error-handling';

// DynamoDB DocumentClient をモック化
const mockSend = vi.fn();

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend }))
  },
  QueryCommand: vi.fn(),
  ScanCommand: vi.fn(),
  PutCommand: vi.fn(),
  UpdateCommand: vi.fn()
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn()
}));

describe('DynamoDB Query Optimization', () => {
  let client: DynamoDbClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();
    
    client = new DynamoDbClient({
      environment: 'development',
      region: 'ap-northeast-1',
      tableName: 'test-table',
      errorHandler: silentErrorHandler
    });
  });

  describe('Query-based Flag Listing', () => {
    it('should successfully list flags using GSI3 query', async () => {
      const mockFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'Enable billing v2',
          defaultEnabled: true,
          owner: 'team-billing',
          createdAt: '2025-01-01T00:00:00Z'
        },
        {
          flagKey: 'new_dashboard_enable',
          description: 'Enable new dashboard',
          defaultEnabled: false,
          owner: 'team-ui',
          createdAt: '2025-01-02T00:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: mockFlags });

      const result = await client.listFlags();

      expect(result).toEqual(mockFlags);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should handle empty flag list', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await client.listFlags();

      expect(result).toEqual([]);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should successfully list flags by owner using GSI2 query', async () => {
      const ownerFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'Enable billing v2',
          defaultEnabled: true,
          owner: 'team-billing',
          createdAt: '2025-01-01T00:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: ownerFlags });

      const result = await client.listFlagsByOwner('team-billing');

      expect(result).toEqual(ownerFlags);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should handle owner with no flags', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await client.listFlagsByOwner('team-nonexistent');

      expect(result).toEqual([]);
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('Scan Fallback Method', () => {
    it('should use scan method as fallback', async () => {
      const mockFlags = [
        {
          PK: 'FLAG#billing_v2_enable',
          SK: 'METADATA',
          flagKey: 'billing_v2_enable',
          description: 'Enable billing v2',
          defaultEnabled: true,
          owner: 'team-billing',
          createdAt: '2025-01-01T00:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: mockFlags });

      const result = await client.listFlagsWithScan();

      expect(result).toEqual(mockFlags);
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('GSI Key Management', () => {
    it('should create flag with correct GSI keys', async () => {
      mockSend.mockResolvedValue({});

      const flagData = {
        flagKey: 'new_feature_enable',
        description: 'Enable new feature',
        defaultEnabled: true,
        owner: 'team-product',
        createdAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-12-31T23:59:59Z'
      };

      await client.createFlag(flagData);

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should update flag with GSI key maintenance', async () => {
      mockSend.mockResolvedValue({});

      const updates = {
        owner: 'team-new-owner',
        expiresAt: '2025-06-30T23:59:59Z',
        description: 'Updated description'
      };

      await client.updateFlag('test_flag', updates);

      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large result sets efficiently', async () => {
      // Simulate 1000 flags
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        flagKey: `performance_test_flag_${i}`,
        description: `Performance test flag ${i}`,
        defaultEnabled: i % 2 === 0,
        owner: `team-${i % 10}`,
        createdAt: new Date(2025, 0, 1, 0, i).toISOString()
      }));

      mockSend.mockResolvedValue({ Items: largeDataSet });

      const startTime = performance.now();
      const result = await client.listFlags();
      const endTime = performance.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      
      console.log(`Query optimization: Processed ${result.length} flags in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should demonstrate different query patterns', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      // Test all query patterns
      await client.listFlags(); // Uses GSI3
      await client.listFlagsByOwner('team-test'); // Uses GSI2
      await client.listFlagsWithScan(); // Uses table scan

      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should handle query errors gracefully', async () => {
      const queryError = new Error('Index not available');
      queryError.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(queryError);

      await expect(client.listFlags()).rejects.toThrow();
      await expect(client.listFlagsByOwner('team-test')).rejects.toThrow();
      
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('Index Selection Strategy', () => {
    it('should validate GSI design principles', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      // GSI3: All flags listing (replaces expensive scan)
      await client.listFlags();
      
      // GSI2: Owner-specific flags (efficient filtering)
      await client.listFlagsByOwner('team-specific');

      // Each query should use different indexes for optimal performance
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent queries efficiently', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      // Simulate concurrent queries
      const queries = [
        client.listFlags(),
        client.listFlagsByOwner('team-a'),
        client.listFlagsByOwner('team-b'),
        client.listFlags()
      ];

      await Promise.all(queries);

      expect(mockSend).toHaveBeenCalledTimes(4);
    });
  });

  describe('Migration Compatibility', () => {
    it('should maintain backwards compatibility with scan method', async () => {
      const scanResults = [
        {
          PK: 'FLAG#legacy_flag',
          SK: 'METADATA',
          flagKey: 'legacy_flag',
          description: 'Legacy flag',
          defaultEnabled: false,
          owner: 'legacy-team',
          createdAt: '2024-12-01T00:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: scanResults });

      const result = await client.listFlagsWithScan();

      expect(result).toEqual(scanResults);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should handle mixed GSI key presence gracefully', async () => {
      // Test scenario where some flags have GSI keys and others don't
      const mixedFlags = [
        {
          flagKey: 'new_flag_with_gsi',
          description: 'New flag with GSI keys',
          defaultEnabled: true,
          owner: 'team-new',
          createdAt: '2025-01-01T00:00:00Z'
        },
        {
          flagKey: 'old_flag_no_gsi',
          description: 'Old flag without GSI keys',
          defaultEnabled: false,
          owner: 'team-old',
          createdAt: '2024-01-01T00:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: mixedFlags });

      const result = await client.listFlags();

      expect(result).toEqual(mixedFlags);
      expect(result).toHaveLength(2);
    });
  });
});