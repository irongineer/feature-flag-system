// 勤怠SaaSシステムの基本型定義

export interface Tenant {
  tenantId: string;
  name: string;
  plan: 'basic' | 'standard' | 'enterprise';
  employees: number;
  features: string[];
  createdAt: string;
  status: 'active' | 'suspended' | 'trial';
}

export interface User {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  employeeId: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface AttendanceRecord {
  recordId: string;
  userId: string;
  tenantId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  totalHours?: number;
  overtimeHours?: number;
  status: 'present' | 'absent' | 'late' | 'early_leave';
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  requestId: string;
  userId: string;
  tenantId: string;
  type: 'paid_leave' | 'sick_leave' | 'personal_leave' | 'maternity_leave';
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagContext {
  tenantId: string;
  userId?: string;        // オプショナル: ユーザー固有の評価が不要な場合
  userRole?: string;      // オプショナル: 権限ベースの制御が不要な場合
  plan?: string;          // オプショナル: プラン情報が利用できない場合
  environment?: 'development' | 'staging' | 'production'; // オプショナル
  metadata?: Record<string, any>;
}

export interface AttendanceSystem {
  timeTracking: TimeTrackingService;
  leaveManagement: LeaveManagementService;
  approvalWorkflow: ApprovalWorkflowService;
  featureFlags: FeatureFlagClient;
  tenantManager: TenantManagerService;
}

// サービスインターフェース
export interface TimeTrackingService {
  clockIn(userId: string, tenantId: string, location?: any): Promise<AttendanceRecord>;
  clockOut(userId: string, tenantId: string, location?: any): Promise<AttendanceRecord>;
  getTodayAttendance(userId: string, tenantId: string): Promise<AttendanceRecord | null>;
  getAttendanceHistory(userId: string, tenantId: string, from: string, to: string): Promise<AttendanceRecord[]>;
}

export interface LeaveManagementService {
  createLeaveRequest(request: Omit<LeaveRequest, 'requestId' | 'createdAt' | 'updatedAt'>): Promise<LeaveRequest>;
  approveLeaveRequest(requestId: string, approverId: string): Promise<LeaveRequest>;
  rejectLeaveRequest(requestId: string, approverId: string, reason: string): Promise<LeaveRequest>;
  getLeaveRequests(tenantId: string, userId?: string): Promise<LeaveRequest[]>;
}

export interface ApprovalWorkflowService {
  submitForApproval(requestId: string, approverId: string): Promise<void>;
  getApprovalQueue(approverId: string): Promise<LeaveRequest[]>;
}

export interface FeatureFlagClient {
  isEnabled(flagKey: string, context: FeatureFlagContext): Promise<boolean>;
  getVariant(flagKey: string, context: FeatureFlagContext): Promise<string | null>;
  getAllFlags(context: FeatureFlagContext): Promise<Record<string, boolean>>;
}

export interface TenantManagerService {
  getTenant(tenantId: string): Promise<Tenant>;
  getUsers(tenantId: string): Promise<User[]>;
  createUser(user: Omit<User, 'userId' | 'createdAt'>): Promise<User>;
}

// フィーチャーフラグ定義
export const ATTENDANCE_FEATURE_FLAGS = {
  // UI関連
  NEW_DASHBOARD_V2: 'new_dashboard_v2',
  MOBILE_APP_ENABLED: 'mobile_app_enabled',
  DARK_MODE_THEME: 'dark_mode_theme',
  
  // 機能関連
  OVERTIME_CALCULATION_V2: 'overtime_calculation_v2',
  ADVANCED_LEAVE_MANAGEMENT: 'advanced_leave_management',
  BIOMETRIC_AUTHENTICATION: 'biometric_authentication',
  GPS_LOCATION_TRACKING: 'gps_location_tracking',
  
  // 統合関連
  SLACK_INTEGRATION: 'slack_integration',
  TEAMS_INTEGRATION: 'teams_integration',
  API_V2_ENABLED: 'api_v2_enabled',
  WEBHOOK_NOTIFICATIONS: 'webhook_notifications',
  
  // 分析関連
  ADVANCED_ANALYTICS: 'advanced_analytics',
  CUSTOM_REPORTS: 'custom_reports',
  REAL_TIME_MONITORING: 'real_time_monitoring',
  
  // 緊急対応
  MAINTENANCE_MODE: 'maintenance_mode',
  EMERGENCY_OVERRIDE: 'emergency_override'
} as const;

export type AttendanceFeatureFlag = typeof ATTENDANCE_FEATURE_FLAGS[keyof typeof ATTENDANCE_FEATURE_FLAGS];