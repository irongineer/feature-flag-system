# 📋 フィーチャーフラグ コンテキスト利用パターン

## 📊 概要

フィーチャーフラグの`FeatureFlagContext`は柔軟に利用できるよう設計されています。`tenantId`のみが必須で、その他の情報はオプショナルです。

## 🎯 コンテキスト定義

```typescript
export interface FeatureFlagContext {
  tenantId: string;        // 必須: テナント識別
  userId?: string;         // オプショナル: ユーザー固有の評価が不要な場合
  userRole?: string;       // オプショナル: 権限ベースの制御が不要な場合
  plan?: string;           // オプショナル: プラン情報が利用できない場合
  environment?: string;    // オプショナル: 環境情報
  metadata?: Record<string, any>; // オプショナル: 追加情報
}
```

## 📚 利用パターン

### 1️⃣ 最小限コンテキスト（推奨）

テナント単位での機能制御のみ実施する場合：

```typescript
// 最小限の情報のみ
const context: FeatureFlagContext = {
  tenantId: 'tenant-123'
};

const isEnabled = await client.isEnabled('new-feature', context);
```

**適用場面:**
- テナント単位の機能ON/OFF
- ユーザー情報が不要な機能
- パブリックページでの機能制御

### 2️⃣ ユーザー固有コンテキスト

特定ユーザーに対する機能制御が必要な場合：

```typescript
// ユーザー情報を含む
const context: FeatureFlagContext = {
  tenantId: 'tenant-123',
  userId: 'user-456'
};

const isEnabled = await client.isEnabled('beta-feature', context);
```

**適用場面:**
- ベータユーザー限定機能
- A/Bテストでのユーザー分割
- 個人設定に基づく機能制御

### 3️⃣ ロールベースコンテキスト

権限に基づく機能制御が必要な場合：

```typescript
// ロール情報を含む
const context: FeatureFlagContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'admin'
};

const isEnabled = await client.isEnabled('admin-panel', context);
```

**適用場面:**
- 管理者限定機能
- 権限レベル別機能提供
- セキュリティが重要な機能

### 4️⃣ プランベースコンテキスト

料金プランに基づく機能制御が必要な場合：

```typescript
// プラン情報を含む
const context: FeatureFlagContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  plan: 'enterprise'
};

const isEnabled = await client.isEnabled('advanced-analytics', context);
```

**適用場面:**
- 有料機能の制御
- プランアップグレード促進
- 機能制限の実装

### 5️⃣ 完全コンテキスト

全ての情報を活用する場合：

```typescript
// 全情報を含む
const context: FeatureFlagContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'admin',
  plan: 'enterprise',
  environment: 'production',
  metadata: {
    region: 'us-east-1',
    browserAgent: 'Chrome/120.0',
    experimentGroup: 'variant-A'
  }
};

const isEnabled = await client.isEnabled('complex-feature', context);
```

**適用場面:**
- 複雑な条件分岐
- 高度なターゲティング
- マルチファクター制御

## 🔧 実装例

### Express.js ミドルウェア

```typescript
import { FeatureFlagClient, FeatureFlagContext } from '@your-org/feature-flag-client';

const client = new FeatureFlagClient({ /* config */ });

// 柔軟なコンテキスト構築
app.use((req: Request, res: Response, next: NextFunction) => {
  const context: FeatureFlagContext = {
    tenantId: req.headers['x-tenant-id'] as string || 'default'
  };

  // オプショナル情報を条件付きで追加
  if (req.user?.id) {
    context.userId = req.user.id;
  }
  
  if (req.user?.role) {
    context.userRole = req.user.role;
  }
  
  if (req.user?.plan) {
    context.plan = req.user.plan;
  }
  
  if (process.env.NODE_ENV) {
    context.environment = process.env.NODE_ENV as any;
  }

  // リクエストにコンテキストを添付
  req.featureFlagContext = context;
  next();
});
```

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { FeatureFlagClient, FeatureFlagContext } from '@your-org/feature-flag-client';

const client = new FeatureFlagClient({ /* config */ });

export const useFeatureFlag = (flagKey: string) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, tenant } = useAuth();

  useEffect(() => {
    const evaluateFlag = async () => {
      try {
        // 動的なコンテキスト構築
        const context: FeatureFlagContext = {
          tenantId: tenant?.id || 'anonymous'
        };

        // 利用可能な情報を追加
        if (user?.id) context.userId = user.id;
        if (user?.role) context.userRole = user.role;
        if (tenant?.plan) context.plan = tenant.plan;

        const result = await client.isEnabled(flagKey, context);
        setEnabled(result);
      } catch (error) {
        console.warn(`Feature flag evaluation failed for ${flagKey}:`, error);
        setEnabled(false); // フェイルセーフ
      } finally {
        setLoading(false);
      }
    };

    evaluateFlag();
  }, [flagKey, user, tenant]);

  return { enabled, loading };
};
```

## 🛡️ フェイルセーフ設計

### クライアント側でのエラーハンドリング

```typescript
class FeatureFlagClient {
  async isEnabled(flagKey: string, context: FeatureFlagContext): Promise<boolean> {
    try {
      // コンテキスト検証
      if (!context.tenantId) {
        console.warn('tenantId is required in FeatureFlagContext');
        return this.getDefaultValue(flagKey);
      }

      // APIリクエスト構築（オプショナルフィールドを除外）
      const requestPayload: any = {
        tenantId: context.tenantId,
        flagKey,
        environment: context.environment || 'production'
      };

      // オプショナルフィールドを条件付きで追加
      if (context.userId) requestPayload.userId = context.userId;
      if (context.userRole) requestPayload.userRole = context.userRole;
      if (context.plan) requestPayload.plan = context.plan;
      if (context.metadata) requestPayload.metadata = context.metadata;

      const response = await this.httpClient.post('/evaluate', requestPayload);
      return response.data.enabled;

    } catch (error) {
      console.error(`Feature flag evaluation failed for ${flagKey}:`, error);
      return this.getDefaultValue(flagKey);
    }
  }

  private getDefaultValue(flagKey: string): boolean {
    // 安全なデフォルト値を返す
    return this.defaultValues[flagKey] || false;
  }
}
```

## 🎯 ベストプラクティス

### 1. 必要最小限の情報のみ送信

```typescript
// ❌ 悪い例: 不要な情報も含める
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'guest',    // この機能でロールは不要
  plan: 'basic',        // この機能でプランは不要
  // ... 他の不要な情報
};

// ✅ 良い例: 必要な情報のみ
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456'    // この機能はユーザー単位制御のみ
};
```

### 2. 環境別設定

```typescript
// 環境に応じたコンテキスト構築
const buildContext = (): FeatureFlagContext => {
  const base: FeatureFlagContext = {
    tenantId: getCurrentTenant()
  };

  // 開発環境では詳細情報を含める
  if (process.env.NODE_ENV === 'development') {
    return {
      ...base,
      userId: getCurrentUser()?.id,
      userRole: getCurrentUser()?.role,
      plan: getCurrentTenant()?.plan,
      environment: 'development',
      metadata: {
        debug: true,
        version: process.env.APP_VERSION
      }
    };
  }

  // 本番環境では最小限に
  return {
    ...base,
    environment: 'production'
  };
};
```

### 3. キャッシュとパフォーマンス

```typescript
// コンテキストに基づくキャッシュキー生成
const generateCacheKey = (flagKey: string, context: FeatureFlagContext): string => {
  const parts = [flagKey, context.tenantId];
  
  if (context.userId) parts.push(context.userId);
  if (context.userRole) parts.push(context.userRole);
  if (context.plan) parts.push(context.plan);
  
  return parts.join(':');
};
```

## 📊 まとめ

- **tenantId**: 必須フィールド、テナント識別に使用
- **userId**: ユーザー固有制御が必要な場合のみ
- **userRole**: 権限ベース制御が必要な場合のみ  
- **plan**: プランベース制御が必要な場合のみ
- **environment**: 環境固有制御が必要な場合のみ
- **metadata**: 高度な制御が必要な場合のみ

適切なコンテキスト設計により、パフォーマンスを維持しながら柔軟なフィーチャーフラグ制御が実現できます。