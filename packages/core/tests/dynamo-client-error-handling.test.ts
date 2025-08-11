import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamoDbClient } from '../src/evaluator/dynamo-client';
import { silentErrorHandler, enhancedErrorHandler } from '../src/types/error-handling';

// DynamoDB DocumentClient をモック化
const mockSend = vi.fn();

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const MockDynamoDBDocumentClient = {
    from: vi.fn(() => ({ send: mockSend })),
  };

  return {
    DynamoDBDocumentClient: MockDynamoDBDocumentClient,
    GetCommand: vi.fn(),
    PutCommand: vi.fn(),
    UpdateCommand: vi.fn(),
    QueryCommand: vi.fn(),
    ScanCommand: vi.fn(),
    BatchGetCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}));

describe('DynamoDbClient Error Handling Integration', () => {
  let client: DynamoDbClient;
  let errorHandlerSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockClear();

    errorHandlerSpy = vi.fn();

    client = new DynamoDbClient({
      environment: 'development',
      region: 'ap-northeast-1',
      tableName: 'test-table',
      errorHandler: errorHandlerSpy,
    });
  });

  describe('getFlag Error Handling', () => {
    it('should handle ResourceNotFoundException gracefully', async () => {
      const notFoundError = new Error('Resource not found');
      notFoundError.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(notFoundError);

      await expect(client.getFlag('nonexistent-flag')).rejects.toThrow('DynamoDB resource not found');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'getFlag',
        flagKey: 'nonexistent-flag',
        errorType: 'ResourceNotFoundException'
      }));
    });

    it('should handle ValidationException', async () => {
      const validationError = new Error('Invalid key format');
      validationError.name = 'ValidationException';
      mockSend.mockRejectedValue(validationError);

      await expect(client.getFlag('invalid-flag')).rejects.toThrow('Request validation failed');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'getFlag',
        errorType: 'ValidationException',
        isRetryable: false
      }));
    });

    it('should handle ThrottlingException', async () => {
      const throttlingError = new Error('Request rate exceeded');
      throttlingError.name = 'ThrottlingException';
      mockSend.mockRejectedValue(throttlingError);

      await expect(client.getFlag('test-flag')).rejects.toThrow('DynamoDB request rate exceeded');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'getFlag',
        errorType: 'ThrottlingException',
        isRetryable: true
      }));
    });
  });

  describe('createFlag Error Handling', () => {
    it('should handle ConditionalCheckFailedException', async () => {
      const conditionalError = new Error('Item already exists');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(conditionalError);

      const flagData = {
        flagKey: 'existing-flag',
        description: 'Test flag',
        defaultEnabled: false,
        owner: 'test-team',
        createdAt: '2025-01-01T00:00:00Z',
      };

      await expect(client.createFlag(flagData)).rejects.toThrow('Resource already exists or condition not met');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'createFlag',
        flagKey: 'existing-flag',
        errorType: 'ConditionalCheckFailedException'
      }));
    });

    it('should handle ProvisionedThroughputExceededException', async () => {
      const throughputError = new Error('Throughput exceeded') as any;
      throughputError.name = 'ProvisionedThroughputExceededException';
      throughputError.$metadata = { httpStatusCode: 400 };
      mockSend.mockRejectedValue(throughputError);

      const flagData = {
        flagKey: 'new-flag',
        description: 'Test flag',
        defaultEnabled: true,
        owner: 'test-team',
        createdAt: '2025-01-01T00:00:00Z',
      };

      await expect(client.createFlag(flagData)).rejects.toThrow('DynamoDB request rate exceeded');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'createFlag',
        errorType: 'ProvisionedThroughputExceededException',
        isRetryable: true,
        httpStatusCode: 400
      }));
    });
  });

  describe('getTenantOverride Error Handling', () => {
    it('should include tenant context in error', async () => {
      const error = new Error('Network error');
      error.name = 'NetworkingError';
      mockSend.mockRejectedValue(error);

      await expect(client.getTenantOverride('tenant-123', 'billing-flag')).rejects.toThrow();

      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'getTenantOverride',
          tenantId: 'tenant-123',
          flagKey: 'billing-flag',
        })
      );
    });
  });

  describe('setTenantOverride Error Handling', () => {
    it('should handle errors with tenant and flag context', async () => {
      const serverError = new Error('Internal server error');
      serverError.name = 'InternalServerError';
      mockSend.mockRejectedValue(serverError);

      await expect(
        client.setTenantOverride('tenant-456', 'feature-flag', true, 'admin')
      ).rejects.toThrow();

      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'setTenantOverride',
          tenantId: 'tenant-456',
          flagKey: 'feature-flag',
          isRetryable: true,
        })
      );
    });
  });

  describe('listFlags Error Handling', () => {
    it('should handle scan operation errors', async () => {
      const error = new Error('Access denied');
      error.name = 'UnauthorizedOperation';
      mockSend.mockRejectedValue(error);

      await expect(client.listFlags()).rejects.toThrow();

      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'listFlags',
        })
      );
    });
  });

  describe('batchGetFlags Error Handling', () => {
    it('should include flagKeys in error context', async () => {
      const error = new Error('Service unavailable');
      error.name = 'ServiceUnavailableException';
      mockSend.mockRejectedValue(error);

      const flagKeys = ['flag1', 'flag2', 'flag3'];
      await expect(client.batchGetFlags(flagKeys)).rejects.toThrow();

      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'batchGetFlags',
          context: expect.objectContaining({
            flagKeys: ['flag1', 'flag2', 'flag3'],
          }),
          isRetryable: true,
        })
      );
    });
  });

  describe('healthCheck Error Handling', () => {
    it('should return false on error without throwing', async () => {
      const error = new Error('Table not found');
      error.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(error);

      const result = await client.healthCheck();

      expect(result).toBe(false);
      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'healthCheck',
          errorType: 'ResourceNotFoundException',
        })
      );
    });

    it('should return true on successful scan', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(errorHandlerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Custom Error Handler Configuration', () => {
    it('should use default enhanced error handler when not specified', () => {
      const defaultClient = new DynamoDbClient({
        environment: 'development',
        region: 'ap-northeast-1',
        tableName: 'test-table',
      });

      // Should not throw during construction
      expect(defaultClient).toBeDefined();
    });

    it('should use silent error handler in test environment', async () => {
      const silentClient = new DynamoDbClient({
        environment: 'development',
        region: 'ap-northeast-1',
        tableName: 'test-table',
        errorHandler: silentErrorHandler,
      });

      const error = new Error('Test error');
      error.name = 'ValidationException';
      mockSend.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(silentClient.getFlag('test-flag')).rejects.toThrow();

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle errors with full AWS metadata', async () => {
      const complexError = new Error('DynamoDB service error') as any;
      complexError.name = 'InternalServerError';
      complexError.$fault = 'server';
      complexError.$metadata = {
        httpStatusCode: undefined,
        requestId: 'aws-request-id-123',
        cfId: 'cloudfront-id-456',
      };
      mockSend.mockRejectedValue(complexError);

      await expect(client.updateFlag('test-flag', { description: 'Updated' })).rejects.toThrow();

      expect(errorHandlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'updateFlag',
          flagKey: 'test-flag',
          errorType: 'InternalServerError',
          isRetryable: true,
          httpStatusCode: 500,
        })
      );
    });

    it('should handle unknown error types gracefully', async () => {
      const unknownError = new Error('Unknown service error');
      unknownError.name = 'UnknownServiceError';
      mockSend.mockRejectedValue(unknownError);

      await expect(client.getFlag('test-flag')).rejects.toThrow('Unexpected DynamoDB error');
      
      expect(errorHandlerSpy).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'getFlag',
        errorType: 'UnknownServiceError',
        isRetryable: false
      }));
    });
  });
});
