import request from 'supertest';
import app from '../../packages/attendance-api/src/server';
import { TEST_TENANTS, TEST_USERS } from '../../packages/attendance-core/src/test-data';

describe('Attendance API Integration Tests', () => {
  // テスト用のヘッダー
  const enterpriseHeaders = {
    'x-tenant-id': 'enterprise-corp',
    'x-user-id': 'user-enterprise-employee',
    'x-user-role': 'employee',
    'x-tenant-plan': 'enterprise',
    'x-environment': 'development'
  };

  const startupHeaders = {
    'x-tenant-id': 'startup-inc',
    'x-user-id': 'user-startup-employee',
    'x-user-role': 'employee',
    'x-tenant-plan': 'standard',
    'x-environment': 'development'
  };

  const basicHeaders = {
    'x-tenant-id': 'small-business',
    'x-user-id': 'user-small-employee',
    'x-user-role': 'employee',
    'x-tenant-plan': 'basic',
    'x-environment': 'development'
  };

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should include feature flags in attendance endpoints (Enterprise)', async () => {
      const response = await request(app)
        .get('/api/attendance/today/user-enterprise-employee')
        .set(enterpriseHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('locationTracking', true);
      expect(response.body.features).toHaveProperty('newDashboard', true);
      expect(response.body.features).toHaveProperty('overtimeCalculationV2', true);
    });

    it('should include feature flags in attendance endpoints (Basic)', async () => {
      const response = await request(app)
        .get('/api/attendance/today/user-small-employee')
        .set(basicHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('locationTracking', false);
      expect(response.body.features).toHaveProperty('newDashboard', false);
      expect(response.body.features).toHaveProperty('overtimeCalculationV2', false);
    });
  });

  describe('Attendance API', () => {
    it('should allow clock-in for any plan', async () => {
      const clockInData = {
        userId: 'user-enterprise-employee',
        tenantId: 'enterprise-corp',
        notes: 'Test clock-in'
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set(enterpriseHeaders)
        .send(clockInData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Clock in successful');
      expect(response.body).toHaveProperty('record');
      expect(response.body.record).toHaveProperty('clockIn');
    });

    it('should track location for enterprise plan', async () => {
      const clockInData = {
        userId: 'user-enterprise-employee',
        tenantId: 'enterprise-corp',
        location: {
          lat: 35.6762,
          lng: 139.6503,
          address: '東京都渋谷区'
        }
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set(enterpriseHeaders)
        .send(clockInData)
        .expect(201);

      expect(response.body.record).toHaveProperty('location');
      expect(response.body.record.location).toHaveProperty('lat', 35.6762);
      expect(response.body.features).toHaveProperty('locationTracking', true);
    });

    it('should not track location for basic plan', async () => {
      const clockInData = {
        userId: 'user-small-employee',
        tenantId: 'small-business',
        location: {
          lat: 35.6762,
          lng: 139.6503,
          address: '東京都渋谷区'
        }
      };

      const response = await request(app)
        .post('/api/attendance/clock-in')
        .set(basicHeaders)
        .send(clockInData)
        .expect(201);

      expect(response.body.record.location).toBeUndefined();
      expect(response.body.features).toHaveProperty('locationTracking', false);
    });

    it('should deny access to advanced analytics for basic plan', async () => {
      const response = await request(app)
        .get('/api/attendance/analytics/user-small-employee')
        .set(basicHeaders)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Feature not available');
      expect(response.body).toHaveProperty('featureFlag', 'advanced_analytics');
    });

    it('should allow access to advanced analytics for enterprise plan', async () => {
      const response = await request(app)
        .get('/api/attendance/analytics/user-enterprise-employee')
        .set(enterpriseHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('analytics');
      expect(response.body.features).toHaveProperty('advancedAnalytics', true);
    });
  });

  describe('Leave Management API', () => {
    it('should create leave request with feature flag context', async () => {
      const leaveData = {
        userId: 'user-startup-employee',
        tenantId: 'startup-inc',
        type: 'paid_leave',
        startDate: '2025-08-01',
        endDate: '2025-08-01',
        reason: 'Test leave'
      };

      const response = await request(app)
        .post('/api/leave/requests')
        .set(startupHeaders)
        .send(leaveData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Leave request created successfully');
      expect(response.body).toHaveProperty('request');
      expect(response.body.features).toHaveProperty('advancedLeaveManagement', true);
    });

    it('should show feature differences between plans', async () => {
      const response = await request(app)
        .get('/api/leave/requests')
        .set(basicHeaders)
        .expect(200);

      expect(response.body.features).toHaveProperty('advancedLeaveManagement', false);
      expect(response.body.features).toHaveProperty('webhookNotifications', false);
    });
  });

  describe('Dashboard API', () => {
    it('should provide basic dashboard for all plans', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .set(basicHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('dashboard');
      expect(response.body.dashboard).toHaveProperty('today');
      expect(response.body.dashboard).toHaveProperty('pending');
      expect(response.body.dashboard).toHaveProperty('team');
    });

    it('should provide enhanced dashboard for enterprise plan', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .set(enterpriseHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('dashboard');
      expect(response.body.dashboard).toHaveProperty('weekly'); // Enhanced feature
      expect(response.body.features).toHaveProperty('newDashboardV2', true);
    });

    it('should deny realtime monitoring for basic plan', async () => {
      const response = await request(app)
        .get('/api/dashboard/realtime')
        .set(basicHeaders)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Feature not available');
      expect(response.body).toHaveProperty('featureFlag', 'real_time_monitoring');
    });

    it('should allow realtime monitoring for enterprise plan', async () => {
      const response = await request(app)
        .get('/api/dashboard/realtime')
        .set(enterpriseHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('realtime');
      expect(response.body.features).toHaveProperty('realTimeMonitoring', true);
    });
  });

  describe('Tenant API', () => {
    it('should return tenant info with feature flags', async () => {
      const response = await request(app)
        .get('/api/tenant/info')
        .set(enterpriseHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('tenant');
      expect(response.body.tenant).toHaveProperty('tenantId', 'enterprise-corp');
      expect(response.body.tenant).toHaveProperty('plan', 'enterprise');
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('enabledFeatures');
    });

    it('should return feature status for tenant', async () => {
      const response = await request(app)
        .get('/api/tenant/features')
        .set(startupHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('tenant');
      expect(response.body.tenant).toHaveProperty('tenantId', 'startup-inc');
      expect(response.body.tenant).toHaveProperty('plan', 'standard');
      expect(response.body.features).toHaveProperty('enabled');
      expect(response.body.features).toHaveProperty('disabled');
    });
  });

  describe('Authentication API', () => {
    it('should return test tenants', async () => {
      const response = await request(app)
        .get('/api/auth/tenants')
        .expect(200);

      expect(response.body).toHaveProperty('tenants');
      expect(response.body.tenants).toHaveLength(3);
      expect(response.body.tenants[0]).toHaveProperty('tenantId');
      expect(response.body.tenants[0]).toHaveProperty('plan');
    });

    it('should return test users for tenant', async () => {
      const response = await request(app)
        .get('/api/auth/tenants/enterprise-corp/users')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.users.length).toBeGreaterThanOrEqual(2);
      expect(response.body.users[0]).toHaveProperty('userId');
      expect(response.body.users[0]).toHaveProperty('role');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tenant ID', async () => {
      const response = await request(app)
        .get('/api/attendance/today/user-test')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'TENANT_ID_REQUIRED');
    });

    it('should handle maintenance mode', async () => {
      // この機能は将来的にテストする予定
      // 現在はメンテナンスモードは無効
    });

    it('should handle invalid API endpoints', async () => {
      const response = await request(app)
        .get('/api/invalid/endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'API endpoint not found');
    });
  });
});