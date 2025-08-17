# 🚀 クイックスタート

## 5分でフィーチャーフラグを始める

このガイドでは、最短でフィーチャーフラグシステムを導入できます。

## 📦 インストール

```bash
npm install @feature-flag/core
```

## ⚙️ 基本セットアップ

### 1. 環境設定

```typescript
import { getCurrentEnvironment, loadEnvironmentConfig } from '@feature-flag/core';

// 環境の自動検出
const environment = getCurrentEnvironment(); // 'local' | 'dev' | 'prod'
const config = loadEnvironmentConfig(environment);
```

### 2. クライアント初期化

```typescript
import { FeatureFlagClient } from '@feature-flag/core';

const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  apiKey: process.env.FEATURE_FLAG_API_KEY
});
```

### 3. フラグ評価

```typescript
const context = {
  tenantId: 'your-tenant-id'  // 必須
};

const isEnabled = await client.isEnabled('new-feature', context);

if (isEnabled) {
  console.log('新機能が有効です！');
} else {
  console.log('従来機能を使用します');
}
```

## 🎯 実際の例

### React での使用

```tsx
import React, { useState, useEffect } from 'react';

const MyComponent = () => {
  const [newFeatureEnabled, setNewFeatureEnabled] = useState(false);

  useEffect(() => {
    const checkFlag = async () => {
      const enabled = await client.isEnabled('new-ui', {
        tenantId: 'demo-tenant'
      });
      setNewFeatureEnabled(enabled);
    };
    checkFlag();
  }, []);

  return (
    <div>
      {newFeatureEnabled ? (
        <NewUI />
      ) : (
        <LegacyUI />
      )}
    </div>
  );
};
```

### Node.js/Express での使用

```typescript
app.get('/dashboard', async (req, res) => {
  const context = {
    tenantId: req.headers['x-tenant-id']
  };

  const newDashboard = await client.isEnabled('new-dashboard', context);

  if (newDashboard) {
    res.render('new-dashboard');
  } else {
    res.render('legacy-dashboard');
  }
});
```

## 🌍 環境別設定

| 環境 | API URL | データソース |
|------|---------|-------------|
| **local** | `http://localhost:3001/api` | インメモリ |
| **dev** | `https://dev-api.feature-flags.example.com/api` | DynamoDB dev |
| **prod** | `https://api.feature-flags.example.com/api` | DynamoDB prod |

## 🎛️ フラグ管理

### 管理画面でのフラグ作成

1. 管理画面にアクセス: `http://localhost:3000`
2. 「新しいフラグを作成」をクリック
3. フラグ情報を入力：
   - **フラグキー**: `new-feature`
   - **説明**: `新機能のテスト`
   - **デフォルト**: `false`
4. 「作成」をクリック

### APIでのフラグ作成

```bash
curl -X POST http://localhost:3001/api/flags \
  -H "Content-Type: application/json" \
  -d '{
    "flagKey": "new-feature",
    "description": "新機能のテスト",
    "defaultEnabled": false,
    "owner": "development-team"
  }'
```

## 🧪 テスト確認

```typescript
// テスト用のコンテキスト
const testContext = {
  tenantId: 'test-tenant'
};

// フラグの状態確認
const result = await client.isEnabled('new-feature', testContext);
console.log('フラグの状態:', result);
```

## 🚨 よくある問題

### API接続エラー

```typescript
try {
  const result = await client.isEnabled('feature', context);
} catch (error) {
  console.error('接続エラー:', error);
  // フェイルセーフ値を使用
  return false;
}
```

### 環境設定の確認

```typescript
console.log('現在の環境:', getCurrentEnvironment());
console.log('API URL:', config.api.baseUrl);
```

## 📚 次のステップ

- [詳細な実装例](./examples/README.md)
- [API仕様](./api-reference.md)
- [フィーチャーフラグ基礎](./concepts/feature-flags-101.md)
- [TypeScript統合](./typescript-integration.md)

## ❓ サポート

問題が発生した場合：

- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- 💬 [Discord コミュニティ](https://discord.gg/developers)
- 📖 [FAQ](./faq.md)

---

**所要時間**: 約5分でセットアップ完了！