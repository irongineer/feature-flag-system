# 👨‍💻 アプリケーション開発者向けドキュメント

> **注意**: このドキュメントは段階的に作成中です。多くのリンク先ファイルが **(準備中)** 状態です。現在利用可能なドキュメントは限定的です。

## 📋 概要

このセクションでは、フィーチャーフラグシステムを利用してアプリケーションを開発する開発者向けの情報を提供します。

## 🚀 クイックスタート

### 5分で始める

1. **[クイックスタート](./quickstart.md)** - 最短でフィーチャーフラグを実装
2. **[実装サンプル](./examples/README.md)** - コピー&ペーストで使える実装例
3. **[API仕様](./api-reference.md)** - 詳細なAPI仕様

### 基本的な使い方

```typescript
// 1. クライアントの初期化
import { FeatureFlagClient } from '@your-org/feature-flag-client';

const client = new FeatureFlagClient({
  apiUrl: 'https://your-feature-flag-api.com',
  apiKey: 'your-api-key'
});

// 2. フィーチャーフラグの評価
// 最小限のコンテキスト（tenantIdのみ必須）
const basicContext = {
  tenantId: 'tenant-456'
};

// より詳細なコンテキスト（必要に応じてオプション情報を追加）
const detailedContext = {
  tenantId: 'tenant-456',
  userId: 'user-123',        // ユーザー固有の評価が必要な場合
  userRole: 'admin',         // 権限ベースの制御が必要な場合
  plan: 'enterprise',        // プランベースの機能制御が必要な場合
  environment: 'production'  // 環境別の設定が必要な場合
};

const isEnabled = await client.isEnabled('new-dashboard', detailedContext);

// 3. 条件分岐
if (isEnabled) {
  // 新しい機能を表示
  showNewDashboard();
} else {
  // 従来の機能を表示
  showLegacyDashboard();
}
```

## 📚 学習パス

### 📖 基礎学習（推定時間: 2-3時間）
1. [フィーチャーフラグとは](./concepts/feature-flags-101.md)
2. [システムアーキテクチャ](./concepts/architecture.md)
3. [基本的な実装パターン](./concepts/basic-patterns.md)
4. [コンテキスト利用パターン](./context-usage-patterns.md) ⭐ 必読

### 🔨 実装学習（推定時間: 4-6時間）
1. [TypeScript統合](./typescript-integration.md)
2. [React統合](./react-integration.md)
3. [Node.js統合](./nodejs-integration.md)
4. [実装例集](./examples/README.md)

### 🧪 テスト学習（推定時間: 2-3時間）
1. [テスト戦略](./testing-guide.md)
2. [ユニットテスト](./testing/unit-testing.md)
3. [統合テスト](./testing/integration-testing.md)
4. [E2Eテスト](./testing/e2e-testing.md)

### 🚀 高度な機能（推定時間: 3-4時間）
1. [パフォーマンス最適化](./performance-optimization.md)
2. [セキュリティ考慮事項](./security-considerations.md)
3. [モニタリング](./monitoring.md)
4. [ベストプラクティス](./best-practices.md)

## 🔧 開発環境別ガイド

### フロントエンド開発者
- [React統合ガイド](./frontend/react-integration.md)
- [Vue.js統合ガイド](./frontend/vue-integration.md)
- [Angular統合ガイド](./frontend/angular-integration.md)
- [JavaScript統合ガイド](./frontend/javascript-integration.md)

### バックエンド開発者
- [Node.js統合ガイド](./backend/nodejs-integration.md)
- [Python統合ガイド](./backend/python-integration.md)
- [Java統合ガイド](./backend/java-integration.md)
- [Go統合ガイド](./backend/go-integration.md)

### モバイル開発者
- [React Native統合ガイド](./mobile/react-native-integration.md)
- [Flutter統合ガイド](./mobile/flutter-integration.md)
- [iOS統合ガイド](./mobile/ios-integration.md)
- [Android統合ガイド](./mobile/android-integration.md)

## 🎯 ユースケース別ガイド

### 💡 新機能開発
- [新機能の段階的リリース](./use-cases/gradual-rollout.md)
- [A/Bテスト実装](./use-cases/ab-testing.md)
- [カナリアリリース](./use-cases/canary-release.md)

### 🔧 既存機能改善
- [既存機能の置き換え](./use-cases/feature-replacement.md)
- [パフォーマンス改善](./use-cases/performance-improvement.md)
- [UI/UX改善](./use-cases/ui-ux-improvement.md)

### 🚨 緊急対応
- [緊急時の機能無効化](./use-cases/emergency-disable.md)
- [Kill-Switch実装](./use-cases/kill-switch.md)
- [障害対応](./use-cases/incident-response.md)

### 🏢 エンタープライズ機能
- [マルチテナント対応](./use-cases/multi-tenant.md)
- [プラン別機能制御](./use-cases/plan-based-features.md)
- [権限ベースアクセス制御](./use-cases/rbac.md)

## 📖 リファレンス

### API仕様
- [クライアントAPI](./api-reference.md)
- [REST API](./rest-api.md)
- [GraphQL API](./graphql-api.md)
- [WebSocket API](./websocket-api.md)

### 設定・構成
- [設定ファイル](./configuration.md)
- [環境変数](./environment-variables.md)
- [初期化オプション](./initialization.md)
- [キャッシュ設定](./caching.md)

### 型定義
- [TypeScript型定義](./types/typescript.md)
- [インターフェース](./types/interfaces.md)
- [型ガード](./types/type-guards.md)
- [ジェネリクス](./types/generics.md)

## 📋 コンテキストの使い分け

フィーチャーフラグの`FeatureFlagContext`は、`tenantId`のみが必須で、その他は利用目的に応じてオプショナルです。

### 基本的なパターン

```typescript
// 1. 最小限（テナントレベル）- テナント全体で同じ設定
const tenantContext = {
  tenantId: 'tenant-123'
};

// 2. ユーザー固有 - A/Bテストや段階的ロールアウト
const userContext = {
  tenantId: 'tenant-123',
  userId: 'user-456'
};

// 3. 権限ベース - 管理者機能など
const roleContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'admin'
};

// 4. プランベース - 有料機能の制御
const planContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  plan: 'enterprise'
};

// 5. 完全なコンテキスト - 複雑な条件判定
const fullContext = {
  tenantId: 'tenant-123',
  userId: 'user-456',
  userRole: 'manager',
  plan: 'enterprise',
  environment: 'production',
  metadata: {
    geoLocation: 'US',
    deviceType: 'mobile'
  }
};
```

## 🔍 実装パターン

### 基本パターン
```typescript
// 1. 単純な条件分岐（最小限のコンテキスト）
const basicContext = { tenantId: 'tenant-123' };
if (await client.isEnabled('feature-x', basicContext)) {
  // 新機能
} else {
  // 従来機能
}

// 2. バリアント（多値）フラグ（ユーザー固有の場合）
const userContext = { 
  tenantId: 'tenant-123',
  userId: 'user-456'  // ユーザー固有のテーマ設定のため
};
const variant = await client.getVariant('ui-theme', userContext);
switch (variant) {
  case 'dark':
    return <DarkTheme />;
  case 'light':
    return <LightTheme />;
  default:
    return <DefaultTheme />;
}

// 3. 数値フラグ（プランベースの制限）
const planContext = {
  tenantId: 'tenant-123',
  plan: 'enterprise'  // プランに基づく制限値のため
};
const maxItems = await client.getNumber('max-items', planContext, 10);
```

## 🛡️ フェイルセーフ機能

コンテキスト情報が不足している場合でも、安全にフィーチャーフラグが動作するよう設計されています。

### フェイルセーフの仕組み

```typescript
// コンテキスト情報が不足している場合の動作例
const minimalContext = { tenantId: 'tenant-123' };

try {
  // ユーザー固有機能でも、ユーザー情報がなければテナントレベルで評価
  const isEnabled = await client.isEnabled('user-specific-feature', minimalContext);
  
  if (isEnabled) {
    // 機能を表示（テナント全体で有効の場合）
    showFeature();
  } else {
    // デフォルト動作（安全側の挙動）
    showDefaultBehavior();
  }
} catch (error) {
  // ネットワークエラーなどの場合は保守的にfalse
  console.error('Feature flag evaluation failed:', error);
  showDefaultBehavior(); // 常に安全側に倒す
}
```

### デフォルト値の決定ルール

```typescript
// フラグ評価時のフォールバック順序
const getDefaultValue = (flagKey: string, context: FeatureFlagContext): boolean => {
  // 1. フラグ固有のデフォルト値
  const flagDefaults: Record<string, boolean> = {
    'maintenance-mode': false,     // 安全側（機能有効にしない）
    'new-feature': false,          // 新機能は保守的にfalse
    'emergency-killswitch': false, // 緊急停止は通常false
    'premium-feature': false       // 有料機能はfalse
  };

  // 2. プラン情報がある場合のプランベースデフォルト
  const planDefaults = {
    enterprise: true,   // エンタープライズは新機能有効
    standard: false,    // スタンダードは保守的
    basic: false        // ベーシックは最小限
  };

  // 優先順位: フラグ固有 > プランベース > 安全側(false)
  return flagDefaults[flagKey] ?? 
         (context.plan ? planDefaults[context.plan] : false) ?? 
         false;
};
```

### エラーハンドリングのベストプラクティス

```typescript
// 1. 個別フラグでのエラーハンドリング
const safeGetFlag = async (flagKey: string, context: FeatureFlagContext): Promise<boolean> => {
  try {
    return await client.isEnabled(flagKey, context);
  } catch (error) {
    // ログに記録して、安全側のデフォルト値を返す
    console.error(`Failed to evaluate flag ${flagKey}:`, error);
    return getDefaultValue(flagKey, context);
  }
};

// 2. バッチ取得でのエラーハンドリング
const safeGetAllFlags = async (context: FeatureFlagContext): Promise<Record<string, boolean>> => {
  try {
    return await client.getAllFlags(context);
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    // 重要なフラグのみデフォルト値で初期化
    return {
      'maintenance-mode': false,
      'new-dashboard': false,
      'premium-features': false
    };
  }
};
```

### React統合パターン
```typescript
// 1. Hook使用（オプショナルコンテキスト対応）
const useFeatureFlag = (flagKey: string, additionalContext?: Partial<FeatureFlagContext>) => {
  const [enabled, setEnabled] = useState(false);
  const { user, tenant } = useAuth();
  
  useEffect(() => {
    const context = {
      tenantId: tenant.id, // 必須
      // ユーザー情報が利用可能な場合のみ追加
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

// 2. コンポーネント
const FeatureFlag: React.FC<{flagKey: string, children: React.ReactNode}> = 
  ({ flagKey, children }) => {
    const enabled = useFeatureFlag(flagKey);
    return enabled ? <>{children}</> : null;
  };

// 3. 使用例
{/* テナント全体での機能切り替え */}
<FeatureFlag flagKey="maintenance-mode">
  <MaintenanceBanner />
</FeatureFlag>

{/* ユーザー固有の機能（自動的にユーザー情報が含まれる） */}
<FeatureFlag flagKey="new-dashboard">
  <NewDashboard />
</FeatureFlag>
```

### Node.js統合パターン
```typescript
// 1. Express.jsミドルウェア
const featureFlagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const context = {
    tenantId: req.headers['x-tenant-id'] as string, // 必須
    // 認証済みユーザーの場合のみ追加情報を含める
    ...(req.user && {
      userId: req.user.id,
      userRole: req.user.role,
      plan: req.user.tenant?.plan
    })
  };
  
  client.getAllFlags(context).then(flags => {
    req.featureFlags = flags;
    next();
  });
};

// 2. 条件分岐
app.get('/dashboard', featureFlagMiddleware, (req, res) => {
  if (req.featureFlags['new-dashboard']) {
    res.render('new-dashboard');
  } else {
    res.render('legacy-dashboard');
  }
});
```

## 🚨 トラブルシューティング

### よくある問題
1. [接続エラー](./troubleshooting/connection-errors.md)
2. [認証エラー](./troubleshooting/authentication-errors.md)
3. [パフォーマンス問題](./troubleshooting/performance-issues.md)
4. [型エラー](./troubleshooting/type-errors.md)

### デバッグ方法
1. [ログ設定](./debugging/logging.md)
2. [デバッグツール](./debugging/tools.md)
3. [テスト環境](./debugging/test-environment.md)

## 📊 パフォーマンス

### 最適化技術
- [キャッシュ戦略](./performance/caching.md)
- [バッチ処理](./performance/batching.md)
- [非同期処理](./performance/async.md)
- [メモリ使用量](./performance/memory.md)

### 監視・メトリクス
- [メトリクス収集](./monitoring/metrics.md)
- [パフォーマンス監視](./monitoring/performance.md)
- [エラー追跡](./monitoring/error-tracking.md)

## 🔐 セキュリティ

### セキュリティ考慮事項
- [認証・認可](./security/authentication.md)
- [データ保護](./security/data-protection.md)
- [通信セキュリティ](./security/communication.md)
- [監査ログ](./security/audit-logging.md)

## 🤝 コミュニティ

### 質問・サポート
- [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/feature-flags)
- [Discord](https://discord.gg/your-community)

### 貢献方法
- [バグレポート](./contributing/bug-reports.md)
- [機能要求](./contributing/feature-requests.md)
- [コードコントリビューション](./contributing/code-contribution.md)

---

## 📈 学習の進め方

### 👶 初心者向け
1. [クイックスタート](./quickstart.md)を完了
2. [基本的な実装パターン](./concepts/basic-patterns.md)を理解
3. [実装例](./examples/README.md)を試す

### 🔧 中級者向け
1. [TypeScript統合](./typescript-integration.md)を学習
2. [テストガイド](./testing-guide.md)を実践
3. [パフォーマンス最適化](./performance-optimization.md)を検討

### 🚀 上級者向け
1. [アーキテクチャ設計](./architecture/design-patterns.md)を理解
2. [拡張開発](./extensions/README.md)を検討
3. [コミュニティ貢献](./contributing/README.md)を開始

**次のステップ**: [クイックスタート](./quickstart.md)から始めましょう！