import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../src/handlers/management-simple';
import { DynamoDbClient } from '@feature-flag/core';

// DynamoDbClientをモック化
vi.mock('@feature-flag/core', () => ({
  DynamoDbClient: vi.fn()
}));

describe('management-simple handler', () => {
  const mockDynamoClient = {
    listFlags: vi.fn(),
    createFlag: vi.fn()
  };

  const mockDynamoDbClient = vi.mocked(DynamoDbClient);

  beforeEach(() => {
    vi.clearAllMocks();
    mockDynamoDbClient.mockReturnValue(mockDynamoClient as any);
    
    // 環境変数をクリア
    delete process.env.AWS_REGION;
    delete process.env.FEATURE_FLAGS_TABLE_NAME;
  });

  const createMockEvent = (
    httpMethod: string,
    path: string,
    body?: any
  ): APIGatewayProxyEvent => ({
    httpMethod,
    path,
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    isBase64Encoded: false
  });

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn()
  };

  describe('GET /flags', () => {
    it('should return flags list successfully', async () => {
      const mockFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'Enable billing v2',
          defaultEnabled: true,
          owner: 'team-billing'
        }
      ];

      mockDynamoClient.listFlags.mockResolvedValue(mockFlags);

      const event = createMockEvent('GET', '/api/flags');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(JSON.parse(result.body)).toEqual(mockFlags);
      expect(mockDynamoClient.listFlags).toHaveBeenCalledOnce();
    });

    it('should handle DynamoDB errors', async () => {
      mockDynamoClient.listFlags.mockRejectedValue(new Error('DynamoDB error'));

      const event = createMockEvent('GET', '/api/flags');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal server error'
      });
    });
  });

  describe('POST /flags', () => {
    it('should create flag successfully', async () => {
      const flagData = {
        flagKey: 'new_feature_enable',
        description: 'Enable new feature',
        defaultEnabled: true,
        owner: 'team-product'
      };

      mockDynamoClient.createFlag.mockResolvedValue(undefined);

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(result.body)).toEqual({
        message: 'Flag created successfully',
        flagKey: 'new_feature_enable'
      });

      expect(mockDynamoClient.createFlag).toHaveBeenCalledWith({
        flagKey: 'new_feature_enable',
        description: 'Enable new feature',
        defaultEnabled: true,
        owner: 'team-product',
        createdAt: expect.any(String)
      });
    });

    it('should create flag with default enabled false', async () => {
      const flagData = {
        flagKey: 'test_flag',
        description: 'Test flag',
        owner: 'team-test'
        // defaultEnabled not specified
      };

      mockDynamoClient.createFlag.mockResolvedValue(undefined);

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockDynamoClient.createFlag).toHaveBeenCalledWith({
        flagKey: 'test_flag',
        description: 'Test flag',
        defaultEnabled: false, // default value
        owner: 'team-test',
        createdAt: expect.any(String)
      });
    });

    it('should reject request missing flagKey', async () => {
      const flagData = {
        description: 'Test flag',
        owner: 'team-test'
        // flagKey missing
      };

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'flagKey, description, and owner are required'
      });
      expect(mockDynamoClient.createFlag).not.toHaveBeenCalled();
    });

    it('should reject request missing description', async () => {
      const flagData = {
        flagKey: 'test_flag',
        owner: 'team-test'
        // description missing
      };

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'flagKey, description, and owner are required'
      });
    });

    it('should reject request missing owner', async () => {
      const flagData = {
        flagKey: 'test_flag',
        description: 'Test flag'
        // owner missing
      };

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'flagKey, description, and owner are required'
      });
    });

    it('should handle empty body', async () => {
      const event = createMockEvent('POST', '/api/flags');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: 'flagKey, description, and owner are required'
      });
    });

    it('should handle malformed JSON body', async () => {
      const event = {
        ...createMockEvent('POST', '/api/flags'),
        body: 'invalid json'
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal server error'
      });
    });

    it('should handle DynamoDB create errors', async () => {
      const flagData = {
        flagKey: 'test_flag',
        description: 'Test flag',
        owner: 'team-test'
      };

      mockDynamoClient.createFlag.mockRejectedValue(new Error('DynamoDB error'));

      const event = createMockEvent('POST', '/api/flags', flagData);
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Internal server error'
      });
    });
  });

  describe('unsupported endpoints', () => {
    it('should return 404 for unsupported GET endpoints', async () => {
      const event = createMockEvent('GET', '/api/unknown');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Not found'
      });
    });

    it('should return 404 for unsupported POST endpoints', async () => {
      const event = createMockEvent('POST', '/api/unknown');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Not found'
      });
    });

    it('should return 404 for unsupported HTTP methods', async () => {
      const event = createMockEvent('PUT', '/api/flags');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Not found'
      });
    });

    it('should return 404 for DELETE method', async () => {
      const event = createMockEvent('DELETE', '/api/flags');
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: 'Not found'
      });
    });
  });

  describe('DynamoDB client initialization', () => {
    it('should create DynamoDB client and call listFlags successfully', async () => {
      const event = createMockEvent('GET', '/api/flags');
      mockDynamoClient.listFlags.mockResolvedValue([]);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockDynamoClient.listFlags).toHaveBeenCalledOnce();
    });

    it('should create DynamoDB client and handle different endpoints', async () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.FEATURE_FLAGS_TABLE_NAME = 'prod-flags';

      const event = createMockEvent('GET', '/api/flags');
      mockDynamoClient.listFlags.mockResolvedValue([]);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockDynamoClient.listFlags).toHaveBeenCalled();
    });

    it('should handle multiple requests efficiently', async () => {
      const event = createMockEvent('GET', '/api/flags');
      mockDynamoClient.listFlags.mockResolvedValue([]);

      // First call
      const result1 = await handler(event, mockContext);
      // Second call
      const result2 = await handler(event, mockContext);

      // Both should succeed
      expect(result1.statusCode).toBe(200);
      expect(result2.statusCode).toBe(200);
      // listFlags should be called twice
      expect(mockDynamoClient.listFlags).toHaveBeenCalledTimes(2);
    });
  });

  describe('logging', () => {
    it('should log request details', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const event = createMockEvent('GET', '/api/flags');
      mockDynamoClient.listFlags.mockResolvedValue([]);

      await handler(event, mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Management request:',
        expect.stringContaining('"httpMethod": "GET"')
      );

      consoleSpy.mockRestore();
    });

    it('should log errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const event = createMockEvent('GET', '/api/flags');
      mockDynamoClient.listFlags.mockRejectedValue(new Error('Test error'));

      await handler(event, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Management error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});