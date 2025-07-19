# 👨‍💻 アプリケーション開発者向けドキュメント

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
const context = {
  userId: 'user-123',
  tenantId: 'tenant-456',
  userRole: 'admin',
  environment: 'production'
};

const isEnabled = await client.isEnabled('new-dashboard', context);

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

## 🔍 実装パターン

### 基本パターン
```typescript
// 1. 単純な条件分岐
if (await client.isEnabled('feature-x', context)) {
  // 新機能
} else {
  // 従来機能
}

// 2. バリアント（多値）フラグ
const variant = await client.getVariant('ui-theme', context);
switch (variant) {
  case 'dark':
    return <DarkTheme />;
  case 'light':
    return <LightTheme />;
  default:
    return <DefaultTheme />;
}

// 3. 数値フラグ
const maxItems = await client.getNumber('max-items', context, 10);
```

### React統合パターン
```typescript
// 1. Hook使用
const useFeatureFlag = (flagKey: string) => {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    client.isEnabled(flagKey, context).then(setEnabled);
  }, [flagKey]);
  
  return enabled;
};

// 2. コンポーネント
const FeatureFlag: React.FC<{flagKey: string, children: React.ReactNode}> = 
  ({ flagKey, children }) => {
    const enabled = useFeatureFlag(flagKey);
    return enabled ? <>{children}</> : null;
  };

// 3. 使用例
<FeatureFlag flagKey="new-dashboard">
  <NewDashboard />
</FeatureFlag>
```

### Node.js統合パターン
```typescript
// 1. Express.jsミドルウェア
const featureFlagMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const context = {
    userId: req.user.id,
    tenantId: req.user.tenantId,
    userRole: req.user.role
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