#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { FeatureFlagEvaluator, DynamoDbClient } from '@feature-flag/core';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Create DynamoDB client
const dynamoClient = new DynamoDbClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  tableName: process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  environment: (process.env.ENVIRONMENT as any) || 'development',
});

// Create evaluator
const evaluator = new FeatureFlagEvaluator({
  dynamoDbClient: dynamoClient
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
    const { tenantId, flagKey, environment = 'development' } = req.body;
    
    console.log('Evaluating flag:', { tenantId, flagKey, environment });
    
    if (!tenantId || !flagKey) {
      return res.status(400).json({ error: 'tenantId and flagKey are required' });
    }
    
    const enabled = await evaluator.isEnabled(tenantId, flagKey);
    
    const response = {
      enabled,
      flagKey,
      tenantId,
      evaluatedAt: new Date().toISOString(),
      source: 'database'
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
app.get('/api/flags', (req, res) => {
  res.json(flags);
});

app.post('/api/flags', (req, res) => {
  const { flagKey, description, defaultEnabled = false, owner = 'test@example.com' } = req.body;
  
  if (!flagKey || !description) {
    return res.status(400).json({ error: 'flagKey and description are required' });
  }
  
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
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 DynamoDB: ${process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'}`);
});

export default app;