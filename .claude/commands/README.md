# Claude Code カスタムコマンド集

## 🎯 プロジェクト専用カスタムコマンド

このディレクトリには、フィーチャーフラグシステム開発に特化したカスタムコマンドが格納されています。

### 📁 ディレクトリ構造

```
.claude/commands/
├── feature-flags/     # フィーチャーフラグ関連
├── quality-checks/    # 品質チェック関連
├── performance/       # パフォーマンス関連
├── architecture/      # アーキテクチャ関連
└── project-mgmt/      # プロジェクト管理関連
```

### 🚀 使用方法

Claude Codeセッション内で `/` を入力すると、カスタムコマンドが自動的に表示されます。

```bash
# 例: フラグ設計最適化コマンド実行
claude
> /feature-flags/design-optimization

# 例: 包括的品質レビュー実行
> /quality-checks/comprehensive-review
```

## 📋 利用可能コマンド一覧

### フィーチャーフラグ関連 (`/feature-flags/`)

#### `/feature-flags/design-optimization`
新しいフィーチャーフラグの設計を最適化します。
- マルチテナント対応チェック
- パフォーマンス最適化提案
- 運用性向上アドバイス

#### `/feature-flags/rollout-strategy`
段階的ロールアウト戦略を設計します。
- カナリアリリース計画
- リスク評価・軽減策
- 自動ロールバック条件

#### `/feature-flags/performance-analysis`
フラグ評価のパフォーマンスを分析します。
- レスポンス時間測定
- スループット分析
- ボトルネック特定

### 品質チェック関連 (`/quality-checks/`)

#### `/quality-checks/comprehensive-review`
CLAUDE.md DoD基準での包括的レビューを実行します。
- 全DoD項目チェック
- 改善提案生成
- 品質メトリクス評価

#### `/quality-checks/test-strategy`
テスト戦略の最適化を提案します。
- カバレッジ90%達成戦略
- TDD実践支援
- E2Eテスト効率化

#### `/quality-checks/code-review-prep`
コードレビュー準備を支援します。
- 事前チェック実行
- レビューポイント整理
- ドキュメント準備

### パフォーマンス関連 (`/performance/`)

#### `/performance/system-audit`
システム全体のパフォーマンス監査を実行します。
- 包括的性能分析
- ボトルネック特定
- 最適化提案生成

#### `/performance/database-optimization`
DynamoDB設計の最適化を提案します。
- クエリ効率分析
- コスト最適化
- スケーラビリティ評価

#### `/performance/ci-cd-optimization`
CI/CDパイプラインの最適化を実行します。
- ビルド時間短縮
- テスト実行効率化
- リソース使用量最適化

### アーキテクチャ関連 (`/architecture/`)

#### `/architecture/compliance-check`
アーキテクチャ原則への適合性をチェックします。
- レイヤードアーキテクチャ検証
- SOLID原則確認
- 依存関係分析

#### `/architecture/refactoring-guidance`
リファクタリングの指針を提供します。
- 技術債務特定
- 改善優先度評価
- 実装戦略提案

#### `/architecture/scalability-analysis`
スケーラビリティ観点での分析を実行します。
- 成長対応能力評価
- ボトルネック予測
- 拡張戦略提案

### プロジェクト管理関連 (`/project-mgmt/`)

#### `/project-mgmt/sprint-planning`
スプリント計画の支援を行います。
- タスク優先度評価
- 工数見積もり支援
- リスク要因特定

#### `/project-mgmt/retrospective`
振り返りの実施を支援します。
- 改善点特定
- 成功要因分析
- アクションプラン作成

#### `/project-mgmt/risk-assessment`
プロジェクトリスクの評価を行います。
- 技術リスク特定
- 影響度評価
- 軽減策提案

## 🔧 カスタムコマンド作成方法

### 新しいコマンドの追加

1. **適切なディレクトリに配置**
```bash
# 例: 新しいフラグ機能関連コマンド
touch .claude/commands/feature-flags/ab-testing-setup.md
```

2. **コマンドコンテンツ作成**
```markdown
# A/Bテストセットアップ

新しいA/Bテスト機能のセットアップを支援します。

## 設定項目
1. **実験設計**
   - 仮説設定
   - 成功指標定義
   - サンプルサイズ計算

2. **技術実装**
   - バリアント配信ロジック
   - メトリクス収集設定
   - 分析基盤準備

3. **運用準備**
   - 監視・アラート設定
   - 緊急停止手順
   - 結果分析計画

現在のプロジェクト構成を考慮し、最適なA/Bテスト実装を提案してください。
```

### ベストプラクティス

#### 1. 明確なコマンド目的
```markdown
# ❌ 悪い例
フラグをチェックして

# ✅ 良い例  
# フラグ設計品質監査

現在のフィーチャーフラグ設計を以下の観点で監査してください：
- パフォーマンス影響
- セキュリティ考慮事項
- 運用保守性
```

#### 2. プロジェクト固有コンテキスト
```markdown
# プロジェクト制約の明示
## 技術制約
- DynamoDB Single Table Design使用
- TypeScript完全対応必須
- 3環境対応 (local/dev/prod)

## 品質基準
- テストカバレッジ90%以上
- レスポンス時間100ms以下
- 可用性99.9%以上
```

#### 3. 段階的アクション
```markdown
## Step 1: 現状分析
まず現在の状況を分析してください

## Step 2: 問題特定
特定された課題を優先度順で整理

## Step 3: 解決策提案
具体的な改善策を段階的に提示
```

## 🎯 効果的活用のコツ

### 1. コマンドの組み合わせ活用
```bash
# 包括的レビューフロー
> /quality-checks/comprehensive-review
> /architecture/compliance-check  
> /performance/system-audit
```

### 2. 文脈の継続活用
```bash
# 前回の分析結果を踏まえた詳細分析
> /performance/database-optimization
# 「先ほどのシステム監査結果を踏まえて詳細なDB最適化を実行」
```

### 3. Sub agentとの連携
```bash
# カスタムコマンドでの分析 → Sub agentでの専門対応
> /feature-flags/design-optimization
# その後
claude-code --agent feature-flag-architect "カスタムコマンドの分析結果を基に実装提案"
```

---

**カスタムコマンドにより、プロジェクト固有の知識とワークフローが Claude Code に完全統合されます！**

効率的な開発フローを実現し、一貫した品質とベストプラクティスの適用を確実にしましょう 🚀