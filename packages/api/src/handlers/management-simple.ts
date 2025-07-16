import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDbClient } from '@feature-flag/core';

let dynamoClient: DynamoDbClient | null = null;

function getDynamoClient(): DynamoDbClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDbClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
      tableName: process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags',
    });
  }
  return dynamoClient;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Management request:', JSON.stringify(event, null, 2));
  
  try {
    const { httpMethod, path } = event;
    const dynamoClient = getDynamoClient();
    
    // フラグ一覧取得
    if (httpMethod === 'GET' && path.includes('/flags')) {
      const flags = await dynamoClient.listFlags();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(flags),
      };
    }
    
    // フラグ作成
    if (httpMethod === 'POST' && path.includes('/flags')) {
      const body = JSON.parse(event.body || '{}');
      const { flagKey, description, defaultEnabled, owner } = body;
      
      if (!flagKey || !description || !owner) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'flagKey, description, and owner are required'
          }),
        };
      }
      
      await dynamoClient.createFlag({
        flagKey,
        description,
        defaultEnabled: defaultEnabled || false,
        owner,
        createdAt: new Date().toISOString(),
      });
      
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Flag created successfully',
          flagKey,
        }),
      };
    }
    
    // その他のエンドポイント
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Not found'
      }),
    };
    
  } catch (error) {
    console.error('Management error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error'
      }),
    };
  }
};