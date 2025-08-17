# 環境管理運用手順書

## 概要

フィーチャーフラグシステムの環境切り替えと運用手順を説明します。

## 環境アーキテクチャ

```
[Local Dev] ──── config/environments.json ──── [Auto Detection]
     │                                               │
     ├─ local  → In-Memory Flags                    │
     ├─ dev    → feature-flags-dev DynamoDB          │
     └─ prod   → feature-flags-prod DynamoDB         │
                                                     │
[API Server] ←────────────────────────────────────────
```

## 環境切り替え手順

### 1. ローカル開発環境

高速開発・単体テスト用のインメモリ環境：

```bash
# APIサーバー起動
cd packages/api
NODE_ENV=local npm run dev

# 確認
curl http://localhost:3001/health
curl http://localhost:3001/api/flags
```

**特徴**:
- インメモリフラグストレージ
- プロセス再起動でデータリセット
- DynamoDB不要

### 2. 開発環境 (dev)

統合テスト・機能検証用のDynamoDB環境：

```bash
# AWS認証確認
aws sts get-caller-identity

# APIサーバー起動
cd packages/api
NODE_ENV=development STAGE=dev USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-dev npm run dev

# 環境確認
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/flags \
  -H "Content-Type: application/json" \
  -d '{"flagKey": "test_flag", "description": "Test", "defaultEnabled": false}'
```

**特徴**:
- `feature-flags-dev` DynamoDB テーブル
- 永続化されたフラグデータ
- ステージング環境マッピング

### 3. 本番環境 (prod)

本番運用用のDynamoDB環境：

```bash
# AWS認証確認（本番アカウント）
aws sts get-caller-identity

# APIサーバー起動
cd packages/api
NODE_ENV=production STAGE=prod USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-prod npm run dev

# 環境確認
curl http://localhost:3001/health
curl http://localhost:3001/api/flags
```

**特徴**:
- `feature-flags-prod` DynamoDB テーブル
- 本番データの永続化
- プロダクション環境マッピング

## 環境変数設定

### 必須環境変数

| 変数名 | 値 | 説明 |
|-------|-----|------|
| `NODE_ENV` | `local`/`development`/`production` | Node.js環境 |
| `STAGE` | `local`/`dev`/`prod` | デプロイステージ |

### 環境別設定

#### ローカル環境
```bash
export NODE_ENV=local
export STAGE=local
# USE_IN_MEMORY_FLAGS=true (デフォルト)
```

#### 開発環境
```bash
export NODE_ENV=development
export STAGE=dev
export USE_IN_MEMORY_FLAGS=false
export FEATURE_FLAGS_TABLE_NAME=feature-flags-dev
export AWS_REGION=ap-northeast-1
```

#### 本番環境
```bash
export NODE_ENV=production
export STAGE=prod
export USE_IN_MEMORY_FLAGS=false
export FEATURE_FLAGS_TABLE_NAME=feature-flags-prod
export AWS_REGION=ap-northeast-1
```

## データベース管理

### DynamoDBテーブル状態確認

```bash
# 開発環境テーブル
aws dynamodb describe-table --table-name feature-flags-dev
aws dynamodb scan --table-name feature-flags-dev --max-items 5

# 本番環境テーブル
aws dynamodb describe-table --table-name feature-flags-prod
aws dynamodb scan --table-name feature-flags-prod --max-items 5
```

### テーブル作成 (必要時)

```bash
# CDKでのテーブル作成
cd infrastructure
npx cdk deploy FeatureFlagStack-dev
npx cdk deploy FeatureFlagStack-prod
```

## トラブルシューティング

### 1. 環境検出失敗

**症状**: `Unknown environment: ${stage}, defaulting to local`

**原因**: 無効な`STAGE`環境変数

**解決策**:
```bash
# 有効な値に設定
export STAGE=local  # または dev, prod
```

### 2. DynamoDB接続エラー

**症状**: `DynamoDB error [NON-RETRYABLE]: ValidationException`

**原因**: AWS認証エラーまたはテーブル不存在

**解決策**:
```bash
# AWS認証確認
aws sts get-caller-identity

# テーブル存在確認
aws dynamodb list-tables --query "TableNames[?contains(@, 'feature-flags')]"

# IAM権限確認
aws iam get-user
```

### 3. 設定ファイル読み込みエラー

**症状**: `Configuration file not found`

**原因**: `/config/environments.json`が見つからない

**解決策**:
```bash
# ファイル存在確認
ls -la config/environments.json

# プロジェクトルートからの実行確認
pwd  # feature-flag-system/ であることを確認
```

### 4. 予約キーワードエラー

**症状**: `Attribute name is a reserved keyword; reserved keyword: owner`

**原因**: DynamoDB予約キーワードの使用

**解決策**: 最新のcoreパッケージを使用（自動修正済み）
```bash
cd packages/core && npm run build
```

## モニタリング

### ヘルスチェック

```bash
# 各環境のヘルスチェック
curl http://localhost:3001/health

# 期待されるレスポンス
{
  "status": "healthy",
  "timestamp": "2025-08-16T19:50:02.838Z"
}
```

### ログ監視

APIサーバーログで以下を確認：

```
🚀 Starting Feature Flag API Server in {environment} environment
💾 Database: {type} ({persistence})
🌐 CORS Origins: {origins}
```

### パフォーマンス監視

```bash
# フラグ評価レスポンス時間
time curl -X POST http://localhost:3001/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test", "flagKey": "test_flag"}'
```

## 緊急対応

### Kill-Switch発動

```bash
# グローバル緊急停止
curl -X POST http://localhost:3001/api/emergency/global \
  -H "Content-Type: application/json" \
  -d '{"reason": "Critical issue detected"}'

# フラグ固有停止
curl -X POST http://localhost:3001/api/emergency/flags/{flagKey} \
  -H "Content-Type: application/json" \
  -d '{"reason": "Flag causing issues"}'
```

### 環境切り戻し

```bash
# 問題のある環境から安全な環境へ
pkill -f "tsx src/simple-server.ts"

# 安全な環境で再起動
NODE_ENV=local npm run dev  # ローカルインメモリ
```

## デプロイ時チェックリスト

### 環境切り替え前

- [ ] AWS認証情報確認
- [ ] 対象DynamoDBテーブル存在確認
- [ ] 環境変数設定確認
- [ ] 設定ファイル存在確認

### 切り替え後

- [ ] ヘルスチェック成功
- [ ] フラグ一覧取得成功
- [ ] フラグ評価成功
- [ ] ログに正しい環境表示
- [ ] データ分離確認

### ロールバック準備

- [ ] 直前環境の設定保存
- [ ] エラーログ取得準備
- [ ] Kill-Switch手順確認