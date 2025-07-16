const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

class SimpleDynamoClient {
  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    });
    this.dynamoDb = DynamoDBDocumentClient.from(client);
    this.tableName = process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags';
  }

  async listFlags() {
    try {
      const result = await this.dynamoDb.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'FLAG#',
          ':sk': 'METADATA',
        },
      }));
      return result.Items || [];
    } catch (error) {
      console.error('Error listing flags:', error);
      return [];
    }
  }

  async createFlag(flagData) {
    try {
      const item = {
        PK: `FLAG#${flagData.flagKey}`,
        SK: 'METADATA',
        ...flagData,
      };
      
      await this.dynamoDb.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
      }));
    } catch (error) {
      console.error('Error creating flag:', error);
      throw error;
    }
  }
}

const dynamoClient = new SimpleDynamoClient();

exports.handler = async (event, context) => {
  console.log('Management request:', JSON.stringify(event, null, 2));
  
  try {
    const { httpMethod, path } = event;
    
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
