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
  InternalServerError
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

export function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'ValidationException';
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
  return isValidationError(error) || isConditionalCheckFailed(error) || isResourceNotFound(error);
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