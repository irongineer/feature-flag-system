/**
 * Error Handling Types
 * 
 * エラーハンドリングの型定義とインターフェース
 */

export interface StructuredError {
  operation: string;
  tenantId?: string;
  flagKey?: string;
  error: Error;
  timestamp?: string;
  context?: Record<string, any>;
}

export type ErrorHandler = (errorInfo: string | StructuredError, error?: Error) => void;

export interface ErrorHandlingOptions {
  errorHandler?: ErrorHandler;
  enableConsoleLogging?: boolean;
}

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