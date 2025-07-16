const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

class SimpleDynamoClient {
  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
    this.dynamoDb = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags';
  }

  async getFlag(flagKey) {
    try {
      const result = await this.dynamoDb.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `FLAG#${flagKey}`,
          SK: 'METADATA',
        },
      }));
      return result.Item || null;
    } catch (error) {
      console.error('Error getting flag:', error);
      return null;
    }
  }
}

const dynamoClient = new SimpleDynamoClient();

exports.handler = async (event, context) => {
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
          error: 'tenantId and flagKey are required'
        }),
      };
    }
    
    // For now, return a simple response
    // In a real implementation, this would use the full evaluation logic
    const flag = await dynamoClient.getFlag(flagKey);
    const enabled = flag ? flag.defaultEnabled : false;
    
    const response = {
      enabled,
      flagKey,
      tenantId,
      evaluatedAt: new Date().toISOString(),
      source: 'database'
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
        error: 'Internal server error'
      }),
    };
  }
};
