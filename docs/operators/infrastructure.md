# 🏗️ インフラ構成

> **⚠️ このドキュメントは現在準備中です**
> 
> フィーチャーフラグシステムのインフラ構成とAWS設定ガイドを準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [デプロイメントガイド](./deployment-guide.md) - デプロイ手順
> - [モニタリング](./monitoring.md) - 運用監視

## 🌍 アーキテクチャ概要

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │───▶│  Lambda API     │───▶│   DynamoDB      │
│  (Admin Panel)  │    │  (Express)      │    │  (Flags Store)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ☁️ AWS リソース

### DynamoDB テーブル

```typescript
// テーブル設計
interface FeatureFlagsTable {
  PK: string;           // "FLAG#${flagKey}"
  SK: string;           // "METADATA"
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
}
```

### Lambda 設定

```yaml
# serverless.yml
functions:
  api:
    handler: src/lambda.handler
    environment:
      DYNAMODB_TABLE_NAME: ${self:custom.tableName}
      NODE_ENV: ${self:custom.stage}
```

## 🔧 環境設定

| 環境 | DynamoDB Table | Lambda Function |
|------|----------------|-----------------|
| **Local** | `localhost:8000` | `localhost:3001` |
| **Dev** | `feature-flags-dev` | `dev-api-lambda` |
| **Prod** | `feature-flags-prod` | `prod-api-lambda` |

## 📚 関連ドキュメント

- [デプロイメントガイド](./deployment-guide.md) - 実際のデプロイ手順
- [モニタリング](./monitoring.md) - インフラ監視

## 📞 サポート

インフラについてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)