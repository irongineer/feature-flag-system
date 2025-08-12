/**
 * Error Handling Types
 *
 * エラーハンドリングの型定義とインターフェース
 */
import { ResourceNotFoundException, ConditionalCheckFailedException, ProvisionedThroughputExceededException, ItemCollectionSizeLimitExceededException, RequestLimitExceeded, InternalServerError, ResourceInUseException, LimitExceededException, TableNotFoundException, TableInUseException } from '@aws-sdk/client-dynamodb';
import { FeatureFlagsTable, TenantOverridesTable, EmergencyControlTable } from '../models';
export interface AccessDeniedException extends Error {
    name: 'AccessDeniedException';
}
export interface ValidationException extends Error {
    name: 'ValidationException';
}
export interface ServiceUnavailableException extends Error {
    name: 'ServiceUnavailableException';
}
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
    rolloutConfig?: string;
}
export type ErrorHandler = (errorInfo: string | StructuredError, error?: Error) => void;
export interface ErrorHandlingOptions {
    errorHandler?: ErrorHandler;
    enableConsoleLogging?: boolean;
}
export declare function isResourceNotFound(error: unknown): error is ResourceNotFoundException;
export declare function isConditionalCheckFailed(error: unknown): error is ConditionalCheckFailedException;
export declare function isValidationError(error: unknown): error is ValidationException;
export declare function isAccessDenied(error: unknown): error is AccessDeniedException;
export declare function isResourceInUse(error: unknown): error is ResourceInUseException;
export declare function isTableNotFound(error: unknown): error is TableNotFoundException;
export declare function isTableInUse(error: unknown): error is TableInUseException;
export declare function isLimitExceeded(error: unknown): error is LimitExceededException;
export declare function isThrottlingError(error: unknown): error is ProvisionedThroughputExceededException | RequestLimitExceeded | Error;
export declare function isItemCollectionSizeLimit(error: unknown): error is ItemCollectionSizeLimitExceededException;
export declare function isInternalServerError(error: unknown): error is InternalServerError;
export declare function isServiceUnavailable(error: unknown): error is Error;
export declare function isRetryableError(error: unknown): boolean;
export declare function isClientError(error: unknown): boolean;
/**
 * 運用者向けの詳細なエラーメッセージを生成
 */
export declare function createOperationalErrorMessage(error: unknown, context?: {
    operation?: string;
    flagKey?: string;
    tenantId?: string;
    tableName?: string;
}): string;
/**
 * 型安全性を向上させるためのFeatureFlagValidatorクラス
 */
export declare class FeatureFlagValidator {
    /**
     * フィーチャーフラグデータの構造を検証
     */
    static validateFeatureFlag(item: any): FeatureFlagsTable;
    /**
     * テナントオーバーライドデータの構造を検証
     */
    static validateTenantOverride(item: any): TenantOverridesTable;
    /**
     * キルスイッチデータの構造を検証
     */
    static validateKillSwitch(item: any): EmergencyControlTable;
}
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
