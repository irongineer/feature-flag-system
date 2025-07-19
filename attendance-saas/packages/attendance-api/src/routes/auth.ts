import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { createError } from '../middleware/error-handler';
import { TEST_USERS, TEST_TENANTS } from '../../../attendance-core/src/test-data';

const router = express.Router();

// バリデーションスキーマ
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().min(1).optional()
});

const verifyTokenSchema = z.object({
  token: z.string().min(1)
});

/**
 * ログイン
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, tenantId } = loginSchema.parse(req.body);

    // テストユーザーを検索
    let user = TEST_USERS.find(u => u.email === email && u.status === 'active');
    
    if (!user) {
      return next(createError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
    }

    // テナントIDが指定されている場合は、そのテナントのユーザーかチェック
    if (tenantId && user.tenantId !== tenantId) {
      return next(createError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
    }

    // テナント情報を取得
    const tenant = TEST_TENANTS.find(t => t.tenantId === user.tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    // 簡易的なJWTトークンを生成（実際のアプリではちゃんとしたJWTライブラリを使用）
    const token = Buffer.from(JSON.stringify({
      userId: user.userId,
      tenantId: user.tenantId,
      userRole: user.role,
      email: user.email,
      plan: tenant.plan,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24時間有効
    })).toString('base64');

    logger.info('User login successful', {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      plan: tenant.plan
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId
      },
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        plan: tenant.plan,
        features: tenant.features
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * トークン検証
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { token } = verifyTokenSchema.parse(req.body);

    // トークンをデコード
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    } catch (error) {
      return next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    }

    // トークンの有効期限をチェック
    if (tokenData.exp < Date.now()) {
      return next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    }

    // ユーザーが存在するかチェック
    const user = TEST_USERS.find(u => u.userId === tokenData.userId && u.status === 'active');
    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // テナント情報を取得
    const tenant = TEST_TENANTS.find(t => t.tenantId === user.tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    res.json({
      message: 'Token is valid',
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId
      },
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        plan: tenant.plan,
        features: tenant.features
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ログアウト
 */
router.post('/logout', async (req, res) => {
  // 実際のアプリではトークンを無効化する処理を行う
  res.json({
    message: 'Logout successful'
  });
});

/**
 * テナント一覧を取得（開発用）
 */
router.get('/tenants', async (req, res) => {
  const tenants = TEST_TENANTS.map(tenant => ({
    tenantId: tenant.tenantId,
    name: tenant.name,
    plan: tenant.plan,
    employees: tenant.employees,
    status: tenant.status
  }));

  res.json({
    tenants,
    total: tenants.length
  });
});

/**
 * テナントのテストユーザー一覧を取得（開発用）
 */
router.get('/tenants/:tenantId/users', async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const tenant = TEST_TENANTS.find(t => t.tenantId === tenantId);
    if (!tenant) {
      return next(createError('Tenant not found', 404, 'TENANT_NOT_FOUND'));
    }

    const users = TEST_USERS
      .filter(u => u.tenantId === tenantId && u.status === 'active')
      .map(u => ({
        userId: u.userId,
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        employeeId: u.employeeId
      }));

    res.json({
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        plan: tenant.plan
      },
      users,
      total: users.length
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };