import express from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { logger } from '../utils/logger';
import { createError } from '../middleware/error-handler';
import { requireFeatureFlag, checkMaintenanceMode } from '../middleware/feature-flag-middleware';
import { TEST_ATTENDANCE_RECORDS, TEST_USERS } from '../../../attendance-core/src/test-data';
import { AttendanceRecord } from '../../../attendance-core/src/types';

const router = express.Router();

// バリデーションスキーマ
const clockInSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional()
  }).optional(),
  notes: z.string().optional()
});

const clockOutSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional()
  }).optional(),
  notes: z.string().optional()
});

// メンテナンスモードチェック
router.use(checkMaintenanceMode);

/**
 * 出勤打刻
 */
router.post('/clock-in', async (req, res, next) => {
  try {
    const validatedData = clockInSchema.parse(req.body);
    const { userId, tenantId, location, notes } = validatedData;

    // GPS位置追跡が有効な場合のみ位置情報を記録
    const shouldTrackLocation = req.isFeatureEnabled!('gps_location_tracking');
    const recordLocation = shouldTrackLocation ? location : undefined;

    // 既存の出勤記録をチェック
    const today = format(new Date(), 'yyyy-MM-dd');
    const existingRecord = TEST_ATTENDANCE_RECORDS.find(
      record => record.userId === userId && 
                record.tenantId === tenantId && 
                record.date === today
    );

    if (existingRecord && existingRecord.clockIn) {
      return next(createError('Already clocked in today', 400, 'ALREADY_CLOCKED_IN'));
    }

    // 新しい出勤記録を作成
    const attendanceRecord: AttendanceRecord = {
      recordId: uuidv4(),
      userId,
      tenantId,
      date: today,
      clockIn: format(new Date(), 'HH:mm:ss'),
      status: 'present',
      location: recordLocation,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // テストデータに追加（実際のアプリではデータベースに保存）
    TEST_ATTENDANCE_RECORDS.push(attendanceRecord);

    logger.info('Clock in successful', {
      userId,
      tenantId,
      recordId: attendanceRecord.recordId,
      locationTracked: !!recordLocation,
      clockInTime: attendanceRecord.clockIn
    });

    res.status(201).json({
      message: 'Clock in successful',
      record: attendanceRecord,
      features: {
        locationTracking: shouldTrackLocation,
        newDashboard: req.isFeatureEnabled!('new_dashboard_v2')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 退勤打刻
 */
router.post('/clock-out', async (req, res, next) => {
  try {
    const validatedData = clockOutSchema.parse(req.body);
    const { userId, tenantId, location, notes } = validatedData;

    // 今日の出勤記録を検索
    const today = format(new Date(), 'yyyy-MM-dd');
    const recordIndex = TEST_ATTENDANCE_RECORDS.findIndex(
      record => record.userId === userId && 
                record.tenantId === tenantId && 
                record.date === today
    );

    if (recordIndex === -1) {
      return next(createError('No clock-in record found for today', 400, 'NO_CLOCK_IN_RECORD'));
    }

    const record = TEST_ATTENDANCE_RECORDS[recordIndex];
    
    if (record.clockOut) {
      return next(createError('Already clocked out today', 400, 'ALREADY_CLOCKED_OUT'));
    }

    // 残業計算v2が有効な場合の処理
    const useOvertimeV2 = req.isFeatureEnabled!('overtime_calculation_v2');
    
    const clockOutTime = format(new Date(), 'HH:mm:ss');
    const clockInTime = record.clockIn!;
    
    // 勤務時間の計算
    const clockInDate = new Date(`${today}T${clockInTime}`);
    const clockOutDate = new Date(`${today}T${clockOutTime}`);
    const workHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
    
    // 残業時間の計算
    let overtimeHours = 0;
    if (useOvertimeV2) {
      // v2ロジック: より精密な残業計算
      const standardHours = 8;
      const breakHours = 1; // 休憩時間
      const actualWorkHours = workHours - breakHours;
      overtimeHours = Math.max(0, actualWorkHours - standardHours);
    } else {
      // v1ロジック: 簡易的な残業計算
      overtimeHours = Math.max(0, workHours - 9); // 9時間以上で残業
    }

    // GPS位置追跡が有効な場合のみ位置情報を記録
    const shouldTrackLocation = req.isFeatureEnabled!('gps_location_tracking');
    const recordLocation = shouldTrackLocation ? location : record.location;

    // 記録を更新
    const updatedRecord = {
      ...record,
      clockOut: clockOutTime,
      totalHours: parseFloat(workHours.toFixed(2)),
      overtimeHours: parseFloat(overtimeHours.toFixed(2)),
      location: recordLocation,
      notes: notes || record.notes,
      updatedAt: new Date().toISOString()
    };

    TEST_ATTENDANCE_RECORDS[recordIndex] = updatedRecord;

    logger.info('Clock out successful', {
      userId,
      tenantId,
      recordId: record.recordId,
      clockOutTime,
      totalHours: updatedRecord.totalHours,
      overtimeHours: updatedRecord.overtimeHours,
      overtimeCalculationV2: useOvertimeV2,
      locationTracked: !!recordLocation
    });

    res.json({
      message: 'Clock out successful',
      record: updatedRecord,
      features: {
        locationTracking: shouldTrackLocation,
        overtimeCalculationV2: useOvertimeV2,
        newDashboard: req.isFeatureEnabled!('new_dashboard_v2')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 今日の勤怠情報を取得
 */
router.get('/today/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const record = TEST_ATTENDANCE_RECORDS.find(
      r => r.userId === userId && r.tenantId === tenantId && r.date === today
    );

    res.json({
      record: record || null,
      features: {
        locationTracking: req.isFeatureEnabled!('gps_location_tracking'),
        newDashboard: req.isFeatureEnabled!('new_dashboard_v2'),
        overtimeCalculationV2: req.isFeatureEnabled!('overtime_calculation_v2')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 勤怠履歴を取得
 */
router.get('/history/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const tenantId = req.featureFlagContext?.tenantId;
    const { from, to, limit = '30' } = req.query;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    let records = TEST_ATTENDANCE_RECORDS.filter(
      r => r.userId === userId && r.tenantId === tenantId
    );

    // 日付フィルタリング
    if (from) {
      records = records.filter(r => r.date >= from);
    }
    if (to) {
      records = records.filter(r => r.date <= to);
    }

    // 日付順にソート（新しい順）
    records.sort((a, b) => b.date.localeCompare(a.date));

    // 件数制限
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0) {
      records = records.slice(0, limitNum);
    }

    res.json({
      records,
      total: records.length,
      features: {
        locationTracking: req.isFeatureEnabled!('gps_location_tracking'),
        newDashboard: req.isFeatureEnabled!('new_dashboard_v2'),
        overtimeCalculationV2: req.isFeatureEnabled!('overtime_calculation_v2')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 高度な分析機能（Enterprise プランのみ）
 */
router.get('/analytics/:userId', 
  requireFeatureFlag('advanced_analytics'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const tenantId = req.featureFlagContext?.tenantId;

      if (!tenantId) {
        return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
      }

      const records = TEST_ATTENDANCE_RECORDS.filter(
        r => r.userId === userId && r.tenantId === tenantId
      );

      // 分析データの計算
      const analytics = {
        totalDays: records.length,
        totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        totalOvertimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
        averageHoursPerDay: records.length > 0 ? 
          records.reduce((sum, r) => sum + (r.totalHours || 0), 0) / records.length : 0,
        attendanceRate: records.length > 0 ? 
          records.filter(r => r.status === 'present').length / records.length * 100 : 0,
        lateArrivals: records.filter(r => r.status === 'late').length,
        earlyLeaves: records.filter(r => r.status === 'early_leave').length
      };

      res.json({
        analytics,
        period: {
          from: records.length > 0 ? records[records.length - 1].date : null,
          to: records.length > 0 ? records[0].date : null
        },
        features: {
          advancedAnalytics: true,
          realTimeMonitoring: req.isFeatureEnabled!('real_time_monitoring')
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as attendanceRouter };