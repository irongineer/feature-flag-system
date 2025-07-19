import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { FeatureFlagContext } from '../../packages/attendance-core/src/types';
import { featureFlagClient } from '../client/feature-flag-client';

// フィーチャーフラグコンテキスト
interface FeatureFlagContextValue {
  context: FeatureFlagContext;
  updateContext: (newContext: Partial<FeatureFlagContext>) => void;
}

const FeatureFlagContextProvider = createContext<FeatureFlagContextValue | null>(null);

// フィーチャーフラグプロバイダー
interface FeatureFlagProviderProps {
  children: ReactNode;
  initialContext: FeatureFlagContext;
}

export function FeatureFlagProvider({ children, initialContext }: FeatureFlagProviderProps) {
  const [context, setContext] = useState<FeatureFlagContext>(initialContext);

  const updateContext = (newContext: Partial<FeatureFlagContext>) => {
    setContext(prev => ({ ...prev, ...newContext }));
  };

  return (
    <FeatureFlagContextProvider.Provider value={{ context, updateContext }}>
      {children}
    </FeatureFlagContextProvider.Provider>
  );
}

// フィーチャーフラグコンテキストを取得するHook
export function useFeatureFlagContext() {
  const context = useContext(FeatureFlagContextProvider);
  if (!context) {
    throw new Error('useFeatureFlagContext must be used within a FeatureFlagProvider');
  }
  return context;
}

// 単一のフィーチャーフラグを使用するHook
export function useFeatureFlag(flagKey: string) {
  const { context } = useFeatureFlagContext();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const evaluateFlag = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await featureFlagClient.isEnabled(flagKey, context);
        
        if (isMounted) {
          setEnabled(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    evaluateFlag();

    return () => {
      isMounted = false;
    };
  }, [flagKey, context]);

  return { enabled, loading, error };
}

// 複数のフィーチャーフラグを使用するHook
export function useFeatureFlags(flagKeys: string[]) {
  const { context } = useFeatureFlagContext();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const evaluateFlags = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.all(
          flagKeys.map(async (flagKey) => {
            const enabled = await featureFlagClient.isEnabled(flagKey, context);
            return { [flagKey]: enabled };
          })
        );

        const flagsObject = results.reduce((acc, result) => ({ ...acc, ...result }), {});
        
        if (isMounted) {
          setFlags(flagsObject);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    evaluateFlags();

    return () => {
      isMounted = false;
    };
  }, [flagKeys, context]);

  return { flags, loading, error };
}

// すべてのフィーチャーフラグを使用するHook
export function useAllFeatureFlags() {
  const { context } = useFeatureFlagContext();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const evaluateAllFlags = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await featureFlagClient.getAllFlags(context);
        
        if (isMounted) {
          setFlags(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    evaluateAllFlags();

    return () => {
      isMounted = false;
    };
  }, [context]);

  return { flags, loading, error };
}

// フィーチャーフラグのバリアントを使用するHook
export function useFeatureFlagVariant(flagKey: string) {
  const { context } = useFeatureFlagContext();
  const [variant, setVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const evaluateVariant = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await featureFlagClient.getVariant(flagKey, context);
        
        if (isMounted) {
          setVariant(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    evaluateVariant();

    return () => {
      isMounted = false;
    };
  }, [flagKey, context]);

  return { variant, loading, error };
}

// 条件付きレンダリング用のコンポーネント
interface FeatureFlagProps {
  flagKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag({ flagKey, children, fallback = null }: FeatureFlagProps) {
  const { enabled, loading } = useFeatureFlag(flagKey);

  if (loading) {
    return <>{fallback}</>;
  }

  return enabled ? <>{children}</> : <>{fallback}</>;
}

// バリアント別レンダリング用のコンポーネント
interface FeatureFlagVariantProps {
  flagKey: string;
  variants: Record<string, ReactNode>;
  fallback?: ReactNode;
}

export function FeatureFlagVariant({ flagKey, variants, fallback = null }: FeatureFlagVariantProps) {
  const { variant, loading } = useFeatureFlagVariant(flagKey);

  if (loading) {
    return <>{fallback}</>;
  }

  return variant && variants[variant] ? <>{variants[variant]}</> : <>{fallback}</>;
}

// 勤怠SaaS用の特定フィーチャーフラグHooks
export function useAttendanceFeatureFlags() {
  const attendanceFlags = [
    'new_dashboard_v2',
    'mobile_app_enabled',
    'dark_mode_theme',
    'overtime_calculation_v2',
    'advanced_leave_management',
    'biometric_authentication',
    'gps_location_tracking',
    'slack_integration',
    'teams_integration',
    'api_v2_enabled',
    'webhook_notifications',
    'advanced_analytics',
    'custom_reports',
    'real_time_monitoring',
    'maintenance_mode',
    'emergency_override'
  ];

  return useFeatureFlags(attendanceFlags);
}

// 新ダッシュボード用Hook
export function useNewDashboard() {
  return useFeatureFlag('new_dashboard_v2');
}

// 高度な分析機能用Hook
export function useAdvancedAnalytics() {
  return useFeatureFlag('advanced_analytics');
}

// GPS位置追跡用Hook
export function useGPSTracking() {
  return useFeatureFlag('gps_location_tracking');
}

// メンテナンスモード用Hook
export function useMaintenanceMode() {
  return useFeatureFlag('maintenance_mode');
}

// 緊急オーバーライド用Hook
export function useEmergencyOverride() {
  return useFeatureFlag('emergency_override');
}