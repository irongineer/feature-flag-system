#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { FeatureFlagEvaluator, DynamoDbClient, loadEnvironmentConfig, getCurrentEnvironment } from '@feature-flag/core';

const app = express();
const PORT = process.env.PORT || 3001;

// 環境設定を読み込み（フォールバック対応）
const environment = getCurrentEnvironment();
let config;

try {
  config = loadEnvironmentConfig(environment);
} catch (error) {
  console.warn(`⚠️ Failed to load config file, using defaults:`, error.message);
  // デフォルト設定を使用
  config = {
    name: environment,
    api: {
      baseUrl: `http://localhost:${process.env.PORT || 3001}`,
      evaluateEndpoint: `http://localhost:${process.env.PORT || 3001}/api/evaluate`,
      timeout: 5000
    },
    database: {
      type: 'local',
      dynamodb: {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
        region: process.env.DYNAMODB_REGION || 'ap-northeast-1',
        tableName: process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags'
      }
    },
    useInMemoryFlags: process.env.USE_IN_MEMORY_FLAGS !== 'false',
    cors: {
      origins: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080']
    }
  };
}

console.log(`🚀 Starting Feature Flag API Server in ${environment} environment`);

// CORS設定
app.use(cors({
  origin: config.cors.origins,
  credentials: true
}));
app.use(express.json());

// Create DynamoDB client based on environment config
const dynamoEnvironment = (() => {
  switch (environment) {
    case 'local': return 'development';
    case 'dev': return 'staging';  
    case 'prod': return 'production';
    default: return 'development';
  }
})();

const dynamoClient = new DynamoDbClient({
  region: config.database.dynamodb.region,
  tableName: config.database.dynamodb.tableName,
  endpoint: config.database.dynamodb.endpoint,
  environment: dynamoEnvironment as any,
});

// Create evaluator
const evaluator = new FeatureFlagEvaluator({
  dynamoDbClient: dynamoClient
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Evaluation endpoint (environment-aware)
app.post('/api/evaluate', async (req, res) => {
  try {
    const { tenantId, flagKey, environment: requestEnv = environment } = req.body;
    
    console.log('Evaluating flag:', { tenantId, flagKey, environment: requestEnv, configEnv: environment });
    
    if (!tenantId || !flagKey) {
      return res.status(400).json({ error: 'tenantId and flagKey are required' });
    }
    
    let enabled = false;
    let source = 'unknown';
    
    if (config.useInMemoryFlags) {
      // Use in-memory flags for local development
      const flag = flags.find(f => f.flagKey === flagKey);
      enabled = flag ? flag.defaultEnabled : false;
      source = 'in-memory';
    } else {
      // Use DynamoDB evaluator for dev/prod
      enabled = await evaluator.isEnabled(tenantId, flagKey);
      source = 'dynamodb';
    }
    
    const response = {
      enabled,
      flagKey,
      tenantId,
      evaluatedAt: new Date().toISOString(),
      source,
      environment: environment
    };
    
    console.log('Evaluation result:', response);
    
    res.json(response);
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mock dashboard endpoint
app.get('/api/dashboard/metrics', (req, res) => {
  res.json({
    totalFlags: 15,
    activeFlags: 12,
    killSwitchesActive: 0,
    tenantsWithOverrides: 23,
    flagUsageStats: [
      { flagKey: 'test_flag_1', evaluations: 1234, lastAccessed: new Date().toISOString() },
      { flagKey: 'test_flag_2', evaluations: 567, lastAccessed: new Date(Date.now() - 3600000).toISOString() }
    ]
  });
});

// Mock dashboard activities endpoint
app.get('/api/dashboard/activities', (req, res) => {
  res.json([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      type: 'flag_created',
      user: 'test@example.com',
      message: 'Created flag: test_flag_1'
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'flag_updated',
      user: 'admin@example.com',
      message: 'Updated flag: test_flag_2'
    }
  ]);
});

// In-memory storage for development/testing
let flags = [
  {
    id: '1',
    flagKey: 'test_flag_1',
    description: 'Test Flag 1',
    defaultEnabled: true,
    owner: 'test@example.com',
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: '2025-12-31T23:59:59Z'
  },
  {
    id: '2',
    flagKey: 'test_flag_2',
    description: 'Test Flag 2',
    defaultEnabled: false,
    owner: 'test@example.com',
    createdAt: '2025-01-01T00:00:00Z'
  }
];

// Flag management endpoints
app.get('/api/flags', async (req, res) => {
  try {
    if (config.useInMemoryFlags) {
      res.json(flags);
    } else {
      // Use DynamoDB for dev/prod environments
      const dbFlags = await dynamoClient.listFlags();
      res.json(dbFlags);
    }
  } catch (error) {
    console.error('Failed to get flags:', error);
    res.status(500).json({ error: 'Failed to get flags' });
  }
});

app.post('/api/flags', async (req, res) => {
  try {
    const { flagKey, description, defaultEnabled = false, owner = 'test@example.com' } = req.body;
    
    if (!flagKey || !description) {
      return res.status(400).json({ error: 'flagKey and description are required' });
    }
    
    if (config.useInMemoryFlags) {
      // In-memory for local development
      const newFlag = {
        id: String(Date.now()),
        flagKey,
        description,
        defaultEnabled,
        owner,
        createdAt: new Date().toISOString()
      };
      
      flags.push(newFlag);
      res.status(201).json(newFlag);
    } else {
      // DynamoDB for dev/prod environments
      await dynamoClient.createFlag({
        flagKey,
        description,
        defaultEnabled,
        owner,
        createdAt: new Date().toISOString()
      });
      
      const createdFlag = {
        id: String(Date.now()),
        flagKey,
        description,
        defaultEnabled,
        owner,
        createdAt: new Date().toISOString()
      };
      
      res.status(201).json(createdFlag);
    }
  } catch (error) {
    console.error('Failed to create flag:', error);
    res.status(500).json({ error: 'Failed to create flag' });
  }
});

app.put('/api/flags/:id', (req, res) => {
  const { id } = req.params;
  const { flagKey, description, defaultEnabled, owner } = req.body;
  
  const flagIndex = flags.findIndex(f => f.id === id);
  if (flagIndex === -1) {
    return res.status(404).json({ error: 'Flag not found' });
  }
  
  const updatedFlag = {
    ...flags[flagIndex],
    ...(flagKey && { flagKey }),
    ...(description && { description }),
    ...(defaultEnabled !== undefined && { defaultEnabled }),
    ...(owner && { owner })
  };
  
  flags[flagIndex] = updatedFlag;
  res.json(updatedFlag);
});

// Update flag by flagKey endpoint
app.put('/api/flags/by-key/:flagKey', async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { description, defaultEnabled, owner } = req.body;
    
    console.log(`Updating flag by flagKey: ${flagKey}`, req.body);
    
    if (config.useInMemoryFlags) {
      // In-memory for local development
      const flagIndex = flags.findIndex(f => f.flagKey === flagKey);
      if (flagIndex === -1) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      
      const updatedFlag = {
        ...flags[flagIndex],
        ...(description && { description }),
        ...(defaultEnabled !== undefined && { defaultEnabled }),
        ...(owner && { owner })
      };
      
      flags[flagIndex] = updatedFlag;
      console.log(`Flag updated successfully:`, updatedFlag);
      res.json(updatedFlag);
    } else {
      // DynamoDB for dev/prod environments
      const updateData = {};
      if (description) updateData.description = description;
      if (defaultEnabled !== undefined) updateData.defaultEnabled = defaultEnabled;
      if (owner) updateData.owner = owner;
      
      await dynamoClient.updateFlag(flagKey, updateData);
      
      // Get updated flag for response
      const updatedFlag = await dynamoClient.getFlag(flagKey);
      console.log(`Flag updated successfully in DynamoDB:`, updatedFlag);
      res.json(updatedFlag);
    }
  } catch (error) {
    console.error('Failed to update flag:', error);
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

app.delete('/api/flags/:id', (req, res) => {
  const { id } = req.params;
  
  const flagIndex = flags.findIndex(f => f.id === id);
  if (flagIndex === -1) {
    return res.status(404).json({ error: 'Flag not found' });
  }
  
  flags.splice(flagIndex, 1);
  res.status(204).send();
});

// Test data management endpoints
app.post('/api/test/reset', (req, res) => {
  flags = [];
  console.log('🧪 Test data reset - all flags cleared');
  res.json({ message: 'Test data reset', timestamp: new Date().toISOString() });
});

app.post('/api/test/seed', (req, res) => {
  const seedData = [
    {
      id: '1',
      flagKey: 'test_flag_1',
      description: 'Test Flag 1',
      defaultEnabled: true,
      owner: 'test@example.com',
      createdAt: '2025-01-01T00:00:00Z',
      expiresAt: '2025-12-31T23:59:59Z'
    },
    {
      id: '2',
      flagKey: 'test_flag_2',
      description: 'Test Flag 2',
      defaultEnabled: false,
      owner: 'test@example.com',
      createdAt: '2025-01-01T00:00:00Z'
    }
  ];
  
  flags = [...seedData];
  console.log(`🌱 Test data seeded - ${flags.length} flags created`);
  res.json({ message: 'Test data seeded', count: flags.length, timestamp: new Date().toISOString() });
});

app.post('/api/test/seed-custom', (req, res) => {
  const { customFlags } = req.body;
  
  if (!customFlags || !Array.isArray(customFlags)) {
    return res.status(400).json({ error: 'customFlags array is required' });
  }
  
  flags = [...customFlags];
  console.log(`🎯 Custom test data seeded - ${flags.length} flags created`);
  res.json({ message: 'Custom test data seeded', count: flags.length, timestamp: new Date().toISOString() });
});

app.get('/api/test/status', (req, res) => {
  res.json({
    totalFlags: flags.length,
    flags: flags.map(f => ({ id: f.id, flagKey: f.flagKey, defaultEnabled: f.defaultEnabled })),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Feature Flag API Server running on http://localhost:${PORT}`);
  console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${environment}`);
  console.log(`💾 Database: ${config.database.type} (${config.useInMemoryFlags ? 'in-memory' : 'persistent'})`);
  if (config.database.dynamodb.endpoint) {
    console.log(`🗄️ DynamoDB: ${config.database.dynamodb.endpoint}`);
  }
  console.log(`🌐 CORS Origins: ${config.cors.origins.join(', ')}`);
});

export default app;