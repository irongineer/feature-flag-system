import { vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

/**
 * Audit Service Testing Setup
 * 
 * CloudWatch統合テスト用の基本環境設定
 * DynamoDBストリーム・Lambda・AWS SDK v3のモック準備
 */

// CloudWatch Logs Client Mock
export const cloudWatchLogsMock = mockClient(CloudWatchLogsClient);

// Reset function for tests
export const resetAllMocks = () => {
  cloudWatchLogsMock.reset();
  vi.clearAllMocks();
};

// AWS Lambda Context Mock
export const createMockLambdaContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'audit-service-test',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:audit-service-test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/audit-service-test',
  logStreamName: '2025/07/23/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn(),
});

// DynamoDB Stream Event Mock Factory
export const createMockStreamEvent = () => ({
  Records: [
    {
      eventID: 'test-event-id',
      eventName: 'INSERT',
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'ap-northeast-1',
      dynamodb: {
        Keys: {
          PK: { S: 'FLAG#test_flag' },
          SK: { S: 'METADATA' }
        },
        NewImage: {
          PK: { S: 'FLAG#test_flag' },
          SK: { S: 'METADATA' },
          flagKey: { S: 'test_flag' },
          description: { S: 'Test flag for audit' },
          defaultEnabled: { BOOL: true },
          owner: { S: 'test-user' },
          createdAt: { S: '2025-07-23T12:00:00.000Z' }
        },
        SequenceNumber: '123456789',
        SizeBytes: 256,
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      }
    }
  ]
});

// Console output control
if (process.env.NODE_ENV === 'test') {
  const originalConsole = console;
  global.console = {
    ...originalConsole,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}