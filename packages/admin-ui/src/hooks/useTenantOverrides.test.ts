import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { message } from 'antd';
import {
  useTenantOverrides,
  useFlagTenantOverrides,
  useSetTenantOverride,
  useRemoveTenantOverride,
  useBulkSetTenantOverrides,
  TENANT_QUERY_KEYS,
} from './useTenantOverrides';
import { tenantApi } from '../services/api';

/**
 * Tenant Override Hooks Specification
 *
 * テナントオーバーライド管理フックは、テナント固有の
 * フィーチャーフラグ設定を管理する責務を持つ。
 *
 * Key Responsibilities:
 * 1. テナント別オーバーライド設定の取得・管理
 * 2. フラグ別テナント設定の取得・管理
 * 3. 個別オーバーライド設定・削除
 * 4. 一括オーバーライド設定機能
 * 5. キャッシュ無効化による一貫性保証
 * 6. ユーザーフレンドリーな操作フィードバック
 *
 * Business Rules:
 * - テナントID必須: 空の場合はクエリ無効化
 * - フラグキー必須: 空の場合はクエリ無効化
 * - 成功時: 関連するクエリを自動無効化
 * - エラー時: 日本語でのユーザー通知
 * - 一括操作: 全フラグのクエリ無効化
 */

// モックセットアップ
vi.mock('../services/api');
vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedTenantApi = vi.mocked(tenantApi);
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
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('Tenant Override Hooks Specification', () => {
  let queryClient: QueryClient;
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
  });

  describe('Query Hooks (Data Fetching)', () => {
    describe('useTenantOverrides - Tenant-Specific Override Retrieval', () => {
      describe('GIVEN a request to fetch tenant override settings', () => {
        describe('WHEN tenantId is provided and tenant has overrides', () => {
          it('THEN fetches and caches tenant override list', async () => {
            // Given: API returns tenant overrides
            const mockOverrides = [
              {
                PK: 'TENANT#tenant-123',
                SK: 'OVERRIDE#billing_v2_enable',
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                enabled: true,
                updatedBy: 'admin-user',
                updatedAt: '2025-01-01T10:00:00Z',
              },
              {
                PK: 'TENANT#tenant-123',
                SK: 'OVERRIDE#new_dashboard_enable',
                tenantId: 'tenant-123',
                flagKey: 'new_dashboard_enable',
                enabled: false,
                updatedBy: 'tenant-admin',
                updatedAt: '2025-01-01T11:00:00Z',
              },
            ];

            mockedTenantApi.getTenantOverrides.mockResolvedValue(mockOverrides);

            // When: Rendering useTenantOverrides hook
            const { result } = renderHook(() => useTenantOverrides('tenant-123'), { wrapper });

            // Then: Should start with loading state
            expect(result.current.isLoading).toBe(true);
            expect(result.current.data).toBeUndefined();

            // And: Should fetch and return override data
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockOverrides);
            expect(result.current.isLoading).toBe(false);
            expect(mockedTenantApi.getTenantOverrides).toHaveBeenCalledWith('tenant-123');

            // And: Should use correct query key
            const queryKey = TENANT_QUERY_KEYS.TENANT_OVERRIDES('tenant-123');
            expect(queryClient.getQueryData(queryKey)).toEqual(mockOverrides);
          });
        });

        describe('WHEN tenantId is empty or undefined', () => {
          it('THEN disables query to prevent invalid API calls', () => {
            // Given: Empty tenantId
            const tenantId = '';

            // When: Rendering hook with empty tenantId
            const { result } = renderHook(() => useTenantOverrides(tenantId), { wrapper });

            // Then: Should not execute query
            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeUndefined();
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedTenantApi.getTenantOverrides).not.toHaveBeenCalled();
          });
        });

        describe('WHEN API request fails with authorization error', () => {
          it('THEN provides error state for user feedback', async () => {
            // Given: API request fails with authorization error
            const authError = new Error('Unauthorized to access tenant data');
            mockedTenantApi.getTenantOverrides.mockRejectedValue(authError);

            // When: Rendering hook with failed API
            const { result } = renderHook(() => useTenantOverrides('tenant-456'), { wrapper });

            // Then: Should provide error state
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(authError);
            expect(result.current.data).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
          });
        });
      });
    });

    describe('useFlagTenantOverrides - Flag-Specific Tenant List', () => {
      describe('GIVEN a request to fetch tenants with overrides for specific flag', () => {
        describe('WHEN flagKey is provided and flag has tenant overrides', () => {
          it('THEN fetches tenant list with override details', async () => {
            // Given: API returns flag tenant overrides
            const mockFlagTenants = [
              {
                PK: 'TENANT#tenant-123',
                SK: 'OVERRIDE#billing_v2_enable',
                tenantId: 'tenant-123',
                flagKey: 'billing_v2_enable',
                enabled: true,
                updatedBy: 'customer-success',
                updatedAt: '2025-01-01T10:00:00Z',
              },
              {
                PK: 'TENANT#tenant-456',
                SK: 'OVERRIDE#billing_v2_enable',
                tenantId: 'tenant-456',
                flagKey: 'billing_v2_enable',
                enabled: false,
                updatedBy: 'support-team',
                updatedAt: '2025-01-01T11:00:00Z',
              },
            ];

            mockedTenantApi.getFlagTenantOverrides.mockResolvedValue(mockFlagTenants);

            // When: Rendering useFlagTenantOverrides hook
            const { result } = renderHook(() => useFlagTenantOverrides('billing_v2_enable'), {
              wrapper,
            });

            // Then: Should fetch flag tenant overrides
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockFlagTenants);
            expect(mockedTenantApi.getFlagTenantOverrides).toHaveBeenCalledWith(
              'billing_v2_enable'
            );

            // And: Should use correct query key
            const queryKey = TENANT_QUERY_KEYS.FLAG_TENANTS('billing_v2_enable');
            expect(queryClient.getQueryData(queryKey)).toEqual(mockFlagTenants);
          });
        });

        describe('WHEN flagKey is empty', () => {
          it('THEN disables query execution', () => {
            // Given: Empty flagKey
            const flagKey = '' as any;

            // When: Rendering hook with empty flagKey
            const { result } = renderHook(() => useFlagTenantOverrides(flagKey), { wrapper });

            // Then: Should not execute query
            expect(result.current.isLoading).toBe(false);
            expect(result.current.fetchStatus).toBe('idle');
            expect(mockedTenantApi.getFlagTenantOverrides).not.toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe('Mutation Hooks (Data Modification)', () => {
    describe('useSetTenantOverride - Individual Override Setting', () => {
      describe('GIVEN a request to set tenant flag override', () => {
        describe('WHEN mutation is executed with valid override data', () => {
          it('THEN sets override, invalidates cache, and shows localized success message', async () => {
            // Given: Valid tenant override data
            const overrideData = {
              tenantId: 'tenant-789',
              flagKey: 'billing_v2_enable',
              enabled: true,
              updatedBy: 'customer-success',
            };

            const createdOverride = {
              PK: 'TENANT#tenant-789',
              SK: 'OVERRIDE#billing_v2_enable',
              tenantId: 'tenant-789',
              flagKey: 'billing_v2_enable',
              enabled: true,
              updatedBy: 'customer-success',
              updatedAt: '2025-01-01T13:00:00Z',
            };

            mockedTenantApi.setTenantOverride.mockResolvedValue(createdOverride);

            // When: Rendering useSetTenantOverride and executing mutation
            const { result } = renderHook(() => useSetTenantOverride(), { wrapper });

            result.current.mutate(overrideData);

            // Then: Should set override successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(createdOverride);
            expect(mockedTenantApi.setTenantOverride).toHaveBeenCalledWith(
              'tenant-789',
              'billing_v2_enable',
              true,
              'customer-success'
            );

            // And: Should show localized success message
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'テナント "tenant-789" のフラグ "billing_v2_enable" を有効にしました'
            );
          });
        });

        describe('WHEN setting override to disabled state', () => {
          it('THEN shows appropriate disabled state message', async () => {
            // Given: Disable override data
            const disableData = {
              tenantId: 'tenant-999',
              flagKey: 'new_feature_enable',
              enabled: false,
              updatedBy: 'admin-user',
            };

            const disabledOverride = {
              PK: 'TENANT#tenant-999',
              SK: 'OVERRIDE#new_feature_enable',
              tenantId: 'tenant-999',
              flagKey: 'new_feature_enable',
              enabled: false,
              updatedBy: 'admin-user',
              updatedAt: '2025-01-01T14:00:00Z',
            };

            mockedTenantApi.setTenantOverride.mockResolvedValue(disabledOverride);

            // When: Setting override to disabled
            const { result } = renderHook(() => useSetTenantOverride(), { wrapper });

            result.current.mutate(disableData);

            // Then: Should show disabled state message
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(mockedMessage.success).toHaveBeenCalledWith(
              'テナント "tenant-999" のフラグ "new_feature_enable" を無効にしました'
            );
          });
        });

        describe('WHEN mutation fails due to validation error', () => {
          it('THEN provides error state and shows localized error message', async () => {
            // Given: Validation error from API
            const validationError = new Error('Invalid override configuration');
            validationError.message = 'Tenant not found';
            mockedTenantApi.setTenantOverride.mockRejectedValue(validationError);

            const invalidData = {
              tenantId: 'non-existent-tenant',
              flagKey: 'billing_v2_enable',
              enabled: true,
              updatedBy: 'admin',
            };

            // When: Executing failed mutation
            const { result } = renderHook(() => useSetTenantOverride(), { wrapper });

            result.current.mutate(invalidData);

            // Then: Should handle error appropriately
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(validationError);

            // And: Should show localized error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'テナントオーバーライドの設定に失敗しました: Tenant not found'
            );
          });
        });
      });
    });

    describe('useRemoveTenantOverride - Override Removal', () => {
      describe('GIVEN a request to remove tenant flag override', () => {
        describe('WHEN mutation is executed with valid removal data', () => {
          it('THEN removes override, invalidates cache, and shows success message', async () => {
            // Given: Successful override removal
            mockedTenantApi.removeTenantOverride.mockResolvedValue(undefined);

            const removalData = {
              tenantId: 'tenant-cleanup',
              flagKey: 'deprecated_feature',
            };

            // When: Rendering useRemoveTenantOverride and executing mutation
            const { result } = renderHook(() => useRemoveTenantOverride(), { wrapper });

            result.current.mutate(removalData);

            // Then: Should remove override successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(mockedTenantApi.removeTenantOverride).toHaveBeenCalledWith(
              'tenant-cleanup',
              'deprecated_feature'
            );

            // And: Should show success message
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'テナント "tenant-cleanup" のフラグ "deprecated_feature" のオーバーライドを削除しました'
            );
          });
        });

        describe('WHEN removal fails due to override not existing', () => {
          it('THEN provides error state and shows descriptive error message', async () => {
            // Given: Removal fails - override not found
            const notFoundError = new Error('Override not found');
            notFoundError.message = 'No override exists for this tenant and flag';
            mockedTenantApi.removeTenantOverride.mockRejectedValue(notFoundError);

            // When: Executing failed removal
            const { result } = renderHook(() => useRemoveTenantOverride(), { wrapper });

            result.current.mutate({
              tenantId: 'tenant-no-override',
              flagKey: 'non_existent_flag',
            });

            // Then: Should handle removal error
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(notFoundError);

            // And: Should show descriptive error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              'テナントオーバーライドの削除に失敗しました: No override exists for this tenant and flag'
            );
          });
        });
      });
    });

    describe('useBulkSetTenantOverrides - Bulk Override Operations', () => {
      describe('GIVEN a request to set multiple overrides for tenant', () => {
        describe('WHEN mutation is executed with bulk override data', () => {
          it('THEN sets all overrides, invalidates multiple caches, and shows bulk success message', async () => {
            // Given: Bulk override data
            const bulkData = {
              tenantId: 'tenant-bulk-test',
              overrides: [
                { flagKey: 'billing_v2_enable', enabled: true },
                { flagKey: 'new_dashboard_enable', enabled: false },
                { flagKey: 'advanced_analytics_enable', enabled: true },
              ],
              updatedBy: 'bulk-admin',
            };

            const createdOverrides = bulkData.overrides.map((override, index) => ({
              PK: 'TENANT#tenant-bulk-test',
              SK: `OVERRIDE#${override.flagKey}`,
              tenantId: 'tenant-bulk-test',
              flagKey: override.flagKey,
              enabled: override.enabled,
              updatedBy: 'bulk-admin',
              updatedAt: `2025-01-01T15:0${index}:00Z`,
            }));

            mockedTenantApi.bulkSetTenantOverrides.mockResolvedValue(createdOverrides);

            // When: Rendering useBulkSetTenantOverrides and executing mutation
            const { result } = renderHook(() => useBulkSetTenantOverrides(), { wrapper });

            result.current.mutate(bulkData);

            // Then: Should set bulk overrides successfully
            await waitFor(() => {
              expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(createdOverrides);
            expect(mockedTenantApi.bulkSetTenantOverrides).toHaveBeenCalledWith(
              'tenant-bulk-test',
              bulkData.overrides,
              'bulk-admin'
            );

            // And: Should show bulk success message with count
            expect(mockedMessage.success).toHaveBeenCalledWith(
              'テナント "tenant-bulk-test" の 3 個のフラグを一括更新しました'
            );
          });
        });

        describe('WHEN bulk operation partially fails', () => {
          it('THEN provides error state and shows descriptive error message', async () => {
            // Given: Bulk operation fails
            const bulkError = new Error('Bulk operation failed');
            bulkError.message = 'Some flags could not be updated due to validation errors';
            mockedTenantApi.bulkSetTenantOverrides.mockRejectedValue(bulkError);

            const failingBulkData = {
              tenantId: 'tenant-partial-fail',
              overrides: [
                { flagKey: 'valid_flag', enabled: true },
                { flagKey: 'invalid_flag', enabled: true }, // This one fails
              ],
              updatedBy: 'admin',
            };

            // When: Executing failed bulk operation
            const { result } = renderHook(() => useBulkSetTenantOverrides(), { wrapper });

            result.current.mutate(failingBulkData);

            // Then: Should handle bulk error appropriately
            await waitFor(() => {
              expect(result.current.isError).toBe(true);
            });

            expect(result.current.error).toEqual(bulkError);

            // And: Should show descriptive error message
            expect(mockedMessage.error).toHaveBeenCalledWith(
              '一括テナントオーバーライドの設定に失敗しました: Some flags could not be updated due to validation errors'
            );
          });
        });
      });
    });
  });

  describe('Query Key Management', () => {
    describe('GIVEN the TENANT_QUERY_KEYS constant object', () => {
      describe('WHEN examining tenant query key structure', () => {
        it('THEN provides consistent and hierarchical query keys', () => {
          // Given: Tenant query key definitions
          const queryKeys = TENANT_QUERY_KEYS;

          // Then: Should have consistent structure
          expect(queryKeys.TENANT_OVERRIDES('tenant-123')).toEqual([
            'tenants',
            'tenant-123',
            'overrides',
          ]);
          expect(queryKeys.FLAG_TENANTS('billing_v2_enable')).toEqual([
            'flags',
            'billing_v2_enable',
            'tenants',
          ]);

          // And: Should support proper query invalidation hierarchy
          expect(queryKeys.TENANT_OVERRIDES('test').includes('tenants')).toBe(true);
          expect(queryKeys.FLAG_TENANTS('test').includes('flags')).toBe(true);
        });
      });
    });
  });

  describe('Cache Invalidation for Complex Operations', () => {
    describe('GIVEN successful tenant override setting', () => {
      describe('WHEN useSetTenantOverride mutation succeeds', () => {
        it('THEN invalidates both tenant and flag-specific queries', async () => {
          // Given: Spy on query invalidation
          const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

          const overrideData = {
            tenantId: 'tenant-cache-test',
            flagKey: 'billing_v2_enable',
            enabled: true,
            updatedBy: 'admin',
          };

          const createdOverride = {
            PK: 'TENANT#tenant-cache-test',
            SK: 'OVERRIDE#billing_v2_enable',
            tenantId: 'tenant-cache-test',
            flagKey: 'billing_v2_enable',
            enabled: true,
            updatedBy: 'admin',
            updatedAt: '2025-01-01T16:00:00Z',
          };

          mockedTenantApi.setTenantOverride.mockResolvedValue(createdOverride);

          // When: Executing set override mutation
          const { result } = renderHook(() => useSetTenantOverride(), { wrapper });
          result.current.mutate(overrideData);

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
          });

          // Then: Should invalidate both related queries
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES('tenant-cache-test'),
          });
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS('billing_v2_enable'),
          });
        });
      });
    });

    describe('GIVEN successful bulk tenant override setting', () => {
      describe('WHEN useBulkSetTenantOverrides mutation succeeds', () => {
        it('THEN invalidates tenant query and all affected flag queries', async () => {
          // Given: Spy on query invalidation
          const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

          const bulkData = {
            tenantId: 'tenant-bulk-cache',
            overrides: [
              { flagKey: 'flag_a', enabled: true },
              { flagKey: 'flag_b', enabled: false },
              { flagKey: 'flag_c', enabled: true },
            ],
            updatedBy: 'bulk-admin',
          };

          const createdOverrides = bulkData.overrides.map(override => ({
            PK: 'TENANT#tenant-bulk-cache',
            SK: `OVERRIDE#${override.flagKey}`,
            tenantId: 'tenant-bulk-cache',
            flagKey: override.flagKey,
            enabled: override.enabled,
            updatedBy: 'bulk-admin',
            updatedAt: '2025-01-01T17:00:00Z',
          }));

          mockedTenantApi.bulkSetTenantOverrides.mockResolvedValue(createdOverrides);

          // When: Executing bulk set mutation
          const { result } = renderHook(() => useBulkSetTenantOverrides(), { wrapper });
          result.current.mutate(bulkData);

          await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
          });

          // Then: Should invalidate tenant query
          expect(invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES('tenant-bulk-cache'),
          });

          // And: Should invalidate all affected flag queries
          bulkData.overrides.forEach(override => {
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({
              queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS(override.flagKey),
            });
          });
        });
      });
    });
  });
});
