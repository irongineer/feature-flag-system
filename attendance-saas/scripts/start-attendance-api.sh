#!/bin/bash

# 勤怠SaaS API サーバー起動スクリプト

set -e

echo "🚀 Starting Attendance SaaS API Server..."

# 必要なディレクトリの作成
mkdir -p logs

# 環境変数の設定
export NODE_ENV=development
export PORT=3002
export LOG_LEVEL=info

# API サーバーのディレクトリに移動
cd packages/attendance-api

# 依存関係のインストール（必要に応じて）
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# TypeScript のコンパイル
echo "🔨 Compiling TypeScript..."
npm run build

# サーバーの起動
echo "🌟 Starting server on port $PORT..."
npm run dev