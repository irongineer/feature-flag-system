import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isResourceNotFound,
  isValidationError,
  isAccessDenied,
  isConditionalCheckFailed,
  isThrottlingError,
  isTableNotFound,
  createOperationalErrorMessage,
  FeatureFlagValidator,
  createStructuredError
} from '../src/types/error-handling';

// Create mock AWS SDK errors instead of importing the constructors
const createMockError = (name: string, message: string, metadata?: any) => {
  const error = new Error(message) as any;
  error.name = name;
  error.$fault = 'client';
  if (metadata) {
    error.$metadata = metadata;
  }
  return error;
};

describe('Enhanced AWS SDK v3 Error Handling', () => {
  describe('Error Type Guards', () => {
    it('should correctly identify ResourceNotFoundException', () => {
      const error = createMockError('ResourceNotFoundException', 'Resource not found');

      expect(isResourceNotFound(error)).toBe(true);
      expect(isValidationError(error)).toBe(false);
    });

    it('should correctly identify ValidationException', () => {
      const error = createMockError('ValidationException', 'Invalid input');

      expect(isValidationError(error)).toBe(true);
      expect(isResourceNotFound(error)).toBe(false);
    });

    it('should correctly identify AccessDeniedException', () => {
      const error = createMockError('AccessDeniedException', 'Access denied');

      expect(isAccessDenied(error)).toBe(true);
      expect(isResourceNotFound(error)).toBe(false);
    });

    it('should correctly identify ConditionalCheckFailedException', () => {
      const error = createMockError('ConditionalCheckFailedException', 'Condition check failed');

      expect(isConditionalCheckFailed(error)).toBe(true);
      expect(isResourceNotFound(error)).toBe(false);
    });

    it('should correctly identify ThrottlingException', () => {
      const error = createMockError('ProvisionedThroughputExceededException', 'Throughput exceeded');

      expect(isThrottlingError(error)).toBe(true);
      expect(isResourceNotFound(error)).toBe(false);
    });

    it('should correctly identify TableNotFoundException', () => {
      const error = createMockError('TableNotFoundException', 'Table not found');

      expect(isTableNotFound(error)).toBe(true);
      expect(isResourceNotFound(error)).toBe(false);
    });
  });

  describe('Operational Error Messages', () => {
    it('should generate detailed message for ResourceNotFoundException', () => {
      const error = createMockError('ResourceNotFoundException', 'Resource not found');

      const message = createOperationalErrorMessage(error, {
        operation: 'getFlag',
        flagKey: 'test_flag',
        tableName: 'feature-flags'
      });

      expect(message).toContain('DynamoDB resource not found');
      expect(message).toContain('Table \'feature-flags\' exists');
      expect(message).toContain('test_flag');
    });

    it('should generate detailed message for TableNotFoundException', () => {
      const error = createMockError('TableNotFoundException', 'Table not found');

      const message = createOperationalErrorMessage(error, {
        operation: 'getFlag',
        tableName: 'feature-flags'
      });

      expect(message).toContain('DynamoDB table \'feature-flags\' does not exist');
      expect(message).toContain('Deploy infrastructure using \'npm run deploy:dev\'');
    });

    it('should generate detailed message for AccessDeniedException', () => {
      const error = createMockError('AccessDeniedException', 'Access denied');

      const message = createOperationalErrorMessage(error, {
        operation: 'getFlag',
        tableName: 'feature-flags'
      });

      expect(message).toContain('Access denied to DynamoDB');
      expect(message).toContain('IAM role/user has correct permissions');
    });

    it('should generate detailed message for ValidationException', () => {
      const error = createMockError('ValidationException', 'Invalid input');

      const message = createOperationalErrorMessage(error, {
        operation: 'createFlag'
      });

      expect(message).toContain('Request validation failed');
      expect(message).toContain('Required fields (flagKey, tenantId)');
    });

    it('should generate detailed message for ThrottlingException', () => {
      const error = createMockError('ProvisionedThroughputExceededException', 'Throughput exceeded');

      const message = createOperationalErrorMessage(error, {
        operation: 'getFlag'
      });

      expect(message).toContain('DynamoDB request rate exceeded');
      expect(message).toContain('exponential backoff');
      expect(message).toContain('provisioned throughput');
    });
  });

  describe('FeatureFlagValidator', () => {
    describe('validateFeatureFlag', () => {
      it('should validate correct feature flag data', () => {
        const validFlag = {
          PK: 'FLAG#development#test_flag',
          SK: 'METADATA',
          flagKey: 'test_flag',
          description: 'Test flag',
          defaultEnabled: true,
          owner: 'test-team',
          environment: 'development'
        };

        const result = FeatureFlagValidator.validateFeatureFlag(validFlag);
        expect(result).toEqual(validFlag);
      });

      it('should throw ValidationException for null item', () => {
        expect(() => {
          FeatureFlagValidator.validateFeatureFlag(null);
        }).toThrowError('Feature flag item is null or undefined');
      });

      it('should throw ValidationException for missing flagKey', () => {
        const invalidFlag = {
          description: 'Test flag',
          defaultEnabled: true,
          owner: 'test-team'
        };

        expect(() => {
          FeatureFlagValidator.validateFeatureFlag(invalidFlag);
        }).toThrowError('flagKey must be a non-empty string');
      });

      it('should throw ValidationException for invalid defaultEnabled type', () => {
        const invalidFlag = {
          flagKey: 'test_flag',
          description: 'Test flag',
          defaultEnabled: 'true', // should be boolean
          owner: 'test-team'
        };

        expect(() => {
          FeatureFlagValidator.validateFeatureFlag(invalidFlag);
        }).toThrowError('defaultEnabled must be a boolean');
      });
    });

    describe('validateTenantOverride', () => {
      it('should validate correct tenant override data', () => {
        const validOverride = {
          PK: 'TENANT#development#tenant-123',
          SK: 'FLAG#test_flag',
          tenantId: 'tenant-123',
          flagKey: 'test_flag',
          enabled: true,
          environment: 'development'
        };

        const result = FeatureFlagValidator.validateTenantOverride(validOverride);
        expect(result).toEqual(validOverride);
      });

      it('should throw ValidationException for invalid enabled type', () => {
        const invalidOverride = {
          tenantId: 'tenant-123',
          flagKey: 'test_flag',
          enabled: 'true' // should be boolean
        };

        expect(() => {
          FeatureFlagValidator.validateTenantOverride(invalidOverride);
        }).toThrowError('enabled must be a boolean');
      });
    });

    describe('validateKillSwitch', () => {
      it('should validate correct kill switch data', () => {
        const validKillSwitch = {
          PK: 'EMERGENCY#development',
          SK: 'GLOBAL',
          enabled: true,
          reason: 'System maintenance',
          environment: 'development'
        };

        const result = FeatureFlagValidator.validateKillSwitch(validKillSwitch);
        expect(result).toEqual(validKillSwitch);
      });

      it('should throw ValidationException for missing reason', () => {
        const invalidKillSwitch = {
          enabled: true
          // reason is missing
        };

        expect(() => {
          FeatureFlagValidator.validateKillSwitch(invalidKillSwitch);
        }).toThrowError('reason must be a non-empty string');
      });
    });
  });

  describe('Structured Error Creation', () => {
    it('should create structured error with all context information', () => {
      const error = createMockError('ResourceNotFoundException', 'Resource not found', {
        httpStatusCode: 404,
        requestId: 'test-request-id'
      });

      const context = {
        tenantId: 'tenant-123',
        flagKey: 'test_flag',
        environment: 'development',
        additionalInfo: 'test'
      };

      const structuredError = createStructuredError('getFlag', error, context);

      expect(structuredError.operation).toBe('getFlag');
      expect(structuredError.tenantId).toBe('tenant-123');
      expect(structuredError.flagKey).toBe('test_flag');
      expect(structuredError.environment).toBe('development');
      expect(structuredError.errorType).toBe('ResourceNotFoundException');
      expect(structuredError.httpStatusCode).toBe(404);
      expect(structuredError.isRetryable).toBe(false);
      expect(structuredError.context).toEqual(context);
      expect(structuredError.timestamp).toBeDefined();
    });

    it('should handle errors without metadata', () => {
      const error = new Error('Generic error');

      const structuredError = createStructuredError('testOperation', error);

      expect(structuredError.operation).toBe('testOperation');
      expect(structuredError.errorType).toBe('Error');
      expect(structuredError.httpStatusCode).toBeUndefined();
      expect(structuredError.isRetryable).toBe(false);
    });
  });
});