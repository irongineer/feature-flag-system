#!/usr/bin/env node

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
});
const dynamoDb = DynamoDBDocumentClient.from(client);

const tableName = 'feature-flags-dev';

async function seedDatabase() {
  console.log('🌱 Seeding AWS DynamoDB table:', tableName);
  
  const sampleData = [
    // Feature flags
    {
      PK: 'FLAG#billing_v2_enable',
      SK: 'METADATA',
      flagKey: 'billing_v2_enable',
      description: 'Enable new billing system v2',
      defaultEnabled: false,
      owner: 'billing-team',
      createdAt: new Date().toISOString(),
    },
    {
      PK: 'FLAG#new_dashboard_enable',
      SK: 'METADATA',
      flagKey: 'new_dashboard_enable',
      description: 'Enable new dashboard UI',
      defaultEnabled: true,
      owner: 'frontend-team',
      createdAt: new Date().toISOString(),
    },
    {
      PK: 'FLAG#advanced_analytics_enable',
      SK: 'METADATA',
      flagKey: 'advanced_analytics_enable',
      description: 'Enable advanced analytics features',
      defaultEnabled: false,
      owner: 'analytics-team',
      createdAt: new Date().toISOString(),
    },
    // Tenant overrides
    {
      PK: 'TENANT#test-tenant',
      SK: 'FLAG#billing_v2_enable',
      enabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
      GSI1PK: 'FLAG#billing_v2_enable',
      GSI1SK: 'TENANT#test-tenant',
    },
    {
      PK: 'TENANT#demo-tenant',
      SK: 'FLAG#new_dashboard_enable',
      enabled: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
      GSI1PK: 'FLAG#new_dashboard_enable',
      GSI1SK: 'TENANT#demo-tenant',
    },
    // Kill switches (disabled)
    {
      PK: 'EMERGENCY',
      SK: 'GLOBAL',
      enabled: false,
      reason: 'Global kill switch disabled',
      activatedAt: new Date().toISOString(),
      activatedBy: 'system',
    },
  ];

  try {
    for (const item of sampleData) {
      await dynamoDb.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
      console.log(`✅ Inserted: ${item.PK}#${item.SK}`);
    }
    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();