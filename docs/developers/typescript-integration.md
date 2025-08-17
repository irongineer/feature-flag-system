# 📘 TypeScript統合ガイド

> **⚠️ このドキュメントは現在準備中です**
> 
> TypeScript統合の詳細ガイドを準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [実装サンプル](./examples/README.md) - TypeScript例を含む
> - [API仕様](./api-reference.md) - 型定義情報あり
> - [クイックスタート](./quickstart.md) - 基本的な型使用例

## 🚀 基本的な型定義

```typescript
import { FeatureFlagClient } from '@feature-flag/core';

interface FeatureFlagContext {
  tenantId: string;              // 必須
  userId?: string;               // オプション
  userRole?: string;             // オプション
  plan?: string;                 // オプション
  environment?: string;          // オプション
  metadata?: Record<string, any>; // オプション
}

const client = new FeatureFlagClient({
  apiUrl: 'https://api.feature-flags.example.com/api',
  apiKey: process.env.FEATURE_FLAG_API_KEY
});

const context: FeatureFlagContext = {
  tenantId: 'your-tenant'
};

const isEnabled: boolean = await client.isEnabled('feature-flag', context);
```

## 📚 関連ドキュメント

- [実装サンプル](./examples/README.md) - TypeScriptコード例
- [API仕様](./api-reference.md) - 詳細な型情報

## 📞 サポート

TypeScript統合についてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- 💬 [開発者コミュニティ](https://discord.gg/developers)