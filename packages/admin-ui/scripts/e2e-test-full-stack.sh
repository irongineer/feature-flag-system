#!/bin/bash
set -e

echo "🚀 フィーチャーフラグシステム - 完全統合E2Eテスト開始"
echo "=================================================================="

# プロジェクトルートに移動
cd "$(dirname "$0")/../../.."

echo "📦 依存関係インストール確認..."
npm install

echo "🗄️  DynamoDB Local 起動中..."
./scripts/start-local-aws.sh &
DYNAMO_PID=$!

# DynamoDB Localの起動を待機
echo "⏳ DynamoDB Local 起動待機..."
sleep 5

echo "🔧 APIサーバー起動中..."
cd packages/api
npm run dev &
API_PID=$!
cd ../..

# APIサーバーの起動を待機
echo "⏳ APIサーバー起動待機..."
sleep 3

# APIサーバーのヘルスチェック
echo "🩺 APIサーバー ヘルスチェック..."
for i in {1..30}; do
  if curl -f http://localhost:3001/health 2>/dev/null; then
    echo "✅ APIサーバー起動完了"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ APIサーバー起動タイムアウト"
    exit 1
  fi
  sleep 1
done

echo "🌐 フロントエンド起動中..."
cd packages/admin-ui
npm run dev &
FRONTEND_PID=$!

# フロントエンドの起動を待機
echo "⏳ フロントエンド起動待機..."
for i in {1..30}; do
  if curl -f http://localhost:3000 2>/dev/null; then
    echo "✅ フロントエンド起動完了"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ フロントエンド起動タイムアウト"
    exit 1
  fi
  sleep 1
done

echo "🧪 E2Eテスト実行..."
npx playwright test --reporter=list

# クリーンアップ
cleanup() {
  echo "🧹 クリーンアップ中..."
  kill $FRONTEND_PID 2>/dev/null || true
  kill $API_PID 2>/dev/null || true
  kill $DYNAMO_PID 2>/dev/null || true
  
  # DynamoDB Localコンテナを停止
  docker stop dynamodb-local 2>/dev/null || true
  
  echo "✅ クリーンアップ完了"
}

trap cleanup EXIT

# テスト結果の表示
echo "📊 E2Eテスト結果確認..."
if [ $? -eq 0 ]; then
  echo "🎉 全E2Eテスト成功！"
else
  echo "❌ E2Eテスト失敗"
  exit 1
fi