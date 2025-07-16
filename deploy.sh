#!/bin/bash

set -e

echo "🚀 Starting deployment process..."

# Build core package
echo "📦 Building core package..."
cd packages/core
npm run build
cd ../..

# Create deployment package for Lambda
echo "📦 Creating Lambda deployment package..."
cd packages/api

# Create a minimal package.json for Lambda
cat > lambda-package.json << EOF
{
  "name": "feature-flag-lambda",
  "version": "1.0.0",
  "main": "handlers/evaluation.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.451.0",
    "@aws-sdk/lib-dynamodb": "^3.451.0"
  }
}
EOF

# Create lambda deployment directory
rm -rf lambda-dist
mkdir -p lambda-dist

# Copy compiled core package
cp -r ../core/dist lambda-dist/core

# Copy evaluation handler (simplified)
mkdir -p lambda-dist/handlers

# Create simplified evaluation handler for Lambda
cat > lambda-dist/handlers/evaluation.js << 'EOF'
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
EOF

# Create simplified management handler
cat > lambda-dist/handlers/management.js << 'EOF'
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
EOF

# Copy package.json for Lambda
cp lambda-package.json lambda-dist/package.json

# Create index.js files for each handler
echo "exports.handler = require('./evaluation').handler;" > lambda-dist/handlers/evaluation-index.js
echo "exports.handler = require('./management').handler;" > lambda-dist/handlers/management-index.js

# Install dependencies for Lambda
cd lambda-dist
npm install --production

cd ../..

# Deploy with CDK
echo "🚀 Deploying with CDK..."
cd infrastructure
npm install
npx cdk deploy --all --require-approval never

echo "✅ Deployment complete!"