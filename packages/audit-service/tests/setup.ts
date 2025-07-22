import { vi } from 'vitest';

/**
 * Audit Service Test Setup Configuration
 * 
 * t-wada TDD原則に基づくCloudWatch統合テスト環境構築
 * - AWS SDK Mock設定
 * - CloudWatch Logs Mock設定
 * - DynamoDB Streams Mock設定
 * - テスト用環境変数設定
 * - Performance測定ユーティリティ
 */

// Mock AWS SDK clients globally
vi.mock('@aws-sdk/client-cloudwatch-logs');
vi.mock('@aws-sdk/client-dynamodb');

// Set up environment variables for testing
process.env.AUDIT_LOG_GROUP_NAME = '/aws/lambda/feature-flag-audit-test';
process.env.AWS_REGION = 'ap-northeast-1';
process.env.SERVICE_VERSION = '1.0.0-test';
process.env.ENVIRONMENT = 'test';

// Console methods mock（テスト出力をクリーンに保つ）
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

// Performance testing utility
export const measurePerformance = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

// CloudWatch Logs response factory
export const createCloudWatchResponse = (options: {
  success?: boolean;
  nextSequenceToken?: string;
  error?: Error;
  logStreams?: any[];
} = {}) => {
  const { success = true, nextSequenceToken, error, logStreams = [] } = options;
  
  if (error) {
    return Promise.reject(error);
  }
  
  if (success) {
    return Promise.resolve({
      nextSequenceToken,
      logStreams,
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id'
      }
    });
  }
  
  return Promise.reject(new Error('CloudWatch operation failed'));
};

// DynamoDB Stream event factory
export const createDynamoDBStreamEvent = (eventName: 'INSERT' | 'MODIFY' | 'REMOVE', overrides: any = {}) => ({
  Records: [{
    eventID: 'test-event-id',
    eventName,
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'ap-northeast-1',
    dynamodb: {
      ApproximateCreationDateTime: Math.floor(Date.now() / 1000),
      SequenceNumber: '123456789',
      SizeBytes: 100,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      Keys: {
        PK: { S: 'FLAG#billing_v2_enable' },
        SK: { S: 'METADATA' }
      },
      NewImage: eventName !== 'REMOVE' ? {
        PK: { S: 'FLAG#billing_v2_enable' },
        SK: { S: 'METADATA' },
        flagKey: { S: 'billing_v2_enable' },
        description: { S: 'Billing v2 feature flag' },
        defaultEnabled: { BOOL: true },
        owner: { S: 'test-user' },
        createdAt: { S: new Date().toISOString() }
      } : undefined,
      OldImage: eventName !== 'INSERT' ? {
        PK: { S: 'FLAG#billing_v2_enable' },
        SK: { S: 'METADATA' },
        flagKey: { S: 'billing_v2_enable' },
        description: { S: 'Old Billing v2 feature flag' },
        defaultEnabled: { BOOL: false },
        owner: { S: 'old-user' },
        createdAt: { S: new Date(Date.now() - 86400000).toISOString() }
      } : undefined,
      ...overrides
    }
  }]
});

// Lambda context factory
export const createLambdaContext = (overrides: any = {}) => ({
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'feature-flag-audit-streams-processor',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:feature-flag-audit-streams-processor',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id-' + Math.random().toString(36).substr(2, 9),
  logGroupName: '/aws/lambda/feature-flag-audit-streams-processor',
  logStreamName: '2025/07/22/[$LATEST]test-stream',
  remainingTimeInMillis: () => 5000,
  getRemainingTimeInMillis: () => 5000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  ...overrides
});

// Audit log entry validation helper
export const validateAuditLogEntry = (entry: any) => {
  expect(entry).toHaveProperty('id');
  expect(entry).toHaveProperty('timestamp');
  expect(entry).toHaveProperty('eventType');
  expect(entry).toHaveProperty('resourceType');
  expect(entry).toHaveProperty('resourceId');
  expect(entry).toHaveProperty('action');
  expect(entry).toHaveProperty('actor');
  expect(entry).toHaveProperty('changes');
  expect(entry).toHaveProperty('metadata');
  expect(entry).toHaveProperty('source');
  
  expect(typeof entry.id).toBe('string');
  expect(typeof entry.timestamp).toBe('string');
  expect(typeof entry.resourceId).toBe('string');
  expect(typeof entry.actor).toBe('object');
  expect(typeof entry.changes).toBe('object');
  expect(typeof entry.metadata).toBe('object');
  expect(typeof entry.source).toBe('object');
};

// Generate load test data
export const generateAuditLogEntries = (count: number = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `audit_test_${i}_${Date.now()}`,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    eventType: ['flag_created', 'flag_updated', 'flag_deleted'][i % 3] as any,
    resourceType: 'feature_flag' as any,
    resourceId: `test_flag_${i}`,
    action: ['CREATE', 'UPDATE', 'DELETE'][i % 3] as any,
    actor: {
      type: 'system' as const,
      id: `test_actor_${i}`,
      name: `Test Actor ${i}`
    },
    changes: {
      before: i > 0 ? { enabled: false } : undefined,
      after: { enabled: i % 2 === 0 }
    },
    metadata: {
      correlationId: `test_correlation_${i}`,
      tenantId: `tenant_${i % 3}`,
      flagKey: `test_flag_${i}` as any,
      environment: 'test'
    },
    source: {
      service: 'feature-flag-audit-service',
      version: '1.0.0-test',
      region: 'ap-northeast-1',
      environment: 'test'
    }
  }));
};