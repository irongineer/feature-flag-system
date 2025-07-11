import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { FeatureFlagEvaluator, FeatureFlagKey, FeatureFlagContext } from '@feature-flag/core';
import { validateEvaluationRequest } from '../validators/evaluation';
import { createResponse, createErrorResponse } from '../utils/response';
import { createDynamoClient } from '../utils/dynamo';

interface EvaluationRequest {
  tenantId: string;
  flagKey: FeatureFlagKey;
  userId?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

interface EvaluationResponse {
  enabled: boolean;
  flagKey: FeatureFlagKey;
  tenantId: string;
  evaluatedAt: string;
  source: 'cache' | 'database' | 'default';
  ttl?: number;
}

let evaluator: FeatureFlagEvaluator | null = null;

function getEvaluator(): FeatureFlagEvaluator {
  if (!evaluator) {
    const dynamoClient = createDynamoClient();
    evaluator = new FeatureFlagEvaluator({
      dynamoDbClient: dynamoClient,
    });
  }
  return evaluator;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Evaluation request:', JSON.stringify(event, null, 2));
  
  try {
    // リクエストの検証
    const body = JSON.parse(event.body || '{}');
    const { error, value } = validateEvaluationRequest(body);
    
    if (error) {
      return createErrorResponse(400, 'Invalid request', error.details);
    }
    
    const request: EvaluationRequest = value;
    
    // フラグ評価コンテキストの作成
    const evaluationContext: FeatureFlagContext = {
      tenantId: request.tenantId,
      userId: request.userId,
      environment: request.environment,
      metadata: request.metadata,
    };
    
    // フラグ評価の実行
    const startTime = Date.now();
    const flagEvaluator = getEvaluator();
    const enabled = await flagEvaluator.isEnabled(evaluationContext, request.flagKey);
    const evaluationTime = Date.now() - startTime;
    
    // レスポンスの作成
    const response: EvaluationResponse = {
      enabled,
      flagKey: request.flagKey,
      tenantId: request.tenantId,
      evaluatedAt: new Date().toISOString(),
      source: 'database', // 実際のソースを判定する場合は追加実装が必要
      ttl: 300, // 5分
    };
    
    // カスタムメトリクスの記録
    console.log('FLAG_EVALUATION', {
      flagKey: request.flagKey,
      tenantId: request.tenantId,
      enabled,
      evaluationTime,
      source: response.source,
    });
    
    return createResponse(200, response);
    
  } catch (error) {
    console.error('Evaluation error:', error);
    
    // エラーログの記録
    console.log('FLAG_EVALUATION_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      event: event.body,
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};

// バッチ評価のハンドラー
export const batchHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Batch evaluation request:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { tenantId, flagKeys, userId, environment, metadata } = body;
    
    if (!tenantId || !Array.isArray(flagKeys) || flagKeys.length === 0) {
      return createErrorResponse(400, 'Invalid request', 'tenantId and flagKeys are required');
    }
    
    if (flagKeys.length > 50) {
      return createErrorResponse(400, 'Too many flags', 'Maximum 50 flags per batch request');
    }
    
    const evaluationContext: FeatureFlagContext = {
      tenantId,
      userId,
      environment,
      metadata,
    };
    
    const flagEvaluator = getEvaluator();
    const startTime = Date.now();
    
    // 並列で全フラグを評価
    const evaluationPromises = flagKeys.map(async (flagKey: FeatureFlagKey) => {
      try {
        const enabled = await flagEvaluator.isEnabled(evaluationContext, flagKey);
        return {
          flagKey,
          enabled,
          error: null,
        };
      } catch (error) {
        return {
          flagKey,
          enabled: false, // エラー時はfalseで安全側に倒す
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
    
    const results = await Promise.all(evaluationPromises);
    const evaluationTime = Date.now() - startTime;
    
    // レスポンスの作成
    const response = {
      tenantId,
      evaluatedAt: new Date().toISOString(),
      evaluationTime,
      flags: results,
    };
    
    // カスタムメトリクスの記録
    console.log('BATCH_FLAG_EVALUATION', {
      tenantId,
      flagCount: flagKeys.length,
      evaluationTime,
      successCount: results.filter(r => r.error === null).length,
      errorCount: results.filter(r => r.error !== null).length,
    });
    
    return createResponse(200, response);
    
  } catch (error) {
    console.error('Batch evaluation error:', error);
    
    console.log('BATCH_FLAG_EVALUATION_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      event: event.body,
    });
    
    return createErrorResponse(500, 'Internal server error');
  }
};