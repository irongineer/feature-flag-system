import express from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/error-handler';
import { requireFeatureFlag } from '../middleware/feature-flag-middleware';
import { TEST_TENANTS, TEST_USERS, getTestDataForTenant } from '../../../attendance-core/src/test-data';

const router = express.Router();

/**
 * テナント情報を取得
 */
router.get('/info', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    const tenant = TEST_TENANTS.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    const users = TEST_USERS.filter(u => u.tenantId === tenantId);

    res.json({
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        plan: tenant.plan,
        employees: tenant.employees,
        features: tenant.features,
        createdAt: tenant.createdAt,
        status: tenant.status
      },
      users: {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length
      },
      features: {
        availableFeatures: tenant.features,
        enabledFeatures: Object.entries(req.featureFlags || {})
          .filter(([_, enabled]) => enabled)
          .map(([key, _]) => key)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * テナントのユーザー一覧を取得
 */
router.get('/users', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;
    const { role, status, limit = '50' } = req.query;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    let users = TEST_USERS.filter(u => u.tenantId === tenantId);

    // ロール別フィルタ
    if (role) {
      users = users.filter(u => u.role === role);
    }

    // ステータス別フィルタ
    if (status) {
      users = users.filter(u => u.status === status);
    }

    // 件数制限
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0) {
      users = users.slice(0, limitNum);
    }

    // 機密情報を除外
    const sanitizedUsers = users.map(user => ({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      employeeId: user.employeeId,
      status: user.status,
      createdAt: user.createdAt
    }));

    res.json({
      users: sanitizedUsers,
      total: sanitizedUsers.length,
      features: {
        advancedUserManagement: req.isFeatureEnabled!('advanced_user_management')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * テナントの統計情報を取得
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    const testData = getTestDataForTenant(tenantId);
    
    if (!testData.tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    const stats = {
      tenant: {
        name: testData.tenant.name,
        plan: testData.tenant.plan,
        employees: testData.tenant.employees,
        status: testData.tenant.status
      },
      users: {
        total: testData.users.length,
        byRole: testData.users.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byStatus: testData.users.reduce((acc, user) => {
          acc[user.status] = (acc[user.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      attendance: {
        totalRecords: testData.attendanceRecords.length,
        totalHours: testData.attendanceRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        totalOvertimeHours: testData.attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
        byStatus: testData.attendanceRecords.reduce((acc, record) => {
          acc[record.status] = (acc[record.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      leave: {
        totalRequests: testData.leaveRequests.length,
        totalDays: testData.leaveRequests.reduce((sum, r) => sum + r.days, 0),
        byStatus: testData.leaveRequests.reduce((acc, request) => {
          acc[request.status] = (acc[request.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byType: testData.leaveRequests.reduce((acc, request) => {
          acc[request.type] = (acc[request.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      featureFlags: testData.featureFlags
    };

    res.json({
      stats,
      features: {
        advancedAnalytics: req.isFeatureEnabled!('advanced_analytics'),
        realTimeMonitoring: req.isFeatureEnabled!('real_time_monitoring')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * テナントのフィーチャーフラグ状況を取得
 */
router.get('/features', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    const tenant = TEST_TENANTS.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    const allFeatureFlags = req.featureFlags || {};
    const enabledFeatures = Object.entries(allFeatureFlags)
      .filter(([_, enabled]) => enabled)
      .map(([key, _]) => key);

    const disabledFeatures = Object.entries(allFeatureFlags)
      .filter(([_, enabled]) => !enabled)
      .map(([key, _]) => key);

    res.json({
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        plan: tenant.plan
      },
      features: {
        enabled: enabledFeatures,
        disabled: disabledFeatures,
        total: Object.keys(allFeatureFlags).length,
        planFeatures: tenant.features,
        context: req.featureFlagContext
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * テナントの設定を取得（管理者のみ）
 */
router.get('/settings', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;
    const userRole = req.featureFlagContext?.userRole;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    // 管理者権限をチェック
    if (userRole !== 'admin') {
      return next(createError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED'));
    }

    const tenant = TEST_TENANTS.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    const settings = {
      general: {
        name: tenant.name,
        plan: tenant.plan,
        employees: tenant.employees,
        status: tenant.status
      },
      features: {
        available: tenant.features,
        enabled: Object.entries(req.featureFlags || {})
          .filter(([_, enabled]) => enabled)
          .map(([key, _]) => key)
      },
      integrations: {
        slack: req.isFeatureEnabled!('slack_integration'),
        teams: req.isFeatureEnabled!('teams_integration'),
        webhook: req.isFeatureEnabled!('webhook_notifications')
      },
      security: {
        biometricAuth: req.isFeatureEnabled!('biometric_authentication'),
        gpsTracking: req.isFeatureEnabled!('gps_location_tracking')
      },
      analytics: {
        advanced: req.isFeatureEnabled!('advanced_analytics'),
        customReports: req.isFeatureEnabled!('custom_reports'),
        realTimeMonitoring: req.isFeatureEnabled!('real_time_monitoring')
      }
    };

    res.json({
      settings,
      features: {
        adminPanel: true,
        advancedSettings: req.isFeatureEnabled!('advanced_settings')
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as tenantRouter };