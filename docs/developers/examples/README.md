# 📝 実装サンプル集

## 🚀 コピー&ペーストで使える実装例

このページでは、フィーチャーフラグシステムを実際のアプリケーションに統合するための実装例を提供します。

## 🎯 クイックスタート例

### 1. 基本的なフラグ評価

```typescript
import { FeatureFlagClient, getCurrentEnvironment, loadEnvironmentConfig } from '@feature-flag/core';

// 環境の自動検出と設定ロード
const environment = getCurrentEnvironment(); // 'local' | 'dev' | 'prod'
const config = loadEnvironmentConfig(environment);

// クライアントの初期化
const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  timeout: config.api.timeout,
  apiKey: process.env.FEATURE_FLAG_API_KEY
});

// フラグの評価
const context = {
  tenantId: 'your-tenant-id'  // 必須
};

const isNewDashboardEnabled = await client.isEnabled('new-dashboard', context);

if (isNewDashboardEnabled) {
  console.log('新しいダッシュボードを表示');
} else {
  console.log('従来のダッシュボードを表示');
}
```

## 🌐 環境別設定例

### ローカル開発環境

```typescript
// local環境での設定例
const localConfig = {
  apiUrl: 'http://localhost:3001/api',
  environment: 'local',
  useInMemoryFlags: true  // ローカルでは高速なインメモリを使用
};

const client = new FeatureFlagClient(localConfig);
```

### 本番環境

```typescript
// production環境での設定例
const prodConfig = {
  apiUrl: 'https://api.feature-flags.example.com/api',
  environment: 'prod',
  useInMemoryFlags: false,  // 本番ではDynamoDBを使用
  apiKey: process.env.PROD_FEATURE_FLAG_API_KEY
};

const client = new FeatureFlagClient(prodConfig);
```

## 🎨 React統合例

### 基本的なHook

```typescript
import { useState, useEffect } from 'react';
import { FeatureFlagClient } from '@feature-flag/core';

const useFeatureFlag = (flagKey: string) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFlag = async () => {
      try {
        const context = {
          tenantId: 'your-tenant-id'
        };
        const result = await client.isEnabled(flagKey, context);
        setEnabled(result);
      } catch (error) {
        console.error('フラグ評価エラー:', error);
        setEnabled(false); // エラー時は安全側に倒す
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagKey]);

  return { enabled, loading };
};
```

### コンポーネントでの使用

```tsx
import React from 'react';

const Dashboard: React.FC = () => {
  const { enabled: newDashboard, loading } = useFeatureFlag('new-dashboard');
  const { enabled: betaFeatures } = useFeatureFlag('beta-features');

  if (loading) {
    return <div>読み込み中...</div>;
  }

  return (
    <div>
      {newDashboard ? (
        <NewDashboard />
      ) : (
        <LegacyDashboard />
      )}
      
      {betaFeatures && (
        <div className="beta-features">
          <h3>🧪 ベータ機能</h3>
          <BetaFeatureComponent />
        </div>
      )}
    </div>
  );
};
```

## 🖥️ Node.js/Express統合例

### ミドルウェア

```typescript
import express from 'express';
import { FeatureFlagClient } from '@feature-flag/core';

const app = express();
const client = new FeatureFlagClient({
  apiUrl: process.env.FEATURE_FLAG_API_URL,
  apiKey: process.env.FEATURE_FLAG_API_KEY
});

// フィーチャーフラグミドルウェア
const featureFlagMiddleware = async (req: any, res: any, next: any) => {
  try {
    const context = {
      tenantId: req.headers['x-tenant-id'] || 'default-tenant',
      userId: req.user?.id,
      userRole: req.user?.role
    };

    // よく使用するフラグをまとめて取得
    const flags = await Promise.all([
      client.isEnabled('new-api-version', context),
      client.isEnabled('enhanced-logging', context),
      client.isEnabled('rate-limiting', context)
    ]);

    req.featureFlags = {
      newApiVersion: flags[0],
      enhancedLogging: flags[1],
      rateLimiting: flags[2]
    };

    next();
  } catch (error) {
    console.error('フィーチャーフラグ取得エラー:', error);
    // エラー時はデフォルト値で継続
    req.featureFlags = {
      newApiVersion: false,
      enhancedLogging: false,
      rateLimiting: true  // セキュリティ関連は安全側に
    };
    next();
  }
};

app.use(featureFlagMiddleware);
```

### API エンドポイントでの使用

```typescript
app.get('/api/data', (req: any, res: any) => {
  if (req.featureFlags.newApiVersion) {
    // 新しいAPIバージョンの処理
    res.json({
      version: 'v2',
      data: getEnhancedData(),
      features: ['pagination', 'filtering', 'sorting']
    });
  } else {
    // 従来のAPIバージョンの処理
    res.json({
      version: 'v1',
      data: getLegacyData()
    });
  }
});
```

## 🏢 勤怠管理アプリ統合例

### HTML/JavaScript統合

```html
<!DOCTYPE html>
<html>
<head>
    <title>勤怠管理システム</title>
</head>
<body>
    <div id="app">
        <h1>勤怠管理システム</h1>
        
        <!-- フィーチャーフラグで制御される要素 -->
        <div id="new-timecard" style="display: none;">
            <h2>新しいタイムカード機能</h2>
            <button onclick="clockIn()">出勤</button>
            <button onclick="clockOut()">退勤</button>
        </div>
        
        <div id="legacy-timecard">
            <h2>従来のタイムカード</h2>
            <button onclick="legacyClockIn()">出勤記録</button>
            <button onclick="legacyClockOut()">退勤記録</button>
        </div>
    </div>

    <script>
        // 環境検出
        function getEnvironment() {
            const hostname = window.location.hostname;
            if (hostname === 'localhost') return 'local';
            if (hostname.includes('dev-')) return 'dev';
            return 'prod';
        }

        // API設定
        const environment = getEnvironment();
        const apiEndpoints = {
            local: 'http://localhost:3001/api',
            dev: 'https://dev-api.feature-flags.example.com/api',
            prod: 'https://api.feature-flags.example.com/api'
        };

        // フラグ評価関数
        async function evaluateFlag(flagKey) {
            try {
                const response = await fetch(`${apiEndpoints[environment]}/evaluate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tenantId: 'attendance-company-123',
                        flagKey: flagKey,
                        environment: environment
                    })
                });

                const result = await response.json();
                return result.enabled;
            } catch (error) {
                console.error('フラグ評価エラー:', error);
                return false; // エラー時は安全側
            }
        }

        // 初期化
        async function initializeApp() {
            const newTimecardEnabled = await evaluateFlag('new_timecard_ui');
            
            if (newTimecardEnabled) {
                document.getElementById('new-timecard').style.display = 'block';
                document.getElementById('legacy-timecard').style.display = 'none';
            } else {
                document.getElementById('new-timecard').style.display = 'none';
                document.getElementById('legacy-timecard').style.display = 'block';
            }
        }

        // 新機能
        function clockIn() {
            console.log('新UI: 出勤記録');
            alert('出勤時刻を記録しました (新UI)');
        }

        function clockOut() {
            console.log('新UI: 退勤記録');
            alert('退勤時刻を記録しました (新UI)');
        }

        // 従来機能
        function legacyClockIn() {
            console.log('従来UI: 出勤記録');
            alert('出勤記録完了 (従来UI)');
        }

        function legacyClockOut() {
            console.log('従来UI: 退勤記録');
            alert('退勤記録完了 (従来UI)');
        }

        // アプリ初期化
        window.addEventListener('load', initializeApp);
    </script>
</body>
</html>
```

## 🧪 テスト例

### ユニットテスト

```typescript
import { describe, it, expect, vi } from 'vitest';
import { FeatureFlagClient } from '@feature-flag/core';

describe('フィーチャーフラグ統合', () => {
  it('フラグが有効な場合の動作確認', async () => {
    // モック設定
    const mockClient = {
      isEnabled: vi.fn().mockResolvedValue(true)
    } as any;

    const context = { tenantId: 'test-tenant' };
    const result = await mockClient.isEnabled('test-flag', context);

    expect(result).toBe(true);
    expect(mockClient.isEnabled).toHaveBeenCalledWith('test-flag', context);
  });

  it('エラー時のフォールバック動作確認', async () => {
    // エラーを発生させるモック
    const mockClient = {
      isEnabled: vi.fn().mockRejectedValue(new Error('API エラー'))
    } as any;

    let result = false;
    try {
      result = await mockClient.isEnabled('test-flag', { tenantId: 'test' });
    } catch (error) {
      result = false; // エラー時のフォールバック
    }

    expect(result).toBe(false);
  });
});
```

### E2Eテスト (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('フィーチャーフラグによる画面切り替え', async ({ page }) => {
  // ページにアクセス
  await page.goto('/dashboard');

  // 新機能フラグが有効な場合の確認
  await page.evaluate(() => {
    // フラグを有効に設定
    window.localStorage.setItem('feature-flags', JSON.stringify({
      'new-dashboard': true
    }));
  });

  await page.reload();

  // 新しいダッシュボードが表示されることを確認
  await expect(page.locator('[data-testid="new-dashboard"]')).toBeVisible();
  await expect(page.locator('[data-testid="legacy-dashboard"]')).not.toBeVisible();
});
```

## 🎯 具体的なユースケース

### 1. 段階的ロールアウト

```typescript
// 特定のユーザー群から開始
const context = {
  tenantId: 'company-abc',
  userId: user.id,
  userRole: user.role
};

const isBetaTester = user.groups.includes('beta-testers');
const rolloutEnabled = await client.isEnabled('new-feature-rollout', {
  ...context,
  metadata: { isBetaTester }
});
```

### 2. A/Bテスト

```typescript
// バリアント取得
const variant = await client.getVariant('checkout-button-test', context);

switch (variant) {
  case 'green-button':
    return <GreenCheckoutButton />;
  case 'blue-button':
    return <BlueCheckoutButton />;
  case 'red-button':
    return <RedCheckoutButton />;
  default:
    return <DefaultCheckoutButton />;
}
```

### 3. 緊急時のKill-Switch

```typescript
// 緊急停止機能
const emergencyMode = await client.isEnabled('emergency-maintenance', context);

if (emergencyMode) {
  return (
    <div className="maintenance-banner">
      🚨 緊急メンテナンス中です
    </div>
  );
}
```

## 🔧 デバッグとトラブルシューティング

### ログ設定

```typescript
// デバッグモード有効化
const client = new FeatureFlagClient({
  apiUrl: config.api.baseUrl,
  debug: true,  // デバッグログ有効
  timeout: 5000
});

// カスタムログ設定
client.on('evaluation', (data) => {
  console.log('フラグ評価:', data);
});

client.on('error', (error) => {
  console.error('フラグエラー:', error);
});
```

### 開発者ツール

```typescript
// ブラウザでのデバッグ用
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // 開発環境でグローバルに公開
  (window as any).featureFlags = {
    client,
    async checkFlag(flagKey: string) {
      const result = await client.isEnabled(flagKey, { tenantId: 'debug' });
      console.log(`Flag ${flagKey}:`, result);
      return result;
    }
  };
}
```

## 📚 関連ドキュメント

- [API仕様](../api-reference.md)
- [TypeScript統合](../typescript-integration.md)
- [テストガイド](../testing-guide.md)
- [環境設定](../../environments/README.md)
- [勤怠管理アプリ統合詳細](../../application-examples/attendance-app-integration.md)

## ❓ サポート

実装に関する質問やサポートが必要な場合は、以下をご利用ください：

- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- 💬 [Discord コミュニティ](https://discord.gg/your-community)
- 📖 [FAQ](../faq.md)