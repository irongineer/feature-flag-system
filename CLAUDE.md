# CLAUDE.md - フィーチャーフラグシステム開発ガイド

> **注意**: 一部のリンクは準備中です。対象のファイルが存在しない場合は **(準備中)** または **(Coming Soon)** と表示されています。

## 📋 プロジェクト概要

マルチテナント SaaS 向けのフィーチャーフラグシステム。デプロイとリリースを分離し、安全かつ高速な価値提供を実現。

## 🏗️ アーキテクチャ

### 技術スタック
```
Frontend: React + Vite + Ant Design Pro
Backend:  Node.js + Express + Lambda
Database: DynamoDB + CDK
Testing:  Vitest + Playwright
DevOps:   GitHub Actions + AWS CDK
```

### ディレクトリ構造
```
feature-flag-system/
├── packages/
│   ├── core/         # フラグ評価エンジン
│   ├── api/          # Lambda API + Express wrapper
│   └── admin-ui/     # React管理画面
├── infrastructure/   # AWS CDK定義
├── scripts/         # 開発支援スクリプト
└── docs/           # ドキュメント
```

## 🎯 実装完了機能

### ✅ Phase 1: MVP完了 (2025-07-16)
- **管理画面**: React + Ant Design Pro
- **API層**: Express wrapper + Lambda handlers
- **E2Eテスト**: Playwright完全実装
- **インフラ**: CDK TypeScript + DynamoDB
- **開発環境**: ローカル統合テスト環境

### 🔄 データフロー
```typescript
// 1. フラグ評価API
POST /api/evaluate
{
  "tenantId": "tenant-123",
  "flagKey": "billing_v2_enable",
  "environment": "production"
}

// 2. 管理API
GET /api/flags          # フラグ一覧
POST /api/flags         # フラグ作成
PUT /api/flags/:id      # フラグ更新
DELETE /api/flags/:id   # フラグ削除
```

## 🚀 開発プロセス

### 1Issue1PR原則
- **必須**: 1つのIssueに対して1つのPR
- **マージ**: GitHub PR経由での正式マージのみ
- **レビュー**: Expert Review必須（2名以上Approve）
- **DoD**: Definition of Done達成確認

### Expert Review体制
#### Eric Evans (DDD観点)
- ドメインモデルの適切性
- 境界コンテキストの明確性
- ユビキタス言語の一貫性

#### Martin Fowler (アーキテクチャ観点)
- レイヤードアーキテクチャ準拠
- 責務分離の適切性
- 拡張性・保守性の考慮

#### 和田卓人 (品質・TDD観点)
- TDD実践状況
- テストカバレッジ90%以上
- リファクタリング品質

### PRマージフロー
```bash
# 1. ブランチ作成
git checkout -b feature/issue-number-description

# 2. 実装・テスト
npm test                # ユニットテスト
npm run test:e2e       # E2Eテスト
npm run build          # ビルド確認

# 3. PR作成（日本語）
gh pr create --title "feat: 機能名実装 (#issue-number)"

# 4. Expert Review待ち
# 5. GitHub経由でマージ
gh pr merge --squash
```

## 📊 品質基準

### Definition of Done
- [ ] 機能実装完了
- [ ] テストカバレッジ90%以上
- [ ] TypeScript型安全性100%
- [ ] E2Eテスト通過
- [ ] Expert Review完了（2名以上）
- [ ] CI/CD全チェック通過
- [ ] ドキュメント更新

### 品質メトリクス
| 項目 | 基準値 | 自動化 |
|------|-------|--------|
| テストカバレッジ | 90%以上 | ✅ Vitest |
| TypeScript型安全性 | 100% | ✅ tsc |
| ESLint違反 | 0件 | ✅ CI/CD |
| PRサイズ | 200行以下 | 🔍 Manual |

## 🔧 開発環境

### ローカル開発
```bash
# 1. 依存関係インストール
npm install

# 2. DynamoDB Local起動
./scripts/start-local-aws.sh

# 3. APIサーバー起動
cd packages/api && npm run dev

# 4. 管理画面起動
cd packages/admin-ui && npm run dev

# 5. E2Eテスト実行
cd packages/admin-ui && npm run test:e2e
```

### デプロイ
```bash
# 開発環境
npm run deploy:dev

# 本番環境
npm run deploy:prod
```

## 🧪 テスト戦略

### テストレベル
1. **ユニットテスト**: 各モジュールの個別テスト
2. **統合テスト**: API + DynamoDB連携テスト
3. **E2Eテスト**: ブラウザ自動化テスト

### E2Eテスト例
```typescript
// packages/admin-ui/e2e/flag-management.spec.ts
test('should create new flag', async ({ page }) => {
  await page.goto('/flags/list');
  await page.click('[data-testid="create-flag-button"]');
  await page.fill('[data-testid="flag-key-input"]', 'test_flag');
  await page.fill('[data-testid="flag-description-input"]', 'Test description');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=フラグが作成されました')).toBeVisible();
});
```

## 📝 コーディング規約

### TypeScript
```typescript
// 型安全性の確保
export const FEATURE_FLAGS = {
  BILLING_V2: 'billing_v2_enable',
  NEW_DASHBOARD: 'new_dashboard_enable',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

// エラーハンドリング
async function evaluateFlag(tenantId: string, flagKey: FeatureFlagKey): Promise<boolean> {
  try {
    // 実装
  } catch (error) {
    console.error('Flag evaluation failed:', error);
    return getDefaultValue(flagKey); // フェイルセーフ
  }
}
```

### Conventional Commits
```bash
feat(scope): 新機能追加 (#issue-number)
fix(scope): バグ修正 (#issue-number)
docs(scope): ドキュメント更新 (#issue-number)
test(scope): テスト追加 (#issue-number)
```

## 🗂️ データモデル

### DynamoDB設計
```typescript
// FeatureFlags テーブル
interface FeatureFlagsTable {
  PK: string;           // "FLAG#${flagKey}"
  SK: string;           // "METADATA"
  flagKey: string;
  description: string;
  defaultEnabled: boolean;
  owner: string;
  createdAt: string;
  expiresAt?: string;
}

// 評価API例
const evaluator = new FeatureFlagEvaluator({ dynamoDbClient });
const enabled = await evaluator.isEnabled(tenantId, flagKey);
```

## 🚨 重要なルール

### 絶対禁止事項
- [ ] **ローカルマージ**: `git merge`でのローカルマージ禁止
- [ ] **マルチIssue PR**: 複数Issue混在禁止
- [ ] **巨大PR**: 500行超（例外時は事前相談）
- [ ] **レビュー省略**: 緊急時でもExpert Review必須
- [ ] **DoD妥協**: いかなる理由でもDoD未達成マージ禁止

### リベース後の再レビュー
- **必須**: 最終レビュー以降に差分があれば再レビュー
- **確認**: `git diff origin/branch-name`で差分確認
- **対応**: 変更があれば必ずExpert Review追加

## 📚 参考資料

### 外部リンク
- [AWS CDK v2 Documentation](https://docs.aws.amazon.com/cdk/v2/)
- [Playwright Testing](https://playwright.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [React + Ant Design Pro](https://pro.ant.design/)

### プロジェクト内資料
- `/docs/architecture/` - アーキテクチャ設計
- `/docs/runbooks/` - 運用手順書 **(準備中)**
- `/docs/api/` - API仕様書

## 💡 次のステップ

### Phase 2: 拡張機能
- [ ] 段階的ロールアウト（パーセンテージ配信）
- [ ] A/Bテスト機能
- [ ] リアルタイムメトリクス
- [ ] 高度な監査・分析
- [ ] Next.js管理画面への移行

### 運用改善
- [ ] モニタリング・アラート強化
- [ ] 自動デプロイパイプライン
- [ ] パフォーマンス最適化
- [ ] セキュリティ強化

---

**最終更新**: 2025-07-16  
**ステータス**: Phase 1 MVP完了 ✅