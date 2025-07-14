import { beforeAll, afterAll } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';

// グローバルセットアップ
beforeAll(async () => {
  console.log('🚀 統合テスト環境セットアップ開始');
  
  // 環境変数設定
  process.env.AWS_ACCESS_KEY_ID = 'dummy';
  process.env.AWS_SECRET_ACCESS_KEY = 'dummy';
  process.env.AWS_DEFAULT_REGION = 'ap-northeast-1';
  process.env.NODE_ENV = 'test';
  
  // DynamoDB Local接続チェック
  try {
    const response = await fetch('http://localhost:8000');
    // DynamoDB Localは正常時も400を返すので、接続できること自体を確認
    console.log('✅ DynamoDB Local接続確認完了');
  } catch (error) {
    console.error('❌ DynamoDB Local接続エラー');
    console.error('💡 scripts/start-local-aws.sh を実行してください');
    throw error;
  }
  
  // DynamoDBテーブル作成
  const dynamoClient = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'ap-northeast-1',
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy'
    }
  });

  try {
    // FeatureFlagsテーブル作成
    await dynamoClient.send(new CreateTableCommand({
      TableName: 'FeatureFlags-Test',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' },
          BillingMode: 'PAY_PER_REQUEST'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
    console.log('✅ DynamoDBテーブル作成完了');
  } catch (error: any) {
    if (error.name !== 'ResourceInUseException') {
      console.error('テーブル作成エラー:', error);
      throw error;
    }
    console.log('✅ DynamoDBテーブル既存確認');
  }

  console.log('✅ 統合テスト環境セットアップ完了');
});

// グローバルクリーンアップ
afterAll(async () => {
  console.log('🧹 統合テスト環境クリーンアップ完了');
});