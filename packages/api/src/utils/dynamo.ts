import { DynamoDbClient, DynamoDbClientConfig } from '@feature-flag/core';

export function createDynamoClient(): DynamoDbClient {
  const config: DynamoDbClientConfig = {
    region: process.env.AWS_REGION || 'ap-northeast-1',
    tableName: process.env.FEATURE_FLAGS_TABLE_NAME || 'feature-flags',
    environment: (process.env.ENVIRONMENT as any) || 'development',
  };

  // ローカル開発環境の場合
  if (process.env.NODE_ENV === 'development' || process.env.IS_OFFLINE) {
    config.endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  }

  return new DynamoDbClient(config);
}
