# 📡 API リファレンス

## 🌍 環境別エンドポイント

| 環境 | ベースURL | 説明 |
|------|----------|------|
| **local** | `http://localhost:3001/api` | ローカル開発環境 |
| **dev** | `https://dev-api.feature-flags.example.com/api` | 開発環境 |
| **prod** | `https://api.feature-flags.example.com/api` | 本番環境 |

## 🔑 認証

```typescript
// APIキーによる認証
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

## 📋 主要エンドポイント

### 1. フラグ評価 API

#### POST `/evaluate`

フィーチャーフラグの状態を評価します。

**リクエスト:**
```json
{
  "tenantId": "tenant-123",
  "flagKey": "new-dashboard",
  "environment": "prod",
  "metadata": {
    "userId": "user-456",
    "userRole": "admin",
    "plan": "enterprise"
  }
}
```

**レスポンス:**
```json
{
  "enabled": true,
  "flagKey": "new-dashboard",
  "tenantId": "tenant-123",
  "reason": "default",
  "source": "dynamodb",
  "environment": "prod",
  "evaluatedAt": "2024-01-15T10:00:00Z"
}
```

**TypeScript型定義:**
```typescript
interface EvaluationRequest {
  tenantId: string;           // 必須
  flagKey: string;            // 必須
  environment?: string;       // オプション（自動検出）
  metadata?: {
    userId?: string;
    userRole?: string;
    plan?: string;
    [key: string]: any;
  };
}

interface EvaluationResponse {
  enabled: boolean;
  flagKey: string;
  tenantId: string;
  reason: 'default' | 'tenant_override' | 'kill_switch';
  source: 'in-memory' | 'dynamodb';
  environment: 'local' | 'dev' | 'prod';
  evaluatedAt: string;
}
```

### 2. フラグ管理 API

#### GET `/flags`

フラグ一覧を取得します。

**レスポンス:**
```json
[
  {
    "id": "1",
    "flagKey": "new-dashboard",
    "description": "新しいダッシュボード機能",
    "defaultEnabled": true,
    "owner": "frontend-team",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

#### POST `/flags`

新しいフラグを作成します。

**リクエスト:**
```json
{
  "flagKey": "beta-feature",
  "description": "ベータ機能フラグ",
  "defaultEnabled": false,
  "owner": "engineering-team"
}
```

#### PUT `/flags/by-key/{flagKey}`

フラグの設定を更新します。

**リクエスト:**
```json
{
  "description": "更新された説明",
  "defaultEnabled": true,
  "owner": "new-owner-team"
}
```

#### DELETE `/flags/{id}`

フラグを削除します。

**レスポンス:**
```json
{
  "message": "Flag deleted successfully"
}
```

### 3. ヘルスチェック API

#### GET `/health`

システムの状態を確認します。

**レスポンス:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## 🔄 環境対応クライアント

### 自動環境検出

```typescript
import { getCurrentEnvironment, loadEnvironmentConfig } from '@feature-flag/core';

// 現在の環境を自動検出
const environment = getCurrentEnvironment(); // 'local' | 'dev' | 'prod'

// 環境設定を読み込み
const config = loadEnvironmentConfig(environment);

console.log(`Environment: ${environment}`);
console.log(`API URL: ${config.api.baseUrl}`);
```

### 手動設定

```typescript
import { FeatureFlagClient } from '@feature-flag/core';

const client = new FeatureFlagClient({
  apiUrl: 'https://api.feature-flags.example.com/api',
  apiKey: process.env.FEATURE_FLAG_API_KEY,
  timeout: 5000,
  retries: 3
});
```

## 📝 使用例

### 基本的な評価

```typescript
// 最小限のコンテキスト
const basicContext = {
  tenantId: 'company-abc'
};

const isEnabled = await client.isEnabled('new-feature', basicContext);

if (isEnabled) {
  console.log('新機能が有効です');
} else {
  console.log('新機能は無効です');
}
```

### 詳細なコンテキスト

```typescript
// 詳細なコンテキスト情報
const detailedContext = {
  tenantId: 'company-abc',
  userId: 'user-123',
  userRole: 'admin',
  plan: 'enterprise',
  environment: 'production'
};

const isEnabled = await client.isEnabled('premium-feature', detailedContext);
```

### バッチ評価

```typescript
// 複数のフラグを一度に評価
const flags = await Promise.all([
  client.isEnabled('feature-a', context),
  client.isEnabled('feature-b', context),
  client.isEnabled('feature-c', context)
]);

const [featureA, featureB, featureC] = flags;
```

## 🛡️ エラーハンドリング

### 基本的なエラーハンドリング

```typescript
try {
  const isEnabled = await client.isEnabled('feature-flag', context);
  return isEnabled;
} catch (error) {
  console.error('フラグ評価エラー:', error);
  
  // エラー時のフェイルセーフ値
  return false; // 新機能は保守的にfalse
}
```

### リトライロジック

```typescript
const clientWithRetries = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  timeout: 5000,
  retries: 3,           // 3回までリトライ
  retryDelay: 1000     // 1秒間隔
});
```

### カスタムエラーハンドリング

```typescript
client.on('error', (error, context) => {
  console.error('フィーチャーフラグエラー:', {
    error: error.message,
    flagKey: context.flagKey,
    tenantId: context.tenantId,
    timestamp: new Date().toISOString()
  });
  
  // エラーレポートサービスに送信
  errorReportingService.report(error, context);
});
```

## ⚡ パフォーマンス最適化

### キャッシュ設定

```typescript
const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  cache: {
    enabled: true,
    ttl: 60000,        // 1分間キャッシュ
    maxSize: 1000      // 最大1000件
  }
});
```

### バックグラウンド更新

```typescript
// バックグラウンドでフラグを定期更新
const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  backgroundRefresh: {
    enabled: true,
    interval: 30000    // 30秒間隔
  }
});
```

## 🔍 デバッグ機能

### デバッグログ有効化

```typescript
const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  debug: true  // デバッグログを有効化
});
```

### イベントリスナー

```typescript
// フラグ評価イベント
client.on('evaluation', (data) => {
  console.log('フラグ評価完了:', data);
});

// キャッシュヒットイベント
client.on('cache:hit', (data) => {
  console.log('キャッシュヒット:', data.flagKey);
});

// キャッシュミスイベント
client.on('cache:miss', (data) => {
  console.log('キャッシュミス:', data.flagKey);
});
```

## 📊 レスポンス形式

### 成功レスポンス

```json
{
  "enabled": true,
  "flagKey": "feature-name",
  "tenantId": "tenant-123",
  "reason": "default",
  "source": "dynamodb",
  "environment": "prod",
  "evaluatedAt": "2024-01-15T10:00:00Z"
}
```

### エラーレスポンス

```json
{
  "error": "Invalid request",
  "message": "tenantId and flagKey are required",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### HTTPステータスコード

| ステータス | 説明 |
|------------|------|
| `200` | 成功 |
| `400` | 不正なリクエスト |
| `401` | 認証エラー |
| `403` | 権限不足 |
| `404` | フラグが見つからない |
| `429` | レート制限 |
| `500` | サーバーエラー |

## 🧪 テスト用 API

### テスト環境での使用

```typescript
// テスト用の設定
const testClient = new FeatureFlagClient({
  apiUrl: 'http://localhost:3001/api',
  environment: 'test',
  mockMode: true  // モックモードを有効化
});

// モックフラグの設定
testClient.setMockFlag('test-feature', true);

const isEnabled = await testClient.isEnabled('test-feature', context);
// モック値が返される: true
```

## 🔧 設定オプション

### 完全な設定例

```typescript
const client = new FeatureFlagClient({
  // 必須設定
  apiUrl: 'https://api.feature-flags.example.com/api',
  
  // 認証
  apiKey: process.env.FEATURE_FLAG_API_KEY,
  
  // タイムアウト・リトライ
  timeout: 5000,
  retries: 3,
  retryDelay: 1000,
  
  // キャッシュ
  cache: {
    enabled: true,
    ttl: 60000,
    maxSize: 1000
  },
  
  // バックグラウンド更新
  backgroundRefresh: {
    enabled: true,
    interval: 30000
  },
  
  // デバッグ
  debug: process.env.NODE_ENV === 'development',
  
  // フェイルセーフ
  defaultValues: {
    'critical-feature': false,
    'maintenance-mode': false
  }
});
```

## 📚 関連ドキュメント

- [実装サンプル](./examples/README.md)
- [TypeScript統合](./typescript-integration.md)
- [React統合](./react-integration.md)
- [Node.js統合](./nodejs-integration.md)
- [環境設定](../environments/README.md)
- [完全なOpenAPI仕様](../api/openapi.yaml)

## ❓ FAQ

### Q: フラグが見つからない場合はどうなりますか？

A: フラグが存在しない場合、デフォルト値（通常は`false`）が返されます。エラーは発生しません。

### Q: ネットワークエラー時の動作は？

A: ネットワークエラー時は、キャッシュされた値が使用されます。キャッシュがない場合は、設定されたデフォルト値が返されます。

### Q: レート制限はありますか？

A: はい。本番環境では1秒間に1000リクエストまでの制限があります。制限に達した場合、429ステータスが返されます。

## 📞 サポート

API利用に関する質問やサポートが必要な場合：

- 📖 [完全なAPI仕様書](../api/openapi.yaml)
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- 💬 [開発者Discord](https://discord.gg/developers)