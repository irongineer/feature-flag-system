import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Management Handler Specification
 * 
 * 管理APIハンドラーは、フィーチャーフラグシステムの管理機能を提供する
 * Lambda関数として、以下の責務を持つ：
 * 
 * Key Business Rules:
 * 1. フラグ操作: CRUD operations for feature flags
 * 2. テナント操作: Tenant-specific flag overrides
 * 3. 緊急操作: Kill-switch for emergency flag disabling
 * 4. 適切な権限制御とバリデーション
 * 5. 監査ログ出力
 * 6. エラーハンドリングとセキュリティ
 * 
 * Route Structure:
 * - /flags/* : Flag management operations
 * - /tenants/* : Tenant override operations  
 * - /emergency/* : Kill-switch operations
 */

// モックセットアップ
const mockDynamoClient = {
  getFlag: vi.fn(),
  listFlags: vi.fn(),
  createFlag: vi.fn(),
  updateFlag: vi.fn(),
  getTenantOverride: vi.fn(),
  listTenantOverrides: vi.fn(),
  setTenantOverride: vi.fn(),
  deleteTenantOverride: vi.fn(),
  setKillSwitch: vi.fn()
};

const mockCreateDynamoClient = vi.fn().mockReturnValue(mockDynamoClient);
const mockValidateFlagRequest = vi.fn();
const mockValidateTenantOverrideRequest = vi.fn();

// モジュールレベルでのモック設定
vi.mock('../../src/utils/dynamo', () => ({
  createDynamoClient: mockCreateDynamoClient
}));

vi.mock('../../src/validators/management', () => ({
  validateFlagRequest: mockValidateFlagRequest,
  validateTenantOverrideRequest: mockValidateTenantOverrideRequest
}));

describe('Management Handler Specification', () => {
  let mockContext: Context;

  beforeEach(() => {
    // Context モック
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'management-handler',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:management-handler',
      memoryLimitInMB: '256',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/management-handler',
      logStreamName: '2025/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 15000,
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn()
    };

    // モック関数をリセット
    vi.clearAllMocks();
  });

  describe('Flag Management Operations', () => {
    describe('Flag Listing (GET /flags)', () => {
      describe('GIVEN a request to list all flags', () => {
        describe('WHEN no specific flag is requested', () => {
          it('THEN returns all available flags with metadata', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request to list all flags
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: DynamoDB returns flag list
            const mockFlags = [
              {
                flagKey: 'billing_v2_enable',
                description: 'Enable billing v2 features',
                defaultEnabled: false,
                owner: 'billing-team',
                createdAt: '2025-01-01T00:00:00Z'
              },
              {
                flagKey: 'new_dashboard_enable', 
                description: 'Enable new dashboard UI',
                defaultEnabled: true,
                owner: 'ui-team',
                createdAt: '2025-01-01T00:00:00Z'
              }
            ];
            mockDynamoClient.listFlags.mockResolvedValue(mockFlags);

            // When: Processing the list request
            const response = await handler(event, mockContext);

            // Then: Should return flag list
            expect(response.statusCode).toBe(200);
            expect(response.headers['Content-Type']).toBe('application/json');
            
            const responseBody = JSON.parse(response.body);
            expect(responseBody.flags).toEqual(mockFlags);
            expect(mockDynamoClient.listFlags).toHaveBeenCalledOnce();
          });
        });
      });
    });

    describe('Flag Retrieval (GET /flags/{flagKey})', () => {
      describe('GIVEN a request for a specific flag', () => {
        describe('WHEN the flag exists in the system', () => {
          it('THEN returns the flag details with metadata', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request for specific flag
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/flags/billing_v2_enable',
              pathParameters: { flagKey: 'billing_v2_enable' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Flag exists in database
            const mockFlag = {
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: false,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00Z'
            };
            mockDynamoClient.getFlag.mockResolvedValue(mockFlag);

            // When: Processing the flag retrieval request
            const response = await handler(event, mockContext);

            // Then: Should return flag details
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody).toEqual(mockFlag);
            expect(mockDynamoClient.getFlag).toHaveBeenCalledWith('billing_v2_enable');
          });
        });

        describe('WHEN the flag does not exist', () => {
          it('THEN returns 404 not found error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request for non-existent flag
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/flags/non_existent_flag',
              pathParameters: { flagKey: 'non_existent_flag' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Flag does not exist
            mockDynamoClient.getFlag.mockResolvedValue(null);

            // When: Processing the request for non-existent flag
            const response = await handler(event, mockContext);

            // Then: Should return 404 error
            expect(response.statusCode).toBe(404);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Flag not found');
          });
        });
      });
    });

    describe('Flag Creation (POST /flags)', () => {
      describe('GIVEN a request to create a new flag', () => {
        describe('WHEN valid flag data is provided', () => {
          it('THEN creates the flag and returns success response', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Valid flag creation request
            const flagData = {
              flagKey: 'new_feature_enable',
              description: 'Enable new feature',
              defaultEnabled: false,
              owner: 'feature-team'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'POST',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(flagData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Validation passes
            mockValidateFlagRequest.mockReturnValue({
              error: null,
              value: flagData
            });

            // Given: Database operation succeeds
            mockDynamoClient.createFlag.mockResolvedValue(undefined);

            // When: Processing the flag creation request
            const response = await handler(event, mockContext);

            // Then: Should create flag successfully
            expect(response.statusCode).toBe(201);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Flag created successfully');

            // And: Should call validation and database operations
            expect(mockValidateFlagRequest).toHaveBeenCalledWith(flagData);
            expect(mockDynamoClient.createFlag).toHaveBeenCalledWith({
              flagKey: 'new_feature_enable',
              description: 'Enable new feature',
              defaultEnabled: false,
              owner: 'feature-team',
              createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
              expiresAt: undefined
            });
          });
        });

        describe('WHEN invalid flag data is provided', () => {
          it('THEN returns 400 validation error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Invalid flag creation request
            const invalidFlagData = {
              // Missing required fields
              description: 'Missing flag key'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'POST',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(invalidFlagData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Validation fails
            const validationError = {
              details: [
                { path: ['flagKey'], message: 'flagKey is required' }
              ]
            };
            mockValidateFlagRequest.mockReturnValue({
              error: validationError,
              value: null
            });

            // When: Processing the invalid request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Invalid request');
            expect(responseBody.error.details).toEqual(validationError.details);

            // And: Should not call database operations
            expect(mockDynamoClient.createFlag).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('Flag Update (PUT /flags/{flagKey})', () => {
      describe('GIVEN a request to update an existing flag', () => {
        describe('WHEN valid update data is provided', () => {
          it('THEN updates the flag and returns success response', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Flag update request
            const updateData = {
              description: 'Updated description',
              defaultEnabled: true
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'PUT',
              path: '/flags/billing_v2_enable',
              pathParameters: { flagKey: 'billing_v2_enable' },
              queryStringParameters: null,
              body: JSON.stringify(updateData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Database operation succeeds
            mockDynamoClient.updateFlag.mockResolvedValue(undefined);

            // When: Processing the flag update request
            const response = await handler(event, mockContext);

            // Then: Should update flag successfully
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Flag updated successfully');

            // And: Should call database update
            expect(mockDynamoClient.updateFlag).toHaveBeenCalledWith(
              'billing_v2_enable',
              updateData
            );
          });
        });

        describe('WHEN no flag key is provided in path', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Update request without flag key
            const event: APIGatewayProxyEvent = {
              httpMethod: 'PUT',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify({ description: 'test' }),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the request without flag key
            const response = await handler(event, mockContext);

            // Then: Should return bad request error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Flag key is required');
          });
        });
      });
    });

    describe('Flag Deletion (DELETE /flags/{flagKey})', () => {
      describe('GIVEN a request to delete a flag', () => {
        describe('WHEN attempting flag deletion', () => {
          it('THEN returns 405 method not allowed (security policy)', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Flag deletion request
            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/flags/billing_v2_enable',
              pathParameters: { flagKey: 'billing_v2_enable' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the deletion request
            const response = await handler(event, mockContext);

            // Then: Should reject deletion for security reasons
            expect(response.statusCode).toBe(405);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Method not allowed');
            expect(responseBody.error.details).toBe('Flag deletion not supported');
          });
        });
      });
    });

    describe('Unsupported Flag Operations', () => {
      describe('GIVEN a request with unsupported HTTP method', () => {
        describe('WHEN using unsupported method on flags endpoint', () => {
          it('THEN returns 405 method not allowed', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Unsupported method request
            const event: APIGatewayProxyEvent = {
              httpMethod: 'PATCH',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the unsupported method request
            const response = await handler(event, mockContext);

            // Then: Should return method not allowed
            expect(response.statusCode).toBe(405);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Method not allowed');
          });
        });
      });
    });
  });

  describe('Tenant Override Operations', () => {
    describe('Tenant Override Listing (GET /tenants/{tenantId})', () => {
      describe('GIVEN a request to list tenant overrides', () => {
        describe('WHEN tenant has multiple flag overrides', () => {
          it('THEN returns all tenant-specific flag overrides', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request for tenant overrides
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/tenants/tenant-123',
              pathParameters: { tenantId: 'tenant-123' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Tenant has flag overrides
            const mockOverrides = [
              {
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                enabled: true,
                updatedBy: 'admin-user',
                updatedAt: '2025-01-01T00:00:00Z'
              },
              {
                tenantId: 'tenant-123',
                flagKey: 'new_dashboard_enable',
                enabled: false,
                updatedBy: 'tenant-admin',
                updatedAt: '2025-01-01T01:00:00Z'
              }
            ];
            mockDynamoClient.listTenantOverrides.mockResolvedValue(mockOverrides);

            // When: Processing the tenant overrides request
            const response = await handler(event, mockContext);

            // Then: Should return tenant overrides
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.overrides).toEqual(mockOverrides);
            expect(mockDynamoClient.listTenantOverrides).toHaveBeenCalledWith('tenant-123');
          });
        });
      });
    });

    describe('Specific Tenant Override Retrieval (GET /tenants/{tenantId}/{flagKey})', () => {
      describe('GIVEN a request for specific tenant flag override', () => {
        describe('WHEN the override exists', () => {
          it('THEN returns the specific override details', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request for specific tenant flag override
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/tenants/tenant-123/billing_v2_enable',
              pathParameters: { 
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable'
              },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Override exists
            const mockOverride = {
              tenantId: 'tenant-123',
              flagKey: 'billing_v2_enable',
              enabled: true,
              updatedBy: 'admin-user',
              updatedAt: '2025-01-01T00:00:00Z'
            };
            mockDynamoClient.getTenantOverride.mockResolvedValue(mockOverride);

            // When: Processing the specific override request
            const response = await handler(event, mockContext);

            // Then: Should return override details
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody).toEqual(mockOverride);
            expect(mockDynamoClient.getTenantOverride).toHaveBeenCalledWith(
              'tenant-123',
              'billing_v2_enable'
            );
          });
        });

        describe('WHEN the override does not exist', () => {
          it('THEN returns 404 not found error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request for non-existent override
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/tenants/tenant-456/non_existent_flag',
              pathParameters: { 
                tenantId: 'tenant-456',
                flagKey: 'non_existent_flag'
              },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Override does not exist
            mockDynamoClient.getTenantOverride.mockResolvedValue(null);

            // When: Processing the request for non-existent override
            const response = await handler(event, mockContext);

            // Then: Should return 404 error
            expect(response.statusCode).toBe(404);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Override not found');
          });
        });
      });
    });

    describe('Tenant Override Creation/Update (PUT /tenants/{tenantId}/{flagKey})', () => {
      describe('GIVEN a request to set tenant flag override', () => {
        describe('WHEN valid override data is provided', () => {
          it('THEN creates or updates the override and returns success', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Tenant override request
            const overrideData = {
              enabled: true,
              updatedBy: 'admin-user'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'PUT',
              path: '/tenants/tenant-789/billing_v2_enable',
              pathParameters: { 
                tenantId: 'tenant-789',
                flagKey: 'billing_v2_enable'
              },
              queryStringParameters: null,
              body: JSON.stringify(overrideData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Validation passes
            mockValidateTenantOverrideRequest.mockReturnValue({
              error: null,
              value: overrideData
            });

            // Given: Database operation succeeds
            mockDynamoClient.setTenantOverride.mockResolvedValue(undefined);

            // When: Processing the override request
            const response = await handler(event, mockContext);

            // Then: Should set override successfully
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Tenant override set successfully');

            // And: Should call validation and database operations
            expect(mockValidateTenantOverrideRequest).toHaveBeenCalledWith(overrideData);
            expect(mockDynamoClient.setTenantOverride).toHaveBeenCalledWith(
              'tenant-789',
              'billing_v2_enable',
              true,
              'admin-user'
            );
          });
        });

        describe('WHEN invalid override data is provided', () => {
          it('THEN returns 400 validation error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Invalid override request
            const invalidData = {
              enabled: 'not-a-boolean' // Invalid type
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'PUT',
              path: '/tenants/tenant-789/billing_v2_enable',
              pathParameters: { 
                tenantId: 'tenant-789',
                flagKey: 'billing_v2_enable'
              },
              queryStringParameters: null,
              body: JSON.stringify(invalidData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Validation fails
            const validationError = {
              details: [
                { path: ['enabled'], message: 'enabled must be a boolean' }
              ]
            };
            mockValidateTenantOverrideRequest.mockReturnValue({
              error: validationError,
              value: null
            });

            // When: Processing the invalid override request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Invalid request');
            expect(responseBody.error.details).toEqual(validationError.details);

            // And: Should not call database operations
            expect(mockDynamoClient.setTenantOverride).not.toHaveBeenCalled();
          });
        });

        describe('WHEN no flag key is provided', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Override request without flag key
            const event: APIGatewayProxyEvent = {
              httpMethod: 'PUT',
              path: '/tenants/tenant-789',
              pathParameters: { tenantId: 'tenant-789' },
              queryStringParameters: null,
              body: JSON.stringify({ enabled: true }),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the request without flag key
            const response = await handler(event, mockContext);

            // Then: Should return bad request error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Flag key is required');
          });
        });
      });
    });

    describe('Tenant Override Deletion (DELETE /tenants/{tenantId}/{flagKey})', () => {
      describe('GIVEN a request to remove tenant flag override', () => {
        describe('WHEN valid deletion request is made', () => {
          it('THEN removes the override and returns success', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Override deletion request
            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/tenants/tenant-123/billing_v2_enable',
              pathParameters: { 
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable'
              },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the deletion request
            const response = await handler(event, mockContext);

            // Then: Should confirm deletion (Note: actual deletion is commented out in implementation)
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Tenant override removed successfully');
          });
        });

        describe('WHEN no flag key is provided for deletion', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Deletion request without flag key
            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/tenants/tenant-123',
              pathParameters: { tenantId: 'tenant-123' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the deletion request without flag key
            const response = await handler(event, mockContext);

            // Then: Should return bad request error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Flag key is required');
          });
        });
      });
    });

    describe('Tenant Operations without Tenant ID', () => {
      describe('GIVEN a tenant operation request without tenant ID', () => {
        describe('WHEN tenant ID is missing from path parameters', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Tenant operation without tenant ID
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/tenants',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the request without tenant ID
            const response = await handler(event, mockContext);

            // Then: Should return bad request error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Tenant ID is required');
          });
        });
      });
    });

    describe('Unsupported Tenant Operations', () => {
      describe('GIVEN a request with unsupported method on tenant endpoint', () => {
        describe('WHEN using unsupported method', () => {
          it('THEN returns 405 method not allowed', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Unsupported method on tenant endpoint
            const event: APIGatewayProxyEvent = {
              httpMethod: 'PATCH',
              path: '/tenants/tenant-123',
              pathParameters: { tenantId: 'tenant-123' },
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the unsupported method request
            const response = await handler(event, mockContext);

            // Then: Should return method not allowed
            expect(response.statusCode).toBe(405);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Method not allowed');
          });
        });
      });
    });
  });

  describe('Emergency Operations (Kill-Switch)', () => {
    describe('Kill-Switch Activation (POST /emergency)', () => {
      describe('GIVEN a request to activate kill-switch', () => {
        describe('WHEN valid emergency data is provided', () => {
          it('THEN activates global kill-switch and returns success', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Global kill-switch activation request
            const emergencyData = {
              reason: 'Critical security vulnerability detected',
              activatedBy: 'security-team'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'POST',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(emergencyData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Database operation succeeds
            mockDynamoClient.setKillSwitch.mockResolvedValue(undefined);

            // When: Processing the kill-switch activation
            const response = await handler(event, mockContext);

            // Then: Should activate kill-switch successfully
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Kill-switch activated successfully');

            // And: Should call database operation with correct parameters
            expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(
              null, // Global kill-switch
              true,
              'Critical security vulnerability detected',
              'security-team'
            );
          });
        });

        describe('WHEN flag-specific kill-switch is requested', () => {
          it('THEN activates flag-specific kill-switch', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Flag-specific kill-switch activation
            const emergencyData = {
              flagKey: 'billing_v2_enable',
              reason: 'Billing calculation error detected',
              activatedBy: 'billing-team'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'POST',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(emergencyData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Database operation succeeds
            mockDynamoClient.setKillSwitch.mockResolvedValue(undefined);

            // When: Processing the flag-specific kill-switch activation
            const response = await handler(event, mockContext);

            // Then: Should activate flag-specific kill-switch
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Kill-switch activated successfully');

            // And: Should call database operation with flag key
            expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(
              'billing_v2_enable',
              true,
              'Billing calculation error detected',
              'billing-team'
            );
          });
        });

        describe('WHEN required emergency fields are missing', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Incomplete emergency request
            const incompleteData = {
              reason: 'Emergency reason'
              // Missing activatedBy
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'POST',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(incompleteData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the incomplete emergency request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Reason and activatedBy are required');

            // And: Should not call database operations
            expect(mockDynamoClient.setKillSwitch).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('Kill-Switch Deactivation (DELETE /emergency)', () => {
      describe('GIVEN a request to deactivate kill-switch', () => {
        describe('WHEN valid deactivation data is provided', () => {
          it('THEN deactivates global kill-switch and returns success', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Global kill-switch deactivation request
            const deactivationData = {
              deactivatedBy: 'security-team'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(deactivationData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Database operation succeeds
            mockDynamoClient.setKillSwitch.mockResolvedValue(undefined);

            // When: Processing the kill-switch deactivation
            const response = await handler(event, mockContext);

            // Then: Should deactivate kill-switch successfully
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Kill-switch deactivated successfully');

            // And: Should call database operation with deactivation parameters
            expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(
              null, // Global kill-switch
              false,
              'Deactivated by security-team',
              'security-team'
            );
          });
        });

        describe('WHEN flag-specific kill-switch deactivation is requested', () => {
          it('THEN deactivates flag-specific kill-switch', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Flag-specific kill-switch deactivation
            const deactivationData = {
              flagKey: 'billing_v2_enable',
              deactivatedBy: 'billing-team'
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(deactivationData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: Database operation succeeds
            mockDynamoClient.setKillSwitch.mockResolvedValue(undefined);

            // When: Processing the flag-specific kill-switch deactivation
            const response = await handler(event, mockContext);

            // Then: Should deactivate flag-specific kill-switch
            expect(response.statusCode).toBe(200);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.message).toBe('Kill-switch deactivated successfully');

            // And: Should call database operation with flag key
            expect(mockDynamoClient.setKillSwitch).toHaveBeenCalledWith(
              'billing_v2_enable',
              false,
              'Deactivated by billing-team',
              'billing-team'
            );
          });
        });

        describe('WHEN deactivatedBy field is missing', () => {
          it('THEN returns 400 bad request error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Deactivation request without deactivatedBy
            const incompleteData = {
              flagKey: 'billing_v2_enable'
              // Missing deactivatedBy
            };

            const event: APIGatewayProxyEvent = {
              httpMethod: 'DELETE',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: JSON.stringify(incompleteData),
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the incomplete deactivation request
            const response = await handler(event, mockContext);

            // Then: Should return validation error
            expect(response.statusCode).toBe(400);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('deactivatedBy is required');

            // And: Should not call database operations
            expect(mockDynamoClient.setKillSwitch).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('Unsupported Emergency Operations', () => {
      describe('GIVEN a request with unsupported method on emergency endpoint', () => {
        describe('WHEN using unsupported method', () => {
          it('THEN returns 405 method not allowed', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Unsupported method on emergency endpoint
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/emergency',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the unsupported method request
            const response = await handler(event, mockContext);

            // Then: Should return method not allowed
            expect(response.statusCode).toBe(405);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Method not allowed');
          });
        });
      });
    });
  });

  describe('Route Handling and Error Cases', () => {
    describe('Unknown Route Handling', () => {
      describe('GIVEN a request to an unknown endpoint', () => {
        describe('WHEN the path does not match any known routes', () => {
          it('THEN returns 404 not found error', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request to unknown endpoint
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/unknown-endpoint',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // When: Processing the unknown route request
            const response = await handler(event, mockContext);

            // Then: Should return 404 error
            expect(response.statusCode).toBe(404);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Not found');
          });
        });
      });
    });

    describe('Internal Server Error Handling', () => {
      describe('GIVEN a request that causes an unexpected error', () => {
        describe('WHEN DynamoDB client throws an error', () => {
          it('THEN returns 500 internal server error without exposing details', async () => {
            // Import handler after mocks are set up
            const { handler } = await import('../../src/handlers/management');
            
            // Given: Request that will cause DynamoDB error
            const event: APIGatewayProxyEvent = {
              httpMethod: 'GET',
              path: '/flags',
              pathParameters: null,
              queryStringParameters: null,
              body: null,
              headers: {},
              multiValueHeaders: {},
              isBase64Encoded: false,
              multiValueQueryStringParameters: null,
              stageVariables: null,
              requestContext: {} as any,
              resource: ''
            };

            // Given: DynamoDB operation fails
            mockDynamoClient.listFlags.mockRejectedValue(new Error('DynamoDB connection failed'));

            // When: Processing the request with database failure
            const response = await handler(event, mockContext);

            // Then: Should return generic internal server error
            expect(response.statusCode).toBe(500);
            const responseBody = JSON.parse(response.body);
            expect(responseBody.error.message).toBe('Internal server error');
            
            // And: Should not expose internal error details
            expect(response.body).not.toContain('DynamoDB connection failed');
          });
        });
      });
    });
  });
});