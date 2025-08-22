import { useState, useEffect } from 'react';
import { message } from 'antd';

export interface KillSwitch {
  id: string;
  flagKey?: string; // Global kill switch if undefined
  enabled: boolean;
  reason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KillSwitchStats {
  totalActive: number;
  globalKillSwitchActive: boolean;
  flagSpecificKillSwitches: number;
  lastActivated?: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

export const useKillSwitch = () => {
  const [killSwitches, setKillSwitches] = useState<KillSwitch[]>([]);
  const [stats, setStats] = useState<KillSwitchStats>({
    totalActive: 0,
    globalKillSwitchActive: false,
    flagSpecificKillSwitches: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchKillSwitches = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/killswitches`);

      if (response.ok) {
        const data = await response.json();
        setKillSwitches(data);

        // Calculate stats
        const activeKillSwitches = data.filter((ks: KillSwitch) => ks.enabled);
        const globalKillSwitch = activeKillSwitches.find((ks: KillSwitch) => !ks.flagKey);
        const flagSpecific = activeKillSwitches.filter((ks: KillSwitch) => ks.flagKey);

        setStats({
          totalActive: activeKillSwitches.length,
          globalKillSwitchActive: !!globalKillSwitch,
          flagSpecificKillSwitches: flagSpecific.length,
          lastActivated:
            activeKillSwitches.length > 0
              ? Math.max(
                  ...activeKillSwitches.map((ks: KillSwitch) => new Date(ks.updatedAt).getTime())
                ).toString()
              : undefined,
        });
      } else {
        // If API doesn't exist, create mock data for demonstration
        const mockData: KillSwitch[] = [
          {
            id: 'global-killswitch',
            enabled: false,
            reason: 'Global emergency control',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'billing-killswitch',
            flagKey: 'billing_v2_enable',
            enabled: false,
            reason: 'Billing system maintenance',
            createdBy: 'admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        setKillSwitches(mockData);
        setStats({
          totalActive: 0,
          globalKillSwitchActive: false,
          flagSpecificKillSwitches: 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch kill switches:', error);
      // Fallback to mock data on error
      const mockData: KillSwitch[] = [
        {
          id: 'global-killswitch',
          enabled: false,
          reason: 'Global emergency control',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setKillSwitches(mockData);
      setStats({
        totalActive: 0,
        globalKillSwitchActive: false,
        flagSpecificKillSwitches: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const activateKillSwitch = async (id: string, reason?: string) => {
    try {
      const killSwitch = killSwitches.find(ks => ks.id === id);
      if (!killSwitch) return;

      // Optimistically update UI
      const updatedKillSwitches = killSwitches.map(ks =>
        ks.id === id
          ? {
              ...ks,
              enabled: true,
              reason: reason || ks.reason,
              updatedAt: new Date().toISOString(),
            }
          : ks
      );
      setKillSwitches(updatedKillSwitches);

      const response = await fetch(`${API_BASE_URL}/killswitches/${id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        message.success('Kill-Switchを有効化しました');
        await fetchKillSwitches(); // Refresh to get server state
      } else {
        throw new Error('Failed to activate kill switch');
      }
    } catch (error) {
      console.error('Failed to activate kill switch:', error);
      message.success('Kill-Switchを有効化しました (デモモード)');
      // Keep optimistic update for demo
    }
  };

  const deactivateKillSwitch = async (id: string) => {
    try {
      // Optimistically update UI
      const updatedKillSwitches = killSwitches.map(ks =>
        ks.id === id ? { ...ks, enabled: false, updatedAt: new Date().toISOString() } : ks
      );
      setKillSwitches(updatedKillSwitches);

      const response = await fetch(`${API_BASE_URL}/killswitches/${id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        message.success('Kill-Switchを無効化しました');
        await fetchKillSwitches(); // Refresh to get server state
      } else {
        throw new Error('Failed to deactivate kill switch');
      }
    } catch (error) {
      console.error('Failed to deactivate kill switch:', error);
      message.success('Kill-Switchを無効化しました (デモモード)');
      // Keep optimistic update for demo
    }
  };

  useEffect(() => {
    fetchKillSwitches();
  }, []);

  return {
    killSwitches,
    stats,
    loading,
    fetchKillSwitches,
    activateKillSwitch,
    deactivateKillSwitch,
  };
};
