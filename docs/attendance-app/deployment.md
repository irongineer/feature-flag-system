# 🚀 勤怠アプリデプロイメント

> **⚠️ このドキュメントは現在準備中です**
> 
> 勤怠管理アプリのデプロイメント手順とフィーチャーフラグ統合設定を準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [統合ガイド](./integration-guide.md) - 基本的な統合方法
> - [運用者デプロイガイド](../operators/deployment-guide.md) - システム全体のデプロイ

## 🎯 基本的なデプロイ手順

### 環境変数設定

```bash
# .env.local
REACT_APP_FEATURE_FLAG_API_URL=http://localhost:3001/api
REACT_APP_TENANT_ID=your-tenant-id

# .env.dev
REACT_APP_FEATURE_FLAG_API_URL=https://dev-api.feature-flags.example.com/api
REACT_APP_TENANT_ID=dev-tenant

# .env.prod
REACT_APP_FEATURE_FLAG_API_URL=https://api.feature-flags.example.com/api
REACT_APP_TENANT_ID=prod-tenant
```

### ビルド設定

```json
{
  "scripts": {
    "build:dev": "REACT_APP_ENV=dev npm run build",
    "build:prod": "REACT_APP_ENV=prod npm run build",
    "deploy:dev": "npm run build:dev && aws s3 sync build/ s3://dev-bucket",
    "deploy:prod": "npm run build:prod && aws s3 sync build/ s3://prod-bucket"
  }
}
```

## 🌍 環境別デプロイ

| 環境 | コマンド | S3 Bucket |
|------|----------|-----------|
| **Development** | `npm run deploy:dev` | `dev-attendance-app` |
| **Production** | `npm run deploy:prod` | `prod-attendance-app` |

## 📚 関連ドキュメント

- [統合ガイド](./integration-guide.md) - フィーチャーフラグ統合
- [運用者デプロイガイド](../operators/deployment-guide.md) - インフラ設定

## 📞 サポート

デプロイメントについてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)