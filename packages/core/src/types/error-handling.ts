/**
 * Error Handling Types
 * 
 * エラーハンドリングの型定義とインターフェース
 */

import { 
  ResourceNotFoundException,
  ConditionalCheckFailedException,
  ProvisionedThroughputExceededException,
  ItemCollectionSizeLimitExceededException,
  RequestLimitExceeded,
  InternalServerError,
  ValidationException,
  AccessDeniedException,
  ResourceInUseException,
  LimitExceededException,
  BackupNotFoundException,
  TableNotFoundException,
  TableInUseException
} from '@aws-sdk/client-dynamodb';

// AWS SDK v3 DynamoDB エラー型の統合インターフェース
export interface AWSError extends Error {
  name: string;
  $fault?: 'client' | 'server';
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
  };
}

export interface StructuredError {
  operation: string;
  tenantId?: string;
  flagKey?: string;
  environment?: string; // 環境情報を追加
  error: Error;
  timestamp?: string;
  context?: Record<string, any>;
  errorType?: string;
  isRetryable?: boolean;
  httpStatusCode?: number;
}

export type ErrorHandler = (errorInfo: string | StructuredError, error?: Error) => void;

export interface ErrorHandlingOptions {
  errorHandler?: ErrorHandler;
  enableConsoleLogging?: boolean;
}

// AWS DynamoDB エラータイプガード関数
export function isResourceNotFound(error: unknown): error is ResourceNotFoundException {
  return error instanceof Error && error.name === 'ResourceNotFoundException';
}

export function isConditionalCheckFailed(error: unknown): error is ConditionalCheckFailedException {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

export function isValidationError(error: unknown): error is ValidationException {
  return error instanceof Error && error.name === 'ValidationException';
}

export function isAccessDenied(error: unknown): error is AccessDeniedException {
  return error instanceof Error && error.name === 'AccessDeniedException';
}

export function isResourceInUse(error: unknown): error is ResourceInUseException {
  return error instanceof Error && error.name === 'ResourceInUseException';
}

export function isTableNotFound(error: unknown): error is TableNotFoundException {
  return error instanceof Error && error.name === 'TableNotFoundException';
}

export function isTableInUse(error: unknown): error is TableInUseException {
  return error instanceof Error && error.name === 'TableInUseException';
}

export function isLimitExceeded(error: unknown): error is LimitExceededException {
  return error instanceof Error && error.name === 'LimitExceededException';
}

export function isThrottlingError(error: unknown): error is ProvisionedThroughputExceededException | RequestLimitExceeded | Error {
  return error instanceof Error && (
    error.name === 'ThrottlingException' ||
    error.name === 'ProvisionedThroughputExceededException' ||
    error.name === 'RequestLimitExceeded'
  );
}

export function isItemCollectionSizeLimit(error: unknown): error is ItemCollectionSizeLimitExceededException {
  return error instanceof Error && error.name === 'ItemCollectionSizeLimitExceededException';
}

export function isInternalServerError(error: unknown): error is InternalServerError {
  return error instanceof Error && error.name === 'InternalServerError';
}

export function isServiceUnavailable(error: unknown): error is Error {
  return error instanceof Error && error.name === 'ServiceUnavailableException';
}

export function isRetryableError(error: unknown): boolean {
  return isThrottlingError(error) || isInternalServerError(error) || isServiceUnavailable(error);
}

export function isClientError(error: unknown): boolean {
  return isValidationError(error) || isConditionalCheckFailed(error) || isResourceNotFound(error) || isAccessDenied(error);
}

/**
 * 運用者向けの詳細なエラーメッセージを生成
 */
export function createOperationalErrorMessage(error: unknown, context?: { operation?: string; flagKey?: string; tenantId?: string; tableName?: string }): string {
  if (isResourceNotFound(error)) {
    return `DynamoDB resource not found. Please check: 1) Table '${context?.tableName || 'feature-flags'}' exists, 2) AWS region is correct, 3) Item with key '${context?.flagKey || context?.tenantId || 'unknown'}' exists`;
  }
  
  if (isTableNotFound(error)) {
    return `DynamoDB table '${context?.tableName || 'feature-flags'}' does not exist. Please: 1) Deploy infrastructure using 'npm run deploy:dev', 2) Verify table name in environment variables, 3) Check AWS region configuration`;
  }
  
  if (isAccessDenied(error)) {
    return `Access denied to DynamoDB. Please check: 1) IAM role/user has correct permissions, 2) AWS credentials are valid, 3) Table resource policies allow access`;
  }
  
  if (isValidationError(error)) {
    return `Request validation failed. Please verify: 1) Required fields (flagKey, tenantId) are provided, 2) Field values match DynamoDB schema, 3) Data types are correct`;
  }
  
  if (isConditionalCheckFailed(error)) {
    return `Resource already exists or condition not met. This might indicate: 1) Flag already exists (during creation), 2) Resource was modified concurrently, 3) Optimistic locking conflict`;
  }
  
  if (isThrottlingError(error)) {
    return `DynamoDB request rate exceeded. Recommended actions: 1) Implement exponential backoff, 2) Check table read/write capacity, 3) Consider increasing provisioned throughput or using on-demand billing`;
  }
  
  if (isTableInUse(error)) {
    return `Table is currently being modified. Please: 1) Wait for ongoing table operations to complete, 2) Check table status in AWS console, 3) Retry the operation after table becomes ACTIVE`;
  }
  
  if (isLimitExceeded(error)) {
    return `AWS service limits exceeded. Please: 1) Check account limits in AWS Service Quotas, 2) Request limit increase if needed, 3) Optimize table design to reduce resource usage`;
  }
  
  if (isInternalServerError(error)) {
    return `DynamoDB internal server error. This is a temporary AWS service issue. Please: 1) Retry with exponential backoff, 2) Check AWS service health dashboard, 3) Contact AWS support if persistent`;
  }
  
  // 汎用メッセージ
  const err = error as Error;
  return `Unexpected DynamoDB error: ${err.message}. Operation: ${context?.operation || 'unknown'}. Please check application logs for detailed error information`;
}

/**
 * 型安全性を向上させるためのFeatureFlagValidatorクラス
 */
export class FeatureFlagValidator {
  /**
   * フィーチャーフラグデータの構造を検証
   */
  static validateFeatureFlag(item: any): FeatureFlagsTable {
    if (!item) {
      const error = new Error('Feature flag item is null or undefined') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (!item.flagKey || typeof item.flagKey !== 'string') {
      const error = new Error('Invalid feature flag: flagKey must be a non-empty string') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (typeof item.defaultEnabled !== 'boolean') {
      const error = new Error('Invalid feature flag: defaultEnabled must be a boolean') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (!item.owner || typeof item.owner !== 'string') {
      const error = new Error('Invalid feature flag: owner must be a non-empty string') as any;
      error.name = 'ValidationException';
      throw error;
    }

    return item as FeatureFlagsTable;
  }

  /**
   * テナントオーバーライドデータの構造を検証
   */
  static validateTenantOverride(item: any): TenantOverridesTable {
    if (!item) {
      const error = new Error('Tenant override item is null or undefined') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (!item.tenantId || typeof item.tenantId !== 'string') {
      const error = new Error('Invalid tenant override: tenantId must be a non-empty string') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (!item.flagKey || typeof item.flagKey !== 'string') {
      const error = new Error('Invalid tenant override: flagKey must be a non-empty string') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (typeof item.enabled !== 'boolean') {
      const error = new Error('Invalid tenant override: enabled must be a boolean') as any;
      error.name = 'ValidationException';
      throw error;
    }

    return item as TenantOverridesTable;
  }

  /**
   * キルスイッチデータの構造を検証
   */
  static validateKillSwitch(item: any): EmergencyControlTable {
    if (!item) {
      const error = new Error('Kill switch item is null or undefined') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (typeof item.enabled !== 'boolean') {
      const error = new Error('Invalid kill switch: enabled must be a boolean') as any;
      error.name = 'ValidationException';
      throw error;
    }

    if (!item.reason || typeof item.reason !== 'string') {
      const error = new Error('Invalid kill switch: reason must be a non-empty string') as any;
      error.name = 'ValidationException';
      throw error;
    }

    return item as EmergencyControlTable;
  }
}

/**
 * AWS エラーから構造化エラー情報を作成
 */
export function createStructuredError(
  operation: string,
  error: unknown,
  context?: { tenantId?: string; flagKey?: string; environment?: string; [key: string]: any }
): StructuredError {
  const err = error as AWSError;
  
  return {
    operation,
    tenantId: context?.tenantId,
    flagKey: context?.flagKey,
    environment: context?.environment,
    error: err,
    timestamp: new Date().toISOString(),
    context,
    errorType: err.name,
    isRetryable: isRetryableError(error),
    httpStatusCode: err.$metadata?.httpStatusCode
  };
}

/**
 * Enhanced error handler with AWS error classification
 */
export const enhancedErrorHandler: ErrorHandler = (errorInfo: string | StructuredError, error?: Error) => {
  if (typeof errorInfo === 'string') {
    console.error(errorInfo, error);
  } else {
    const logLevel = isClientError(errorInfo.error) ? 'warn' : 'error';
    const retryInfo = errorInfo.isRetryable ? ' [RETRYABLE]' : ' [NON-RETRYABLE]';
    
    console[logLevel](`[${errorInfo.operation}] DynamoDB error${retryInfo}:`, {
      errorType: errorInfo.errorType,
      httpStatus: errorInfo.httpStatusCode,
      tenantId: errorInfo.tenantId,
      flagKey: errorInfo.flagKey,
      timestamp: errorInfo.timestamp,
      message: errorInfo.error.message,
      retryable: errorInfo.isRetryable,
      context: errorInfo.context
    });
  }
};

/**
 * Default error handler that logs to console
 */
export const defaultErrorHandler: ErrorHandler = (errorInfo: string | StructuredError, error?: Error) => {
  if (typeof errorInfo === 'string') {
    console.error(errorInfo, error);
  } else {
    console.error(`[${errorInfo.operation}] Error in feature flag evaluation:`, {
      ...errorInfo,
      timestamp: errorInfo.timestamp || new Date().toISOString()
    });
  }
};

/**
 * Silent error handler for testing
 */
export const silentErrorHandler: ErrorHandler = () => {
  // Do nothing - for testing scenarios
};