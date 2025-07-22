import { vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { 
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
  ResourceAlreadyExistsException
} from '@aws-sdk/client-cloudwatch-logs';
import { AuditLogEntry, AuditEventType, ResourceType } from '../../src/types';

/**
 * Mock Factory for Audit Service Testing
 * 
 * t-wada TDD原則に基づくCloudWatch統合テスト用モック生成ファクトリー
 * AWS SDK Client Mock統合による高品質テスト実現
 */

// CloudWatch Logs Client Mock
export const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);

// Reset all mocks
export const resetAllMocks = () => {
  cloudWatchLogsMock.reset();
  vi.clearAllMocks();
};

// CloudWatch Mock Response Factories
export class CloudWatchMockFactory {
  
  static successfulLogGroupCreation() {
    cloudWatchLogsMock.on(CreateLogGroupCommand).resolves({
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static logGroupAlreadyExists() {
    const error = new Error('The specified log group already exists');
    error.name = 'ResourceAlreadyExistsException';
    (error as any).$metadata = { httpStatusCode: 400 };
    cloudWatchLogsMock.on(CreateLogGroupCommand).rejects(error);
  }
  
  static successfulLogStreamCreation() {
    cloudWatchLogsMock.on(CreateLogStreamCommand).resolves({
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static logStreamAlreadyExists() {
    const error = new Error('The specified log stream already exists');
    error.name = 'ResourceAlreadyExistsException';
    (error as any).$metadata = { httpStatusCode: 400 };
    cloudWatchLogsMock.on(CreateLogStreamCommand).rejects(error);
  }
  
  static describeLogStreamsEmpty() {
    cloudWatchLogsMock.on(DescribeLogStreamsCommand).resolves({
      logStreams: [],
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static describeLogStreamsExisting(sequenceToken?: string) {
    cloudWatchLogsMock.on(DescribeLogStreamsCommand).resolves({
      logStreams: [{
        logStreamName: 'test-log-stream',
        creationTime: Date.now(),
        uploadSequenceToken: sequenceToken,
        arn: 'arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/feature-flag-audit-test:log-stream:test-log-stream',
        storedBytes: 1024
      }],
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static successfulPutLogEvents(nextSequenceToken: string = 'next-token-123') {
    cloudWatchLogsMock.on(PutLogEventsCommand).resolves({
      nextSequenceToken,
      rejectedLogEvents: [],
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static putLogEventsWithRejected(rejectedEvents: any[] = []) {
    cloudWatchLogsMock.on(PutLogEventsCommand).resolves({
      nextSequenceToken: 'next-token-456',
      rejectedLogEvents: rejectedEvents,
      $metadata: { httpStatusCode: 200, requestId: 'test-request-id' }
    });
  }
  
  static putLogEventsFailure(error: string = 'CloudWatch Logs service error') {
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(new Error(error));
  }
  
  static throttledPutLogEvents() {
    const error = new Error('ThrottlingException');
    error.name = 'ThrottlingException';
    (error as any).$metadata = { httpStatusCode: 429 };
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(error);
  }
  
  static invalidSequenceToken() {
    const error = new Error('InvalidSequenceTokenException');
    error.name = 'InvalidSequenceTokenException';
    (error as any).expectedSequenceToken = 'expected-token-789';
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(error);
  }
}

// Standard test data factories
export const createTestAuditEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'test-audit-id-123',
  timestamp: '2025-07-22T10:00:00.000Z',
  eventType: 'flag_created',
  resourceType: 'feature_flag',
  resourceId: 'billing_v2_enable',
  action: 'CREATE',
  actor: {
    type: 'user',
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com'
  },
  changes: {
    after: {
      flagKey: 'billing_v2_enable',
      description: 'Billing v2 feature flag',
      defaultEnabled: true,
      owner: 'test-user'
    }
  },
  metadata: {
    correlationId: 'test-correlation-123',
    requestId: 'test-request-123',
    tenantId: 'tenant-123',
    flagKey: 'billing_v2_enable',
    environment: 'test'
  },
  source: {
    service: 'feature-flag-audit-service',
    version: '1.0.0-test',
    region: 'ap-northeast-1',
    environment: 'test'
  },
  ...overrides
});

// DynamoDB Stream test data factories
export const DynamoDBStreamFactory = {
  
  flagCreated: (flagKey: string = 'billing_v2_enable') => ({
    eventName: 'INSERT' as const,
    Keys: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' }
    },
    NewImage: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' },
      flagKey: { S: flagKey },
      description: { S: `${flagKey} feature flag` },
      defaultEnabled: { BOOL: true },
      owner: { S: 'test-user' },
      createdAt: { S: '2025-07-22T10:00:00.000Z' }
    }
  }),
  
  flagUpdated: (flagKey: string = 'billing_v2_enable') => ({
    eventName: 'MODIFY' as const,
    Keys: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' }
    },
    OldImage: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' },
      flagKey: { S: flagKey },
      description: { S: `Old ${flagKey} description` },
      defaultEnabled: { BOOL: false },
      owner: { S: 'old-user' },
      createdAt: { S: '2025-07-21T10:00:00.000Z' }
    },
    NewImage: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' },
      flagKey: { S: flagKey },
      description: { S: `Updated ${flagKey} description` },
      defaultEnabled: { BOOL: true },
      owner: { S: 'new-user' },
      createdAt: { S: '2025-07-21T10:00:00.000Z' },
      updatedAt: { S: '2025-07-22T10:00:00.000Z' }
    }
  }),
  
  flagDeleted: (flagKey: string = 'billing_v2_enable') => ({
    eventName: 'REMOVE' as const,
    Keys: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' }
    },
    OldImage: {
      PK: { S: `FLAG#${flagKey}` },
      SK: { S: 'METADATA' },
      flagKey: { S: flagKey },
      description: { S: `${flagKey} feature flag` },
      defaultEnabled: { BOOL: false },
      owner: { S: 'test-user' },
      createdAt: { S: '2025-07-22T09:00:00.000Z' }
    }
  }),
  
  tenantOverrideSet: (tenantId: string = 'tenant-123', flagKey: string = 'billing_v2_enable') => ({
    eventName: 'INSERT' as const,
    Keys: {
      PK: { S: `TENANT#${tenantId}` },
      SK: { S: `FLAG#${flagKey}` }
    },
    NewImage: {
      PK: { S: `TENANT#${tenantId}` },
      SK: { S: `FLAG#${flagKey}` },
      tenantId: { S: tenantId },
      flagKey: { S: flagKey },
      enabled: { BOOL: true },
      reason: { S: 'Testing override' },
      createdAt: { S: '2025-07-22T10:00:00.000Z' }
    }
  }),
  
  killSwitchActivated: (flagKey: string = 'billing_v2_enable') => ({
    eventName: 'MODIFY' as const,
    Keys: {
      PK: { S: 'EMERGENCY' },
      SK: { S: `FLAG#${flagKey}` }
    },
    OldImage: {
      PK: { S: 'EMERGENCY' },
      SK: { S: `FLAG#${flagKey}` },
      flagKey: { S: flagKey },
      enabled: { BOOL: false },
      reason: { S: 'Previous state' },
      updatedAt: { S: '2025-07-22T09:00:00.000Z' }
    },
    NewImage: {
      PK: { S: 'EMERGENCY' },
      SK: { S: `FLAG#${flagKey}` },
      flagKey: { S: flagKey },
      enabled: { BOOL: true },
      reason: { S: 'Emergency activated' },
      updatedAt: { S: '2025-07-22T10:00:00.000Z' }
    }
  }),
  
  unknownEvent: () => ({
    eventName: 'MODIFY' as const,
    Keys: {
      PK: { S: 'UNKNOWN#resource' },
      SK: { S: 'UNKNOWN' }
    },
    NewImage: {
      PK: { S: 'UNKNOWN#resource' },
      SK: { S: 'UNKNOWN' },
      someField: { S: 'some value' }
    }
  })
};

// Error simulation factories
export const ErrorSimulator = {
  
  cloudWatchServiceDown: () => {
    const error = new Error('Service temporarily unavailable');
    error.name = 'ServiceUnavailableException';
    (error as any).$metadata = { httpStatusCode: 503 };
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(error);
  },
  
  invalidLogGroupName: () => {
    const error = new Error('Invalid log group name');
    error.name = 'InvalidParameterException';
    (error as any).$metadata = { httpStatusCode: 400 };
    cloudWatchLogsMock.on(CreateLogGroupCommand).rejects(error);
  },
  
  insufficientPermissions: () => {
    const error = new Error('User is not authorized to perform logs:PutLogEvents');
    error.name = 'AccessDeniedException';
    (error as any).$metadata = { httpStatusCode: 403 };
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(error);
  },
  
  networkTimeout: () => {
    const error = new Error('Request timeout');
    error.name = 'TimeoutError';
    (error as any).code = 'TimeoutError';
    cloudWatchLogsMock.on(PutLogEventsCommand).rejects(error);
  }
};

// Performance testing utilities
export const PerformanceTestData = {
  
  largeBatch: (count: number = 100) => {
    return Array.from({ length: count }, (_, i) => createTestAuditEntry({
      id: `perf-test-${i}`,
      resourceId: `flag-${i}`,
      timestamp: new Date(Date.now() + i * 1000).toISOString()
    }));
  },
  
  complexAuditEntry: () => createTestAuditEntry({
    changes: {
      before: {
        flagKey: 'complex-flag',
        description: 'Complex feature with many properties',
        defaultEnabled: false,
        owner: 'old-owner',
        tags: ['tag1', 'tag2'],
        configuration: {
          rolloutPercentage: 0,
          targetAudience: ['beta-users'],
          schedule: {
            startDate: '2025-01-01',
            endDate: '2025-12-31'
          }
        }
      },
      after: {
        flagKey: 'complex-flag',
        description: 'Updated complex feature with enhanced properties',
        defaultEnabled: true,
        owner: 'new-owner',
        tags: ['tag1', 'tag2', 'tag3'],
        configuration: {
          rolloutPercentage: 50,
          targetAudience: ['beta-users', 'premium-users'],
          schedule: {
            startDate: '2025-01-01',
            endDate: '2025-12-31'
          },
          additionalSettings: {
            maxConcurrentUsers: 1000,
            geographicRestrictions: ['US', 'EU']
          }
        }
      },
      fields: ['description', 'defaultEnabled', 'owner', 'tags', 'configuration.rolloutPercentage', 'configuration.targetAudience', 'configuration.additionalSettings']
    },
    metadata: {
      correlationId: 'complex-correlation-id',
      requestId: 'complex-request-id',
      userAgent: 'Mozilla/5.0 (compatible; audit-test)',
      ipAddress: '192.168.1.100',
      tenantId: 'enterprise-tenant-001',
      flagKey: 'complex-flag',
      environment: 'production',
      reason: 'Scheduled rollout phase 2'
    }
  })
};