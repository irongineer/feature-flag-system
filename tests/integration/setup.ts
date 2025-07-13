import { beforeAll, afterAll } from 'vitest';

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
    if (!response.ok) {
      throw new Error('DynamoDB Local接続失敗');
    }
    console.log('✅ DynamoDB Local接続確認完了');
  } catch (error) {
    console.error('❌ DynamoDB Local接続エラー');
    console.error('💡 scripts/start-local-aws.sh を実行してください');
    throw error;
  }
  
  console.log('✅ 統合テスト環境セットアップ完了');
});

// グローバルクリーンアップ
afterAll(async () => {
  console.log('🧹 統合テスト環境クリーンアップ完了');
});