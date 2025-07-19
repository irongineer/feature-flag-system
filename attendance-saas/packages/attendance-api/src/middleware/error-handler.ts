import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ログに記録
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    code: err.code,
    method: req.method,
    path: req.path,
    tenantId: req.featureFlagContext?.tenantId,
    userId: req.featureFlagContext?.userId,
    details: err.details
  });

  // デフォルトのエラーコード
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  // 開発環境でのみスタックトレースを返す
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: any = {
    error: err.message || 'Internal server error',
    code,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}

export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): ApiError {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    message: `API endpoint ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
}

// 共通のエラータイプ
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE'
} as const;