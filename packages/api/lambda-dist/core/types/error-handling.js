"use strict";
/**
 * Error Handling Types
 *
 * エラーハンドリングの型定義とインターフェース
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.silentErrorHandler = exports.defaultErrorHandler = exports.enhancedErrorHandler = exports.FeatureFlagValidator = void 0;
exports.isResourceNotFound = isResourceNotFound;
exports.isConditionalCheckFailed = isConditionalCheckFailed;
exports.isValidationError = isValidationError;
exports.isAccessDenied = isAccessDenied;
exports.isResourceInUse = isResourceInUse;
exports.isTableNotFound = isTableNotFound;
exports.isTableInUse = isTableInUse;
exports.isLimitExceeded = isLimitExceeded;
exports.isThrottlingError = isThrottlingError;
exports.isItemCollectionSizeLimit = isItemCollectionSizeLimit;
exports.isInternalServerError = isInternalServerError;
exports.isServiceUnavailable = isServiceUnavailable;
exports.isRetryableError = isRetryableError;
exports.isClientError = isClientError;
exports.createOperationalErrorMessage = createOperationalErrorMessage;
exports.createStructuredError = createStructuredError;
// AWS DynamoDB エラータイプガード関数
function isResourceNotFound(error) {
    return error instanceof Error && error.name === 'ResourceNotFoundException';
}
function isConditionalCheckFailed(error) {
    return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}
function isValidationError(error) {
    return error instanceof Error && error.name === 'ValidationException';
}
function isAccessDenied(error) {
    return error instanceof Error && error.name === 'AccessDeniedException';
}
function isResourceInUse(error) {
    return error instanceof Error && error.name === 'ResourceInUseException';
}
function isTableNotFound(error) {
    return error instanceof Error && error.name === 'TableNotFoundException';
}
function isTableInUse(error) {
    return error instanceof Error && error.name === 'TableInUseException';
}
function isLimitExceeded(error) {
    return error instanceof Error && error.name === 'LimitExceededException';
}
function isThrottlingError(error) {
    return error instanceof Error && (error.name === 'ThrottlingException' ||
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'RequestLimitExceeded');
}
function isItemCollectionSizeLimit(error) {
    return error instanceof Error && error.name === 'ItemCollectionSizeLimitExceededException';
}
function isInternalServerError(error) {
    return error instanceof Error && error.name === 'InternalServerError';
}
function isServiceUnavailable(error) {
    return error instanceof Error && error.name === 'ServiceUnavailableException';
}
function isRetryableError(error) {
    return isThrottlingError(error) || isInternalServerError(error) || isServiceUnavailable(error);
}
function isClientError(error) {
    return isValidationError(error) || isConditionalCheckFailed(error) || isResourceNotFound(error) || isAccessDenied(error);
}
/**
 * 運用者向けの詳細なエラーメッセージを生成
 */
function createOperationalErrorMessage(error, context) {
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
    const err = error;
    return `Unexpected DynamoDB error: ${err.message}. Operation: ${context?.operation || 'unknown'}. Please check application logs for detailed error information`;
}
/**
 * 型安全性を向上させるためのFeatureFlagValidatorクラス
 */
class FeatureFlagValidator {
    /**
     * フィーチャーフラグデータの構造を検証
     */
    static validateFeatureFlag(item) {
        if (!item) {
            const error = new Error('Feature flag item is null or undefined');
            error.name = 'ValidationException';
            throw error;
        }
        if (!item.flagKey || typeof item.flagKey !== 'string') {
            const error = new Error('Invalid feature flag: flagKey must be a non-empty string');
            error.name = 'ValidationException';
            throw error;
        }
        if (typeof item.defaultEnabled !== 'boolean') {
            const error = new Error('Invalid feature flag: defaultEnabled must be a boolean');
            error.name = 'ValidationException';
            throw error;
        }
        if (!item.owner || typeof item.owner !== 'string') {
            const error = new Error('Invalid feature flag: owner must be a non-empty string');
            error.name = 'ValidationException';
            throw error;
        }
        return item;
    }
    /**
     * テナントオーバーライドデータの構造を検証
     */
    static validateTenantOverride(item) {
        if (!item) {
            const error = new Error('Tenant override item is null or undefined');
            error.name = 'ValidationException';
            throw error;
        }
        if (!item.tenantId || typeof item.tenantId !== 'string') {
            const error = new Error('Invalid tenant override: tenantId must be a non-empty string');
            error.name = 'ValidationException';
            throw error;
        }
        if (!item.flagKey || typeof item.flagKey !== 'string') {
            const error = new Error('Invalid tenant override: flagKey must be a non-empty string');
            error.name = 'ValidationException';
            throw error;
        }
        if (typeof item.enabled !== 'boolean') {
            const error = new Error('Invalid tenant override: enabled must be a boolean');
            error.name = 'ValidationException';
            throw error;
        }
        return item;
    }
    /**
     * キルスイッチデータの構造を検証
     */
    static validateKillSwitch(item) {
        if (!item) {
            const error = new Error('Kill switch item is null or undefined');
            error.name = 'ValidationException';
            throw error;
        }
        if (typeof item.enabled !== 'boolean') {
            const error = new Error('Invalid kill switch: enabled must be a boolean');
            error.name = 'ValidationException';
            throw error;
        }
        if (!item.reason || typeof item.reason !== 'string') {
            const error = new Error('Invalid kill switch: reason must be a non-empty string');
            error.name = 'ValidationException';
            throw error;
        }
        return item;
    }
}
exports.FeatureFlagValidator = FeatureFlagValidator;
/**
 * AWS エラーから構造化エラー情報を作成
 */
function createStructuredError(operation, error, context) {
    const err = error;
    // HTTPステータスコードの決定
    let httpStatusCode = err.$metadata?.httpStatusCode;
    if (!httpStatusCode && isInternalServerError(error)) {
        httpStatusCode = 500;
    }
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
        httpStatusCode,
    };
}
/**
 * Enhanced error handler with AWS error classification
 */
const enhancedErrorHandler = (errorInfo, error) => {
    if (typeof errorInfo === 'string') {
        console.error(errorInfo);
        return;
    }
    else {
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
            context: errorInfo.context,
        });
    }
};
exports.enhancedErrorHandler = enhancedErrorHandler;
/**
 * Default error handler that logs to console
 */
const defaultErrorHandler = (errorInfo, error) => {
    if (typeof errorInfo === 'string') {
        console.error(errorInfo, error);
    }
    else {
        console.error(`[${errorInfo.operation}] Error in feature flag evaluation:`, {
            ...errorInfo,
            timestamp: errorInfo.timestamp || new Date().toISOString(),
        });
    }
};
exports.defaultErrorHandler = defaultErrorHandler;
/**
 * Silent error handler for testing
 */
const silentErrorHandler = () => {
    // Do nothing - for testing scenarios
};
exports.silentErrorHandler = silentErrorHandler;
//# sourceMappingURL=error-handling.js.map