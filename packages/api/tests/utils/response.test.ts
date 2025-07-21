import { describe, it, expect } from 'vitest';
import { createResponse, createErrorResponse, createSuccessResponse } from '../../src/utils/response';

/**
 * API Response Utilities Specification
 * 
 * APIレスポンス生成ユーティリティは、統一されたレスポンス形式と
 * 適切なHTTPヘッダーを提供する責務を持つ。
 * 
 * Key Responsibilities:
 * 1. 統一されたJSONレスポンス形式
 * 2. CORS対応ヘッダーの自動設定
 * 3. エラーレスポンスの標準化
 * 4. 成功レスポンスの標準化
 * 5. カスタムヘッダーのサポート
 * 6. 適切なHTTPステータスコード設定
 */
describe('API Response Utilities Specification', () => {

  describe('Generic Response Creation', () => {
    describe('GIVEN a request to create a standard API response', () => {
      describe('WHEN using createResponse with basic parameters', () => {
        it('THEN returns properly formatted Lambda proxy response with CORS headers', () => {
          // Given: Basic response parameters
          const statusCode = 200;
          const body = { message: 'Success' };

          // When: Creating a standard response
          const response = createResponse(statusCode, body);

          // Then: Should return properly formatted response
          expect(response.statusCode).toBe(200);
          expect(response.body).toBe(JSON.stringify(body));
          
          // And: Should include default CORS headers
          expect(response.headers).toMatchObject({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });
        });

        it('THEN handles various HTTP status codes correctly', () => {
          // Given: Different status codes
          const testCases = [
            { statusCode: 200, description: 'success' },
            { statusCode: 201, description: 'created' },
            { statusCode: 400, description: 'bad request' },
            { statusCode: 401, description: 'unauthorized' },
            { statusCode: 404, description: 'not found' },
            { statusCode: 500, description: 'internal server error' }
          ];

          testCases.forEach(({ statusCode, description }) => {
            // When: Creating response with specific status code
            const response = createResponse(statusCode, { message: description });

            // Then: Should preserve the status code
            expect(response.statusCode).toBe(statusCode);
            expect(JSON.parse(response.body).message).toBe(description);
          });
        });

        it('THEN handles complex response bodies correctly', () => {
          // Given: Complex response body with nested objects
          const complexBody = {
            user: {
              id: 'user-123',
              name: 'John Doe',
              settings: {
                theme: 'dark',
                notifications: true
              }
            },
            flags: ['billing_v2_enable', 'new_dashboard_enable'],
            metadata: {
              timestamp: '2025-01-01T00:00:00Z',
              version: '1.0.0'
            }
          };

          // When: Creating response with complex body
          const response = createResponse(200, complexBody);

          // Then: Should properly serialize complex object
          expect(response.body).toBe(JSON.stringify(complexBody));
          expect(JSON.parse(response.body)).toEqual(complexBody);
        });
      });

      describe('WHEN using createResponse with custom headers', () => {
        it('THEN merges custom headers with default CORS headers', () => {
          // Given: Custom headers to merge
          const customHeaders = {
            'X-Custom-Header': 'custom-value',
            'Cache-Control': 'no-cache'
          };

          // When: Creating response with custom headers
          const response = createResponse(200, { message: 'test' }, customHeaders);

          // Then: Should include both default and custom headers
          expect(response.headers).toMatchObject({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'X-Custom-Header': 'custom-value',
            'Cache-Control': 'no-cache'
          });
        });

        it('THEN allows custom headers to override default headers', () => {
          // Given: Custom headers that override defaults
          const overrideHeaders = {
            'Content-Type': 'application/xml',
            'Access-Control-Allow-Origin': 'https://example.com'
          };

          // When: Creating response with override headers
          const response = createResponse(200, { message: 'test' }, overrideHeaders);

          // Then: Should use custom header values
          expect(response.headers['Content-Type']).toBe('application/xml');
          expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com');
        });
      });
    });
  });

  describe('Error Response Creation', () => {
    describe('GIVEN a request to create an error response', () => {
      describe('WHEN using createErrorResponse with basic error information', () => {
        it('THEN returns standardized error response format', () => {
          // Given: Basic error information
          const statusCode = 400;
          const message = 'Invalid request parameters';

          // When: Creating error response
          const response = createErrorResponse(statusCode, message);

          // Then: Should return standardized error format
          expect(response.statusCode).toBe(400);
          
          const responseBody = JSON.parse(response.body);
          expect(responseBody.error.message).toBe('Invalid request parameters');
          expect(responseBody.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          expect(responseBody.error.details).toBeUndefined();
        });

        it('THEN includes CORS headers in error responses', () => {
          // Given: Error response parameters
          const statusCode = 500;
          const message = 'Internal server error';

          // When: Creating error response
          const response = createErrorResponse(statusCode, message);

          // Then: Should include CORS headers
          expect(response.headers).toMatchObject({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });
        });
      });

      describe('WHEN using createErrorResponse with detailed error information', () => {
        it('THEN includes error details in the response', () => {
          // Given: Detailed error information
          const statusCode = 422;
          const message = 'Validation failed';
          const details = {
            field: 'tenantId',
            code: 'REQUIRED',
            description: 'tenantId is required'
          };

          // When: Creating detailed error response
          const response = createErrorResponse(statusCode, message, details);

          // Then: Should include error details
          const responseBody = JSON.parse(response.body);
          expect(responseBody.error.message).toBe('Validation failed');
          expect(responseBody.error.details).toEqual(details);
          expect(responseBody.error.timestamp).toBeDefined();
        });

        it('THEN handles various error status codes correctly', () => {
          // Given: Different error scenarios
          const errorCases = [
            { statusCode: 400, message: 'Bad Request' },
            { statusCode: 401, message: 'Unauthorized' },
            { statusCode: 403, message: 'Forbidden' },
            { statusCode: 404, message: 'Not Found' },
            { statusCode: 409, message: 'Conflict' },
            { statusCode: 422, message: 'Unprocessable Entity' },
            { statusCode: 500, message: 'Internal Server Error' },
            { statusCode: 503, message: 'Service Unavailable' }
          ];

          errorCases.forEach(({ statusCode, message }) => {
            // When: Creating error response for each case
            const response = createErrorResponse(statusCode, message);

            // Then: Should preserve status code and message
            expect(response.statusCode).toBe(statusCode);
            expect(JSON.parse(response.body).error.message).toBe(message);
          });
        });
      });

      describe('WHEN handling complex error details', () => {
        it('THEN properly serializes nested error objects', () => {
          // Given: Complex nested error details
          const complexDetails = {
            validationErrors: [
              { field: 'tenantId', message: 'Required field' },
              { field: 'flagKey', message: 'Invalid flag key' }
            ],
            context: {
              requestId: 'req-123',
              userId: 'user-456'
            },
            suggestions: ['Check required fields', 'Verify flag key exists']
          };

          // When: Creating error response with complex details
          const response = createErrorResponse(422, 'Multiple validation errors', complexDetails);

          // Then: Should properly serialize complex details
          const responseBody = JSON.parse(response.body);
          expect(responseBody.error.details).toEqual(complexDetails);
        });
      });
    });
  });

  describe('Success Response Creation', () => {
    describe('GIVEN a request to create a success response', () => {
      describe('WHEN using createSuccessResponse with data', () => {
        it('THEN returns standardized success response format', () => {
          // Given: Success data
          const data = {
            flagKey: 'billing_v2_enable',
            enabled: true,
            tenantId: 'tenant-123'
          };

          // When: Creating success response
          const response = createSuccessResponse(data);

          // Then: Should return standardized success format
          expect(response.statusCode).toBe(200);
          
          const responseBody = JSON.parse(response.body);
          expect(responseBody.success).toBe(true);
          expect(responseBody.data).toEqual(data);
          expect(responseBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('THEN includes CORS headers in success responses', () => {
          // Given: Success data
          const data = { result: 'ok' };

          // When: Creating success response
          const response = createSuccessResponse(data);

          // Then: Should include CORS headers
          expect(response.headers).toMatchObject({
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          });
        });
      });

      describe('WHEN handling various data types', () => {
        it('THEN properly handles string data', () => {
          // Given: String data
          const stringData = 'Simple success message';

          // When: Creating success response
          const response = createSuccessResponse(stringData);

          // Then: Should wrap string in standard format
          const responseBody = JSON.parse(response.body);
          expect(responseBody.data).toBe(stringData);
          expect(responseBody.success).toBe(true);
        });

        it('THEN properly handles array data', () => {
          // Given: Array data
          const arrayData = [
            { flagKey: 'billing_v2_enable', enabled: true },
            { flagKey: 'new_dashboard_enable', enabled: false }
          ];

          // When: Creating success response
          const response = createSuccessResponse(arrayData);

          // Then: Should preserve array structure
          const responseBody = JSON.parse(response.body);
          expect(responseBody.data).toEqual(arrayData);
          expect(Array.isArray(responseBody.data)).toBe(true);
        });

        it('THEN properly handles null and undefined data', () => {
          // Given: Edge case data values
          const testCases = [null, undefined, 0, false, ''];

          testCases.forEach(testData => {
            // When: Creating success response with edge case data
            const response = createSuccessResponse(testData);

            // Then: Should handle edge cases properly
            const responseBody = JSON.parse(response.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data).toBe(testData);
          });
        });
      });
    });
  });

  describe('Response Consistency and Standards', () => {
    describe('GIVEN multiple response creation functions', () => {
      describe('WHEN comparing response structures', () => {
        it('THEN all functions produce consistent header structure', () => {
          // Given: Responses from different functions
          const genericResponse = createResponse(200, { message: 'test' });
          const errorResponse = createErrorResponse(400, 'test error');
          const successResponse = createSuccessResponse({ data: 'test' });

          // When: Examining header consistency
          const responses = [genericResponse, errorResponse, successResponse];

          // Then: Should have consistent CORS headers
          responses.forEach(response => {
            expect(response.headers['Content-Type']).toBe('application/json');
            expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
            expect(response.headers['Access-Control-Allow-Methods']).toBeDefined();
            expect(response.headers['Access-Control-Allow-Headers']).toBeDefined();
          });
        });

        it('THEN all functions produce valid JSON response bodies', () => {
          // Given: Various response types
          const responses = [
            createResponse(200, { message: 'test' }),
            createErrorResponse(400, 'test error'),
            createSuccessResponse({ data: 'test' })
          ];

          // When: Parsing response bodies
          responses.forEach(response => {
            // Then: Should produce valid JSON
            expect(() => JSON.parse(response.body)).not.toThrow();
          });
        });
      });

      describe('WHEN examining timestamp consistency', () => {
        it('THEN error and success responses include timestamps', () => {
          // Given: Timestamp-enabled responses
          const errorResponse = createErrorResponse(400, 'test error');
          const successResponse = createSuccessResponse({ data: 'test' });

          // When: Examining response bodies
          const errorBody = JSON.parse(errorResponse.body);
          const successBody = JSON.parse(successResponse.body);

          // Then: Should include valid timestamps
          expect(errorBody.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          expect(successBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
      });
    });
  });
});