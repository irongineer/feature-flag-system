#!/bin/bash

# デプロイメントスクリプト
set -e

ENVIRONMENT=${1:-dev}
echo "🚀 Deploying to environment: $ENVIRONMENT"

# 環境ファイルを読み込み
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "📄 Loading environment config: .env.$ENVIRONMENT"
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
else
    echo "❌ Environment file .env.$ENVIRONMENT not found"
    exit 1
fi

# 依存関係のインストール
echo "📦 Installing dependencies..."
npm install

# ビルド
echo "🔨 Building packages..."
npm run build

# TypeScript型チェック
echo "🔍 Type checking..."
npm run typecheck

# テスト実行
echo "🧪 Running tests..."
npm test

if [ "$ENVIRONMENT" = "local" ]; then
    echo "🏠 Starting local development environment..."
    echo "✅ Use 'npm run dev' to start the development servers"
elif [ "$ENVIRONMENT" = "dev" ]; then
    echo "🌐 Deploying to AWS dev environment..."
    # CDKデプロイ
    cd infrastructure
    npx cdk deploy --profile dev --context environment=dev
    cd ..
elif [ "$ENVIRONMENT" = "prod" ]; then
    echo "🌟 Deploying to AWS production environment..."
    # CDKデプロイ（本番では追加の確認が必要）
    read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        cd infrastructure
        npx cdk deploy --profile prod --context environment=prod
        cd ..
    else
        echo "❌ Production deployment cancelled"
        exit 1
    fi
fi

echo "✅ Deployment to $ENVIRONMENT completed successfully!"