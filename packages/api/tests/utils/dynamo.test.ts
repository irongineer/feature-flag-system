import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDynamoClient } from '../../src/utils/dynamo';
import { DynamoDbClient } from '@feature-flag/core';

// DynamoDbClientをモック化
vi.mock('@feature-flag/core', () => ({
  DynamoDbClient: vi.fn()
}));

describe('dynamo utils', () => {
  const mockDynamoClient = vi.mocked(DynamoDbClient);

  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をクリア
    delete process.env.AWS_REGION;
    delete process.env.FEATURE_FLAGS_TABLE_NAME;
    delete process.env.NODE_ENV;
    delete process.env.IS_OFFLINE;
    delete process.env.DYNAMODB_ENDPOINT;
  });

  describe('createDynamoClient', () => {
    it('should create DynamoDB client with default configuration', () => {
      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'ap-northeast-1',
        tableName: 'feature-flags'
      });
    });

    it('should use environment variables when provided', () => {
      process.env.AWS_REGION = 'us-west-2';
      process.env.FEATURE_FLAGS_TABLE_NAME = 'custom-flags-table';

      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'us-west-2',
        tableName: 'custom-flags-table'
      });
    });

    it('should add endpoint for development environment', () => {
      process.env.NODE_ENV = 'development';

      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: 'http://localhost:8000'
      });
    });

    it('should add endpoint when IS_OFFLINE is set', () => {
      process.env.IS_OFFLINE = 'true';

      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: 'http://localhost:8000'
      });
    });

    it('should use custom DYNAMODB_ENDPOINT when provided', () => {
      process.env.NODE_ENV = 'development';
      process.env.DYNAMODB_ENDPOINT = 'http://custom-dynamo:8000';

      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: 'http://custom-dynamo:8000'
      });
    });

    it('should return DynamoDbClient instance', () => {
      const mockInstance = { listFlags: vi.fn() };
      mockDynamoClient.mockReturnValue(mockInstance as any);

      const result = createDynamoClient();

      expect(result).toBe(mockInstance);
    });

    it('should handle all environment configurations combined', () => {
      process.env.AWS_REGION = 'eu-central-1';
      process.env.FEATURE_FLAGS_TABLE_NAME = 'prod-flags';
      process.env.NODE_ENV = 'development';
      process.env.DYNAMODB_ENDPOINT = 'http://localstack:4566';

      createDynamoClient();

      expect(mockDynamoClient).toHaveBeenCalledWith({
        region: 'eu-central-1',
        tableName: 'prod-flags',
        endpoint: 'http://localstack:4566'
      });
    });
  });
});