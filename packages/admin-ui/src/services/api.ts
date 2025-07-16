import axios from 'axios';
import type { FeatureFlagKey, FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '@feature-flag/core';

// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Feature Flag API
export const featureFlagApi = {
  // Get all flags
  async getFlags(): Promise<FeatureFlagsTable[]> {
    const response = await apiClient.get('/flags');
    return response.data;
  },

  // Get flag by key
  async getFlag(flagKey: FeatureFlagKey): Promise<FeatureFlagsTable> {
    const response = await apiClient.get(`/flags/${flagKey}`);
    return response.data;
  },

  // Create new flag
  async createFlag(flag: Omit<FeatureFlagsTable, 'PK' | 'SK' | 'createdAt'>): Promise<FeatureFlagsTable> {
    const response = await apiClient.post('/flags', flag);
    return response.data;
  },

  // Update flag
  async updateFlag(flagKey: FeatureFlagKey, updates: Partial<FeatureFlagsTable>): Promise<FeatureFlagsTable> {
    const response = await apiClient.put(`/flags/${flagKey}`, updates);
    return response.data;
  },

  // Delete flag
  async deleteFlag(flagKey: FeatureFlagKey): Promise<void> {
    await apiClient.delete(`/flags/${flagKey}`);
  },

  // Evaluate flag for tenant
  async evaluateFlag(tenantId: string, flagKey: FeatureFlagKey): Promise<{ enabled: boolean; reason: string }> {
    const response = await apiClient.get(`/flags/${flagKey}/evaluate`, {
      params: { tenantId },
    });
    return response.data;
  },
};

// Tenant Override API
export const tenantApi = {
  // Get tenant overrides
  async getTenantOverrides(tenantId: string): Promise<TenantOverridesTable[]> {
    const response = await apiClient.get(`/tenants/${tenantId}/overrides`);
    return response.data;
  },

  // Get all tenant overrides for a flag
  async getFlagTenantOverrides(flagKey: FeatureFlagKey): Promise<TenantOverridesTable[]> {
    const response = await apiClient.get(`/flags/${flagKey}/tenants`);
    return response.data;
  },

  // Set tenant override
  async setTenantOverride(
    tenantId: string,
    flagKey: FeatureFlagKey,
    enabled: boolean,
    updatedBy: string
  ): Promise<TenantOverridesTable> {
    const response = await apiClient.put(`/tenants/${tenantId}/overrides/${flagKey}`, {
      enabled,
      updatedBy,
    });
    return response.data;
  },

  // Remove tenant override
  async removeTenantOverride(tenantId: string, flagKey: FeatureFlagKey): Promise<void> {
    await apiClient.delete(`/tenants/${tenantId}/overrides/${flagKey}`);
  },

  // Bulk set tenant overrides
  async bulkSetTenantOverrides(
    tenantId: string,
    overrides: Array<{ flagKey: FeatureFlagKey; enabled: boolean }>,
    updatedBy: string
  ): Promise<TenantOverridesTable[]> {
    const response = await apiClient.post(`/tenants/${tenantId}/overrides/bulk`, {
      overrides,
      updatedBy,
    });
    return response.data;
  },
};

// Kill Switch API
export const killSwitchApi = {
  // Get all kill switches
  async getKillSwitches(): Promise<EmergencyControlTable[]> {
    const response = await apiClient.get('/kill-switches');
    return response.data;
  },

  // Get kill switch by flag
  async getKillSwitch(flagKey?: FeatureFlagKey): Promise<EmergencyControlTable> {
    const endpoint = flagKey ? `/kill-switches/${flagKey}` : '/kill-switches/global';
    const response = await apiClient.get(endpoint);
    return response.data;
  },

  // Activate kill switch
  async activateKillSwitch(
    flagKey: FeatureFlagKey | null,
    reason: string,
    activatedBy: string
  ): Promise<EmergencyControlTable> {
    const response = await apiClient.post('/kill-switches/activate', {
      flagKey,
      reason,
      activatedBy,
    });
    return response.data;
  },

  // Deactivate kill switch
  async deactivateKillSwitch(
    flagKey: FeatureFlagKey | null,
    deactivatedBy: string
  ): Promise<EmergencyControlTable> {
    const response = await apiClient.post('/kill-switches/deactivate', {
      flagKey,
      deactivatedBy,
    });
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  // Get dashboard metrics
  async getMetrics(): Promise<{
    totalFlags: number;
    activeFlags: number;
    killSwitchesActive: number;
    tenantsWithOverrides: number;
    flagUsageStats: Array<{ flagKey: string; evaluations: number; lastAccessed: string }>;
  }> {
    const response = await apiClient.get('/dashboard/metrics');
    return response.data;
  },

  // Get recent activities
  async getRecentActivities(): Promise<Array<{
    id: string;
    type: 'flag_created' | 'flag_updated' | 'tenant_override' | 'kill_switch';
    message: string;
    timestamp: string;
    user: string;
  }>> {
    const response = await apiClient.get('/dashboard/activities');
    return response.data;
  },
};

// Audit Log API
export const auditApi = {
  // Get audit logs
  async getAuditLogs(params?: {
    startDate?: string;
    endDate?: string;
    flagKey?: FeatureFlagKey;
    tenantId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      timestamp: string;
      action: string;
      flagKey?: string;
      tenantId?: string;
      user: string;
      changes: Record<string, any>;
      metadata?: Record<string, any>;
    }>;
    total: number;
  }> {
    const response = await apiClient.get('/audit/logs', { params });
    return response.data;
  },

  // Export audit logs
  async exportAuditLogs(params?: {
    startDate?: string;
    endDate?: string;
    flagKey?: FeatureFlagKey;
    tenantId?: string;
    format?: 'csv' | 'json';
  }): Promise<Blob> {
    const response = await apiClient.get('/audit/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default apiClient;