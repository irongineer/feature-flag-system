import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeatureFlagHttpClient } from '../src/client/http-client';
import { FeatureFlagContext, FEATURE_FLAGS } from '../src/models';

// Fetch のモック
global.fetch = vi.fn();
const mockFetch = fetch as any;

/**
 * Feature Flag HTTP Client Specification
 * 
 * HTTPクライアントは、リモートフィーチャーフラグAPIとの通信を担当し、
 * コンテキストの柔軟性とフェイルセーフ機能を提供する責務を持つ。
 * 
 * Key Business Rules:
 * 1. 必須フィールドのバリデーション（tenantIdの存在確認）
 * 2. オプショナルフィールドの選択的送信（undefinedは除外）
 * 3. ネットワークエラー時のフェイルセーフ（デフォルト値返却）
 * 4. リトライ機能による一時的な障害への対応
 * 5. カスタムデフォルト値の設定機能
 * 6. レスポンス時間の最適化（タイムアウト設定）
 * 7. 適切な認証ヘッダーの付与
 */
describe('FeatureFlagHttpClient Specification', () => {
  let client: FeatureFlagHttpClient;

  beforeEach(() => {
    client = new FeatureFlagHttpClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      timeout: 1000,
      retries: 1
    });
    
    vi.clearAllMocks();
  });

  describe('Context Handling and Flexibility', () => {
    describe('Minimal Context Processing', () => {
      describe('GIVEN a context with only required tenantId', () => {
        describe('WHEN evaluating a feature flag', () => {
          it('THEN successfully processes with minimal context and applies defaults', async () => {
            // Given: Minimal context with only required field
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123'
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with minimal context
            const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should return the API result
            expect(result).toBe(true);
            
            // And: Should make proper API call with correct headers
            expect(mockFetch).toHaveBeenCalledWith(
              'https://api.example.com/evaluate',
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer test-key'
                })
              })
            );

            // And: Should include required fields plus defaults
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              flagKey: 'new_dashboard_enable',
              environment: 'production' // Default environment
            });
          });
        });
      });
    });

    describe('Selective Field Inclusion', () => {
      describe('GIVEN a context with userId information', () => {
        describe('WHEN the userId is provided', () => {
          it('THEN includes userId in the API request for user-specific evaluation', async () => {
            // Given: Context including user identification
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userId: 'user-456'
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with user context
            await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should make API call with proper authentication
            expect(mockFetch).toHaveBeenCalledWith(
              'https://api.example.com/evaluate',
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer test-key'
                })
              })
            );

            // And: Should include user information in request payload
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              userId: 'user-456',
              flagKey: 'new_dashboard_enable',
              environment: 'production'
            });
          });
        });
      });
    });

      describe('GIVEN a context with role-based information', () => {
        describe('WHEN userRole is provided for authorization-based features', () => {
          it('THEN includes role information for permission-based flag evaluation', async () => {
            // Given: Context including user role for permission evaluation
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userRole: 'admin'
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with role-based context
            await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should make API call with authentication headers
            expect(mockFetch).toHaveBeenCalledWith(
              'https://api.example.com/evaluate',
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer test-key'
                })
              })
            );

            // And: Should include role information for authorization evaluation
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              userRole: 'admin',
              flagKey: 'new_dashboard_enable',
              environment: 'production'
            });
          });
        });
      });

      describe('GIVEN a context with subscription plan information', () => {
        describe('WHEN plan information is provided for feature tier control', () => {
          it('THEN includes plan details for subscription-based feature evaluation', async () => {
            // Given: Context including subscription plan for tier-based features
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              plan: 'enterprise'
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with plan-based context
            await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should make authenticated API call
            expect(mockFetch).toHaveBeenCalledWith(
              'https://api.example.com/evaluate',
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer test-key'
                })
              })
            );

            // And: Should include plan information for subscription-based evaluation
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              plan: 'enterprise',
              flagKey: 'new_dashboard_enable',
              environment: 'production'
            });
          });
        });
      });

    describe('Complete Context Processing', () => {
      describe('GIVEN a context with all available information', () => {
        describe('WHEN all optional fields are provided for complex evaluation', () => {
          it('THEN includes comprehensive context for sophisticated flag evaluation logic', async () => {
            // Given: Complete context with all available evaluation parameters
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userId: 'user-456',
              userRole: 'admin',
              plan: 'enterprise',
              environment: 'staging',
              metadata: {
                region: 'us-east-1',
                experimentGroup: 'variant-A'
              }
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with comprehensive context
            await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should make authenticated API call
            expect(mockFetch).toHaveBeenCalledWith(
              'https://api.example.com/evaluate',
              expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer test-key'
                })
              })
            );

            // And: Should transmit all context information for complex evaluation
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              userId: 'user-456',
              userRole: 'admin',
              plan: 'enterprise',
              flagKey: 'new_dashboard_enable',
              environment: 'staging',
              metadata: {
                region: 'us-east-1',
                experimentGroup: 'variant-A'
              }
            });
          });
        });
      });
    });

    describe('Undefined Field Exclusion', () => {
      describe('GIVEN a context with explicitly undefined optional fields', () => {
        describe('WHEN some fields are undefined rather than omitted', () => {
          it('THEN excludes undefined fields from request to minimize payload size', async () => {
            // Given: Context with explicitly undefined fields (common in dynamic contexts)
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userId: undefined,
              userRole: undefined,
              plan: undefined,
              metadata: undefined
            };

            // Given: API responds successfully
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
            } as Response);

            // When: Evaluating flag with context containing undefined fields
            await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should send only defined fields plus defaults
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              flagKey: 'new_dashboard_enable',
              environment: 'production'
            });
            
            // And: Should not include undefined fields in request payload
            expect(callBody).not.toHaveProperty('userId');
            expect(callBody).not.toHaveProperty('userRole');
            expect(callBody).not.toHaveProperty('plan');
            expect(callBody).not.toHaveProperty('metadata');
          });
        });
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    describe('Input Validation', () => {
      describe('GIVEN invalid or missing required context', () => {
        describe('WHEN tenantId is missing from context', () => {
          it('THEN fails fast with default value without making API calls', async () => {
            // Given: Invalid context missing required tenantId
            const context = {} as FeatureFlagContext;

            // When: Attempting to evaluate with invalid context
            const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should return safe default without API call
            expect(result).toBe(false);
            expect(mockFetch).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('Network Resilience', () => {
      describe('GIVEN network connectivity issues', () => {
        describe('WHEN API calls fail due to network errors', () => {
          it('THEN gracefully falls back to default value for system stability', async () => {
            // Given: Valid context but network issues
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123'
            };

            // Given: Network error occurs
            mockFetch.mockRejectedValue(new Error('Network error'));

            // When: Attempting evaluation during network issues
            const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should return safe default value
            expect(result).toBe(false);
          });
        });
      });
    });

    describe('Custom Default Values', () => {
      describe('GIVEN specific business requirements for fallback values', () => {
        describe('WHEN custom defaults are configured for critical features', () => {
          it('THEN respects custom default values during failures', async () => {
            // Given: A context and custom default configuration
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123'
            };

            // Given: Custom default is set for business continuity
            client.setDefaultValue(FEATURE_FLAGS.NEW_DASHBOARD, true);
            mockFetch.mockRejectedValue(new Error('Network error'));

            // When: Evaluation fails but custom default is available
            const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should use custom default instead of system default
            expect(result).toBe(true);
          });
        });
      });
    });

    describe('Automatic Retry Behavior', () => {
      describe('GIVEN transient network failures', () => {
        describe('WHEN initial requests fail but subsequent requests succeed', () => {
          it('THEN automatically retries failed requests for improved reliability', async () => {
            // Given: Valid context
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123'
            };

            // Given: Transient failure followed by success
            mockFetch
              .mockRejectedValueOnce(new Error('Network error'))
              .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ enabled: true, flagKey: 'new_dashboard_enable', reason: 'ENABLED' })
              } as Response);

            // When: Making request with retry mechanism
            const result = await client.isEnabled(FEATURE_FLAGS.NEW_DASHBOARD, context);

            // Then: Should succeed with retry
            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(2);
          });
        });
      });
    });
  });

  describe('Batch Flag Retrieval Operations', () => {
    describe('Minimal Context Batch Processing', () => {
      describe('GIVEN a need to retrieve multiple flags efficiently', () => {
        describe('WHEN using minimal context for batch operations', () => {
          it('THEN successfully retrieves all flags with basic tenant context', async () => {
            // Given: Minimal context for efficient batch processing
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123'
            };

            // Given: API returns multiple flag states
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                flags: {
                  'new_dashboard_enable': true,
                  'billing_v2_enable': false
                }
              })
            } as Response);

            // When: Requesting all flags in batch
            const result = await client.getAllFlags(context);

            // Then: Should return comprehensive flag state mapping
            expect(result).toEqual({
              'new_dashboard_enable': true,
              'billing_v2_enable': false
            });
          });
        });
      });
    });

    describe('Rich Context Batch Processing', () => {
      describe('GIVEN comprehensive context for sophisticated batch evaluation', () => {
        describe('WHEN optional fields are available for batch processing', () => {
          it('THEN includes all context information for accurate batch evaluation', async () => {
            // Given: Rich context for comprehensive batch evaluation
            const context: FeatureFlagContext = {
              tenantId: 'tenant-123',
              userId: 'user-456',
              userRole: 'admin'
            };

            // Given: API responds to batch request
            mockFetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ flags: {} })
            } as Response);

            // When: Making batch request with rich context
            await client.getAllFlags(context);

            // Then: Should transmit complete context for batch evaluation
            const callBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
            expect(callBody).toMatchObject({
              tenantId: 'tenant-123',
              userId: 'user-456',
              userRole: 'admin',
              environment: 'production'
            });
          });
        });
      });
    });
  });
});