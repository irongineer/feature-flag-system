import express from 'express';
import { logger } from '../utils/logger';
import { createError } from '../middleware/error-handler';
import { requireFeatureFlag } from '../middleware/feature-flag-middleware';
import { 
  TEST_ATTENDANCE_RECORDS, 
  TEST_LEAVE_REQUESTS, 
  TEST_USERS, 
  TEST_TENANTS 
} from '../../../attendance-core/src/test-data';

const router = express.Router();

/**
 * 基本ダッシュボード情報を取得
 */
router.get('/overview', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;
    const userId = req.featureFlagContext?.userId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    // 今日の日付
    const today = new Date().toISOString().split('T')[0];

    // 基本統計情報
    const todayAttendance = TEST_ATTENDANCE_RECORDS.filter(
      r => r.tenantId === tenantId && r.date === today
    );

    const pendingLeaveRequests = TEST_LEAVE_REQUESTS.filter(
      r => r.tenantId === tenantId && r.status === 'pending'
    );

    const tenantUsers = TEST_USERS.filter(u => u.tenantId === tenantId);

    // ユーザー個別の情報
    const userTodayAttendance = todayAttendance.find(r => r.userId === userId);
    const userPendingLeaves = TEST_LEAVE_REQUESTS.filter(
      r => r.userId === userId && r.status === 'pending'
    );

    const dashboardData = {
      today: {
        date: today,
        attendance: {
          total: todayAttendance.length,
          present: todayAttendance.filter(r => r.status === 'present').length,
          late: todayAttendance.filter(r => r.status === 'late').length,
          absent: todayAttendance.filter(r => r.status === 'absent').length
        },
        user: {
          hasAttendance: !!userTodayAttendance,
          clockIn: userTodayAttendance?.clockIn || null,
          clockOut: userTodayAttendance?.clockOut || null,
          totalHours: userTodayAttendance?.totalHours || 0,
          overtimeHours: userTodayAttendance?.overtimeHours || 0
        }
      },
      pending: {
        leaveRequests: pendingLeaveRequests.length,
        userLeaveRequests: userPendingLeaves.length
      },
      team: {
        totalEmployees: tenantUsers.length,
        activeEmployees: tenantUsers.filter(u => u.status === 'active').length
      }
    };

    // 新しいダッシュボードv2が有効な場合は、追加情報を提供
    if (req.isFeatureEnabled!('new_dashboard_v2')) {
      // 週次統計
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const weeklyAttendance = TEST_ATTENDANCE_RECORDS.filter(
        r => r.tenantId === tenantId && r.date >= weekAgoStr
      );

      dashboardData.weekly = {
        totalHours: weeklyAttendance.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        overtimeHours: weeklyAttendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
        averageHours: weeklyAttendance.length > 0 ? 
          weeklyAttendance.reduce((sum, r) => sum + (r.totalHours || 0), 0) / weeklyAttendance.length : 0
      };
    }

    res.json({
      dashboard: dashboardData,
      features: {
        newDashboardV2: req.isFeatureEnabled!('new_dashboard_v2'),
        realTimeMonitoring: req.isFeatureEnabled!('real_time_monitoring'),
        advancedAnalytics: req.isFeatureEnabled!('advanced_analytics')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * リアルタイム監視情報を取得（Enterprise プランのみ）
 */
router.get('/realtime', 
  requireFeatureFlag('real_time_monitoring'),
  async (req, res, next) => {
    try {
      const tenantId = req.featureFlagContext?.tenantId;

      if (!tenantId) {
        return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      // 現在の勤務状況
      const currentAttendance = TEST_ATTENDANCE_RECORDS.filter(
        r => r.tenantId === tenantId && r.date === today
      );

      // 勤務中のユーザー（出勤済み、退勤未了）
      const activeUsers = currentAttendance.filter(r => r.clockIn && !r.clockOut);

      // 遅刻者
      const lateUsers = currentAttendance.filter(r => r.status === 'late');

      // 残業中のユーザー
      const overtimeUsers = currentAttendance.filter(r => {
        if (!r.clockIn || r.clockOut) return false;
        
        const clockInTime = new Date(`${today}T${r.clockIn}`);
        const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        return workHours > 9; // 9時間以上勤務
      });

      const realtimeData = {
        timestamp: now.toISOString(),
        active: {
          total: activeUsers.length,
          users: activeUsers.map(r => ({
            userId: r.userId,
            clockIn: r.clockIn,
            workHours: r.clockIn ? 
              Math.round((now.getTime() - new Date(`${today}T${r.clockIn}`).getTime()) / (1000 * 60 * 60) * 100) / 100 : 0
          }))
        },
        late: {
          total: lateUsers.length,
          users: lateUsers.map(r => ({ userId: r.userId, clockIn: r.clockIn }))
        },
        overtime: {
          total: overtimeUsers.length,
          users: overtimeUsers.map(r => ({
            userId: r.userId,
            clockIn: r.clockIn,
            workHours: r.clockIn ? 
              Math.round((now.getTime() - new Date(`${today}T${r.clockIn}`).getTime()) / (1000 * 60 * 60) * 100) / 100 : 0
          }))
        }
      };

      res.json({
        realtime: realtimeData,
        features: {
          realTimeMonitoring: true,
          advancedAnalytics: req.isFeatureEnabled!('advanced_analytics')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 高度な分析情報を取得（Enterprise プランのみ）
 */
router.get('/analytics', 
  requireFeatureFlag('advanced_analytics'),
  async (req, res, next) => {
    try {
      const tenantId = req.featureFlagContext?.tenantId;
      const { period = '30' } = req.query;

      if (!tenantId) {
        return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
      }

      const periodDays = parseInt(period as string, 10);
      const periodAgo = new Date();
      periodAgo.setDate(periodAgo.getDate() - periodDays);
      const periodAgoStr = periodAgo.toISOString().split('T')[0];

      // 期間内の勤怠データ
      const periodAttendance = TEST_ATTENDANCE_RECORDS.filter(
        r => r.tenantId === tenantId && r.date >= periodAgoStr
      );

      // 期間内の有給申請データ
      const periodLeaveRequests = TEST_LEAVE_REQUESTS.filter(
        r => r.tenantId === tenantId && r.startDate >= periodAgoStr
      );

      // 分析データの計算
      const analytics = {
        period: {
          days: periodDays,
          from: periodAgoStr,
          to: new Date().toISOString().split('T')[0]
        },
        attendance: {
          totalRecords: periodAttendance.length,
          totalHours: periodAttendance.reduce((sum, r) => sum + (r.totalHours || 0), 0),
          totalOvertimeHours: periodAttendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
          averageHoursPerDay: periodAttendance.length > 0 ? 
            periodAttendance.reduce((sum, r) => sum + (r.totalHours || 0), 0) / periodAttendance.length : 0,
          attendanceRate: periodAttendance.length > 0 ? 
            periodAttendance.filter(r => r.status === 'present').length / periodAttendance.length * 100 : 0,
          lateRate: periodAttendance.length > 0 ? 
            periodAttendance.filter(r => r.status === 'late').length / periodAttendance.length * 100 : 0
        },
        leave: {
          totalRequests: periodLeaveRequests.length,
          totalDays: periodLeaveRequests.reduce((sum, r) => sum + r.days, 0),
          approvedRequests: periodLeaveRequests.filter(r => r.status === 'approved').length,
          pendingRequests: periodLeaveRequests.filter(r => r.status === 'pending').length,
          rejectedRequests: periodLeaveRequests.filter(r => r.status === 'rejected').length
        },
        trends: {
          // 日別の勤怠状況
          dailyAttendance: periodAttendance.reduce((acc, r) => {
            if (!acc[r.date]) {
              acc[r.date] = { total: 0, present: 0, late: 0, absent: 0 };
            }
            acc[r.date].total++;
            acc[r.date][r.status]++;
            return acc;
          }, {} as Record<string, any>)
        }
      };

      res.json({
        analytics,
        features: {
          advancedAnalytics: true,
          realTimeMonitoring: req.isFeatureEnabled!('real_time_monitoring'),
          customReports: req.isFeatureEnabled!('custom_reports')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * カスタムレポートを取得（Standard プラン以上）
 */
router.get('/reports', 
  requireFeatureFlag('custom_reports'),
  async (req, res, next) => {
    try {
      const tenantId = req.featureFlagContext?.tenantId;
      const { reportType = 'attendance', userId, from, to } = req.query;

      if (!tenantId) {
        return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
      }

      let reportData: any = {};

      switch (reportType) {
        case 'attendance':
          let attendanceData = TEST_ATTENDANCE_RECORDS.filter(r => r.tenantId === tenantId);
          
          if (userId) {
            attendanceData = attendanceData.filter(r => r.userId === userId);
          }
          if (from) {
            attendanceData = attendanceData.filter(r => r.date >= from);
          }
          if (to) {
            attendanceData = attendanceData.filter(r => r.date <= to);
          }

          reportData = {
            type: 'attendance',
            records: attendanceData,
            summary: {
              totalRecords: attendanceData.length,
              totalHours: attendanceData.reduce((sum, r) => sum + (r.totalHours || 0), 0),
              totalOvertimeHours: attendanceData.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
            }
          };
          break;

        case 'leave':
          let leaveData = TEST_LEAVE_REQUESTS.filter(r => r.tenantId === tenantId);
          
          if (userId) {
            leaveData = leaveData.filter(r => r.userId === userId);
          }
          if (from) {
            leaveData = leaveData.filter(r => r.startDate >= from);
          }
          if (to) {
            leaveData = leaveData.filter(r => r.endDate <= to);
          }

          reportData = {
            type: 'leave',
            requests: leaveData,
            summary: {
              totalRequests: leaveData.length,
              totalDays: leaveData.reduce((sum, r) => sum + r.days, 0),
              approvedRequests: leaveData.filter(r => r.status === 'approved').length
            }
          };
          break;

        default:
          return next(createError('Invalid report type', 400, 'INVALID_REPORT_TYPE'));
      }

      res.json({
        report: reportData,
        generatedAt: new Date().toISOString(),
        features: {
          customReports: true,
          advancedAnalytics: req.isFeatureEnabled!('advanced_analytics')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as dashboardRouter };