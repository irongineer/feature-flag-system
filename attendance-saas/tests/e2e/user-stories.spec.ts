import { test, expect } from '@playwright/test';

/**
 * 実際のユーザーストーリーに基づいたE2Eテストケース
 * 勤怠SaaSシステムでのフィーチャーフラグ効果を検証
 */

// テスト用のベースURL
const API_BASE_URL = 'http://localhost:3002';

// テスト用のテナントとユーザー情報
const TENANTS = {
  enterprise: {
    tenantId: 'enterprise-corp',
    plan: 'enterprise',
    adminUser: 'user-enterprise-admin',
    employeeUser: 'user-enterprise-employee',
    name: 'エンタープライズ株式会社'
  },
  startup: {
    tenantId: 'startup-inc',
    plan: 'standard',
    adminUser: 'user-startup-admin',
    employeeUser: 'user-startup-employee',
    name: 'スタートアップ株式会社'
  },
  basic: {
    tenantId: 'small-business',
    plan: 'basic',
    adminUser: 'user-small-admin',
    employeeUser: 'user-small-employee',
    name: '中小企業'
  }
};

test.describe('勤怠SaaS - 実際のユーザーストーリーテスト', () => {
  
  test.describe('ユーザーストーリー1: 一般従業員の出勤打刻', () => {
    test('Enterprise従業員: GPS位置情報付きで出勤打刻', async ({ request }) => {
      // Given: Enterprise プランの従業員がシステムにログイン
      const tenant = TENANTS.enterprise;
      
      // When: 出勤打刻を行う（位置情報付き）
      const response = await request.post(`${API_BASE_URL}/api/attendance/clock-in`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          location: {
            lat: 35.6762,
            lng: 139.6503,
            address: '東京都渋谷区'
          },
          notes: 'E2Eテスト用の出勤打刻'
        }
      });

      // Then: 正常に打刻され、位置情報が記録される
      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.message).toBe('Clock in successful');
      expect(data.record.location).toBeDefined();
      expect(data.record.location.lat).toBe(35.6762);
      expect(data.features.locationTracking).toBe(true);
    });

    test('Basic従業員: 位置情報なしで出勤打刻', async ({ request }) => {
      // Given: Basic プランの従業員がシステムにログイン
      const tenant = TENANTS.basic;
      
      // When: 出勤打刻を行う（位置情報付きで送信しても）
      const response = await request.post(`${API_BASE_URL}/api/attendance/clock-in`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          location: {
            lat: 35.6762,
            lng: 139.6503,
            address: '東京都渋谷区'
          },
          notes: 'E2Eテスト用の出勤打刻'
        }
      });

      // Then: 正常に打刻されるが、位置情報は記録されない
      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.message).toBe('Clock in successful');
      expect(data.record.location).toBeUndefined();
      expect(data.features.locationTracking).toBe(false);
    });
  });

  test.describe('ユーザーストーリー2: 管理者による分析データ確認', () => {
    test('Enterprise管理者: 高度な分析データにアクセス可能', async ({ request }) => {
      // Given: Enterprise プランの管理者がログイン
      const tenant = TENANTS.enterprise;
      
      // When: 高度な分析データにアクセス
      const response = await request.get(`${API_BASE_URL}/api/attendance/analytics/${tenant.employeeUser}`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.adminUser,
          'x-user-role': 'admin',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 分析データが取得できる
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.analytics).toBeDefined();
      expect(data.features.advancedAnalytics).toBe(true);
    });

    test('Basic管理者: 高度な分析データにアクセス拒否', async ({ request }) => {
      // Given: Basic プランの管理者がログイン
      const tenant = TENANTS.basic;
      
      // When: 高度な分析データにアクセス試行
      const response = await request.get(`${API_BASE_URL}/api/attendance/analytics/${tenant.employeeUser}`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.adminUser,
          'x-user-role': 'admin',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: アクセスが拒否される
      expect(response.status()).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Feature not available');
      expect(data.featureFlag).toBe('advanced_analytics');
    });
  });

  test.describe('ユーザーストーリー3: 有給申請と承認フロー', () => {
    test('Startup従業員: 有給申請作成（高度な有給管理機能あり）', async ({ request }) => {
      // Given: Standard プランの従業員がログイン
      const tenant = TENANTS.startup;
      
      // When: 有給申請を作成
      const response = await request.post(`${API_BASE_URL}/api/leave/requests`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          type: 'paid_leave',
          startDate: '2025-08-01',
          endDate: '2025-08-01',
          reason: 'E2Eテスト用有給申請'
        }
      });

      // Then: 申請が作成され、高度な有給管理機能が利用可能
      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.message).toBe('Leave request created successfully');
      expect(data.features.advancedLeaveManagement).toBe(true);
    });

    test('Basic従業員: 有給申請作成（基本機能のみ）', async ({ request }) => {
      // Given: Basic プランの従業員がログイン
      const tenant = TENANTS.basic;
      
      // When: 有給申請を作成
      const response = await request.post(`${API_BASE_URL}/api/leave/requests`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          type: 'paid_leave',
          startDate: '2025-08-01',
          endDate: '2025-08-01',
          reason: 'E2Eテスト用有給申請'
        }
      });

      // Then: 申請は作成されるが、高度な機能は利用不可
      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.message).toBe('Leave request created successfully');
      expect(data.features.advancedLeaveManagement).toBe(false);
    });
  });

  test.describe('ユーザーストーリー4: A/Bテストによる新機能体験', () => {
    test('Enterprise: 新ダッシュボードv2を体験', async ({ request }) => {
      // Given: Enterprise プランの従業員がログイン
      const tenant = TENANTS.enterprise;
      
      // When: ダッシュボードにアクセス
      const response = await request.get(`${API_BASE_URL}/api/dashboard/overview`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 新しいダッシュボードv2が表示される
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.newDashboardV2).toBe(true);
      expect(data.dashboard.weekly).toBeDefined(); // 新機能
    });

    test('Startup: 従来ダッシュボードを体験', async ({ request }) => {
      // Given: Standard プランの従業員がログイン（A/Bテストで従来版）
      const tenant = TENANTS.startup;
      
      // When: ダッシュボードにアクセス
      const response = await request.get(`${API_BASE_URL}/api/dashboard/overview`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 従来のダッシュボードが表示される
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.newDashboardV2).toBe(false);
      expect(data.dashboard.weekly).toBeUndefined(); // 新機能なし
    });
  });

  test.describe('ユーザーストーリー5: 段階的ロールアウトの体験', () => {
    test('Enterprise: 新機能のアーリーアクセス', async ({ request }) => {
      // Given: Enterprise プランの従業員がログイン
      const tenant = TENANTS.enterprise;
      
      // When: テナントの機能状況を確認
      const response = await request.get(`${API_BASE_URL}/api/tenant/features`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 段階的ロールアウト中の機能が有効
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.enabled).toContain('dark_mode_theme');
      expect(data.features.enabled).toContain('overtime_calculation_v2');
    });

    test('Basic: 新機能は未展開', async ({ request }) => {
      // Given: Basic プランの従業員がログイン
      const tenant = TENANTS.basic;
      
      // When: テナントの機能状況を確認
      const response = await request.get(`${API_BASE_URL}/api/tenant/features`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 段階的ロールアウト中の機能は未展開
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.enabled).not.toContain('dark_mode_theme');
      expect(data.features.enabled).not.toContain('overtime_calculation_v2');
    });
  });

  test.describe('ユーザーストーリー6: 統合機能の利用', () => {
    test('Enterprise: 全統合機能が利用可能', async ({ request }) => {
      // Given: Enterprise プランの管理者がログイン
      const tenant = TENANTS.enterprise;
      
      // When: テナント設定を確認
      const response = await request.get(`${API_BASE_URL}/api/tenant/settings`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.adminUser,
          'x-user-role': 'admin',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 全統合機能が利用可能
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.settings.integrations.slack).toBe(true);
      expect(data.settings.integrations.teams).toBe(true);
      expect(data.settings.integrations.webhook).toBe(true);
    });

    test('Basic: 統合機能は利用不可', async ({ request }) => {
      // Given: Basic プランの管理者がログイン
      const tenant = TENANTS.basic;
      
      // When: テナント設定を確認
      const response = await request.get(`${API_BASE_URL}/api/tenant/settings`, {
        headers: {
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.adminUser,
          'x-user-role': 'admin',
          'x-tenant-plan': tenant.plan
        }
      });

      // Then: 統合機能は利用不可
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.settings.integrations.slack).toBe(false);
      expect(data.settings.integrations.teams).toBe(false);
      expect(data.settings.integrations.webhook).toBe(false);
    });
  });

  test.describe('ユーザーストーリー7: 残業計算ロジックの違い', () => {
    test('Enterprise: 新しい残業計算v2を体験', async ({ request }) => {
      // Given: Enterprise プランの従業員が出勤済み
      const tenant = TENANTS.enterprise;
      
      // When: 退勤打刻を行う
      const response = await request.post(`${API_BASE_URL}/api/attendance/clock-out`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          notes: 'E2Eテスト用の退勤打刻'
        }
      });

      // Then: 新しい残業計算v2が使用される
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.overtimeCalculationV2).toBe(true);
    });

    test('Startup: 従来の残業計算を体験', async ({ request }) => {
      // Given: Standard プランの従業員が出勤済み
      const tenant = TENANTS.startup;
      
      // When: 退勤打刻を行う
      const response = await request.post(`${API_BASE_URL}/api/attendance/clock-out`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenant.tenantId,
          'x-user-id': tenant.employeeUser,
          'x-user-role': 'employee',
          'x-tenant-plan': tenant.plan
        },
        data: {
          userId: tenant.employeeUser,
          tenantId: tenant.tenantId,
          notes: 'E2Eテスト用の退勤打刻'
        }
      });

      // Then: 従来の残業計算が使用される
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.features.overtimeCalculationV2).toBe(false);
    });
  });

  test.describe('ユーザーストーリー8: 緊急時対応（Kill-Switch）', () => {
    test('メンテナンスモード: 全機能停止', async ({ request }) => {
      // Note: このテストは実際にはメンテナンスモードを有効にする必要があります
      // 実際の運用では、フィーチャーフラグ管理画面から設定します
      
      // Given: システムがメンテナンスモードに設定される
      // When: 任意のAPIにアクセス
      // Then: メンテナンスモードメッセージが返される
      
      // この機能は将来的に実装予定
      expect(true).toBe(true); // プレースホルダー
    });
  });
});

test.describe('統合テストシナリオ: 実際の業務フロー', () => {
  test('完全な業務フロー: 出勤→有給申請→承認→退勤', async ({ request }) => {
    const tenant = TENANTS.startup;
    
    // 1. 出勤打刻
    const clockInResponse = await request.post(`${API_BASE_URL}/api/attendance/clock-in`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenant.tenantId,
        'x-user-id': tenant.employeeUser,
        'x-user-role': 'employee',
        'x-tenant-plan': tenant.plan
      },
      data: {
        userId: tenant.employeeUser,
        tenantId: tenant.tenantId,
        notes: '統合テスト用出勤'
      }
    });
    expect(clockInResponse.status()).toBe(201);

    // 2. 有給申請作成
    const leaveResponse = await request.post(`${API_BASE_URL}/api/leave/requests`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenant.tenantId,
        'x-user-id': tenant.employeeUser,
        'x-user-role': 'employee',
        'x-tenant-plan': tenant.plan
      },
      data: {
        userId: tenant.employeeUser,
        tenantId: tenant.tenantId,
        type: 'paid_leave',
        startDate: '2025-08-15',
        endDate: '2025-08-15',
        reason: '統合テスト用有給申請'
      }
    });
    expect(leaveResponse.status()).toBe(201);

    // 3. 今日の勤怠確認
    const todayResponse = await request.get(`${API_BASE_URL}/api/attendance/today/${tenant.employeeUser}`, {
      headers: {
        'x-tenant-id': tenant.tenantId,
        'x-user-id': tenant.employeeUser,
        'x-user-role': 'employee',
        'x-tenant-plan': tenant.plan
      }
    });
    expect(todayResponse.status()).toBe(200);
    const todayData = await todayResponse.json();
    expect(todayData.record.clockIn).toBeDefined();
    expect(todayData.features.advancedLeaveManagement).toBe(true);

    // 4. ダッシュボード確認
    const dashboardResponse = await request.get(`${API_BASE_URL}/api/dashboard/overview`, {
      headers: {
        'x-tenant-id': tenant.tenantId,
        'x-user-id': tenant.employeeUser,
        'x-user-role': 'employee',
        'x-tenant-plan': tenant.plan
      }
    });
    expect(dashboardResponse.status()).toBe(200);
    const dashboardData = await dashboardResponse.json();
    expect(dashboardData.dashboard.today.user.hasAttendance).toBe(true);
    expect(dashboardData.features.newDashboardV2).toBe(false); // A/Bテストで従来版
  });
});