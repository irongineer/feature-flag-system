import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { FeatureFlagEvaluator, DynamoDbClient } from '@feature-flag/core';
import { validateEvaluationRequest } from '../validators/evaluation';
import { createErrorResponse, createSuccessResponse } from '../utils/response';

interface EvaluationRequest {
  tenantId: string;
  flagKey: string;
  userId?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

interface EvaluationResponse {
  enabled: boolean;
  flagKey: string;
  tenantId: string;
  evaluatedAt: string;
  source: 'database' | 'cache' | 'default';
  ttl?: number;
}

let evaluator: FeatureFlagEvaluator | null = null;

function getEvaluator(): FeatureFlagEvaluator {
  if (!evaluator) {
    const dynamoClient = new DynamoDbClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      tableName: process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags',
      endpoint: process.env.AWS_ENDPOINT_URL, // DynamoDB Local対応
    });
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
    const body = JSON.parse(event.body || '{}');
    
    // Joi バリデーション適用 (TDD改善)
    const { error, value } = validateEvaluationRequest(body);
    if (error) {
      return createErrorResponse(400, 'Validation failed', {
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }))
      });
    }
    
    const { tenantId, flagKey, userId, environment = 'development', metadata } = value;
    
    const flagEvaluator = getEvaluator();
    const enabled = await flagEvaluator.isEnabled(tenantId, flagKey);
    
    const response: EvaluationResponse = {
      enabled,
      flagKey,
      tenantId,
      evaluatedAt: new Date().toISOString(),
      source: 'database',
      ttl: 300, // 5分
    };
    
    return createSuccessResponse(response);
    
  } catch (error) {
    console.error('Evaluation error:', error);
    
    return createErrorResponse(500, 'Internal server error', {
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
    });
  }
};