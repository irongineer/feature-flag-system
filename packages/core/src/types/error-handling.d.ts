/**
 * Error Handling Types
 *
 * エラーハンドリングの型定義とインターフェース
 */
import { ResourceNotFoundException, ConditionalCheckFailedException, ProvisionedThroughputExceededException, ItemCollectionSizeLimitExceededException, RequestLimitExceeded, InternalServerError } from '@aws-sdk/client-dynamodb';
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
    environment?: string;
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
export declare function isResourceNotFound(error: unknown): error is ResourceNotFoundException;
export declare function isConditionalCheckFailed(error: unknown): error is ConditionalCheckFailedException;
export declare function isValidationError(error: unknown): error is Error;
export declare function isThrottlingError(error: unknown): error is ProvisionedThroughputExceededException | RequestLimitExceeded | Error;
export declare function isItemCollectionSizeLimit(error: unknown): error is ItemCollectionSizeLimitExceededException;
export declare function isInternalServerError(error: unknown): error is InternalServerError;
export declare function isServiceUnavailable(error: unknown): error is Error;
export declare function isRetryableError(error: unknown): boolean;
export declare function isClientError(error: unknown): boolean;
/**
 * AWS エラーから構造化エラー情報を作成
 */
export declare function createStructuredError(operation: string, error: unknown, context?: {
    tenantId?: string;
    flagKey?: string;
    environment?: string;
    [key: string]: any;
}): StructuredError;
/**
 * Enhanced error handler with AWS error classification
 */
export declare const enhancedErrorHandler: ErrorHandler;
/**
 * Default error handler that logs to console
 */
export declare const defaultErrorHandler: ErrorHandler;
/**
 * Silent error handler for testing
 */
export declare const silentErrorHandler: ErrorHandler;
//# sourceMappingURL=error-handling.d.ts.map