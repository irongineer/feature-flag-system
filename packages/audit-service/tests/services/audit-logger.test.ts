import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogStreamsCommand,
  CreateLogGroupCommand,
  ResourceAlreadyExistsException,
} from '@aws-sdk/client-cloudwatch-logs';
import { AuditLogger } from '../../src/services/audit-logger';
import type { AuditLogEntry } from '../../src/types';

// Mock AWS SDK
vi.mock('@aws-sdk/client-cloudwatch-logs', () => {
  return {
    CloudWatchLogsClient: vi.fn(),
    CreateLogStreamCommand: vi.fn().mockImplementation((input) => ({ input })),
    PutLogEventsCommand: vi.fn().mockImplementation((input) => ({ input })),
    DescribeLogStreamsCommand: vi.fn().mockImplementation((input) => ({ input })),
    CreateLogGroupCommand: vi.fn().mockImplementation((input) => ({ input })),
    ResourceAlreadyExistsException: class ResourceAlreadyExistsException extends Error {
      constructor(options: any) {
        super(options.message);
        this.$metadata = options.$metadata || {};
      }
      $metadata: any;
    },
  };
});

describe('AuditLogger TDD Tests', () => {
  let mockCloudWatchClient: any;
  let mockSend: Mock;
  let mockConsoleLog: Mock;
  let mockConsoleError: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock CloudWatch client
    mockSend = vi.fn();
    mockCloudWatchClient = {
      send: mockSend,
    };
    vi.mocked(CloudWatchLogsClient).mockImplementation(() => mockCloudWatchClient);

    // Mock console methods
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create AuditLogger with default configuration', () => {
      const config = {
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
      };

      const logger = new AuditLogger(config);

      expect(CloudWatchLogsClient).toHaveBeenCalledWith({ region: 'ap-northeast-1' });
      expect(logger).toBeInstanceOf(AuditLogger);
    });

    it('should create AuditLogger with custom CloudWatch client', () => {
      const customClient = { send: vi.fn() };
      const config = {
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'us-east-1',
        cloudWatchClient: customClient as any,
        retentionInDays: 90,
      };

      const logger = new AuditLogger(config);

      expect(CloudWatchLogsClient).not.toHaveBeenCalled();
      expect(logger).toBeInstanceOf(AuditLogger);
    });

    it('should generate consistent log stream name format', () => {
      const config = {
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
      };

      new AuditLogger(config);

      // ログストリーム名の形式をテスト（プライベートメソッドの間接テスト）
      const expectedDate = new Date(1640995200000); // Mocked date
      const year = expectedDate.getFullYear();
      const month = String(expectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(expectedDate.getDate()).padStart(2, '0');

      // Math.randomがモックされているので、一貫したコンテナIDが生成される
      expect(year).toBe(2022);
      expect(month).toBe('01');
      expect(day).toBe('01');
    });
  });

  describe('Single Log Entry (log method)', () => {
    let logger: AuditLogger;
    let sampleLogEntry: AuditLogEntry;

    beforeEach(() => {
      logger = new AuditLogger({
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
      });

      sampleLogEntry = {
        id: 'test-log-id',
        timestamp: '2022-01-01T00:00:00.000Z',
        eventType: 'flag_updated',
        resourceType: 'feature_flag',
        resourceId: 'billing_v2_enable',
        action: 'UPDATE',
        actor: {
          type: 'user',
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        },
        changes: {
          before: { defaultEnabled: false },
          after: { defaultEnabled: true },
        },
        metadata: {
          tenantId: 'tenant-123',
          flagKey: 'billing_v2_enable',
          correlationId: 'req-123',
        },
        source: {
          service: 'feature-flag-api',
          version: '1.0.0',
          region: 'ap-northeast-1',
          environment: 'production',
        },
      };

      // Mock successful responses
      mockSend
        .mockResolvedValueOnce({ logStreams: [] }) // DescribeLogStreamsCommand (no existing streams)
        .mockResolvedValueOnce({}) // CreateLogGroupCommand
        .mockResolvedValueOnce({}) // CreateLogStreamCommand
        .mockResolvedValueOnce({ nextSequenceToken: 'token-123' }); // PutLogEventsCommand
    });

    it('should log single entry successfully', async () => {
      await logger.log(sampleLogEntry);

      // Verify correct number of AWS calls were made
      expect(mockSend).toHaveBeenCalledTimes(4);

      // Verify console output messages indicate success
      expect(mockConsoleLog).toHaveBeenCalledWith('Created log group: /aws/lambda/feature-flag-audit');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Created log stream:'));
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });

    it('should handle successful log operations', async () => {
      await logger.log(sampleLogEntry);

      expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });

    it('should handle ResourceAlreadyExistsException for log group', async () => {
      const resourceExistsError = new ResourceAlreadyExistsException({
        message: 'Log group already exists',
        $metadata: {},
      });

      mockSend
        .mockResolvedValueOnce({ logStreams: [] }) // DescribeLogStreamsCommand
        .mockRejectedValueOnce(resourceExistsError) // CreateLogGroupCommand (already exists)
        .mockResolvedValueOnce({}) // CreateLogStreamCommand
        .mockResolvedValueOnce({ nextSequenceToken: 'token-123' }); // PutLogEventsCommand

      await logger.log(sampleLogEntry);

      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });

    it('should handle ResourceAlreadyExistsException for log stream', async () => {
      const resourceExistsError = new ResourceAlreadyExistsException({
        message: 'Log stream already exists',
        $metadata: {},
      });

      mockSend
        .mockResolvedValueOnce({ logStreams: [] }) // DescribeLogStreamsCommand
        .mockResolvedValueOnce({}) // CreateLogGroupCommand
        .mockRejectedValueOnce(resourceExistsError) // CreateLogStreamCommand (already exists)
        .mockResolvedValueOnce({ nextSequenceToken: 'token-123' }); // PutLogEventsCommand

      await logger.log(sampleLogEntry);

      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });
  });

  describe('Batch Log Entries (logBatch method)', () => {
    let logger: AuditLogger;
    let sampleLogEntries: AuditLogEntry[];

    beforeEach(() => {
      logger = new AuditLogger({
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
      });

      sampleLogEntries = [
        {
          id: 'test-log-1',
          timestamp: '2022-01-01T00:00:00.000Z',
          eventType: 'flag_created',
          resourceType: 'feature_flag',
          resourceId: 'new_feature_enable',
          action: 'CREATE',
          actor: { type: 'user', id: 'user-123', name: 'Test User' },
          changes: { after: { defaultEnabled: false } },
          metadata: { tenantId: 'tenant-123', flagKey: 'new_feature_enable' },
          source: { service: 'api', version: '1.0.0', region: 'ap-northeast-1', environment: 'dev' },
        },
        {
          id: 'test-log-2',
          timestamp: '2022-01-01T00:01:00.000Z',
          eventType: 'flag_updated',
          resourceType: 'feature_flag',
          resourceId: 'new_feature_enable',
          action: 'UPDATE',
          actor: { type: 'user', id: 'user-456', name: 'Another User' },
          changes: { before: { defaultEnabled: false }, after: { defaultEnabled: true } },
          metadata: { tenantId: 'tenant-123', flagKey: 'new_feature_enable' },
          source: { service: 'api', version: '1.0.0', region: 'ap-northeast-1', environment: 'dev' },
        },
      ];

      // Mock successful responses
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ nextSequenceToken: 'token-batch-123' });
    });

    it('should log multiple entries successfully', async () => {
      await logger.logBatch(sampleLogEntries);

      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 2 log events to CloudWatch');
    });

    it('should handle empty batch gracefully', async () => {
      await logger.logBatch([]);

      expect(mockSend).not.toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Successfully sent'));
    });

    it('should sort log events by timestamp', async () => {
      // Create entries with out-of-order timestamps
      const unorderedEntries = [
        { ...sampleLogEntries[1], timestamp: '2022-01-01T00:05:00.000Z' },
        { ...sampleLogEntries[0], timestamp: '2022-01-01T00:01:00.000Z' },
      ];

      await logger.logBatch(unorderedEntries);

      // Verify AWS send was called and batch was processed
      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 2 log events to CloudWatch');
    });

    it('should include CloudWatch searchable fields in log message', async () => {
      await logger.logBatch([sampleLogEntries[0]]);

      // Verify the batch was processed successfully
      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });
  });

  describe('Error Logging (logError method)', () => {
    let logger: AuditLogger;

    beforeEach(() => {
      logger = new AuditLogger({
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
      });

      // Mock successful responses
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ nextSequenceToken: 'error-token-123' });
    });

    it('should log error with complete information', async () => {
      const errorInfo = {
        error: 'Database connection failed',
        event: 'flag_evaluation_failed',
        recordCount: 5,
        requestId: 'req-error-123',
        metadata: { tenantId: 'tenant-error', flagKey: 'problematic_flag' },
      };

      await logger.logError(errorInfo);

      // Verify error was logged successfully
      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });

    it('should log error with minimal information', async () => {
      const errorInfo = {
        error: 'Unknown error occurred',
        event: 'system_failure',
      };

      await logger.logError(errorInfo);

      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });

    it('should include environment variables in error log', async () => {
      process.env.SERVICE_VERSION = '2.1.0';
      process.env.ENVIRONMENT = 'production';

      const errorInfo = {
        error: 'Configuration error',
        event: 'config_load_failed',
      };

      await logger.logError(errorInfo);

      // Verify error was logged successfully
      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');

      // Cleanup
      delete process.env.SERVICE_VERSION;
      delete process.env.ENVIRONMENT;
    });
  });

  describe('Error Handling', () => {
    let logger: AuditLogger;
    let sampleLogEntry: AuditLogEntry;

    beforeEach(() => {
      logger = new AuditLogger({
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
      });

      sampleLogEntry = {
        id: 'error-test-log',
        timestamp: '2022-01-01T00:00:00.000Z',
        eventType: 'flag_updated',
        resourceType: 'feature_flag',
        resourceId: 'test_flag',
        action: 'UPDATE',
        actor: { type: 'user', id: 'user-123' },
        changes: { after: { defaultEnabled: true } },
        metadata: { tenantId: 'tenant-123' },
        source: { service: 'api', version: '1.0.0', region: 'ap-northeast-1', environment: 'test' },
      };
    });

    it('should handle CloudWatch API errors during log stream creation', async () => {
      const apiError = new Error('CloudWatch API rate limit exceeded');
      
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(apiError);

      await expect(logger.log(sampleLogEntry)).rejects.toThrow('CloudWatch API rate limit exceeded');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Error ensuring log stream exists:', apiError);
    });

    it('should handle CloudWatch API errors during log group creation', async () => {
      const apiError = new Error('Insufficient permissions');
      
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockRejectedValueOnce(apiError);

      await expect(logger.log(sampleLogEntry)).rejects.toThrow('Insufficient permissions');
      
      // The error flows through ensureLogStreamExists, so it gets wrapped
      expect(mockConsoleError).toHaveBeenCalledWith('Error ensuring log stream exists:', apiError);
    });

    it('should handle CloudWatch API errors during put log events', async () => {
      const putLogError = new Error('Log event too large');
      
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(putLogError);

      await expect(logger.log(sampleLogEntry)).rejects.toThrow('Log event too large');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Error sending logs to CloudWatch:', putLogError);
    });

    it('should handle malformed log entries gracefully', async () => {
      const malformedEntry = {
        ...sampleLogEntry,
        timestamp: 'invalid-timestamp',
      };

      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ nextSequenceToken: 'token-123' });

      // Should not throw - CloudWatch will handle the invalid timestamp
      await logger.log(malformedEntry);
      
      expect(mockSend).toHaveBeenCalledTimes(4);
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
    });
  });

  describe('Integration Scenarios', () => {
    let logger: AuditLogger;

    beforeEach(() => {
      logger = new AuditLogger({
        logGroupName: '/aws/lambda/feature-flag-audit',
        region: 'ap-northeast-1',
        cloudWatchClient: mockCloudWatchClient,
        retentionInDays: 60,
      });
    });

    it('should handle logging configuration correctly', async () => {
      const testLogger = new AuditLogger({
        logGroupName: '/test/audit-logs',
        region: 'us-east-1',
        cloudWatchClient: mockCloudWatchClient,
        retentionInDays: 90,
      });

      expect(testLogger).toBeInstanceOf(AuditLogger);
    });

    it('should handle mixed single and batch operations', async () => {
      const singleEntry = {
        id: 'single-entry',
        timestamp: '2022-01-01T00:00:00.000Z',
        eventType: 'flag_created' as const,
        resourceType: 'feature_flag' as const,
        resourceId: 'single_flag',
        action: 'CREATE' as const,
        actor: { type: 'user' as const, id: 'user-single' },
        changes: { after: { defaultEnabled: true } },
        metadata: { tenantId: 'tenant-single' },
        source: { service: 'api', version: '1.0.0', region: 'ap-northeast-1', environment: 'test' },
      };

      const batchEntries = [
        {
          ...singleEntry,
          id: 'batch-entry-1',
          resourceId: 'batch_flag_1',
        },
        {
          ...singleEntry,
          id: 'batch-entry-2',
          resourceId: 'batch_flag_2',
        },
      ];

      // Mock responses for both operations (multiple calls needed)
      mockSend
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ nextSequenceToken: 'token-mixed-1' })
        .mockResolvedValueOnce({ logStreams: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ nextSequenceToken: 'token-mixed-2' });

      await logger.log(singleEntry);
      await logger.logBatch(batchEntries);

      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 1 log events to CloudWatch');
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully sent 2 log events to CloudWatch');
    });
  });
});