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
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
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
    killSwitchActive: false,
    tenantOverrides: 23
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