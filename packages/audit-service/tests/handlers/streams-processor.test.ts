import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// Mock all external dependencies before importing
vi.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ nextSequenceToken: 'test-token' }),
  })),
}));

// Mock the core package
vi.mock('../../../core/src/models', () => ({
  FeatureFlagKey: {},
}));

const mockAuditLogger = {
  logBatch: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn().mockResolvedValue(undefined),
};

const mockStreamParser = {
  parseStreamRecord: vi.fn().mockReturnValue({
    resourceType: 'feature_flag',
    resourceId: 'test_flag',
    eventType: 'flag_updated',
    action: 'UPDATE',
  }),
  extractChanges: vi.fn().mockReturnValue({
    before: { defaultEnabled: false },
    after: { defaultEnabled: true },
  }),
};

vi.mock('../../src/services/audit-logger', () => ({
  AuditLogger: vi.fn().mockImplementation(() => mockAuditLogger),
}));

vi.mock('../../src/services/stream-parser', () => ({
  StreamEventParser: vi.fn().mockImplementation(() => mockStreamParser),
}));

// Import after mocks are set up
import { DynamoDBStreamEvent, Context } from 'aws-lambda';

describe('Streams Processor TDD Tests', () => {
  let handler: any;
  let mockConsoleLog: Mock;
  let mockConsoleError: Mock;
  let mockConsoleWarn: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock functions
    mockAuditLogger.logBatch.mockResolvedValue(undefined);
    mockAuditLogger.logError.mockResolvedValue(undefined);
    mockStreamParser.parseStreamRecord.mockReturnValue({
      resourceType: 'feature_flag',
      resourceId: 'test_flag',
      eventType: 'flag_updated',
      action: 'UPDATE',
    });
    mockStreamParser.extractChanges.mockReturnValue({
      before: { defaultEnabled: false },
      after: { defaultEnabled: true },
    });

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Import handler after mocks are set up
    const handlerModule = await import('../../src/handlers/streams-processor');
    handler = handlerModule.handler;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockContext = (overrides = {}): Context => ({
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'stream-processor',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:stream-processor',
    memoryLimitInMB: '512',
    awsRequestId: 'test-request-id-123',
    logGroupName: '/aws/lambda/stream-processor',
    logStreamName: '2022/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: vi.fn().mockReturnValue(30000),
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
    ...overrides,
  });

  describe('Handler Function', () => {
    it('should process DynamoDB stream records successfully', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#test_flag' }, SK: { S: 'METADATA' } },
              NewImage: {
                PK: { S: 'FLAG#test_flag' },
                SK: { S: 'METADATA' },
                defaultEnabled: { BOOL: true },
                flagKey: { S: 'test_flag' },
              },
              OldImage: {
                PK: { S: 'FLAG#test_flag' },
                SK: { S: 'METADATA' },
                defaultEnabled: { BOOL: false },
                flagKey: { S: 'test_flag' },
              },
              SequenceNumber: '123456789',
              SizeBytes: 128,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockConsoleLog).toHaveBeenCalledWith('Processing 1 DynamoDB stream records');
      expect(mockAuditLogger.logBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          eventType: 'flag_updated',
          resourceType: 'feature_flag',
          resourceId: 'test_flag',
          action: 'UPDATE',
        }),
      ]));
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully logged 1 audit entries');
    });

    it('should handle empty records array gracefully', async () => {
      const mockEvent: DynamoDBStreamEvent = { Records: [] };
      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockConsoleLog).toHaveBeenCalledWith('Processing 0 DynamoDB stream records');
      expect(mockAuditLogger.logBatch).not.toHaveBeenCalled();
    });

    it('should skip records without DynamoDB data', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            // Missing dynamodb field
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          } as any,
        ],
      };

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Skipping record without DynamoDB data:',
        expect.any(Object)
      );
      expect(mockAuditLogger.logBatch).not.toHaveBeenCalled();
    });

    it('should handle parsing errors gracefully', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'INVALID_KEY' } },
              SequenceNumber: '123456789',
              SizeBytes: 128,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      // Mock parser to return null for invalid record
      mockStreamParser.parseStreamRecord.mockReturnValue({
        resourceType: null,
        resourceId: null,
        eventType: null,
        action: null,
      });

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockAuditLogger.logBatch).not.toHaveBeenCalled();
    });

    it('should handle audit logger errors and rethrow', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#test_flag' }, SK: { S: 'METADATA' } },
              SequenceNumber: '123456789',
              SizeBytes: 128,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      const logError = new Error('CloudWatch logging failed');
      mockAuditLogger.logBatch.mockRejectedValue(logError);

      const context = createMockContext();

      await expect(handler(mockEvent, context)).rejects.toThrow('CloudWatch logging failed');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Error processing DynamoDB stream records:', logError);
      expect(mockAuditLogger.logError).toHaveBeenCalledWith({
        error: 'CloudWatch logging failed',
        event: 'stream_processing_error',
        recordCount: 1,
        requestId: 'test-request-id-123',
      });
    });
  });

  describe('Record Processing', () => {
    it('should process multiple records in batch', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#flag1' }, SK: { S: 'METADATA' } },
              NewImage: { flagKey: { S: 'flag1' }, defaultEnabled: { BOOL: true } },
              SequenceNumber: '123456789',
              SizeBytes: 64,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
          {
            eventID: 'event-2',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995260,
              Keys: { PK: { S: 'FLAG#flag2' }, SK: { S: 'METADATA' } },
              NewImage: { flagKey: { S: 'flag2' }, defaultEnabled: { BOOL: false } },
              OldImage: { flagKey: { S: 'flag2' }, defaultEnabled: { BOOL: true } },
              SequenceNumber: '123456790',
              SizeBytes: 72,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      mockStreamParser.parseStreamRecord
        .mockReturnValueOnce({
          resourceType: 'feature_flag',
          resourceId: 'flag1',
          eventType: 'flag_created',
          action: 'CREATE',
        })
        .mockReturnValueOnce({
          resourceType: 'feature_flag',
          resourceId: 'flag2',
          eventType: 'flag_updated',
          action: 'UPDATE',
        });

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockConsoleLog).toHaveBeenCalledWith('Processing 2 DynamoDB stream records');
      expect(mockAuditLogger.logBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ eventType: 'flag_created', resourceId: 'flag1' }),
        expect.objectContaining({ eventType: 'flag_updated', resourceId: 'flag2' }),
      ]));
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully logged 2 audit entries');
    });

    it('should handle mixed valid and invalid records', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          // Valid record
          {
            eventID: 'event-1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#valid_flag' } },
              SequenceNumber: '123456789',
              SizeBytes: 64,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
          // Invalid record (no dynamodb)
          {
            eventID: 'event-2',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          } as any,
        ],
      };

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Skipping record without DynamoDB data:',
        expect.any(Object)
      );
      expect(mockAuditLogger.logBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ resourceType: 'feature_flag' }),
      ]));
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully logged 1 audit entries');
    });
  });

  describe('Utility Functions', () => {
    it('should process records with tenant override data', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'TENANT#tenant-123' }, SK: { S: 'FLAG#test_flag' } },
              NewImage: {
                PK: { S: 'TENANT#tenant-123' },
                SK: { S: 'FLAG#test_flag' },
                enabled: { BOOL: true },
                tenantId: { S: 'tenant-123' },
                flagKey: { S: 'test_flag' },
              },
              SequenceNumber: '123456789',
              SizeBytes: 96,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/TenantOverrides/stream',
          },
        ],
      };

      mockStreamParser.parseStreamRecord.mockReturnValue({
        resourceType: 'tenant_override',
        resourceId: 'tenant-123#test_flag',
        eventType: 'tenant_override_set',
        action: 'CREATE',
      });

      const context = createMockContext();

      await handler(mockEvent, context);

      expect(mockAuditLogger.logBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          eventType: 'tenant_override_set',
          resourceType: 'tenant_override',
          actor: expect.objectContaining({
            type: 'system',
            id: 'dynamodb-streams',
          }),
        }),
      ]));
    });

    it('should handle unknown error types gracefully', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#test_flag' } },
              SequenceNumber: '123456789',
              SizeBytes: 64,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      // Mock error that is not an Error instance
      mockAuditLogger.logBatch.mockRejectedValue('Unknown error string');

      const context = createMockContext();

      await expect(handler(mockEvent, context)).rejects.toThrow('Unknown error string');
      
      expect(mockAuditLogger.logError).toHaveBeenCalledWith({
        error: 'Unknown error',
        event: 'stream_processing_error',
        recordCount: 1,
        requestId: 'test-request-id-123',
      });
    });
  });

  describe('Environment Integration', () => {
    it('should handle environment variables correctly', async () => {
      const mockEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'event-1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'ap-northeast-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: { PK: { S: 'FLAG#prod_flag' } },
              SequenceNumber: '123456789',
              SizeBytes: 64,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/FeatureFlags/stream',
          },
        ],
      };

      const context = createMockContext();

      await handler(mockEvent, context);

      // Test that environment variables are used from module load time
      // In test environment, these default to 'dev' and '1.0.0'
      expect(mockAuditLogger.logBatch).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({
            version: '1.0.0', // Default value used at module load
            environment: 'dev', // Default value used at module load
            service: 'feature-flag-audit-service',
            region: 'ap-northeast-1',
          }),
          metadata: expect.objectContaining({
            environment: 'dev', // Default value used at module load
          }),
        }),
      ]));
    });
  });
});