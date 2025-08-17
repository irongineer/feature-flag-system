import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featureFlagApi } from '../services/api';
import type { FeatureFlagKey, FeatureFlagsTable } from '../types';
import { message } from 'antd';

// Query keys
export const QUERY_KEYS = {
  FLAGS: ['flags'] as const,
  FLAG: (flagKey: FeatureFlagKey) => ['flags', flagKey] as const,
  FLAG_EVALUATION: (tenantId: string, flagKey: FeatureFlagKey) =>
    ['flags', flagKey, 'evaluation', tenantId] as const,
};

// Get all flags
export const useFeatureFlags = () => {
  return useQuery({
    queryKey: QUERY_KEYS.FLAGS,
    queryFn: featureFlagApi.getFlags,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get single flag
export const useFeatureFlag = (flagKey: FeatureFlagKey) => {
  return useQuery({
    queryKey: QUERY_KEYS.FLAG(flagKey),
    queryFn: () => featureFlagApi.getFlag(flagKey),
    enabled: !!flagKey,
  });
};

// Evaluate flag for tenant
export const useFlagEvaluation = (tenantId: string, flagKey: FeatureFlagKey) => {
  return useQuery({
    queryKey: QUERY_KEYS.FLAG_EVALUATION(tenantId, flagKey),
    queryFn: () => featureFlagApi.evaluateFlag(tenantId, flagKey),
    enabled: !!tenantId && !!flagKey,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Create flag mutation
export const useCreateFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: featureFlagApi.createFlag,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FLAGS });
      message.success(`フラグ "${data.flagKey}" を作成しました`);
    },
    onError: (error: any) => {
      message.error(`フラグの作成に失敗しました: ${error.message}`);
    },
  });
};

// Update flag mutation
export const useUpdateFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      flagKey,
      updates,
    }: {
      flagKey: FeatureFlagKey;
      updates: Partial<FeatureFlagsTable>;
    }) => featureFlagApi.updateFlag(flagKey, updates),
    onSuccess: (data, variables) => {
      // First update the cache directly with the returned data
      queryClient.setQueryData(QUERY_KEYS.FLAGS, (oldData: FeatureFlagsTable[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(flag => 
          flag.flagKey === data.flagKey ? { ...flag, ...data } : flag
        );
      });
      
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FLAGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FLAG(variables.flagKey) });
      // Note: Success message is handled in the component for better UX control
    },
    onError: (error: any) => {
      message.error(`フラグの更新に失敗しました: ${error.message}`);
    },
  });
};

// Delete flag mutation
export const useDeleteFlag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: featureFlagApi.deleteFlag,
    onSuccess: (_, flagKey) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FLAGS });
      queryClient.removeQueries({ queryKey: QUERY_KEYS.FLAG(flagKey) });
      message.success(`フラグ "${flagKey}" を削除しました`);
    },
    onError: (error: any) => {
      message.error(`フラグの削除に失敗しました: ${error.message}`);
    },
  });
};
