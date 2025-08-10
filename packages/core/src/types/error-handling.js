"use strict";
/**
 * Error Handling Types
 *
 * エラーハンドリングの型定義とインターフェース
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.silentErrorHandler = exports.defaultErrorHandler = exports.enhancedErrorHandler = void 0;
exports.isResourceNotFound = isResourceNotFound;
exports.isConditionalCheckFailed = isConditionalCheckFailed;
exports.isValidationError = isValidationError;
exports.isThrottlingError = isThrottlingError;
exports.isItemCollectionSizeLimit = isItemCollectionSizeLimit;
exports.isInternalServerError = isInternalServerError;
exports.isServiceUnavailable = isServiceUnavailable;
exports.isRetryableError = isRetryableError;
exports.isClientError = isClientError;
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
    return isValidationError(error) || isConditionalCheckFailed(error) || isResourceNotFound(error);
}
/**
 * AWS エラーから構造化エラー情報を作成
 */
function createStructuredError(operation, error, context) {
    const err = error;
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
const enhancedErrorHandler = (errorInfo, error) => {
    if (typeof errorInfo === 'string') {
        console.error(errorInfo, error);
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
            context: errorInfo.context
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
            timestamp: errorInfo.timestamp || new Date().toISOString()
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