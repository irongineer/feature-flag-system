import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '../services/api';
import type { FeatureFlagKey } from '../types';
import { message } from 'antd';

// Query keys
export const TENANT_QUERY_KEYS = {
  TENANT_OVERRIDES: (tenantId: string) => ['tenants', tenantId, 'overrides'] as const,
  FLAG_TENANTS: (flagKey: FeatureFlagKey) => ['flags', flagKey, 'tenants'] as const,
};

// Get tenant overrides
export const useTenantOverrides = (tenantId: string) => {
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES(tenantId),
    queryFn: () => tenantApi.getTenantOverrides(tenantId),
    enabled: !!tenantId,
  });
};

// Get flag tenant overrides
export const useFlagTenantOverrides = (flagKey: FeatureFlagKey) => {
  return useQuery({
    queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS(flagKey),
    queryFn: () => tenantApi.getFlagTenantOverrides(flagKey),
    enabled: !!flagKey,
  });
};

// Set tenant override mutation
export const useSetTenantOverride = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      tenantId, 
      flagKey, 
      enabled, 
      updatedBy 
    }: { 
      tenantId: string; 
      flagKey: FeatureFlagKey; 
      enabled: boolean; 
      updatedBy: string; 
    }) => tenantApi.setTenantOverride(tenantId, flagKey, enabled, updatedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES(variables.tenantId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS(variables.flagKey) 
      });
      message.success(
        `テナント "${variables.tenantId}" のフラグ "${variables.flagKey}" を${
          variables.enabled ? '有効' : '無効'
        }にしました`
      );
    },
    onError: (error: any) => {
      message.error(`テナントオーバーライドの設定に失敗しました: ${error.message}`);
    },
  });
};

// Remove tenant override mutation
export const useRemoveTenantOverride = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tenantId, flagKey }: { tenantId: string; flagKey: FeatureFlagKey }) =>
      tenantApi.removeTenantOverride(tenantId, flagKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES(variables.tenantId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS(variables.flagKey) 
      });
      message.success(
        `テナント "${variables.tenantId}" のフラグ "${variables.flagKey}" のオーバーライドを削除しました`
      );
    },
    onError: (error: any) => {
      message.error(`テナントオーバーライドの削除に失敗しました: ${error.message}`);
    },
  });
};

// Bulk set tenant overrides mutation
export const useBulkSetTenantOverrides = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      tenantId, 
      overrides, 
      updatedBy 
    }: { 
      tenantId: string; 
      overrides: Array<{ flagKey: FeatureFlagKey; enabled: boolean }>; 
      updatedBy: string; 
    }) => tenantApi.bulkSetTenantOverrides(tenantId, overrides, updatedBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: TENANT_QUERY_KEYS.TENANT_OVERRIDES(variables.tenantId) 
      });
      // Invalidate flag tenant queries for all affected flags
      variables.overrides.forEach(override => {
        queryClient.invalidateQueries({ 
          queryKey: TENANT_QUERY_KEYS.FLAG_TENANTS(override.flagKey) 
        });
      });
      message.success(
        `テナント "${variables.tenantId}" の ${variables.overrides.length} 個のフラグを一括更新しました`
      );
    },
    onError: (error: any) => {
      message.error(`一括テナントオーバーライドの設定に失敗しました: ${error.message}`);
    },
  });
};