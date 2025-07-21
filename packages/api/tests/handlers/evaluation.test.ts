import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Feature Flag Evaluation Handler Specification
 * 
 * フィーチャーフラグ評価APIハンドラーは、Lambda環境でフィーチャーフラグの
 * 評価リクエストを受け取り、適切なレスポンスを返す責務を持つ。
 * 
 * Key Business Rules:
 * 1. tenantIdとflagKeyは必須パラメータ
 * 2. 評価結果にはメタデータ（評価時刻、TTL、ソース）を含む
 * 3. エラー時は適切なHTTPステータスコードを返す
 * 4. CORS対応のヘッダーを設定する
 * 5. JSON形式での入出力
 * 6. 内部エラーの詳細は隠蔽する
 */

// モックセットアップ
const mockEvaluator = {
  isEnabled: vi.fn()
};

const mockDynamoDbClient = vi.fn();

// モジュールレベルでのモック設定
vi.mock('@feature-flag/core', () => ({
  FeatureFlagEvaluator: vi.fn().mockImplementation(() => mockEvaluator),
  DynamoDbClient: mockDynamoDbClient.mockImplementation(() => ({}))
}));

describe('Feature Flag Evaluation Handler Specification', () => {
  let mockContext: Context;

  beforeEach(() => {
    // Context モック
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'evaluation-handler',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:evaluation-handler',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/evaluation-handler',
      logStreamName: '2025/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 5000,
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn()
    };

    // モック関数をリセット
    vi.clearAllMocks();
  });

  describe('Successful Flag Evaluation', () => {
    describe('GIVEN a valid evaluation request with required parameters', () => {
      describe('WHEN the flag is enabled for the tenant', () => {
        it('THEN returns enabled flag evaluation response with metadata', async () => {
          // Import handler after mocks are set up
          const { handler } = await import('../../src/handlers/evaluation');
          
          // Given: Valid request with required tenantId and flagKey
          const event: APIGatewayProxyEvent = {
            body: JSON.stringify({
              tenantId: 'tenant-123',
              flagKey: 'billing_v2_enable'
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/evaluate',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ''
          };

          // Given: Flag is enabled for this tenant
          mockEvaluator.isEnabled.mockResolvedValue(true);

          // When: Processing the evaluation request
          const response = await handler(event, mockContext);

          // Debug: Log response if not 200
          if (response.statusCode !== 200) {
            console.log('Debug - Response:', response);
          }

          // Then: Should return success response with flag enabled
          expect(response.statusCode).toBe(200);
          expect(response.headers['Content-Type']).toBe('application/json');
          expect(response.headers['Access-Control-Allow-Origin']).toBe('*');

          const responseBody = JSON.parse(response.body);
          expect(responseBody).toMatchObject({
            enabled: true,
            flagKey: 'billing_v2_enable',
            tenantId: 'tenant-123',
            source: 'database',
            ttl: 300
          });
          expect(responseBody.evaluatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
      });

      describe('WHEN the flag is disabled for the tenant', () => {
        it('THEN returns disabled flag evaluation response', async () => {
          // Import handler after mocks are set up
          const { handler } = await import('../../src/handlers/evaluation');
          
          // Given: Valid request
          const event: APIGatewayProxyEvent = {
            body: JSON.stringify({
              tenantId: 'tenant-456',
              flagKey: 'new_dashboard_enable'
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/evaluate',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ''
          };

          // Given: Flag is disabled for this tenant
          mockEvaluator.isEnabled.mockResolvedValue(false);

          // When: Processing the evaluation request
          const response = await handler(event, mockContext);

          // Then: Should return success response with flag disabled
          expect(response.statusCode).toBe(200);
          const responseBody = JSON.parse(response.body);
          expect(responseBody.enabled).toBe(false);
          expect(responseBody.flagKey).toBe('new_dashboard_enable');
          expect(responseBody.tenantId).toBe('tenant-456');
        });
      });
    });

    describe('GIVEN a request with optional parameters', () => {
      describe('WHEN userId, environment, and metadata are provided', () => {
        it('THEN processes all parameters correctly', async () => {
          // Import handler after mocks are set up
          const { handler } = await import('../../src/handlers/evaluation');
          
          // Given: Request with all optional parameters
          const event: APIGatewayProxyEvent = {
            body: JSON.stringify({
              tenantId: 'tenant-789',
              flagKey: 'advanced_analytics_enable',
              userId: 'user-456',
              environment: 'production',
              metadata: {
                region: 'us-east-1',
                userTier: 'premium'
              }
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/evaluate',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ''
          };

          // Given: Flag evaluation succeeds
          mockEvaluator.isEnabled.mockResolvedValue(true);

          // When: Processing the request with optional parameters
          const response = await handler(event, mockContext);

          // Then: Should process successfully
          expect(response.statusCode).toBe(200);
          expect(mockEvaluator.isEnabled).toHaveBeenCalledWith('tenant-789', 'advanced_analytics_enable');
        });
      });
    });
  });

  describe('Request Validation and Error Handling', () => {
    describe('Missing Required Parameters', () => {
      describe('GIVEN a request without tenantId', () => {
        describe('WHEN processing the evaluation request', () => {
          it('THEN returns 400 Bad Request with validation error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Request missing required tenantId
            const event: APIGatewayProxyEvent = {
              body: JSON.stringify({
                flagKey: 'billing_v2_enable'
              }),
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the invalid request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            expect(response.headers['Content-Type']).toBe('application/json');
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('tenantId and flagKey are required');
          });
        });
      });

      describe('GIVEN a request without flagKey', () => {
        describe('WHEN processing the evaluation request', () => {
          it('THEN returns 400 Bad Request with validation error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Request missing required flagKey
            const event: APIGatewayProxyEvent = {
              body: JSON.stringify({
                tenantId: 'tenant-123'
              }),
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the invalid request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('tenantId and flagKey are required');
          });
        });
      });

      describe('GIVEN a request with both parameters missing', () => {
        describe('WHEN processing the evaluation request', () => {
          it('THEN returns 400 Bad Request with validation error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Request missing both required parameters
            const event: APIGatewayProxyEvent = {
              body: JSON.stringify({}),
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the empty request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('tenantId and flagKey are required');
          });
        });
      });
    });

    describe('Malformed Request Body', () => {
      describe('GIVEN a request with invalid JSON', () => {
        describe('WHEN processing the malformed request', () => {
          it('THEN returns 500 Internal Server Error with generic error message', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Request with invalid JSON body
            const event: APIGatewayProxyEvent = {
              body: '{invalid json}',
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the malformed request
            const response = await handler(event, mockContext);

            // Then: Should return internal server error (security: don't expose parsing details)
            expect(response.statusCode).toBe(500);
            expect(response.headers['Content-Type']).toBe('application/json');
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Internal server error');
          });
        });
      });

      describe('GIVEN a request with null body', () => {
        describe('WHEN processing the request', () => {
          it('THEN treats as empty object and validates parameters', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Request with null body
            const event: APIGatewayProxyEvent = {
              body: null,
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the null body request
            const response = await handler(event, mockContext);

            // Then: Should return validation error for missing parameters
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('tenantId and flagKey are required');
          });
        });
      });
    });

    describe('Evaluator Service Errors', () => {
      describe('GIVEN a valid request but evaluator throws an error', () => {
        describe('WHEN the evaluation service fails', () => {
          it('THEN returns 500 Internal Server Error without exposing internal details', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/evaluation');
            
            // Given: Valid request
            const event: APIGatewayProxyEvent = {
              body: JSON.stringify({
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable'
              }),
              headers: {},
              multiValueHeaders: {},
              httpMethod: 'POST',
              isBase64Encoded: false,
              path: '/evaluate',
              pathParameters: null,
              queryStringParameters: null,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Evaluator service fails
            mockEvaluator.isEnabled.mockRejectedValue(new Error('DynamoDB connection failed'));

            // When: Processing request with service failure
            const response = await handler(event, mockContext);

            // Then: Should return generic internal server error
            expect(response.statusCode).toBe(500);
            expect(response.headers['Content-Type']).toBe('application/json');
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error).toBe('Internal server error');
          });
        });
      });
    });
  });

  describe('Response Format and Headers', () => {
    describe('GIVEN any successful evaluation', () => {
      describe('WHEN generating the response', () => {
        it('THEN includes proper CORS headers for cross-origin access', async () => {
          // Import handler after mocks are set up
          const { handler } = await import('../../src/handlers/evaluation');
          
          // Given: Valid request
          const event: APIGatewayProxyEvent = {
            body: JSON.stringify({
              tenantId: 'tenant-123',
              flagKey: 'billing_v2_enable'
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/evaluate',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ''
          };

          mockEvaluator.isEnabled.mockResolvedValue(true);

          // When: Processing the request
          const response = await handler(event, mockContext);

          // Then: Should include CORS headers
          expect(response.headers).toMatchObject({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
        });

        it('THEN returns response with required fields and proper types', async () => {
          // Import handler after mocks are set up
          const { handler } = await import('../../src/handlers/evaluation');
          
          // Given: Valid request
          const event: APIGatewayProxyEvent = {
            body: JSON.stringify({
              tenantId: 'tenant-123',
              flagKey: 'billing_v2_enable'
            }),
            headers: {},
            multiValueHeaders: {},
            httpMethod: 'POST',
            isBase64Encoded: false,
            path: '/evaluate',
            pathParameters: null,
            queryStringParameters: null,
            multiValueQueryStringParameters: null,
            stageVariables: null,
            requestContext: {} as any,
            resource: ''
          };

          mockEvaluator.isEnabled.mockResolvedValue(false);

          // When: Processing the request
          const response = await handler(event, mockContext);

          // Then: Should return response with all required fields
          const responseBody = JSON.parse(response.body);
          
          expect(typeof responseBody.enabled).toBe('boolean');
          expect(typeof responseBody.flagKey).toBe('string');
          expect(typeof responseBody.tenantId).toBe('string');
          expect(typeof responseBody.evaluatedAt).toBe('string');
          expect(typeof responseBody.source).toBe('string');
          expect(typeof responseBody.ttl).toBe('number');
          
          expect(responseBody.source).toBe('database');
          expect(responseBody.ttl).toBe(300);
        });
      });
    });
  });
});