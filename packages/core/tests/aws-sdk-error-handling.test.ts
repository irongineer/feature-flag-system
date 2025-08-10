import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isResourceNotFound,
  isConditionalCheckFailed,
  isValidationError,
  isThrottlingError,
  isRetryableError,
  isClientError,
  createStructuredError,
  enhancedErrorHandler,
  silentErrorHandler,
} from '../src/types/error-handling';
import {
  ResourceNotFoundException,
  ConditionalCheckFailedException,
  ValidationException,
  ThrottlingException,
  ProvisionedThroughputExceededException,
  RequestLimitExceeded,
  InternalServerError,
  ServiceUnavailableException,
} from '@aws-sdk/client-dynamodb';

describe('AWS SDK v3 Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Type Guards', () => {
    it('should identify ResourceNotFoundException', () => {
      const error = new Error('Resource not found');
      error.name = 'ResourceNotFoundException';

      expect(isResourceNotFound(error)).toBe(true);
      expect(isResourceNotFound(new Error('Other error'))).toBe(false);
      expect(isResourceNotFound(null)).toBe(false);
    });

    it('should identify ConditionalCheckFailedException', () => {
      const error = new Error('Condition check failed');
      error.name = 'ConditionalCheckFailedException';

      expect(isConditionalCheckFailed(error)).toBe(true);
      expect(isConditionalCheckFailed(new Error('Other error'))).toBe(false);
    });

    it('should identify ValidationException', () => {
      const error = new Error('Invalid parameters');
      error.name = 'ValidationException';

      expect(isValidationError(error)).toBe(true);
      expect(isValidationError(new Error('Other error'))).toBe(false);
    });

    it('should identify throttling errors', () => {
      const throttlingError = new Error('Throttled');
      throttlingError.name = 'ThrottlingException';

      const throughputError = new Error('Throughput exceeded');
      throughputError.name = 'ProvisionedThroughputExceededException';

      const rateLimitError = new Error('Rate limited');
      rateLimitError.name = 'RequestLimitExceeded';

      expect(isThrottlingError(throttlingError)).toBe(true);
      expect(isThrottlingError(throughputError)).toBe(true);
      expect(isThrottlingError(rateLimitError)).toBe(true);
      expect(isThrottlingError(new Error('Other error'))).toBe(false);
    });

    it('should classify retryable errors correctly', () => {
      const throttlingError = new Error('Throttled');
      throttlingError.name = 'ThrottlingException';

      const serverError = new Error('Internal error');
      serverError.name = 'InternalServerError';

      const unavailableError = new Error('Service unavailable');
      unavailableError.name = 'ServiceUnavailableException';

      const clientError = new Error('Validation error');
      clientError.name = 'ValidationException';

      expect(isRetryableError(throttlingError)).toBe(true);
      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(unavailableError)).toBe(true);
      expect(isRetryableError(clientError)).toBe(false);
    });

    it('should classify client errors correctly', () => {
      const validationError = new Error('Validation error');
      validationError.name = 'ValidationException';

      const conditionalError = new Error('Condition failed');
      conditionalError.name = 'ConditionalCheckFailedException';

      const notFoundError = new Error('Not found');
      notFoundError.name = 'ResourceNotFoundException';

      const serverError = new Error('Internal error');
      serverError.name = 'InternalServerError';

      expect(isClientError(validationError)).toBe(true);
      expect(isClientError(conditionalError)).toBe(true);
      expect(isClientError(notFoundError)).toBe(true);
      expect(isClientError(serverError)).toBe(false);
    });
  });

  describe('Structured Error Creation', () => {
    it('should create structured error with AWS metadata', () => {
      const awsError = new Error('DynamoDB error') as any;
      awsError.name = 'ValidationException';
      awsError.$fault = 'client';
      awsError.$metadata = {
        httpStatusCode: 400,
        requestId: 'test-request-id',
      };

      const structuredError = createStructuredError('testOperation', awsError, {
        tenantId: 'test-tenant',
        flagKey: 'test-flag',
      });

      expect(structuredError.operation).toBe('testOperation');
      expect(structuredError.tenantId).toBe('test-tenant');
      expect(structuredError.flagKey).toBe('test-flag');
      expect(structuredError.errorType).toBe('ValidationException');
      expect(structuredError.isRetryable).toBe(false);
      expect(structuredError.httpStatusCode).toBe(400);
      expect(structuredError.timestamp).toBeDefined();
    });

    it('should handle error without AWS metadata', () => {
      const standardError = new Error('Standard error');

      const structuredError = createStructuredError('testOperation', standardError);

      expect(structuredError.operation).toBe('testOperation');
      expect(structuredError.errorType).toBe('Error');
      expect(structuredError.isRetryable).toBe(false);
      expect(structuredError.httpStatusCode).toBeUndefined();
    });
  });

  describe('Enhanced Error Handler', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should handle string errors', () => {
      enhancedErrorHandler('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Test message');
    });

    it('should handle structured client errors with warn level', () => {
      const clientError = new Error('Validation error');
      clientError.name = 'ValidationException';

      const structuredError = createStructuredError('testOp', clientError, {
        tenantId: 'test-tenant',
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      enhancedErrorHandler(structuredError);

      expect(warnSpy).toHaveBeenCalledWith(
        '[testOp] DynamoDB error [NON-RETRYABLE]:',
        expect.objectContaining({
          errorType: 'ValidationException',
          tenantId: 'test-tenant',
          retryable: false,
        })
      );

      warnSpy.mockRestore();
    });

    it('should handle structured server errors with error level', () => {
      const serverError = new Error('Internal error');
      serverError.name = 'InternalServerError';

      const structuredError = createStructuredError('testOp', serverError, {
        flagKey: 'test-flag',
      });

      enhancedErrorHandler(structuredError);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[testOp] DynamoDB error [RETRYABLE]:',
        expect.objectContaining({
          errorType: 'InternalServerError',
          flagKey: 'test-flag',
          retryable: true,
        })
      );
    });
  });

  describe('Silent Error Handler', () => {
    it('should not log anything', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      silentErrorHandler('Test message', error);
      silentErrorHandler(createStructuredError('testOp', error));

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Integration with Real AWS Error Types', () => {
    it('should correctly identify AWS SDK error instances by name', () => {
      // Note: We test by error name since prototype manipulation is complex in test environment
      const resourceNotFound = new Error('Resource not found');
      resourceNotFound.name = 'ResourceNotFoundException';

      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationException';

      expect(isResourceNotFound(resourceNotFound)).toBe(true);
      expect(isValidationError(validationError)).toBe(true);
    });

    it('should handle complex error scenarios', () => {
      const throttlingError = new Error('Request rate exceeded') as any;
      throttlingError.name = 'ProvisionedThroughputExceededException';
      throttlingError.$fault = 'server';
      throttlingError.$metadata = {
        httpStatusCode: 400,
        requestId: 'throttle-request-id',
      };

      const structuredError = createStructuredError('batchOperation', throttlingError, {
        flagKeys: ['flag1', 'flag2', 'flag3'],
      });

      expect(structuredError.isRetryable).toBe(true);
      expect(structuredError.errorType).toBe('ProvisionedThroughputExceededException');
      expect(structuredError.context?.flagKeys).toEqual(['flag1', 'flag2', 'flag3']);
    });
  });

  describe('Error Context Handling', () => {
    it('should preserve all context information', () => {
      const error = new Error('Test error');
      const context = {
        tenantId: 'tenant-123',
        flagKey: 'billing_v2_enable',
        operation: 'evaluation',
        requestId: 'req-456',
        custom: { foo: 'bar' },
      };

      const structuredError = createStructuredError('complexOperation', error, context);

      expect(structuredError.tenantId).toBe('tenant-123');
      expect(structuredError.flagKey).toBe('billing_v2_enable');
      expect(structuredError.context).toEqual(context);
    });

    it('should handle missing context gracefully', () => {
      const error = new Error('Test error');

      const structuredError = createStructuredError('simpleOperation', error);

      expect(structuredError.tenantId).toBeUndefined();
      expect(structuredError.flagKey).toBeUndefined();
      expect(structuredError.context).toBeUndefined();
    });
  });
});
