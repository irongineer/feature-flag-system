import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { message } from 'antd';
import {
  useFeatureFlags,
  useFeatureFlag,
  useFlagEvaluation,
  useCreateFlag,
  useUpdateFlag,
  useDeleteFlag,
  QUERY_KEYS,
} from './useFeatureFlags';
import { featureFlagApi } from '../services/api';

/**
 * Feature Flag Hooks Specification
 * 
 * フィーチャーフラグ管理フックは、React Query を活用して
 * フィーチャーフラグのCRUD操作とキャッシュ管理を提供する。
 * 
 * Key Responsibilities:
 * 1. フラグデータの取得・キャッシュ管理
 * 2. フラグのCRUD操作 (Create/Read/Update/Delete)
 * 3. フラグ評価機能
 * 4. 楽観的更新によるユーザー体験向上
 * 5. エラーハンドリングとユーザー通知
 * 6. クエリキーの一元管理
 * 
 * Business Rules:
 * - フラグ一覧: 5分間キャッシュ
 * - フラグ評価: 1分間キャッシュ
 * - CRUD操作成功時: 関連クエリを無効化
 * - エラー時: Ant Design message でユーザー通知
 * - 楽観的更新: なし (サーバー状態優先)
 */

// モックセットアップ
vi.mock('../services/api');
vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedFeatureFlagApi = vi.mocked(featureFlagApi);
const mockedMessage = vi.mocked(message);

// テスト用 QueryClient作成ヘルパー
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// React Query Wrapper
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('Feature Flag Hooks Specification', () => {
  let queryClient: QueryClient;
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
  });

  describe('Query Hooks (Data Fetching)', () => {
    describe('useFeatureFlags - Flag List Retrieval', () => {
      describe('GIVEN a request to fetch all feature flags', () => {
        describe('WHEN hook is rendered and API responds successfully', () => {
          it('THEN fetches and caches flag list with 5-minute stale time', async () => {
            // Given: API returns flag list
            const mockFlags = [
              {
                PK: 'FLAG#billing_v2_enable',
                SK: 'METADATA',
                flagKey: 'billing_v2_enable',
                description: 'Enable billing v2 features',
                defaultEnabled: false,
                owner: 'billing-team',
                createdAt: '2025-01-01T00:00:00Z',
              },
              {
                PK: 'FLAG#new_dashboard_enable',
                SK: 'METADATA',
                flagKey: 'new_dashboard_enable',
                description: 'Enable new dashboard UI',
                defaultEnabled: true,
                owner: 'ui-team',
                createdAt: '2025-01-01T01:00:00Z',
              },
            ];

            mockedFeatureFlagApi.getFlags.mockResolvedValue(mockFlags);

            // When: Rendering useFeatureFlags hook
            const { result } = renderHook(() => useFeatureFlags(), { wrapper });

            // Then: Should start with loading state
            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();

            // And: Should fetch and return flag data
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockFlags);
            expect(result.current.isLoading).toBe(false);
            expect(mockedFeatureFlagApi.getFlags).toHaveBeenCalledOnce();

            // And: Should use correct query key
            const queryKey = QUERY_KEYS.FLAGS;
            expect(queryClient.getQueryData(queryKey)).toEqual(mockFlags);
          });
        });

        describe('WHEN API request fails with network error', () => {
          it('THEN provides error state for user feedback', async () => {
            // Given: API request fails
            const networkError = new Error('Network request failed');
            mockedFeatureFlagApi.getFlags.mockRejectedValue(networkError);

            // When: Rendering hook with failed API
            const { result } = renderHook(() => useFeatureFlags(), { wrapper });

            // Then: Should provide error state
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(networkError);
            expect(result.current.data).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
          });
        });
      });
    });

    describe('useFeatureFlag - Single Flag Retrieval', () => {
      describe('GIVEN a request to fetch specific flag by key', () => {
        describe('WHEN flag key is provided and flag exists', () => {
          it('THEN fetches single flag with proper caching', async () => {
            // Given: API returns specific flag
            const mockFlag = {
              PK: 'FLAG#billing_v2_enable',
              SK: 'METADATA',
              flagKey: 'billing_v2_enable',
              description: 'Enable billing v2 features',
              defaultEnabled: false,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00Z',
            };

            mockedFeatureFlagApi.getFlag.mockResolvedValue(mockFlag);

            // When: Rendering useFeatureFlag with specific key
            const { result } = renderHook(
              () => useFeatureFlag('billing_v2_enable'),
              { wrapper }
            );

            // Then: Should fetch specific flag
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockFlag);
            expect(mockedFeatureFlagApi.getFlag).toHaveBeenCalledWith('billing_v2_enable');

            // And: Should use correct query key
            const queryKey = QUERY_KEYS.FLAG('billing_v2_enable');
            expect(queryClient.getQueryData(queryKey)).toEqual(mockFlag);
          });
        });

        describe('WHEN flag key is empty or undefined', () => {
          it('THEN disables query execution to prevent unnecessary API calls', () => {
            // Given: Empty flag key
            const flagKey = '' as any;

            // When: Rendering hook with empty key
            const { result } = renderHook(() => useFeatureFlag(flagKey), { wrapper });

            // Then: Should not execute query
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedFeatureFlagApi.getFlag).not.toHaveBeenCalled();
          });
        });
      });
    });

    describe('useFlagEvaluation - Flag Evaluation for Tenant', () => {
      describe('GIVEN a request to evaluate flag for specific tenant', () => {
        describe('WHEN both tenantId and flagKey are provided', () => {
          it('THEN evaluates flag with 1-minute stale time for real-time accuracy', async () => {
            // Given: API returns evaluation result
            const evaluationResult = {
              enabled: true,
              reason: 'tenant_override',
            };

            mockedFeatureFlagApi.evaluateFlag.mockResolvedValue(evaluationResult);

            // When: Rendering useFlagEvaluation hook
            const { result } = renderHook(
              () => useFlagEvaluation('tenant-123', 'billing_v2_enable'),
              { wrapper }
            );

            // Then: Should evaluate flag for tenant
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(evaluationResult);
            expect(mockedFeatureFlagApi.evaluateFlag).toHaveBeenCalledWith(
              'tenant-123',
              'billing_v2_enable'
            );

            // And: Should use correct query key
            const queryKey = QUERY_KEYS.FLAG_EVALUATION('tenant-123', 'billing_v2_enable');
            expect(queryClient.getQueryData(queryKey)).toEqual(evaluationResult);
          });
        });

        describe('WHEN tenantId or flagKey is missing', () => {
          it('THEN disables evaluation to prevent invalid API calls', () => {
            // Given: Missing tenantId
            const tenantId = '';
            const flagKey = 'billing_v2_enable';

            // When: Rendering hook with missing tenantId
            const { result } = renderHook(
              () => useFlagEvaluation(tenantId, flagKey),
              { wrapper }
            );

            // Then: Should not execute evaluation
            expect(result.current.isLoading).toBe(false);
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedFeatureFlagApi.evaluateFlag).not.toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe('Mutation Hooks (Data Modification)', () => {
    describe('useCreateFlag - Flag Creation', () => {
      describe('GIVEN a request to create new feature flag', () => {
        describe('WHEN mutation is executed with valid flag data', () => {
          it('THEN creates flag, invalidates cache, and shows success message', async () => {
            // Given: Valid flag creation data
            const newFlagData = {
              flagKey: 'new_feature_enable',
              description: 'Enable new feature functionality',
              defaultEnabled: false,
              owner: 'feature-team',
            };

            const createdFlag = {
              ...newFlagData,
              PK: 'FLAG#new_feature_enable',
              SK: 'METADATA',
              createdAt: '2025-01-01T12:00:00Z',
            };

            mockedFeatureFlagApi.createFlag.mockResolvedValue(createdFlag);

            // When: Rendering useCreateFlag and executing mutation
            const { result } = renderHook(() => useCreateFlag(), { wrapper });

            // And: Executing create mutation
            result.current.mutate(newFlagData);

            // Then: Should create flag successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(createdFlag);
            expect(mockedFeatureFlagApi.createFlag).toHaveBeenCalledWith(newFlagData);

            // And: Should show success message
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'フラグ "new_feature_enable" を作成しました'
            );

            // And: Should invalidate related queries
            // Note: Query invalidation is tested through cache state changes
          });
        });

        describe('WHEN mutation fails due to validation error', () => {
          it('THEN provides error state and shows error message', async () => {
            // Given: Validation error from API
            const validationError = new Error('Validation failed');
            validationError.message = 'flagKey already exists';
            mockedFeatureFlagApi.createFlag.mockRejectedValue(validationError);

            const invalidFlagData = {
              flagKey: 'existing_flag',
              description: 'Duplicate flag',
              defaultEnabled: false,
              owner: 'team',
            };

            // When: Rendering hook and executing failed mutation
            const { result } = renderHook(() => useCreateFlag(), { wrapper });

            result.current.mutate(invalidFlagData);

            // Then: Should handle error appropriately
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(validationError);

            // And: Should show error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'フラグの作成に失敗しました: flagKey already exists'
            );
          });
        });
      });
    });

    describe('useUpdateFlag - Flag Update', () => {
      describe('GIVEN a request to update existing flag', () => {
        describe('WHEN mutation is executed with valid update data', () => {
          it('THEN updates flag, invalidates cache, and shows success message', async () => {
            // Given: Valid flag update data
            const updateData = {
              description: 'Updated description for billing v2',
              defaultEnabled: true,
            };

            const updatedFlag = {
              PK: 'FLAG#billing_v2_enable',
              SK: 'METADATA',
              flagKey: 'billing_v2_enable',
              description: 'Updated description for billing v2',
              defaultEnabled: true,
              owner: 'billing-team',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T12:00:00Z',
            };

            mockedFeatureFlagApi.updateFlag.mockResolvedValue(updatedFlag);

            // When: Rendering useUpdateFlag and executing mutation
            const { result } = renderHook(() => useUpdateFlag(), { wrapper });

            result.current.mutate({
              flagKey: 'billing_v2_enable',
              updates: updateData,
            });

            // Then: Should update flag successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(updatedFlag);
            expect(mockedFeatureFlagApi.updateFlag).toHaveBeenCalledWith(
              'billing_v2_enable',
              updateData
            );

            // And: Should show success message
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'フラグ "billing_v2_enable" を更新しました'
            );
          });
        });
      });
    });

    describe('useDeleteFlag - Flag Deletion', () => {
      describe('GIVEN a request to delete feature flag', () => {
        describe('WHEN mutation is executed with valid flag key', () => {
          it('THEN deletes flag, clears cache, and shows success message', async () => {
            // Given: Successful flag deletion
            mockedFeatureFlagApi.deleteFlag.mockResolvedValue(undefined);

            // When: Rendering useDeleteFlag and executing mutation
            const { result } = renderHook(() => useDeleteFlag(), { wrapper });

            result.current.mutate('obsolete_feature');

            // Then: Should delete flag successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(mockedFeatureFlagApi.deleteFlag).toHaveBeenCalledWith('obsolete_feature');

            // And: Should show success message
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'フラグ "obsolete_feature" を削除しました'
            );
          });
        });

        describe('WHEN deletion fails due to flag being in use', () => {
          it('THEN provides error state and shows descriptive error message', async () => {
            // Given: Deletion blocked due to active usage
            const conflictError = new Error('Cannot delete flag in use');
            conflictError.message = 'Flag has active tenant overrides';
            mockedFeatureFlagApi.deleteFlag.mockRejectedValue(conflictError);

            // When: Rendering hook and executing failed deletion
            const { result } = renderHook(() => useDeleteFlag(), { wrapper });

            result.current.mutate('active_flag');

            // Then: Should handle deletion conflict
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(conflictError);

            // And: Should show descriptive error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'フラグの削除に失敗しました: Flag has active tenant overrides'
            );
          });
        });
      });
    });
  });

  describe('Query Key Management', () => {
    describe('GIVEN the QUERY_KEYS constant object', () => {
      describe('WHEN examining query key structure', () => {
        it('THEN provides consistent and hierarchical query keys', () => {
          // Given: Query key definitions
          const queryKeys = QUERY_KEYS;

          // Then: Should have consistent structure
          expect(queryKeys.FLAGS).toEqual(['flags']);
          expect(queryKeys.FLAG('billing_v2_enable')).toEqual(['flags', 'billing_v2_enable']);
          expect(queryKeys.FLAG_EVALUATION('tenant-123', 'billing_v2_enable')).toEqual([
            'flags',
            'billing_v2_enable',
            'evaluation',
            'tenant-123',
          ]);

          // And: Should support proper query invalidation hierarchy
          // flags/* queries will be invalidated when flags query is invalidated
          expect(queryKeys.FLAG('test').includes('flags')).toBe(true);
          expect(queryKeys.FLAG_EVALUATION('tenant', 'test').includes('flags')).toBe(true);
        });
      });
    });
  });

  describe('Cache Invalidation and State Management', () => {
    describe('GIVEN successful flag creation', () => {
      describe('WHEN useCreateFlag mutation succeeds', () => {
        it('THEN invalidates flags list query to refresh UI', async () => {
          // Given: Spy on query invalidation
          const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

          const newFlag = {
            flagKey: 'test_flag',
            description: 'Test flag',
            defaultEnabled: false,
            owner: 'test-team',
          };

          const createdFlag = {
            ...newFlag,
            PK: 'FLAG#test_flag',
            SK: 'METADATA',
            createdAt: '2025-01-01T12:00:00Z',
          };

          mockedFeatureFlagApi.createFlag.mockResolvedValue(createdFlag);

          // When: Executing create mutation
          const { result } = renderHook(() => useCreateFlag(), { wrapper });
          result.current.mutate(newFlag);

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
          });

          // Then: Should invalidate flags query
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.FLAGS,
          });
        });
      });
    });

    describe('GIVEN successful flag update', () => {
      describe('WHEN useUpdateFlag mutation succeeds', () => {
        it('THEN invalidates both flags list and specific flag queries', async () => {
          // Given: Spy on query invalidation
          const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

          const updateData = { description: 'Updated description' };
          const updatedFlag = {
            PK: 'FLAG#test_flag',
            SK: 'METADATA',
            flagKey: 'test_flag',
            description: 'Updated description',
            defaultEnabled: false,
            owner: 'test-team',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T12:00:00Z',
          };

          mockedFeatureFlagApi.updateFlag.mockResolvedValue(updatedFlag);

          // When: Executing update mutation
          const { result } = renderHook(() => useUpdateFlag(), { wrapper });
          result.current.mutate({
            flagKey: 'test_flag',
            updates: updateData,
          });

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
          });

          // Then: Should invalidate both queries
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.FLAGS,
          });
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.FLAG('test_flag'),
          });
        });
      });
    });

    describe('GIVEN successful flag deletion', () => {
      describe('WHEN useDeleteFlag mutation succeeds', () => {
        it('THEN invalidates flags list and removes specific flag query', async () => {
          // Given: Spies on query operations
          const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
          const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

          mockedFeatureFlagApi.deleteFlag.mockResolvedValue(undefined);

          // When: Executing delete mutation
          const { result } = renderHook(() => useDeleteFlag(), { wrapper });
          result.current.mutate('deleted_flag');

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
          });

          // Then: Should invalidate flags list and remove specific query
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.FLAGS,
          });
          expect(removeQueriesSpy).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.FLAG('deleted_flag'),
          });
        });
      });
    });
  });

  describe('Error Handling Edge Cases', () => {
    describe('useUpdateFlag Error Handling', () => {
      describe('GIVEN a request to update flag with complex error scenarios', () => {
        describe('WHEN update fails with detailed validation errors', () => {
          it('THEN handles complex error objects appropriately', async () => {
            // Given: Complex validation error from API
            const complexError = {
              message: 'Multiple validation errors',
              details: {
                flagKey: 'Invalid flag key format',
                description: 'Description too long',
                owner: 'Invalid owner format',
              },
              code: 'VALIDATION_FAILED',
            };
            mockedFeatureFlagApi.updateFlag.mockRejectedValue(complexError);

            const updateData = {
              flagKey: 'invalid-flag-key',
              updates: {
                description: 'A'.repeat(1000), // Too long
                owner: '', // Invalid
              },
            };

            // When: Rendering hook and executing failed mutation
            const { result } = renderHook(() => useUpdateFlag(), { wrapper });

            result.current.mutate(updateData);

            // Then: Should handle complex error appropriately
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(complexError);

            // And: Should show error message with complex error handling
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'フラグの更新に失敗しました: Multiple validation errors'
            );
          });
        });

        describe('WHEN update fails with network connectivity issues', () => {
          it('THEN handles network errors with appropriate user feedback', async () => {
            // Given: Network connectivity error
            const networkError = new Error('Network Error');
            networkError.name = 'NetworkError';
            networkError.message = 'Failed to connect to server';
            mockedFeatureFlagApi.updateFlag.mockRejectedValue(networkError);

            const updateData = {
              flagKey: 'network_test_flag',
              updates: { description: 'Updated during network issues' },
            };

            // When: Executing update during network failure
            const { result } = renderHook(() => useUpdateFlag(), { wrapper });

            result.current.mutate(updateData);

            // Then: Should handle network error gracefully
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(networkError);

            // And: Should show network-specific error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'フラグの更新に失敗しました: Failed to connect to server'
            );
          });
        });
      });
    });
  });
});