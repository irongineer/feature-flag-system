import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FeatureFlagEvaluator, DynamoDbClient } from '@feature-flag/core';

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
      environment: (process.env.ENVIRONMENT as any) || 'development',
    });
    evaluator = new FeatureFlagEvaluator({
      dynamoDbClient: dynamoClient,
    });
  }
  return evaluator;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Evaluation request:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const { tenantId, flagKey } = body;

    if (!tenantId || !flagKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'tenantId and flagKey are required',
        }),
      };
    }

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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Evaluation error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
};
