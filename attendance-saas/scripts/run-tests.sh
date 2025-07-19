#!/bin/bash

# 勤怠SaaS テスト実行スクリプト

set -e

echo "🧪 Running Attendance SaaS Integration Tests..."

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

# 必要なディレクトリの作成
mkdir -p logs

# 環境変数の設定
export NODE_ENV=test
export LOG_LEVEL=error

# フィーチャーフラグAPIサーバーが起動しているかチェック
echo "🔍 Checking if Feature Flag API server is running..."
if ! curl -f -s http://localhost:3001/health > /dev/null; then
  echo "❌ Feature Flag API server is not running on port 3001"
  echo "Please start the main feature flag system first:"
  echo "  cd ../../packages/api && npm run dev"
  exit 1
fi

echo "✅ Feature Flag API server is running"

# テストの実行
echo "🚀 Running integration tests..."
cd tests/integration

# 依存関係のインストール（必要に応じて）
if [ ! -d "node_modules" ]; then
  echo "📦 Installing test dependencies..."
  npm install
fi

# 統合テストの実行
echo "🧪 Running feature flag integration tests..."
npm test feature-flag-integration.test.ts

echo "🧪 Running API integration tests..."
npm test attendance-api.test.ts

echo "🎉 All tests completed!"

# テスト結果の表示
echo ""
echo "📊 Test Summary:"
echo "- Feature Flag Integration: ✅ Passed"
echo "- API Integration: ✅ Passed"
echo "- Total Coverage: Check vitest output above"
echo ""
echo "🎯 Next Steps:"
echo "1. Start the Attendance API server: ./scripts/start-attendance-api.sh"
echo "2. Test the API endpoints manually with curl or Postman"
echo "3. Implement the frontend UI components"