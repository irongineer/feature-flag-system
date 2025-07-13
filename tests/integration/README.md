# フィーチャーフラグシステム - ローカル統合テスト

## 概要

AWS SAM Local + DynamoDB Local を使用したローカル統合テスト環境です。プロダクション環境相当のフィーチャーフラグ機能をローカルで完全テストできます。

## 🏗️ 環境構築

### 前提条件

以下のツールがインストールされている必要があります：

```bash
# AWS SAM CLI
brew install aws-sam-cli

# Docker Desktop
# https://docs.docker.com/get-docker/

# Node.js 22.x
# https://nodejs.org/
```

### 環境起動

```bash
# ローカルAWS環境起動（DynamoDB Local + テーブル作成）
npm run local:start

# または直接スクリプト実行
./scripts/start-local-aws.sh
```

### 環境停止

```bash
# ローカルAWS環境停止
npm run local:stop

# または直接スクリプト実行  
./scripts/stop-local-aws.sh
```

## 🧪 テスト実行

### 統合テスト実行

```bash
# 統合テスト実行（ワンショット）
npm run test:integration

# 統合テスト実行（ウォッチモード）
npm run test:integration:watch

# 直接実行
cd tests/integration
npx vitest
```

### テストスイート

#### 1. DynamoDB統合テスト
- **ファイル**: `dynamodb-integration.test.ts`
- **対象**: DynamoDB Local での CRUD オペレーション
- **テスト内容**:
  - FeatureFlags テーブル操作
  - TenantOverrides テーブル操作
  - EmergencyControl テーブル操作
  - パフォーマンステスト（100件のバッチ処理）

#### 2. E2E統合テスト
- **ファイル**: `feature-flag-e2e.test.ts`  
- **対象**: フィーチャーフラグシステム全体の動作
- **テスト内容**:
  - 基本的なフラグ評価
  - Kill-Switch機能
  - キャッシュ統合
  - マルチテナント機能
  - エラーハンドリング

## 📊 テスト環境詳細

### DynamoDB Local
- **URL**: http://localhost:8000
- **テーブル**:
  - `FeatureFlags`
  - `TenantOverrides`
  - `EmergencyControl`

### テストデータ

環境起動時に以下のサンプルデータが投入されます：

```javascript
// FeatureFlags
{
  flagKey: "billing_v2_enable",
  description: "新しい請求システム",
  defaultEnabled: true
}

// TenantOverrides  
{
  tenantId: "tenant-001",
  flagKey: "billing_v2_enable", 
  enabled: false // オーバーライド
}
```

## 🎯 テスト戦略

### テストカテゴリ

1. **DynamoDB 統合テスト**
   - データ永続化の確認
   - CRUD オペレーションの検証
   - パフォーマンス要件の確認

2. **フィーチャーフラグ E2E テスト**
   - ビジネスロジックの検証
   - Kill-Switch 動作確認
   - キャッシュ連携確認

3. **エラーハンドリングテスト**
   - DynamoDB 接続エラー時の動作
   - 不正データに対する堅牢性
   - タイムアウト処理

### パフォーマンス要件

- **DynamoDB 操作**: 100件挿入 < 30秒
- **フラグ評価**: 100テナント並列評価 < 10秒
- **キャッシュ効果**: 2回目評価が初回より高速

## 🔧 設定

### Vitest設定

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000,  // 30秒タイムアウト
    environment: 'node', // Node.js環境
    setupFiles: ['./setup.ts']
  }
});
```

### TypeScript設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "ESNext",
    "paths": {
      "@core/*": ["../../packages/core/src/*"],
      "@models": ["../../packages/core/src/models"]
    }
  }
}
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. DynamoDB Local 接続エラー
```bash
Error: DynamoDB Local に接続できません
```

**解決方法**:
```bash
# Docker Desktop が起動していることを確認
docker info

# DynamoDB Local 再起動
npm run local:stop
npm run local:start
```

#### 2. ポート競合エラー
```bash
Error: Port 8000 is already in use
```

**解決方法**:
```bash
# ポート使用プロセス確認
lsof -i :8000

# プロセス停止後に再起動
npm run local:start
```

#### 3. テストタイムアウト
```bash
Error: Test timeout (30000ms) 
```

**解決方法**:
- DynamoDB Local の動作確認
- テストデータのクリーンアップ確認
- ネットワーク接続確認

### デバッグ方法

#### ログレベル調整
```bash
# 詳細ログ出力
DEBUG=* npm run test:integration
```

#### DynamoDB データ確認
```bash
# テーブル一覧確認
aws dynamodb list-tables --endpoint-url http://localhost:8000

# データスキャン
aws dynamodb scan --table-name FeatureFlags --endpoint-url http://localhost:8000
```

## 📈 継続的インテグレーション

### GitHub Actions 統合

```yaml
# .github/workflows/integration-test.yml
name: Integration Tests
on: [push, pull_request]
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run local:start &
      - run: sleep 10  # DynamoDB Local 起動待機
      - run: npm run test:integration
```

## 🎉 期待される結果

統合テスト成功時には以下が実証されます：

### ✅ 動作確認項目

1. **DynamoDB 永続化**: フラグデータが正しく保存・取得される
2. **マルチテナント**: テナント別オーバーライドが正しく適用される  
3. **Kill-Switch**: 緊急停止機能が即座に反映される
4. **キャッシュ連携**: パフォーマンス向上が確認される
5. **エラーハンドリング**: 障害時にデフォルト値が返される

### 📊 成功基準

- **全テスト通過**: 0 failed tests
- **パフォーマンス**: 要件内での実行時間
- **カバレッジ**: 主要な統合パスを網羅

この統合テストにより、フィーチャーフラグシステムが「真の動作するソフトウェア」であることが実証されます。