# 🚀 クイックスタート - 5分でフィーチャーフラグを実装

> **注意**: このドキュメントの多くのリンクは **(準備中)** です。現在は基本的な実装方法のみ記載されています。

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

// フィーチャーフラグの評価（様々なコンテキストパターン）

// 1. 最小限のコンテキスト（テナントレベルの機能制御）
const basicContext = {
  tenantId: 'tenant-456'
};

// 2. ユーザー固有のコンテキスト（A/Bテストや段階的ロールアウト）
const userContext = {
  tenantId: 'tenant-456',
  userId: 'user-123'
};

// 3. 権限ベースのコンテキスト（管理者機能など）
const roleContext = {
  tenantId: 'tenant-456',
  userId: 'user-123',
  userRole: 'admin'
};

// 4. 完全なコンテキスト（複雑な条件判定）
const fullContext = {
  tenantId: 'tenant-456',
  userId: 'user-123',
  userRole: 'admin',
  plan: 'enterprise',
  environment: 'production'
};

// 実際の評価（目的に応じて適切なコンテキストを選択）
const isNewDashboardEnabled = await client.isEnabled('new-dashboard', userContext);

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
    // 動的なコンテキスト構築（ユーザー情報が利用可能な場合のみ追加）
    const context = {
      tenantId: 'tenant-456', // 必須
      // ログイン済みユーザーの場合のみ追加
      ...(user && {
        userId: user.id,
        userRole: user.role,
        plan: user.tenant?.plan
      }),
      environment: 'production'
    };

    client.isEnabled(flagKey, context)
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [flagKey, user]);

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
  // Vue.jsでの動的コンテキスト構築
  const context = {
    tenantId: 'tenant-456', // 必須
    // ユーザー情報が利用可能な場合のみ追加
    ...(currentUser.value && {
      userId: currentUser.value.id,
      userRole: currentUser.value.role
    }),
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

// ミドルウェア（必須フィールドとオプショナル情報を区別）
app.use(async (req, res, next) => {
  const context = {
    // tenantIdは必須（ヘッダーから取得、デフォルトはdefault）
    tenantId: req.headers['x-tenant-id'] as string || 'default',
    // 認証済みユーザーの場合のみ追加情報を含める
    ...(req.user && {
      userId: req.user.id,
      userRole: req.user.role,
      plan: req.user.tenant?.plan
    }),
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

## 🎯 コンテキストの使い分けパターン

フィーチャーフラグのコンテキストは、利用目的に応じて必要最小限の情報から始めることが重要です。

### 基本的な使い分け

```typescript
// 1. テナント全体での機能制御（緊急時の機能停止など）
const tenantOnlyContext = {
  tenantId: 'tenant-123'
};
const isMaintenanceMode = await client.isEnabled('maintenance-mode', tenantOnlyContext);

// 2. A/Bテスト（ユーザーIDのハッシュ値で分割）
const abTestContext = {
  tenantId: 'tenant-123',
  userId: 'user-456'
};
const showVariantA = await client.isEnabled('experiment-variant-a', abTestContext);

// 3. 権限ベースの機能制御
const adminContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'admin'
};
const canAccessAdminPanel = await client.isEnabled('admin-features', adminContext);

// 4. プランベースの機能制限
const planBasedContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  plan: 'enterprise'
};
const canUseAdvancedFeatures = await client.isEnabled('advanced-analytics', planBasedContext);
```

### フェイルセーフの活用

```typescript
// コンテキスト情報が不足している場合でも安全に動作
const minimalContext = { tenantId: 'tenant-123' };

try {
  // ユーザー固有機能でも、ユーザー情報がなければテナントレベルで評価
  const isEnabled = await client.isEnabled('user-specific-feature', minimalContext);
  
  if (isEnabled) {
    // 機能を表示（テナント全体で有効の場合）
    showNewFeature();
  } else {
    // デフォルト動作（保守的な挙動）
    showLegacyFeature();
  }
} catch (error) {
  // ネットワークエラーなどの場合は保守的にfalse
  console.error('Feature flag evaluation failed:', error);
  showLegacyFeature(); // 常に安全側に倒す
}

// 重要なフラグの事前取得とフェイルセーフ
const initializeFlags = async (context: FeatureFlagContext) => {
  const defaultFlags = {
    'maintenance-mode': false,
    'new-dashboard': false,
    'premium-features': false
  };

  try {
    const flags = await client.getAllFlags(context);
    return { ...defaultFlags, ...flags }; // デフォルト値をベースに上書き
  } catch (error) {
    console.error('Failed to fetch feature flags, using defaults:', error);
    return defaultFlags; // 完全にフォールバック
  }
};
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

    // テスト用コンテキスト（必要最小限の情報）
    const context = {
      tenantId: 'tenant-456',
      userId: 'user-123',
      userRole: 'admin',
      environment: 'test'
    };

    const isEnabled = await mockClient.isEnabled('new-dashboard', context);
    
    expect(isEnabled).toBe(true);
    expect(mockClient.isEnabled).toHaveBeenCalledWith('new-dashboard', context);
  });

  it('should show legacy dashboard when flag is disabled', async () => {
    mockClient.isEnabled.mockResolvedValue(false);

    // テスト用コンテキスト（最小限の情報でテスト）
    const context = {
      tenantId: 'tenant-456',
      userId: 'user-123'
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
  // 外部メトリクスサービスに送信（必須フィールドのみ使用）
  metrics.increment('feature_flag.evaluations', 1, {
    flag: event.flagKey,
    result: event.result.toString(),
    tenant: event.context.tenantId, // 必須フィールド
    // オプショナルフィールドは存在する場合のみ追加
    ...(event.context.userId && { user: event.context.userId }),
    ...(event.context.userRole && { role: event.context.userRole })
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