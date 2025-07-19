# 🚀 クイックスタート - 5分でフィーチャーフラグを実装

## 📋 概要

このガイドでは、フィーチャーフラグシステムを最短時間で実装する方法を説明します。

## ⏱️ 前提条件

- Node.js 16+ または TypeScript 4.5+
- フィーチャーフラグAPIサーバーへのアクセス
- 基本的なJavaScript/TypeScriptの知識

## 🎯 目標

このクイックスタートを完了すると、以下ができるようになります：

✅ フィーチャーフラグクライアントの初期化  
✅ 基本的な条件分岐の実装  
✅ React/Vue/Node.jsでの実装  
✅ 簡単なテストの実行  

## 📦 ステップ1: インストール

### npm
```bash
npm install @your-org/feature-flag-client
```

### yarn
```bash
yarn add @your-org/feature-flag-client
```

### pnpm
```bash
pnpm add @your-org/feature-flag-client
```

## 🔧 ステップ2: 基本セットアップ

### TypeScript/JavaScript
```typescript
import { FeatureFlagClient } from '@your-org/feature-flag-client';

// クライアントの初期化
const client = new FeatureFlagClient({
  apiUrl: 'https://your-feature-flag-api.com',
  apiKey: 'your-api-key', // 本番環境では環境変数を使用
  timeout: 5000,
  cache: {
    enabled: true,
    ttl: 300000 // 5分
  }
});

// フィーチャーフラグの評価
const context = {
  userId: 'user-123',
  tenantId: 'tenant-456',
  userRole: 'admin',
  environment: 'production'
};

const isNewDashboardEnabled = await client.isEnabled('new-dashboard', context);

if (isNewDashboardEnabled) {
  console.log('新しいダッシュボードを表示');
} else {
  console.log('従来のダッシュボードを表示');
}
```

## ⚛️ ステップ3: フレームワーク統合

### React
```typescript
import React, { useState, useEffect } from 'react';
import { FeatureFlagClient } from '@your-org/feature-flag-client';

const client = new FeatureFlagClient({
  apiUrl: process.env.REACT_APP_FEATURE_FLAG_API_URL,
  apiKey: process.env.REACT_APP_FEATURE_FLAG_API_KEY
});

// カスタムフック
const useFeatureFlag = (flagKey: string) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const context = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      userRole: 'admin',
      environment: 'production'
    };

    client.isEnabled(flagKey, context)
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [flagKey]);

  return { enabled, loading };
};

// コンポーネント
const Dashboard: React.FC = () => {
  const { enabled, loading } = useFeatureFlag('new-dashboard');

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {enabled ? (
        <NewDashboard />
      ) : (
        <LegacyDashboard />
      )}
    </div>
  );
};

const NewDashboard: React.FC = () => (
  <div>
    <h1>新しいダッシュボード</h1>
    <p>最新の機能を含むダッシュボード</p>
  </div>
);

const LegacyDashboard: React.FC = () => (
  <div>
    <h1>従来のダッシュボード</h1>
    <p>安定した従来のダッシュボード</p>
  </div>
);
```

### Vue.js
```typescript
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <NewDashboard v-else-if="isNewDashboardEnabled" />
    <LegacyDashboard v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { FeatureFlagClient } from '@your-org/feature-flag-client';

const client = new FeatureFlagClient({
  apiUrl: import.meta.env.VITE_FEATURE_FLAG_API_URL,
  apiKey: import.meta.env.VITE_FEATURE_FLAG_API_KEY
});

const isNewDashboardEnabled = ref(false);
const loading = ref(true);

onMounted(async () => {
  const context = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    userRole: 'admin',
    environment: 'production'
  };

  try {
    isNewDashboardEnabled.value = await client.isEnabled('new-dashboard', context);
  } finally {
    loading.value = false;
  }
});
</script>
```

### Node.js (Express)
```typescript
import express from 'express';
import { FeatureFlagClient } from '@your-org/feature-flag-client';

const app = express();
const client = new FeatureFlagClient({
  apiUrl: process.env.FEATURE_FLAG_API_URL,
  apiKey: process.env.FEATURE_FLAG_API_KEY
});

// ミドルウェア
app.use(async (req, res, next) => {
  const context = {
    userId: req.user?.id || 'anonymous',
    tenantId: req.user?.tenantId || 'default',
    userRole: req.user?.role || 'guest',
    environment: process.env.NODE_ENV || 'development'
  };

  try {
    // よく使うフラグを事前に取得
    const flags = await client.getAllFlags(context);
    req.featureFlags = flags;
    next();
  } catch (error) {
    console.error('Feature flag evaluation failed:', error);
    req.featureFlags = {};
    next();
  }
});

// ルート
app.get('/dashboard', (req, res) => {
  if (req.featureFlags['new-dashboard']) {
    res.render('new-dashboard');
  } else {
    res.render('legacy-dashboard');
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 🧪 ステップ4: テストの実装

### ユニットテスト (Jest)
```typescript
import { FeatureFlagClient } from '@your-org/feature-flag-client';

// モッククライアント
const mockClient = {
  isEnabled: jest.fn(),
  getVariant: jest.fn(),
  getAllFlags: jest.fn()
};

describe('Feature Flag Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show new dashboard when flag is enabled', async () => {
    // モックの設定
    mockClient.isEnabled.mockResolvedValue(true);

    const context = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      userRole: 'admin',
      environment: 'test'
    };

    const isEnabled = await mockClient.isEnabled('new-dashboard', context);
    
    expect(isEnabled).toBe(true);
    expect(mockClient.isEnabled).toHaveBeenCalledWith('new-dashboard', context);
  });

  it('should show legacy dashboard when flag is disabled', async () => {
    mockClient.isEnabled.mockResolvedValue(false);

    const context = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      userRole: 'admin',
      environment: 'test'
    };

    const isEnabled = await mockClient.isEnabled('new-dashboard', context);
    
    expect(isEnabled).toBe(false);
  });
});
```

### React Testing Library
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';

// モック
jest.mock('@your-org/feature-flag-client', () => ({
  FeatureFlagClient: jest.fn().mockImplementation(() => ({
    isEnabled: jest.fn().mockResolvedValue(true)
  }))
}));

describe('Dashboard Component', () => {
  it('should render new dashboard when flag is enabled', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('新しいダッシュボード')).toBeInTheDocument();
    });
  });
});
```

## 🔍 ステップ5: 動作確認

### 1. 環境変数の設定
```bash
# .env ファイル
FEATURE_FLAG_API_URL=https://your-feature-flag-api.com
FEATURE_FLAG_API_KEY=your-api-key
```

### 2. 実行
```bash
# 開発サーバー起動
npm run dev

# または
yarn dev
```

### 3. 確認ポイント
- ✅ フィーチャーフラグが正しく評価されている
- ✅ 条件分岐が期待通りに動作している
- ✅ エラーハンドリングが機能している
- ✅ キャッシュが適切に動作している

## 📊 ステップ6: モニタリング

### 基本的なログ出力
```typescript
const client = new FeatureFlagClient({
  apiUrl: 'https://your-feature-flag-api.com',
  apiKey: 'your-api-key',
  logging: {
    enabled: true,
    level: 'info'
  }
});

// フラグ評価時にログが出力される
const isEnabled = await client.isEnabled('new-dashboard', context);
// ログ出力例: "Feature flag 'new-dashboard' evaluated to true for user user-123"
```

### メトリクス収集
```typescript
// カスタムメトリクス
client.on('flag-evaluated', (event) => {
  // 外部メトリクスサービスに送信
  metrics.increment('feature_flag.evaluations', 1, {
    flag: event.flagKey,
    result: event.result.toString(),
    tenant: event.context.tenantId
  });
});
```

## 🚀 次のステップ

クイックスタートを完了しました！次は以下を検討してください：

### 🔧 実装の改善
1. **[パフォーマンス最適化](./performance-optimization.md)** - キャッシュ戦略の改善
2. **[エラーハンドリング](./error-handling.md)** - フェイルセーフの実装
3. **[セキュリティ](./security-considerations.md)** - 認証・認可の強化

### 🧪 テストの拡充
1. **[テストガイド](./testing-guide.md)** - 包括的なテスト戦略
2. **[統合テスト](./testing/integration-testing.md)** - E2Eテストの実装
3. **[モックとスタブ](./testing/mocking.md)** - テストの高速化

### 📊 高度な機能
1. **[A/Bテスト](./use-cases/ab-testing.md)** - 多変量テストの実装
2. **[段階的ロールアウト](./use-cases/gradual-rollout.md)** - 安全な機能展開
3. **[バリアントフラグ](./advanced/variant-flags.md)** - 多値フラグの活用

### 🔍 実装例の確認
1. **[実装例集](./examples/README.md)** - 各種実装パターン
2. **[ベストプラクティス](./best-practices.md)** - 推奨される実装方法
3. **[アンチパターン](./anti-patterns.md)** - 避けるべき実装

## 🤝 困ったときは

- **[FAQ](../reference/faq.md)** - よくある質問
- **[トラブルシューティング](./troubleshooting/README.md)** - 問題解決ガイド
- **[GitHub Issues](https://github.com/your-org/feature-flag-system/issues)** - 質問・バグレポート
- **[コミュニティ](https://discord.gg/your-community)** - リアルタイムサポート

---

**🎉 おめでとうございます！** フィーチャーフラグシステムの基本的な実装が完了しました。

次は [実装例集](./examples/README.md) で様々な実装パターンを確認してみてください。