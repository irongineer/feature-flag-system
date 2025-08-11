export * from '@feature-flag/core';

// UI specific types
export interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  width?: number;
  render?: (value: any, record: any) => React.ReactNode;
  sorter?: boolean;
  filterable?: boolean;
}

export interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
}

export interface FilterConfig {
  search?: string;
  enabled?: boolean;
  owner?: string;
  hasOverrides?: boolean;
  dateRange?: [string, string];
}

// Form types
export interface FlagFormData {
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  expiresAt?: string;
}

export interface TenantOverrideFormData {
  tenantId: string;
  flagKey: string;
  enabled: boolean;
  updatedBy: string;
}

export interface KillSwitchFormData {
  flagKey?: string;
  reason: string;
  activatedBy: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Dashboard types
export interface DashboardMetrics {
  totalFlags: number;
  activeFlags: number;
  killSwitchesActive: number;
  tenantsWithOverrides: number;
  flagUsageStats: FlagUsageStats[];
}

export interface FlagUsageStats {
  flagKey: string;
  evaluations: number;
  lastAccessed: string;
}

export interface RecentActivity {
  id: string;
  type: 'flag_created' | 'flag_updated' | 'tenant_override' | 'kill_switch';
  message: string;
  timestamp: string;
  user: string;
}

// Audit types
export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  flagKey?: string;
  tenantId?: string;
  user: string;
  changes: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  flagKey?: string;
  tenantId?: string;
  action?: string;
  user?: string;
}

// Component props types
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

export interface LoadingProps extends BaseComponentProps {
  loading?: boolean;
  size?: 'small' | 'default' | 'large';
}

// Navigation types
export interface MenuItem {
  key: string;
  path: string;
  name: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// State types for Redux/Context (if needed)
export interface AppState {
  user: UserInfo | null;
  loading: boolean;
  error: ApiError | null;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];
}
