# 🚀 デプロイメントガイド

> **⚠️ このドキュメントは現在準備中です**
> 
> フィーチャーフラグシステムのデプロイメント手順を準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [クイックスタート](../developers/quickstart.md) - 基本的なセットアップ
> - [インフラ構成](./infrastructure.md) - AWS CDK設定

## 🎯 基本的なデプロイ手順

```bash
# 依存関係インストール
npm install

# 環境別デプロイ
npm run deploy:dev   # 開発環境
npm run deploy:prod  # 本番環境

# CDKデプロイ
cd infrastructure
npx cdk deploy --profile your-aws-profile
```

## 🌍 環境設定

| 環境 | コマンド | AWS Profile |
|------|----------|-------------|
| **Development** | `npm run deploy:dev` | `dev-profile` |
| **Production** | `npm run deploy:prod` | `prod-profile` |

## 📚 関連ドキュメント

- [インフラ構成](./infrastructure.md) - AWS リソース詳細
- [モニタリング](./monitoring.md) - 運用監視設定

## 📞 サポート

デプロイメントについてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)