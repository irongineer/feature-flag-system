# 環境設定ドキュメント

## 概要

フィーチャーフラグシステムは3つの環境（local、dev、prod）に対応し、環境ごとに適切なリソースを自動選択します。

## 設定ファイル

### /config/environments.json

各環境の設定を定義するメインファイル：

```typescript
interface ApiEnvironmentConfig {
  name: string;
  api: {
    baseUrl: string;
    evaluateEndpoint: string;
    timeout: number;
  };
  database: {
    type: 'local' | 'dynamodb';
    dynamodb: {
      endpoint?: string;
      region: string;
      tableName: string;
    };
  };
  useInMemoryFlags: boolean;
  cors: {
    origins: string[];
  };
}
```

## 環境別設定

### local環境
- **目的**: ローカル開発・単体テスト
- **データベース**: インメモリ + DynamoDB Local (オプション)
- **フラグ管理**: 高速な開発用インメモリストレージ
- **CORS**: ローカルホスト許可

### dev環境  
- **目的**: 統合テスト・機能検証
- **データベース**: `feature-flags-dev` DynamoDB テーブル
- **フラグ管理**: 永続化されたDynamoDBストレージ
- **環境マッピング**: dev → staging (DynamoDB Client)

### prod環境
- **目的**: 本番運用
- **データベース**: `feature-flags-prod` DynamoDB テーブル  
- **フラグ管理**: 本番用永続化ストレージ
- **環境マッピング**: prod → production (DynamoDB Client)

## 環境変数オーバーライド

設定ファイルの値は環境変数で上書き可能：

| 環境変数 | 説明 | デフォルト |
|----------|------|-----------|
| `NODE_ENV` | Node.js環境 | `local` |
| `STAGE` | デプロイステージ | `NODE_ENV`と同値 |
| `USE_IN_MEMORY_FLAGS` | インメモリフラグ使用 | 環境設定に依存 |
| `FEATURE_FLAGS_TABLE_NAME` | DynamoDBテーブル名 | 環境設定に依存 |
| `DYNAMODB_ENDPOINT` | DynamoDB エンドポイント | 環境設定に依存 |
| `DYNAMODB_REGION` | AWS リージョン | `ap-northeast-1` |

## 環境検出ロジック

```typescript
// packages/core/src/utils/config.ts
export function getCurrentEnvironment(): ApiEnvironment {
  const env = process.env.NODE_ENV || 'local';
  const stage = process.env.STAGE || env;
  
  switch (stage.toLowerCase()) {
    case 'development':
    case 'local':
      return 'local';
    case 'staging':
    case 'dev':
      return 'dev';
    case 'production':
    case 'prod':
      return 'prod';
    default:
      return 'local';
  }
}
```

## 使用例

### APIサーバー起動

```bash
# ローカル環境
NODE_ENV=local npm run dev

# dev環境
NODE_ENV=development STAGE=dev USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-dev npm run dev

# prod環境  
NODE_ENV=production STAGE=prod USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-prod npm run dev
```

### クライアント初期化

```typescript
import { getCurrentEnvironment, loadEnvironmentConfig } from '@feature-flag/core';

// 自動環境検出
const environment = getCurrentEnvironment();
const config = loadEnvironmentConfig(environment);

// APIクライアント初期化
const apiClient = new FeatureFlagApiClient({
  baseUrl: config.api.baseUrl,
  timeout: config.api.timeout
});
```

## データ分離

各環境は完全に分離されており、相互に影響しません：

- **local**: インメモリ（プロセス終了で消失）
- **dev**: `feature-flags-dev` DynamoDB テーブル
- **prod**: `feature-flags-prod` DynamoDB テーブル

## トラブルシューティング

### 設定ファイルが見つからない

```
Configuration file not found. Searched: [paths...]
```

**解決策**: `/config/environments.json` ファイルが存在することを確認

### DynamoDB接続エラー

```
DynamoDB error [NON-RETRYABLE]: ValidationException
```

**解決策**: 
1. AWS認証情報が正しく設定されているか確認
2. 対象テーブルが存在するか確認
3. IAM権限が適切か確認

### 環境マッピングエラー

```
Invalid environment: local/dev. Must be one of: development, staging, production
```

**解決策**: DynamoDB Clientの環境マッピングを確認（local→development, dev→staging, prod→production）

## 関連ファイル

- `/config/environments.json` - 環境設定
- `/packages/core/src/utils/config.ts` - 設定ユーティリティ
- `/packages/api/src/simple-server.ts` - APIサーバー環境検出
- `/packages/admin-ui/src/services/api.ts` - フロントエンド環境検出