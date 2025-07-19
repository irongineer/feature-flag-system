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

### 1. **最小限のコンテキスト（テナントレベル）**
```typescript
// テナント全体で同じ設定を使用する場合
const context = {
  tenantId: 'tenant-123'
};

const isNewUIEnabled = await client.isEnabled('new-ui', context);
```

**使用例:**
- テナント全体の機能ON/OFF
- 緊急時の機能停止
- メンテナンスモード

### 2. **ユーザー固有のコンテキスト**
```typescript
// ユーザー固有の設定が必要な場合
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456'
};

// userIdに基づいてA/Bテストグループを決定
const isVariantA = await client.isEnabled('ab-test-feature', context);
```

**使用例:**
- A/Bテスト（ユーザーIDのハッシュ値で分割）
- 段階的ロールアウト（特定ユーザーから開始）
- ユーザー固有の機能切り替え

### 3. **権限ベースのコンテキスト**
```typescript
// 権限に基づいた機能制御が必要な場合
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'admin'
};

const canAccessAdminPanel = await client.isEnabled('admin-features', context);
```

**使用例:**
- 管理者限定機能
- 役割ベースアクセス制御
- 段階的権限展開

### 4. **プランベースのコンテキスト**
```typescript
// サブスクリプションプランに基づいた機能制御
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'user',
  plan: 'enterprise'
};

const canUseAdvancedFeatures = await client.isEnabled('advanced-analytics', context);
```

**使用例:**
- プラン別機能制限
- アップセル機能の表示制御
- 使用量制限

### 5. **完全なコンテキスト**
```typescript
// 全ての情報を含む包括的なコンテキスト
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'manager',
  plan: 'enterprise',
  environment: 'production',
  metadata: {
    geoLocation: 'US',
    deviceType: 'mobile',
    experimentGroup: 'beta-users'
  }
};
```

**使用例:**
- 複雑な条件判定
- 地域・デバイス別制御
- 実験的機能の提供

## 🔧 実装例

### **React フックでの利用**
```typescript
const useFeatureFlag = (flagKey: string, additionalContext?: Partial<FeatureFlagContext>) => {
  const [enabled, setEnabled] = useState(false);
  const { user, tenant } = useAuth();

  useEffect(() => {
    const context: FeatureFlagContext = {
      tenantId: tenant.id,
      // ログインしている場合のみユーザー情報を含める
      ...(user && { 
        userId: user.id,
        userRole: user.role,
        plan: tenant.plan
      }),
      ...additionalContext
    };

    client.isEnabled(flagKey, context).then(setEnabled);
  }, [flagKey, user, tenant, additionalContext]);

  return enabled;
};

// 使用例
const MyComponent = () => {
  // ログイン前でも動作（テナントレベルの判定）
  const isMaintenanceMode = useFeatureFlag('maintenance-mode');
  
  // ログイン後のユーザー固有判定
  const canAccessNewFeature = useFeatureFlag('new-feature');

  return (
    <div>
      {isMaintenanceMode && <MaintenanceBanner />}
      {canAccessNewFeature && <NewFeature />}
    </div>
  );
};
```

### **Express.js ミドルウェアでの利用**
```typescript
const featureFlagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const context: FeatureFlagContext = {
    tenantId: req.headers['x-tenant-id'] as string,
    // 認証済みの場合のみユーザー情報を含める
    ...(req.user && {
      userId: req.user.id,
      userRole: req.user.role,
      plan: req.user.tenant?.plan
    }),
    environment: process.env.NODE_ENV as string
  };

  // よく使用されるフラグを事前評価
  Promise.all([
    client.isEnabled('api-v2', context),
    client.isEnabled('rate-limiting', context),
    client.isEnabled('advanced-logging', context)
  ]).then(([apiV2, rateLimiting, advancedLogging]) => {
    req.featureFlags = {
      apiV2,
      rateLimiting,
      advancedLogging
    };
    next();
  }).catch(next);
};
```

### **匿名ユーザーでの利用**
```typescript
// ログイン前の匿名ユーザー
const anonymousContext = {
  tenantId: 'public', // パブリック設定用のテナント
  metadata: {
    sessionId: generateSessionId(),
    geoLocation: getGeoLocation(),
    deviceType: getDeviceType()
  }
};

// ログインページの新しいデザインを表示するかどうか
const showNewLoginUI = await client.isEnabled('new-login-ui', anonymousContext);
```

## 📊 フェイルセーフ機能

コンテキスト情報が不足している場合でも、安全にフィーチャーフラグが動作するようフェイルセーフ機能が組み込まれています。

```typescript
private getDefaultValue(flagKey: string, context: FeatureFlagContext): boolean {
  // プラン情報がある場合のプランベースのデフォルト値
  const planDefaults = {
    enterprise: true,
    standard: false,
    basic: false
  };

  // フラグ固有のデフォルト値（プラン情報がない場合にも対応）
  const flagDefaults: Record<string, boolean> = {
    'maintenance-mode': false, // 安全側のデフォルト
    'new-feature': false,      // 新機能は保守的にfalse
    'emergency-override': false // 緊急機能は通常false
  };

  // 優先順位: フラグ固有 > プランベース > 安全側(false)
  return flagDefaults[flagKey] ?? 
         (context.plan ? planDefaults[context.plan] : false) ?? 
         false;
}
```

## 🎯 ベストプラクティス

### **1. 最小限の情報から開始**
```typescript
// ❌ 過剰な情報
const context = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'user',
  plan: 'basic',
  environment: 'production'
};
const simpleFlag = await client.isEnabled('simple-toggle', context);

// ✅ 必要最小限
const simpleContext = { tenantId: 'tenant-123' };
const simpleFlag = await client.isEnabled('simple-toggle', simpleContext);
```

### **2. 段階的な情報追加**
```typescript
// 基本コンテキスト
let context: FeatureFlagContext = { tenantId: 'tenant-123' };

// ユーザー情報が利用可能な場合に追加
if (user) {
  context = { ...context, userId: user.id, userRole: user.role };
}

// プラン情報が必要な場合に追加
if (needsPlanBasedFeatures) {
  context = { ...context, plan: tenant.plan };
}
```

### **3. 明確な命名規則**
```typescript
// フラグの目的に応じたコンテキスト設計
const tenantLevelContext = { tenantId };                    // テナント全体
const userLevelContext = { tenantId, userId };              // ユーザー固有
const roleBasedContext = { tenantId, userId, userRole };    // 権限ベース
const planBasedContext = { tenantId, userId, plan };        // プランベース
```

---

**更新日**: 2025-07-18  
**ステータス**: オプショナルコンテキスト対応完了