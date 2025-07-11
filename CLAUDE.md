# CLAUDE.md - フィーチャーフラグシステム開発ガイド

## プロジェクト概要

マルチテナント SaaS 向けのフィーチャーフラグシステムを構築します。デプロイとリリースを分離し、安全かつ高速な価値提供を実現します。

## 技術スタック

- **言語**: TypeScript (Node.js 22.x)
- **静的解析**: ESLint + SonarJS
- **コードフォーマット**: Prettier
- **Git Hooks**: Husky + lint-staged
- **ユニットテスト**: Vitest
- **E2E テスト**: PlayWright + CodeceptJS
- **実行環境**: AWS Lambda + API Gateway
- **データストア**: Amazon DynamoDB
- **認証**: AWS Cognito + IAM
- **監視**: CloudWatch Logs/Metrics
- **IaC**: AWS CDK v2
- **パッケージマネージャー**: npm (Node.js 22 対応)
- **管理画面 (MVP)**: Vite + React + Ant Design Pro
- **管理画面 (本番)**: Next.js 15 + Tailwind CSS + shadcn/ui

## ディレクトリ構造

```
feature-flag-system/
├── packages/
│   ├── core/                 # フラグ評価エンジン
│   │   ├── src/
│   │   │   ├── models/       # データモデル定義
│   │   │   ├── cache/        # キャッシュ実装
│   │   │   └── evaluator/    # フラグ評価ロジック
│   │   └── tests/
│   ├── sdk/                  # Lambda用SDK
│   │   ├── src/
│   │   └── tests/
│   ├── api/                  # 管理API (Lambda)
│   │   ├── src/
│   │   │   ├── handlers/     # Lambda handlers
│   │   │   └── validators/   # 入力検証
│   │   └── tests/
│   └── admin-ui/             # 管理画面 (React)
│       ├── src/
│       └── tests/
├── infrastructure/           # CDK定義
│   ├── lib/
│   │   ├── database-stack.ts
│   │   ├── lambda-stack.ts
│   │   └── monitoring-stack.ts
│   └── bin/
├── docs/                     # ドキュメント
│   ├── architecture/
│   ├── runbooks/            # 運用手順書
│   └── api/
└── scripts/                 # 開発支援スクリプト
    ├── setup-local.sh
    └── deploy.sh
```

## MVP スコープ (Phase 1: 2 週間)

### 必須機能

1. **基本的なフラグ評価**

   - テナント別 ON/OFF 制御
   - デフォルト値サポート
   - メモリ内キャッシュ（TTL: 5 分）

2. **Kill-Switch 機能**

   - 全機能即座 OFF
   - 特定機能の緊急停止

3. **最小限の管理機能**

   - CLI 経由でのフラグ作成/更新
   - 基本的な監査ログ

4. **SDK 基本実装**
   - TypeScript 型安全性
   - エラーハンドリング

### 実装しない機能（後回し）

- Web 管理画面
- 段階的ロールアウト
- A/B テスト
- 高度な監査・分析

## データモデル

### DynamoDB テーブル設計

```typescript
// FeatureFlags テーブル
interface FeatureFlagsTable {
  PK: string; // "FLAG#${flagKey}"
  SK: string; // "METADATA"
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
  expiresAt?: string;

  // GSI1: 有効期限でのクエリ用
  GSI1PK?: string; // "EXPIRES"
  GSI1SK?: string; // expiresAt
}

// TenantOverrides テーブル
interface TenantOverridesTable {
  PK: string; // "TENANT#${tenantId}"
  SK: string; // "FLAG#${flagKey}"
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;

  // GSI1: フラグ別のテナント一覧用
  GSI1PK: string; // "FLAG#${flagKey}"
  GSI1SK: string; // "TENANT#${tenantId}"
}

// EmergencyControl テーブル（Kill-Switch用）
interface EmergencyControlTable {
  PK: string; // "EMERGENCY"
  SK: string; // "GLOBAL" or "FLAG#${flagKey}"
  enabled: boolean;
  reason: string;
  activatedAt: string;
  activatedBy: string;
}
```

## 開発タスク（優先順位順）

### Week 1: コア機能実装

1. **[P0] データモデル実装** (1 日)

   - DynamoDB テーブル作成（CDK）
   - 基本的な CRUD 操作
   - ユニットテスト

2. **[P0] フラグ評価エンジン** (2 日)

   - 評価ロジック実装
   - Kill-Switch 統合
   - メモリキャッシュ実装

3. **[P0] Lambda SDK** (2 日)
   - 型定義
   - 初期化処理
   - エラーハンドリング

### Week 2: 運用機能とテスト

4. **[P1] CLI 管理ツール** (1 日)

   - フラグ作成/更新
   - 一覧表示
   - Kill-Switch 操作

5. **[P1] 管理画面 MVP** (2 日)

   - Vite + React + Ant Design Pro セットアップ
   - 基本的な CRUD 画面
   - Cognito 認証統合

6. **[P1] 監査ログ基盤** (1 日)

   - DynamoDB Streams 設定
   - CloudWatch Logs 連携

7. **[P0] 統合テスト** (2 日)

   - E2E テストシナリオ
   - 負荷テスト
   - 障害シナリオテスト

8. **[P1] ドキュメント作成** (1 日)
   - API 仕様書
   - 運用手順書
   - SDK 使用ガイド

## 実装上の注意点

### 1. 型安全性の確保

```typescript
// feature-flags.ts - 単一の真実の源
export const FEATURE_FLAGS = {
  BILLING_V2: 'billing_v2_enable',
  NEW_DASHBOARD: 'new_dashboard_enable',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

// 使用例
import { FEATURE_FLAGS, isFeatureEnabled } from '@company/feature-flag-sdk';

if (await isFeatureEnabled(tenantId, FEATURE_FLAGS.BILLING_V2)) {
  // 新機能のコード
}
```

### 2. エラーハンドリング

```typescript
// SDK内部でのフェイルセーフ実装
class FeatureFlagClient {
  async isEnabled(tenantId: string, flagKey: FeatureFlagKey): Promise<boolean> {
    try {
      // 1. Kill-Switchチェック
      if (await this.checkKillSwitch(flagKey)) {
        return false;
      }

      // 2. キャッシュチェック
      const cached = this.cache.get(tenantId, flagKey);
      if (cached !== undefined) {
        return cached;
      }

      // 3. DynamoDB取得
      const value = await this.fetchFromDynamoDB(tenantId, flagKey);
      this.cache.set(tenantId, flagKey, value);
      return value;
    } catch (error) {
      // 4. エラー時はデフォルト値を返す
      console.error('FeatureFlag evaluation failed:', error);
      return this.getDefaultValue(flagKey);
    }
  }
}
```

### 3. キャッシュ戦略

```typescript
// Lambdaコンテナ再利用を考慮したグローバル変数キャッシュ
let cache: FeatureFlagCache | undefined;

export function getFeatureFlagClient(): FeatureFlagClient {
  if (!cache || cache.isExpired()) {
    cache = new FeatureFlagCache({ ttl: 300 }); // 5分
  }
  return new FeatureFlagClient(cache);
}
```

## テスト戦略

### ユニットテスト

- 各モジュールの個別テスト
- モックを使用した DynamoDB 操作テスト
- キャッシュ動作の検証

### 統合テスト

```typescript
describe('Feature Flag Integration', () => {
  it('should handle DynamoDB failure gracefully', async () => {
    // DynamoDBをダウンさせた状態でデフォルト値が返ることを確認
  });

  it('should respect kill switch immediately', async () => {
    // Kill-Switch有効化後、即座に反映されることを確認
  });
});
```

## 次のステップ

1. この CLAUDE.md をベースに開発を開始
2. 各タスクを GitHub Issues に登録
3. Week 1 の実装を開始
4. 毎日の進捗確認とブロッカー解消

## 管理画面実装ガイド

### MVP 段階（Vite + React + Ant Design Pro）

```bash
# 管理画面のセットアップ
cd packages/admin-ui
npm create vite@latest . -- --template react-ts
npm install antd @ant-design/pro-components @ant-design/icons
npm install @tanstack/react-query axios dayjs
npm install -D @types/react @types/react-dom
```

主な機能：

- フラグ一覧表示（テーブル形式）
- フラグの有効/無効切り替え
- テナント別オーバーライド設定
- Kill-Switch 操作
- 基本的な監査ログ表示

### 本番段階（Next.js 14 + Tailwind CSS）

```bash
# Next.js 14セットアップ（将来的な移行時）
npx create-next-app@latest admin-ui --typescript --tailwind --app
cd admin-ui
npm install @tanstack/react-query next-auth @aws-sdk/client-cognito-identity-provider
npm install lucide-react date-fns zod react-hook-form @hookform/resolvers
npx shadcn-ui@latest init
```

追加機能：

- SSR/SSG による高速表示
- リアルタイムダッシュボード
- 高度なフィルタリング/検索
- 一括操作
- データエクスポート
- 詳細な権限管理

## コマンド例

```bash
# ローカル環境セットアップ
npm install
npm run setup:local

# テスト実行
npm test
npm run test:integration

# デプロイ
npm run deploy:dev
npm run deploy:prod

# CLI使用例
npx feature-flag create --key "billing_v2_enable" --description "New billing system"
npx feature-flag enable --key "billing_v2_enable" --tenant "tenant-123"
npx feature-flag kill-switch --activate --reason "Critical bug found"
```

## 開発プロセス

### 🎯 フェーズ 1: 構想・計画（Sprint 0）

1. **課題定義とゴール設定**

   - ビジネス課題の明確化
   - 成功指標（KPI）の定義
   - ステークホルダーの特定

2. **技術調査と PoC**

   - 技術選定の妥当性検証
   - リスク評価
   - 技術選定と選定の経緯をまとめた ADR 作成
   - 小規模なプロトタイプ作成

3. **要件定義**
   - 機能要件・非機能要件の整理
   - 制約事項の洗い出し
   - 受け入れ基準の定義

### 🏗️ フェーズ 2: 設計・準備

本パートは各技術スタックの最新ベストプラクティスを情報収集しながら、Martin Fowler、Kent Beck、Robert C. Martin、Eric Evans、Michael Feathers、Jeff Sutherland、和田卓人が議論して進める。

1. **アーキテクチャ設計**（成果物はシステム構成図、シーケンス図、OpenAPI 仕様書など）

   - システム全体設計
   - API 設計
   - データモデル設計
   - セキュリティ設計

2. **タスク分解とスケジューリング**

   - エピック → ストーリー → タスクへの分解
   - 依存関係の整理
   - スプリント計画

3. **チケット作成**
   - GitHub Issues でのチケット作成
   - Definition of Done の設定
   - 見積もり（ストーリーポイント）

### 💻 フェーズ 3: 開発（t-wada として）（t-wada として）

7. **開発環境構築**

   - ローカル開発環境のセットアップ
   - CI/CD パイプライン構築
   - 開発ガイドライン策定

8. **実装**

   - TDD/BDD アプローチ（ドメイン駆動設計を意識しながら）
   - ペアプログラミング/モブプログラミング
   - 継続的なリファクタリング

9. **自動テスト実装**

   - 単体テスト
   - 統合テスト
   - E2E テスト
   - パフォーマンステスト

10. **コードレビュー**（t-wada レビュー）
    - PR 作成とレビュー
    - 設計レビュー
    - セキュリティレビュー

### 🧪 フェーズ 4: 品質保証

11. **QA テスト**

    - テスト計画作成
    - 手動テスト実施
    - 探索的テスト
    - 回帰テスト

12. **負荷テスト・カオステスト**
    - パフォーマンス検証
    - 障害シナリオテスト
    - リカバリー手順確認

### 📚 フェーズ 5: ドキュメント・準備

13. **ドキュメント作成**

    - 技術ドキュメント
    - 運用手順書
    - トラブルシューティングガイド
    - API 仕様書

14. **トレーニング・引き継ぎ**
    - 運用チームへの引き継ぎ
    - サポートチームのトレーニング
    - 社内勉強会

### 🚀 フェーズ 6: リリース

15. **リリース準備**

    - リリース計画書作成
    - ロールバック計画
    - コミュニケーション計画

16. **段階的リリース**
    - カナリアリリース
    - 段階的ロールアウト
    - メトリクス監視

### 📊 フェーズ 7: 運用・改善

17. **モニタリング・アラート設定**

    - ダッシュボード構築
    - アラート閾値設定
    - SLO/SLI 定義

18. **インシデント対応**

    - オンコール体制
    - インシデント管理プロセス
    - ポストモーテム

19. **フィードバック収集と改善**

    - ユーザーフィードバック分析
    - メトリクス分析
    - 改善バックログ作成

20. **レトロスペクティブ**
    - プロジェクト振り返り
    - 改善点の特定
    - ナレッジ共有

## フィーチャーフラグプロジェクトでの適用例

### Sprint 0-1: 基盤構築（2 週間）

- 技術調査と PoC
- アーキテクチャ設計
- 開発環境構築
- 基本的な CRUD API 実装

### Sprint 2-3: コア機能（3 週間）

- フラグ評価エンジン
- キャッシュ層実装
- 管理画面（基本機能）
- 自動テスト整備

### Sprint 4: 運用機能（2 週間）

- 監査ログ
- メトリクス収集
- アラート設定
- ドキュメント作成

### Sprint 5: リリース（1 週間）

- 段階的ロールアウト
- モニタリング強化
- 運用引き継ぎ

## 質問・相談先

技術的な質問や設計の相談は、この CLAUDE.md を更新しながら進めてください。
