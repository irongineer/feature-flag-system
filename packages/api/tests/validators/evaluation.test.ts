import { describe, it, expect } from 'vitest';
import { 
  validateEvaluationRequest, 
  validateBatchEvaluationRequest,
  evaluationRequestSchema,
  batchEvaluationRequestSchema
} from '../../src/validators/evaluation';

/**
 * Evaluation Request Validation Specification
 * 
 * フィーチャーフラグ評価リクエストの入力検証は、セキュリティと
 * データ整合性を保証する重要な責務を持つ。
 * 
 * Key Validation Rules:
 * 1. tenantId: 必須、1-100文字
 * 2. flagKey: 必須、定義済みフラグキーのみ
 * 3. userId: オプション、1-100文字
 * 4. environment: オプション、development|staging|production
 * 5. metadata: オプション、任意のオブジェクト
 * 6. バッチ評価: flagKeys配列、1-50個まで
 */
describe('Evaluation Request Validation Specification', () => {

  describe('Single Flag Evaluation Request Validation', () => {
    describe('Valid Request Scenarios', () => {
      describe('GIVEN a request with all required parameters', () => {
        describe('WHEN validating the minimal valid request', () => {
          it('THEN accepts the request without errors', () => {
            // Given: Minimal valid request with required fields
            const validRequest = {
              tenantId: 'tenant-123',
              flagKey: 'billing_v2_enable'
            };

            // When: Validating the request
            const result = validateEvaluationRequest(validRequest);

            // Then: Should pass validation
            expect(result.error).toBeUndefined();
            expect(result.value).toEqual(validRequest);
          });
        });
      });

      describe('GIVEN a request with all optional parameters', () => {
        describe('WHEN validating the complete request', () => {
          it('THEN accepts the request with all fields', () => {
            // Given: Complete request with all optional fields
            const completeRequest = {
              tenantId: 'tenant-456',
              flagKey: 'new_dashboard_enable',
              userId: 'user-789',
              environment: 'production',
              metadata: {
                region: 'us-east-1',
                userTier: 'premium',
                experimentGroup: 'variant-A'
              }
            };

            // When: Validating the complete request
            const result = validateEvaluationRequest(completeRequest);

            // Then: Should pass validation with all fields preserved
            expect(result.error).toBeUndefined();
            expect(result.value).toEqual(completeRequest);
          });
        });
      });

      describe('GIVEN requests with boundary values', () => {
        describe('WHEN validating edge case values', () => {
          it('THEN accepts minimum length strings', () => {
            // Given: Request with minimum length values
            const minLengthRequest = {
              tenantId: 'a', // 1 character (minimum)
              flagKey: 'billing_v2_enable',
              userId: 'b'    // 1 character (minimum)
            };

            // When: Validating boundary values
            const result = validateEvaluationRequest(minLengthRequest);

            // Then: Should accept minimum length values
            expect(result.error).toBeUndefined();
          });

          it('THEN accepts maximum length strings', () => {
            // Given: Request with maximum length values
            const maxLengthRequest = {
              tenantId: 'a'.repeat(100), // 100 characters (maximum)
              flagKey: 'billing_v2_enable',
              userId: 'b'.repeat(100)    // 100 characters (maximum)
            };

            // When: Validating boundary values
            const result = validateEvaluationRequest(maxLengthRequest);

            // Then: Should accept maximum length values
            expect(result.error).toBeUndefined();
          });
        });
      });
    });

    describe('Invalid Request Scenarios', () => {
      describe('Missing Required Fields', () => {
        describe('GIVEN a request without tenantId', () => {
          describe('WHEN validating the incomplete request', () => {
            it('THEN rejects with tenantId required error', () => {
              // Given: Request missing required tenantId
              const invalidRequest = {
                flagKey: 'billing_v2_enable'
              };

              // When: Validating the incomplete request
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with validation error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['tenantId']);
              expect(result.error?.details[0].type).toBe('any.required');
            });
          });
        });

        describe('GIVEN a request without flagKey', () => {
          describe('WHEN validating the incomplete request', () => {
            it('THEN rejects with flagKey required error', () => {
              // Given: Request missing required flagKey
              const invalidRequest = {
                tenantId: 'tenant-123'
              };

              // When: Validating the incomplete request
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with validation error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['flagKey']);
              expect(result.error?.details[0].type).toBe('any.required');
            });
          });
        });
      });

      describe('Invalid Field Values', () => {
        describe('GIVEN a request with invalid flagKey', () => {
          describe('WHEN validating with non-existent flag', () => {
            it('THEN rejects with invalid flagKey error', () => {
              // Given: Request with invalid flagKey
              const invalidRequest = {
                tenantId: 'tenant-123',
                flagKey: 'non_existent_flag'
              };

              // When: Validating the invalid flagKey
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with validation error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['flagKey']);
              expect(result.error?.details[0].type).toBe('any.only');
            });
          });
        });

        describe('GIVEN a request with invalid environment', () => {
          describe('WHEN validating with unsupported environment', () => {
            it('THEN rejects with invalid environment error', () => {
              // Given: Request with invalid environment value
              const invalidRequest = {
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                environment: 'invalid-env'
              };

              // When: Validating the invalid environment
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with validation error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['environment']);
              expect(result.error?.details[0].type).toBe('any.only');
            });
          });
        });

        describe('GIVEN a request with boundary violations', () => {
          describe('WHEN validating with too long strings', () => {
            it('THEN rejects tenantId exceeding 100 characters', () => {
              // Given: Request with tenantId too long
              const invalidRequest = {
                tenantId: 'a'.repeat(101), // 101 characters (exceeds maximum)
                flagKey: 'billing_v2_enable'
              };

              // When: Validating the oversized field
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with length error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['tenantId']);
              expect(result.error?.details[0].type).toBe('string.max');
            });

            it('THEN rejects userId exceeding 100 characters', () => {
              // Given: Request with userId too long
              const invalidRequest = {
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                userId: 'u'.repeat(101) // 101 characters (exceeds maximum)
              };

              // When: Validating the oversized field
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with length error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['userId']);
              expect(result.error?.details[0].type).toBe('string.max');
            });
          });

          describe('WHEN validating with empty strings', () => {
            it('THEN rejects empty tenantId', () => {
              // Given: Request with empty tenantId
              const invalidRequest = {
                tenantId: '', // Empty string (below minimum)
                flagKey: 'billing_v2_enable'
              };

              // When: Validating the empty field
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with minimum length error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['tenantId']);
              expect(result.error?.details[0].type).toBe('string.empty');
            });

            it('THEN rejects empty userId', () => {
              // Given: Request with empty userId
              const invalidRequest = {
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                userId: '' // Empty string (below minimum)
              };

              // When: Validating the empty field
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with minimum length error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['userId']);
              expect(result.error?.details[0].type).toBe('string.empty');
            });
          });
        });

        describe('GIVEN a request with wrong data types', () => {
          describe('WHEN validating with non-string values', () => {
            it('THEN rejects numeric tenantId', () => {
              // Given: Request with non-string tenantId
              const invalidRequest = {
                tenantId: 123, // Number instead of string
                flagKey: 'billing_v2_enable'
              };

              // When: Validating the wrong type
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with type error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['tenantId']);
              expect(result.error?.details[0].type).toBe('string.base');
            });

            it('THEN rejects non-object metadata', () => {
              // Given: Request with non-object metadata
              const invalidRequest = {
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                metadata: 'not-an-object' // String instead of object
              };

              // When: Validating the wrong type
              const result = validateEvaluationRequest(invalidRequest);

              // Then: Should reject with type error
              expect(result.error).toBeDefined();
              expect(result.error?.details[0].path).toEqual(['metadata']);
              expect(result.error?.details[0].type).toBe('object.base');
            });
          });
        });
      });
    });
  });

  describe('Batch Flag Evaluation Request Validation', () => {
    describe('Valid Batch Request Scenarios', () => {
      describe('GIVEN a request with multiple flag keys', () => {
        describe('WHEN validating the batch request', () => {
          it('THEN accepts the request with flag array', () => {
            // Given: Valid batch request
            const validBatchRequest = {
              tenantId: 'tenant-123',
              flagKeys: ['billing_v2_enable', 'new_dashboard_enable']
            };

            // When: Validating the batch request
            const result = validateBatchEvaluationRequest(validBatchRequest);

            // Then: Should pass validation
            expect(result.error).toBeUndefined();
            expect(result.value).toEqual(validBatchRequest);
          });

          it('THEN accepts single flag in array', () => {
            // Given: Batch request with single flag
            const singleFlagBatch = {
              tenantId: 'tenant-456',
              flagKeys: ['advanced_analytics_enable']
            };

            // When: Validating the single flag batch
            const result = validateBatchEvaluationRequest(singleFlagBatch);

            // Then: Should pass validation
            expect(result.error).toBeUndefined();
          });

          it('THEN accepts maximum allowed flags (50)', () => {
            // Given: Batch request with maximum flags
            const flagKeys = Array(50).fill('billing_v2_enable');
            const maxFlagsBatch = {
              tenantId: 'tenant-789',
              flagKeys
            };

            // When: Validating the maximum flags batch
            const result = validateBatchEvaluationRequest(maxFlagsBatch);

            // Then: Should pass validation
            expect(result.error).toBeUndefined();
          });
        });
      });
    });

    describe('Invalid Batch Request Scenarios', () => {
      describe('GIVEN a request with invalid flagKeys array', () => {
        describe('WHEN validating empty flagKeys array', () => {
          it('THEN rejects with minimum array length error', () => {
            // Given: Batch request with empty flagKeys array
            const invalidBatchRequest = {
              tenantId: 'tenant-123',
              flagKeys: [] // Empty array (below minimum)
            };

            // When: Validating the empty array
            const result = validateBatchEvaluationRequest(invalidBatchRequest);

            // Then: Should reject with minimum length error
            expect(result.error).toBeDefined();
            expect(result.error?.details[0].path).toEqual(['flagKeys']);
            expect(result.error?.details[0].type).toBe('array.includesRequiredUnknowns');
          });
        });

        describe('WHEN validating too many flagKeys', () => {
          it('THEN rejects with maximum array length error', () => {
            // Given: Batch request with too many flags
            const flagKeys = Array(51).fill('billing_v2_enable'); // 51 flags (exceeds maximum)
            const invalidBatchRequest = {
              tenantId: 'tenant-123',
              flagKeys
            };

            // When: Validating the oversized array
            const result = validateBatchEvaluationRequest(invalidBatchRequest);

            // Then: Should reject with maximum length error
            expect(result.error).toBeDefined();
            expect(result.error?.details[0].path).toEqual(['flagKeys']);
            expect(result.error?.details[0].type).toBe('array.max');
          });
        });

        describe('WHEN validating invalid flag keys in array', () => {
          it('THEN rejects with invalid flagKey error', () => {
            // Given: Batch request with invalid flag key
            const invalidBatchRequest = {
              tenantId: 'tenant-123',
              flagKeys: ['billing_v2_enable', 'invalid_flag_key']
            };

            // When: Validating the invalid flag key
            const result = validateBatchEvaluationRequest(invalidBatchRequest);

            // Then: Should reject with validation error
            expect(result.error).toBeDefined();
            expect(result.error?.details[0].path).toEqual(['flagKeys', 1]);
            expect(result.error?.details[0].type).toBe('any.only');
          });
        });
      });
    });
  });

  describe('Schema Definition Consistency', () => {
    describe('GIVEN the evaluation request schema', () => {
      describe('WHEN examining schema properties', () => {
        it('THEN enforces consistent validation rules', () => {
          // Given: Schema definition inspection
          const schema = evaluationRequestSchema.describe();

          // Then: Should have proper field definitions
          expect(schema.keys.tenantId.flags.presence).toBe('required');
          expect(schema.keys.flagKey.flags.presence).toBe('required');
          expect(schema.keys.userId.flags.presence).toBe('optional');
          expect(schema.keys.environment.flags.presence).toBe('optional');
          expect(schema.keys.metadata.flags.presence).toBe('optional');
        });
      });
    });

    describe('GIVEN the batch evaluation request schema', () => {
      describe('WHEN examining schema properties', () => {
        it('THEN enforces consistent batch validation rules', () => {
          // Given: Batch schema definition inspection
          const schema = batchEvaluationRequestSchema.describe();

          // Then: Should have proper batch field definitions
          expect(schema.keys.tenantId.flags.presence).toBe('required');
          expect(schema.keys.flagKeys.flags.presence).toBe('required');
          expect(schema.keys.userId.flags.presence).toBe('optional');
          expect(schema.keys.environment.flags.presence).toBe('optional');
          expect(schema.keys.metadata.flags.presence).toBe('optional');
        });
      });
    });
  });
});