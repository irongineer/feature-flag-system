#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler as evaluationHandler } from './handlers/evaluation';
import { handler as managementHandler } from './handlers/management';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Convert Express request to Lambda event
function createLambdaEvent(req: express.Request): APIGatewayProxyEvent {
  return {
    httpMethod: req.method,
    path: req.path,
    pathParameters: req.params,
    queryStringParameters: req.query as any,
    headers: req.headers as any,
    body: req.body ? JSON.stringify(req.body) : null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: {},
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      protocol: 'HTTP/1.1',
      httpMethod: req.method,
      path: req.path,
      stage: 'local',
      requestId: 'local-' + Date.now(),
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: req.ip || '127.0.0.1',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: req.get('User-Agent') || null,
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null
      },
      resourceId: 'local',
      resourcePath: req.path,
      authorizer: null
    },
    resource: req.path,
    stageVariables: null
  };
}

// Mock Lambda context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'local-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:local',
  memoryLimitInMB: '128',
  awsRequestId: 'local-request-id',
  logGroupName: '/aws/lambda/local',
  logStreamName: 'local-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

// Route handler wrapper
async function handleLambda(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>,
  req: express.Request,
  res: express.Response
) {
  try {
    const event = createLambdaEvent(req);
    const result = await handler(event, mockContext);
    
    res.status(result.statusCode);
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }
    
    if (result.body) {
      const contentType = result.headers?.['Content-Type'];
      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        res.json(JSON.parse(result.body));
      } else {
        res.send(result.body);
      }
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Lambda handler error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Routes
app.post('/api/evaluate', (req, res) => {
  handleLambda(evaluationHandler, req, res);
});

app.get('/api/evaluate/:tenantId/:flagKey', (req, res) => {
  // Convert GET request to POST-like body for Lambda
  req.body = {
    tenantId: req.params.tenantId,
    flagKey: req.params.flagKey,
    userId: req.query.userId,
    environment: req.query.environment || 'development'
  };
  handleLambda(evaluationHandler, req, res);
});

app.all('/api/flags*', (req, res) => {
  handleLambda(managementHandler, req, res);
});

app.all('/api/dashboard*', (req, res) => {
  // Mock dashboard endpoints
  if (req.path.includes('/metrics')) {
    res.json({
      totalFlags: 15,
      activeFlags: 12,
      killSwitchActive: false,
      tenantOverrides: 23
    });
  } else if (req.path.includes('/activities')) {
    res.json([
      {
        id: '1',
        timestamp: new Date().toISOString(),
        action: 'フラグ作成',
        flagKey: 'test_flag',
        user: 'admin@example.com'
      }
    ]);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.all('/api/tenants*', (req, res) => {
  // Mock tenant endpoints
  res.json([]);
});

app.all('/api/audit*', (req, res) => {
  // Mock audit endpoints
  res.json({ logs: [], total: 0 });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Feature Flag API Server running on http://localhost:${PORT}`);
  console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;