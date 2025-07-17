# CLAUDE.md - フィーチャーフラグシステム開発ガイド

## プロジェクト概要

マルチテナント SaaS 向けのフィーチャーフラグシステムを構築します。デプロイとリリースを分離し、安全かつ高速な価値提供を実現します。

## 技術スタック

- **言語**: TypeScript (Node.js 22.x)
- **静的解析**: ESLint + SonarJS
- **コードフォーマット**: Prettier
- **Git Hooks**: Husky + lint-staged
- **ユニットテスト**: Vitest
- **ローカル統合テスト**: AWS SAM Local + DynamoDB Local
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

### 💻 フェーズ 3: 開発（Expert Review Process）

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

10. **コードレビュー**（Expert Review by Eric Evans, Martin Fowler, 和田卓人）
    - PR 作成とレビュー（2名以上のApprove必須）
    - 設計レビュー
    - セキュリティレビュー
    - Definition of Done達成確認

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

## 📋 開発プロセス詳細

### 🎯 INVEST原則によるタスク分割

すべてのユーザーストーリーとタスクは以下のINVEST原則に従って分割する：

#### **I - Independent（独立性）**
- 他のストーリー/タスクに依存しない
- 単独でテスト・デプロイ可能
- 並行開発可能な設計

#### **N - Negotiable（交渉可能）**
- 実装方法は柔軟に調整可能
- 要件の詳細化は実装時に決定
- ステークホルダーとの対話重視

#### **V - Valuable（価値提供）**
- ユーザーまたはシステムに明確な価値
- ビジネス価値または技術的価値の明確化
- ROI（投資対効果）の説明可能

#### **E - Estimable（見積もり可能）**
- 適切なサイズでの分割（1-13 Story Points）
- 技術的複雑性の理解
- 実装工数の予測可能

#### **S - Small（小さい）**
- 1スプリント（1-2週間）で完了可能
- PRサイズ200行以下（理想）
- レビュー可能な適切なサイズ

#### **T - Testable（テスト可能）**
- 明確な受入条件定義
- 自動テスト実装可能
- Definition of Done達成可能

### 🔄 GitHubフロー戦略

#### ブランチ戦略
```
main (保護ブランチ)
├── feature/18-enhance-development-process  # Issue #18対応
├── feature/19-implement-web-ui           # Issue #19対応
└── hotfix/20-critical-security-fix       # 緊急修正
```

#### ブランチ命名規則
- **Feature**: `feature/{issue-number}-{brief-description}`
- **Hotfix**: `hotfix/{issue-number}-{brief-description}`
- **Release**: `release/v{version}`

#### プロテクションルール
- main ブランチへの直接pushは禁止
- PR必須（2名以上のApprove）
- CI/CD全チェック通過必須
- DoD達成確認必須

### 📝 Conventional Commits

#### コミットメッセージフォーマット
```
<type>[optional scope]: <description> (#<issue-number>)

[optional body]

[optional footer(s)]
```

#### Type一覧
- **feat**: 新機能追加
- **fix**: バグ修正
- **docs**: ドキュメント更新
- **style**: コードスタイル変更（機能に影響なし）
- **refactor**: リファクタリング
- **test**: テスト追加・修正
- **chore**: その他の変更（ビルド、ツール等）

#### コミット例
```bash
# 機能追加
feat(evaluator): add percentage-based rollout support (#19)

# バグ修正  
fix(cache): resolve TTL memory leak issue (#14)

# ドキュメント更新
docs(readme): update installation instructions (#25)

# テスト追加
test(api): add integration tests for flag management (#22)
```

#### Issue-Commit紐づけ
- コミットメッセージに必ずIssue番号を記載: `(#issue-number)`
- PRタイトルにもIssue番号を含める: `feat: Web管理画面実装 (#19)`
- GitHub自動リンク機能でトレーサビリティ確保

### 👥 Expert Review Process

#### レビュアー構成
- **Eric Evans**: ドメイン駆動設計（DDD）観点
- **Martin Fowler**: アーキテクチャ・リファクタリング観点  
- **和田卓人**: テスト駆動開発（TDD）・品質観点

#### レビュー基準
##### 設計レビュー（Eric Evans）
- [ ] ドメインモデルの適切性
- [ ] 境界コンテキストの明確性
- [ ] ユビキタス言語の一貫性
- [ ] ドメインロジックの純粋性
- [ ] **可読性**: ドメイン概念の理解しやすさ
- [ ] **変更容易性**: ドメイン変更への対応容易性

##### アーキテクチャレビュー（Martin Fowler）
- [ ] レイヤードアーキテクチャ準拠
- [ ] 責務分離の適切性
- [ ] 拡張性・保守性の考慮
- [ ] パフォーマンス影響評価
- [ ] **可読性**: アーキテクチャ意図の明確性
- [ ] **変更容易性**: 機能追加・修正の容易性

##### 品質レビュー（和田卓人）
- [ ] TDD実践状況
- [ ] テストカバレッジ（90%以上）
- [ ] テストの可読性・保守性
- [ ] リファクタリング品質
- [ ] **可読性**: コードの理解しやすさ・自己文書化
- [ ] **変更容易性**: 安全なリファクタリング可能性

#### レビュープロセス
1. **PR作成**: 実装者がPR作成・レビュー依頼
2. **自動チェック**: CI/CD実行・品質ゲート通過確認
3. **Expert Review**: 3名のExpertによる並行レビュー
4. **修正対応**: フィードバック対応・再レビュー
5. **Approve**: 2名以上のApprove取得
6. **DoD確認**: Definition of Done達成確認
7. **マージ**: mainブランチへマージ・Issue自動クローズ

### 🚀 PR作成・管理プロセス

#### PR作成要件
- [ ] **1 Issue = 1 PR原則**: 複数Issue混在禁止
- [ ] **適切なサイズ**: コード変更200行以下（理想）
- [ ] **完全な実装**: 半完成状態でのPR禁止
- [ ] **テスト完備**: カバレッジ90%以上
- [ ] **DoD達成**: 全DoD項目クリア

#### PRテンプレート活用
```markdown
## 📋 Summary
[PR概要]

## 🎯 Issues  
Closes #XX

## 📝 主な変更内容
[実装内容詳細]

## ✅ DoD確認
- [ ] 機能実装完了
- [ ] テスト実装（カバレッジ90%以上）
- [ ] ドキュメント更新
- [ ] TypeScript型安全性100%
- [ ] CI/CD全チェック通過

## 🔍 レビューポイント
[レビュー観点]
```

#### マージ条件
1. **2名以上Expert Approve**: Eric Evans, Martin Fowler, 和田卓人のうち2名以上
2. **CI/CD全通過**: テスト・品質・セキュリティチェック
3. **DoD達成**: 全Definition of Done項目クリア
4. **コンフリクト解決**: 最新mainとのマージ準備完了

### 📊 品質メトリクス監視

#### 必須メトリクス
| メトリクス | 基準値 | 自動化 |
|-----------|-------|--------|
| テストカバレッジ | 90%以上 | ✅ Vitest |
| TypeScript型安全性 | 100% | ✅ tsc --noEmit |
| ESLint違反 | 0件 | ✅ ESLint CI |
| セキュリティ脆弱性 | 0件（High/Critical） | ✅ CodeQL |
| PRサイズ | 200行以下（理想） | 🔍 Manual |

#### プロセスメトリクス
- レビュー完了時間: 2営業日以内
- PR修正サイクル: 平均3回以内  
- Issue-PR-Merge完了時間: 1週間以内
- Expert Approve取得率: 100%

### 🔧 開発ツール統合

#### 必須ツール設定
- **Husky**: pre-commit hooks（lint, test）
- **lint-staged**: 差分ファイルのみlint実行
- **Prettier**: 自動コードフォーマット
- **ESLint**: コード品質チェック
- **Vitest**: 高速テスト実行

#### IDE設定推奨
- **VSCode Extensions**: ESLint, Prettier, GitLens
- **TypeScript Strict Mode**: 最大限の型安全性
- **Auto Save**: ファイル保存時自動lint実行

### 🚨 禁止事項・回避ルール

#### 絶対禁止
- [ ] **マルチIssue PR**: 複数Issueを1PRで処理
- [ ] **巨大PR**: 500行超（例外時は事前Expert相談）
- [ ] **レビュー省略**: 緊急時でもExpert Review必須
- [ ] **DoD妥協**: いかなる理由でもDoD未達成マージ禁止
- [ ] **型安全性妥協**: `any`使用禁止（`unknown`推奨）

#### エスケープハッチ
緊急時（Production Down等）のみ以下手順で例外対応可能：
1. **緊急Issue作成**: 影響・対処法明記
2. **Hotfixブランチ**: `hotfix/{issue-number}`で作成
3. **最小修正**: 問題解決に必要最小限の変更
4. **Expert緊急レビュー**: 24時間以内のレビュー
5. **事後対応**: 根本対策のIssue・PR作成

### 📚 参考資料・ガイドライン

#### 外部参考資料
- [Conventional Commits](https://www.conventionalcommits.org/)
- [INVEST Principles](https://en.wikipedia.org/wiki/INVEST_(mnemonic))
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

#### プロジェクト内資料
- [Definition of Done](docs/development/definition-of-done.md)
- [Technical Debt Log](docs/architecture/technical-debt-log.md)
- [ADR Documentation](docs/architecture/design-decisions.md)

## 質問・相談先

技術的な質問や設計の相談は、この CLAUDE.md を更新しながら進めてください。
