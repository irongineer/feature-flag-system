import { Tenant, User, AttendanceRecord, LeaveRequest } from './types';

// テストテナント定義
export const TEST_TENANTS: Tenant[] = [
  {
    tenantId: 'enterprise-corp',
    name: 'エンタープライズ株式会社',
    plan: 'enterprise',
    employees: 500,
    features: [
      'advanced_analytics',
      'custom_reports',
      'slack_integration',
      'teams_integration',
      'biometric_authentication',
      'gps_location_tracking',
      'advanced_leave_management',
      'api_v2_enabled',
      'webhook_notifications'
    ],
    createdAt: '2024-01-01T00:00:00Z',
    status: 'active'
  },
  {
    tenantId: 'startup-inc',
    name: 'スタートアップ株式会社',
    plan: 'standard',
    employees: 50,
    features: [
      'slack_integration',
      'mobile_app_enabled',
      'advanced_leave_management',
      'custom_reports'
    ],
    createdAt: '2024-03-01T00:00:00Z',
    status: 'active'
  },
  {
    tenantId: 'small-business',
    name: '中小企業',
    plan: 'basic',
    employees: 20,
    features: [
      'mobile_app_enabled'
    ],
    createdAt: '2024-05-01T00:00:00Z',
    status: 'active'
  }
];

// テストユーザー定義（各テナントに最低2ユーザー）
export const TEST_USERS: User[] = [
  // エンタープライズ株式会社
  {
    userId: 'user-enterprise-admin',
    tenantId: 'enterprise-corp',
    email: 'admin@enterprise-corp.com',
    name: '管理者 太郎',
    role: 'admin',
    department: '総務部',
    employeeId: 'EC-001',
    createdAt: '2024-01-02T00:00:00Z',
    status: 'active'
  },
  {
    userId: 'user-enterprise-employee',
    tenantId: 'enterprise-corp',
    email: 'employee@enterprise-corp.com',
    name: '従業員 花子',
    role: 'employee',
    department: '開発部',
    employeeId: 'EC-002',
    createdAt: '2024-01-02T00:00:00Z',
    status: 'active'
  },
  {
    userId: 'user-enterprise-manager',
    tenantId: 'enterprise-corp',
    email: 'manager@enterprise-corp.com',
    name: 'マネージャー 次郎',
    role: 'manager',
    department: '開発部',
    employeeId: 'EC-003',
    createdAt: '2024-01-02T00:00:00Z',
    status: 'active'
  },
  
  // スタートアップ株式会社
  {
    userId: 'user-startup-admin',
    tenantId: 'startup-inc',
    email: 'admin@startup-inc.com',
    name: 'スタートアップ 代表',
    role: 'admin',
    department: '経営企画',
    employeeId: 'SI-001',
    createdAt: '2024-03-02T00:00:00Z',
    status: 'active'
  },
  {
    userId: 'user-startup-employee',
    tenantId: 'startup-inc',
    email: 'employee@startup-inc.com',
    name: 'エンジニア 三郎',
    role: 'employee',
    department: 'エンジニアリング',
    employeeId: 'SI-002',
    createdAt: '2024-03-02T00:00:00Z',
    status: 'active'
  },
  {
    userId: 'user-startup-manager',
    tenantId: 'startup-inc',
    email: 'manager@startup-inc.com',
    name: 'リードエンジニア 四郎',
    role: 'manager',
    department: 'エンジニアリング',
    employeeId: 'SI-003',
    createdAt: '2024-03-02T00:00:00Z',
    status: 'active'
  },
  
  // 中小企業
  {
    userId: 'user-small-admin',
    tenantId: 'small-business',
    email: 'admin@small-business.com',
    name: '中小企業 社長',
    role: 'admin',
    department: '本社',
    employeeId: 'SB-001',
    createdAt: '2024-05-02T00:00:00Z',
    status: 'active'
  },
  {
    userId: 'user-small-employee',
    tenantId: 'small-business',
    email: 'employee@small-business.com',
    name: '事務員 五郎',
    role: 'employee',
    department: '事務',
    employeeId: 'SB-002',
    createdAt: '2024-05-02T00:00:00Z',
    status: 'active'
  }
];

// テスト用勤怠データ
export const TEST_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  // エンタープライズ株式会社のデータ
  {
    recordId: 'att-ec-001',
    userId: 'user-enterprise-employee',
    tenantId: 'enterprise-corp',
    date: '2025-07-18',
    clockIn: '09:00:00',
    clockOut: '18:00:00',
    breakStart: '12:00:00',
    breakEnd: '13:00:00',
    totalHours: 8,
    overtimeHours: 0,
    status: 'present',
    location: {
      lat: 35.6762,
      lng: 139.6503,
      address: '東京都渋谷区'
    },
    notes: '通常勤務',
    createdAt: '2025-07-18T09:00:00Z',
    updatedAt: '2025-07-18T18:00:00Z'
  },
  {
    recordId: 'att-ec-002',
    userId: 'user-enterprise-manager',
    tenantId: 'enterprise-corp',
    date: '2025-07-18',
    clockIn: '08:30:00',
    clockOut: '19:30:00',
    breakStart: '12:00:00',
    breakEnd: '13:00:00',
    totalHours: 10,
    overtimeHours: 2,
    status: 'present',
    location: {
      lat: 35.6762,
      lng: 139.6503,
      address: '東京都渋谷区'
    },
    notes: '残業あり',
    createdAt: '2025-07-18T08:30:00Z',
    updatedAt: '2025-07-18T19:30:00Z'
  },
  
  // スタートアップ株式会社のデータ
  {
    recordId: 'att-si-001',
    userId: 'user-startup-employee',
    tenantId: 'startup-inc',
    date: '2025-07-18',
    clockIn: '10:00:00',
    clockOut: '19:00:00',
    breakStart: '12:30:00',
    breakEnd: '13:30:00',
    totalHours: 8,
    overtimeHours: 0,
    status: 'present',
    notes: 'フレックス勤務',
    createdAt: '2025-07-18T10:00:00Z',
    updatedAt: '2025-07-18T19:00:00Z'
  },
  {
    recordId: 'att-si-002',
    userId: 'user-startup-manager',
    tenantId: 'startup-inc',
    date: '2025-07-18',
    clockIn: '09:00:00',
    clockOut: '18:00:00',
    breakStart: '12:00:00',
    breakEnd: '13:00:00',
    totalHours: 8,
    overtimeHours: 0,
    status: 'present',
    notes: '通常勤務',
    createdAt: '2025-07-18T09:00:00Z',
    updatedAt: '2025-07-18T18:00:00Z'
  },
  
  // 中小企業のデータ
  {
    recordId: 'att-sb-001',
    userId: 'user-small-employee',
    tenantId: 'small-business',
    date: '2025-07-18',
    clockIn: '09:00:00',
    clockOut: '17:00:00',
    breakStart: '12:00:00',
    breakEnd: '13:00:00',
    totalHours: 7,
    overtimeHours: 0,
    status: 'present',
    notes: '定時勤務',
    createdAt: '2025-07-18T09:00:00Z',
    updatedAt: '2025-07-18T17:00:00Z'
  }
];

// テスト用有給申請データ
export const TEST_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    requestId: 'leave-001',
    userId: 'user-enterprise-employee',
    tenantId: 'enterprise-corp',
    type: 'paid_leave',
    startDate: '2025-07-25',
    endDate: '2025-07-25',
    days: 1,
    reason: '私用のため',
    status: 'pending',
    createdAt: '2025-07-18T10:00:00Z',
    updatedAt: '2025-07-18T10:00:00Z'
  },
  {
    requestId: 'leave-002',
    userId: 'user-startup-employee',
    tenantId: 'startup-inc',
    type: 'sick_leave',
    startDate: '2025-07-22',
    endDate: '2025-07-23',
    days: 2,
    reason: '体調不良のため',
    status: 'approved',
    approvedBy: 'user-startup-manager',
    approvedAt: '2025-07-18T11:00:00Z',
    createdAt: '2025-07-18T09:00:00Z',
    updatedAt: '2025-07-18T11:00:00Z'
  },
  {
    requestId: 'leave-003',
    userId: 'user-small-employee',
    tenantId: 'small-business',
    type: 'personal_leave',
    startDate: '2025-07-30',
    endDate: '2025-07-31',
    days: 2,
    reason: '家族の用事',
    status: 'pending',
    createdAt: '2025-07-18T14:00:00Z',
    updatedAt: '2025-07-18T14:00:00Z'
  }
];

// テナント別フィーチャーフラグの初期設定
export const TEST_FEATURE_FLAGS = {
  'enterprise-corp': {
    'new_dashboard_v2': true,
    'mobile_app_enabled': true,
    'dark_mode_theme': true,
    'overtime_calculation_v2': true,
    'advanced_leave_management': true,
    'biometric_authentication': true,
    'gps_location_tracking': true,
    'slack_integration': true,
    'teams_integration': true,
    'api_v2_enabled': true,
    'webhook_notifications': true,
    'advanced_analytics': true,
    'custom_reports': true,
    'real_time_monitoring': true,
    'maintenance_mode': false,
    'emergency_override': false
  },
  'startup-inc': {
    'new_dashboard_v2': false, // A/Bテスト用
    'mobile_app_enabled': true,
    'dark_mode_theme': false,
    'overtime_calculation_v2': false,
    'advanced_leave_management': true,
    'biometric_authentication': false,
    'gps_location_tracking': false,
    'slack_integration': true,
    'teams_integration': false,
    'api_v2_enabled': false,
    'webhook_notifications': false,
    'advanced_analytics': false,
    'custom_reports': true,
    'real_time_monitoring': false,
    'maintenance_mode': false,
    'emergency_override': false
  },
  'small-business': {
    'new_dashboard_v2': false,
    'mobile_app_enabled': true,
    'dark_mode_theme': false,
    'overtime_calculation_v2': false,
    'advanced_leave_management': false,
    'biometric_authentication': false,
    'gps_location_tracking': false,
    'slack_integration': false,
    'teams_integration': false,
    'api_v2_enabled': false,
    'webhook_notifications': false,
    'advanced_analytics': false,
    'custom_reports': false,
    'real_time_monitoring': false,
    'maintenance_mode': false,
    'emergency_override': false
  }
};

// テナント別ユーザー取得のヘルパー関数
export function getUsersByTenant(tenantId: string): User[] {
  return TEST_USERS.filter(user => user.tenantId === tenantId);
}

// 特定のテナントのテストデータ取得
export function getTestDataForTenant(tenantId: string) {
  return {
    tenant: TEST_TENANTS.find(t => t.tenantId === tenantId),
    users: getUsersByTenant(tenantId),
    attendanceRecords: TEST_ATTENDANCE_RECORDS.filter(r => r.tenantId === tenantId),
    leaveRequests: TEST_LEAVE_REQUESTS.filter(r => r.tenantId === tenantId),
    featureFlags: TEST_FEATURE_FLAGS[tenantId as keyof typeof TEST_FEATURE_FLAGS]
  };
}

// 全テナントのサマリー
export function getAllTenantsWithUsers() {
  return TEST_TENANTS.map(tenant => ({
    ...tenant,
    users: getUsersByTenant(tenant.tenantId),
    userCount: getUsersByTenant(tenant.tenantId).length
  }));
}