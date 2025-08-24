import { describe, it, expect } from 'vitest';
import { EvaluationContextBuilder } from '../src/evaluator/evaluation-context';
import { ENVIRONMENTS, FEATURE_FLAGS } from '../src/models';

/**
 * EvaluationContextBuilder Test Suite
 * Tests for context normalization and validation
 */
describe('EvaluationContextBuilder', () => {
  const builder = new EvaluationContextBuilder(ENVIRONMENTS.DEVELOPMENT);

  describe('build method', () => {
    it('should normalize string tenantId and flagKey', () => {
      const result = builder.build('tenant-123', FEATURE_FLAGS.BILLING_V2);
      
      expect(result).toEqual({
        tenantId: 'tenant-123',
        flagKey: FEATURE_FLAGS.BILLING_V2,
        environment: ENVIRONMENTS.DEVELOPMENT,
      });
    });

    it('should normalize FeatureFlagContext input', () => {
      const context = {
        tenantId: 'tenant-456',
        environment: ENVIRONMENTS.DEVELOPMENT,
      };
      
      const result = builder.build(context, FEATURE_FLAGS.NEW_DASHBOARD);
      
      expect(result).toEqual({
        tenantId: 'tenant-456',
        flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
        environment: ENVIRONMENTS.DEVELOPMENT,
      });
    });

    it('should use evaluator environment when context environment is missing', () => {
      const context = {
        tenantId: 'tenant-789',
      };
      
      const result = builder.build(context, FEATURE_FLAGS.ADVANCED_ANALYTICS);
      
      expect(result.environment).toBe(ENVIRONMENTS.DEVELOPMENT);
    });

    it('should throw error for environment mismatch', () => {
      const context = {
        tenantId: 'tenant-mismatch',
        environment: ENVIRONMENTS.PRODUCTION,
      };
      
      expect(() => {
        builder.build(context, FEATURE_FLAGS.BILLING_V2);
      }).toThrow('Environment mismatch: evaluator is configured for development, but context specifies production');
    });
  });
});