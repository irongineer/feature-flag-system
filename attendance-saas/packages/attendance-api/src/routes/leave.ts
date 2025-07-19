import express from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { createError } from '../middleware/error-handler';
import { requireFeatureFlag, requirePlan } from '../middleware/feature-flag-middleware';
import { TEST_LEAVE_REQUESTS, TEST_USERS } from '../../../attendance-core/src/test-data';
import { LeaveRequest } from '../../../attendance-core/src/types';

const router = express.Router();

// バリデーションスキーマ
const createLeaveRequestSchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  type: z.enum(['paid_leave', 'sick_leave', 'personal_leave', 'maternity_leave']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional()
});

const approveLeaveRequestSchema = z.object({
  requestId: z.string().min(1),
  approverId: z.string().min(1),
  reason: z.string().optional()
});

/**
 * 有給申請を作成
 */
router.post('/requests', async (req, res, next) => {
  try {
    const validatedData = createLeaveRequestSchema.parse(req.body);
    const { userId, tenantId, type, startDate, endDate, reason } = validatedData;

    // ユーザーが存在するかチェック
    const user = TEST_USERS.find(u => u.userId === userId && u.tenantId === tenantId);
    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // 日付の妥当性をチェック
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return next(createError('Start date must be before end date', 400, 'INVALID_DATE_RANGE'));
    }

    // 期間の日数を計算
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 高度な有給管理機能が有効な場合の追加チェック
    if (req.isFeatureEnabled!('advanced_leave_management')) {
      // 重複申請チェック
      const overlappingRequest = TEST_LEAVE_REQUESTS.find(request => 
        request.userId === userId && 
        request.tenantId === tenantId && 
        request.status !== 'rejected' &&
        (
          (request.startDate <= startDate && request.endDate >= startDate) ||
          (request.startDate <= endDate && request.endDate >= endDate) ||
          (request.startDate >= startDate && request.endDate <= endDate)
        )
      );

      if (overlappingRequest) {
        return next(createError('Overlapping leave request exists', 400, 'OVERLAPPING_REQUEST'));
      }

      // 連続申請日数制限チェック（例：10日以上の連続申請は要承認）
      if (days > 10) {
        logger.warn('Long leave request detected', {
          userId,
          tenantId,
          days,
          startDate,
          endDate
        });
      }
    }

    // 新しい有給申請を作成
    const leaveRequest: LeaveRequest = {
      requestId: uuidv4(),
      userId,
      tenantId,
      type,
      startDate,
      endDate,
      days,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // テストデータに追加
    TEST_LEAVE_REQUESTS.push(leaveRequest);

    logger.info('Leave request created', {
      requestId: leaveRequest.requestId,
      userId,
      tenantId,
      type,
      startDate,
      endDate,
      days,
      advancedFeatures: req.isFeatureEnabled!('advanced_leave_management')
    });

    res.status(201).json({
      message: 'Leave request created successfully',
      request: leaveRequest,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 有給申請を承認
 */
router.post('/requests/approve', async (req, res, next) => {
  try {
    const { requestId, approverId, reason } = approveLeaveRequestSchema.parse(req.body);

    // 承認者が存在するかチェック
    const approver = TEST_USERS.find(u => u.userId === approverId);
    if (!approver) {
      return next(createError('Approver not found', 404, 'APPROVER_NOT_FOUND'));
    }

    // 承認権限をチェック
    if (approver.role !== 'admin' && approver.role !== 'manager') {
      return next(createError('Insufficient permissions to approve', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    // 申請を検索
    const requestIndex = TEST_LEAVE_REQUESTS.findIndex(req => req.requestId === requestId);
    if (requestIndex === -1) {
      return next(createError('Leave request not found', 404, 'REQUEST_NOT_FOUND'));
    }

    const request = TEST_LEAVE_REQUESTS[requestIndex];
    
    // 既に処理済みかチェック
    if (request.status !== 'pending') {
      return next(createError('Request already processed', 400, 'REQUEST_ALREADY_PROCESSED'));
    }

    // 申請を承認
    const updatedRequest = {
      ...request,
      status: 'approved' as const,
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    TEST_LEAVE_REQUESTS[requestIndex] = updatedRequest;

    logger.info('Leave request approved', {
      requestId,
      approverId,
      userId: request.userId,
      tenantId: request.tenantId,
      type: request.type,
      startDate: request.startDate,
      endDate: request.endDate
    });

    // Webhook通知が有効な場合は通知を送信（実際のアプリではWebhookを送信）
    if (req.isFeatureEnabled!('webhook_notifications')) {
      logger.info('Webhook notification sent for leave approval', {
        requestId,
        userId: request.userId,
        tenantId: request.tenantId
      });
    }

    res.json({
      message: 'Leave request approved successfully',
      request: updatedRequest,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 有給申請を却下
 */
router.post('/requests/reject', async (req, res, next) => {
  try {
    const { requestId, approverId, reason } = approveLeaveRequestSchema.parse(req.body);

    // 承認者が存在するかチェック
    const approver = TEST_USERS.find(u => u.userId === approverId);
    if (!approver) {
      return next(createError('Approver not found', 404, 'APPROVER_NOT_FOUND'));
    }

    // 承認権限をチェック
    if (approver.role !== 'admin' && approver.role !== 'manager') {
      return next(createError('Insufficient permissions to reject', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    // 申請を検索
    const requestIndex = TEST_LEAVE_REQUESTS.findIndex(req => req.requestId === requestId);
    if (requestIndex === -1) {
      return next(createError('Leave request not found', 404, 'REQUEST_NOT_FOUND'));
    }

    const request = TEST_LEAVE_REQUESTS[requestIndex];
    
    // 既に処理済みかチェック
    if (request.status !== 'pending') {
      return next(createError('Request already processed', 400, 'REQUEST_ALREADY_PROCESSED'));
    }

    // 申請を却下
    const updatedRequest = {
      ...request,
      status: 'rejected' as const,
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    TEST_LEAVE_REQUESTS[requestIndex] = updatedRequest;

    logger.info('Leave request rejected', {
      requestId,
      approverId,
      userId: request.userId,
      tenantId: request.tenantId,
      reason
    });

    res.json({
      message: 'Leave request rejected successfully',
      request: updatedRequest,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 有給申請一覧を取得
 */
router.get('/requests', async (req, res, next) => {
  try {
    const { userId, status, from, to, limit = '20' } = req.query;
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    let requests = TEST_LEAVE_REQUESTS.filter(r => r.tenantId === tenantId);

    // ユーザー別フィルタ
    if (userId) {
      requests = requests.filter(r => r.userId === userId);
    }

    // ステータス別フィルタ
    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    // 日付範囲フィルタ
    if (from) {
      requests = requests.filter(r => r.startDate >= from);
    }
    if (to) {
      requests = requests.filter(r => r.endDate <= to);
    }

    // 作成日順にソート（新しい順）
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 件数制限
    const limitNum = parseInt(limit as string, 10);
    if (limitNum > 0) {
      requests = requests.slice(0, limitNum);
    }

    res.json({
      requests,
      total: requests.length,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 承認待ち申請一覧を取得（管理者・マネージャー用）
 */
router.get('/requests/pending', async (req, res, next) => {
  try {
    const tenantId = req.featureFlagContext?.tenantId;
    const userRole = req.featureFlagContext?.userRole;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    // 承認権限をチェック
    if (userRole !== 'admin' && userRole !== 'manager') {
      return next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }

    const pendingRequests = TEST_LEAVE_REQUESTS.filter(
      r => r.tenantId === tenantId && r.status === 'pending'
    );

    // 作成日順にソート（古い順）
    pendingRequests.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json({
      requests: pendingRequests,
      total: pendingRequests.length,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 有給申請の詳細を取得
 */
router.get('/requests/:requestId', async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.featureFlagContext?.tenantId;

    if (!tenantId) {
      return next(createError('Tenant ID is required', 400, 'TENANT_ID_REQUIRED'));
    }

    const request = TEST_LEAVE_REQUESTS.find(
      r => r.requestId === requestId && r.tenantId === tenantId
    );

    if (!request) {
      return next(createError('Leave request not found', 404, 'REQUEST_NOT_FOUND'));
    }

    // 申請者情報を取得
    const user = TEST_USERS.find(u => u.userId === request.userId);
    
    res.json({
      request,
      user: user ? {
        userId: user.userId,
        name: user.name,
        email: user.email,
        department: user.department,
        employeeId: user.employeeId
      } : null,
      features: {
        advancedLeaveManagement: req.isFeatureEnabled!('advanced_leave_management'),
        webhookNotifications: req.isFeatureEnabled!('webhook_notifications')
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as leaveRouter };