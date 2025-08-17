# Sub Agent エコシステム クイックスタートガイド

## 🚀 即座に使えるSub agent活用法

### 基本的な使用方法

```bash
# 基本構文
claude-code --agent [エージェント名] "[具体的なリクエスト]"

# 例: DDD観点でのレビュー依頼
claude-code --agent ddd-reviewer "新しいテナント管理機能のドメインモデル設計をレビューして"
```

## 📋 シナリオ別活用ガイド

### 🔍 Scenario 1: 新機能開発開始時

#### Step 1: ドメイン設計レビュー
```bash
claude-code --agent ddd-reviewer \
  "ユーザー招待機能のドメインモデルを設計してレビューして。境界コンテキストとエンティティの関係を明確にして。"
```

#### Step 2: アーキテクチャ検証
```bash
claude-code --agent architecture-reviewer \
  "ユーザー招待機能がレイヤードアーキテクチャに適合するか検証して。依存関係の方向性をチェックして。"
```

#### Step 3: フィーチャーフラグ設計
```bash
claude-code --agent feature-flag-architect \
  "ユーザー招待機能の段階的ロールアウト用フラグ設計を最適化して。マルチテナント対応も考慮して。"
```

### 🏗️ Scenario 2: データベース設計最適化

#### DynamoDB設計改善
```bash
claude-code --agent dynamodb-specialist \
  "現在のフィーチャーフラグテーブル設計を分析して、パフォーマンスとコスト効率を改善する提案をして。"
```

#### 使用例
```bash
# GSI最適化提案
claude-code --agent dynamodb-specialist \
  "GSI3-TENANT-INDEXの使用率が低い。最適化案を提案して。"

# クエリパフォーマンス改善
claude-code --agent dynamodb-specialist \
  "テナント別フラグ取得のレイテンシが200ms。100ms以下に最適化する方法を提案して。"
```

### 🧪 Scenario 3: A/Bテスト機能実装

#### A/Bテスト設計
```bash
claude-code --agent ab-testing-implementer \
  "新しいダッシュボードUIのA/Bテストを設計して。統計的有意性とサンプルサイズ計算も含めて。"
```

#### 段階的ロールアウト計画
```bash
claude-code --agent gradual-rollout-expert \
  "A/Bテスト結果を基にした新UIの段階的ロールアウト戦略を設計して。自動ロールバック条件も含めて。"
```

### ⚡ Scenario 4: パフォーマンス問題解決

#### システム監査
```bash
claude-code --agent performance-auditor \
  "フラグ評価APIのレスポンス時間が悪化している。包括的な監査を実行してボトルネックを特定して。"
```

#### CI/CD最適化
```bash
claude-code --agent ci-cd-optimizer \
  "ビルド時間が10分かかっている。5分以下に短縮する最適化案を提案して。"
```

### 🎯 Scenario 5: 品質チェック・レビュー

#### TDD実践支援
```bash
claude-code --agent tdd-quality-checker \
  "新機能のテストカバレッジが70%。90%達成のためのテスト戦略を提案して。"
```

#### Expert Review統合
```bash
# 複数エージェントの連携例
claude-code --agent ddd-reviewer "src/domain/tenant.tsのドメインモデルをレビューして"
claude-code --agent architecture-reviewer "src/domain/tenant.tsのアーキテクチャ適合性を確認して"  
claude-code --agent tdd-quality-checker "src/domain/tenant.tsのテスト戦略を評価して"
```

## 🔧 実践的な使用パターン

### Daily Development Workflow

#### 1. 朝の開発開始時
```bash
# 昨日の変更の品質チェック
claude-code --agent tdd-quality-checker \
  "昨日実装した機能のテストカバレッジと品質を評価して"

# 今日の開発計画確認  
claude-code --agent feature-flag-architect \
  "今日実装予定の機能にフィーチャーフラグが必要か判断して"
```

#### 2. 実装中のサポート
```bash
# データベース設計相談
claude-code --agent dynamodb-specialist \
  "新しいクエリパターンを効率的に実装する方法を提案して"

# パフォーマンス懸念の解決
claude-code --agent performance-auditor \
  "この実装がパフォーマンスに与える影響を予測して"
```

#### 3. PR作成前チェック
```bash
# 品質チェック
claude-code --agent tdd-quality-checker \
  "PR作成前の最終品質チェックを実行して"

# アーキテクチャ適合性確認
claude-code --agent architecture-reviewer \
  "変更がアーキテクチャ原則に適合するか確認して"
```

### Weekly Planning Session

#### Phase 2機能計画
```bash
# A/Bテスト機能実装計画
claude-code --agent ab-testing-implementer \
  "来週のA/Bテスト機能実装スプリント計画を立てて"

# ロールアウト戦略計画
claude-code --agent gradual-rollout-expert \
  "次の四半期の段階的機能展開計画を作成して"
```

#### インフラ最適化計画
```bash
# CI/CD改善計画
claude-code --agent ci-cd-optimizer \
  "来月のCI/CDパイプライン改善計画を策定して"

# DynamoDB最適化スケジュール
claude-code --agent dynamodb-specialist \
  "データベースコスト30%削減の実装計画を作成して"
```

## ⚙️ 高度な活用テクニック

### 1. エージェント連携による包括的分析

```bash
# Expert Review完全自動化
./scripts/expert-review-automation.sh [PR番号]

# Phase 2機能実装サポート
./scripts/phase2-implementation-support.sh [機能名]
```

### 2. 継続的品質監視

```bash
# 定期パフォーマンス監査（cron設定例）
# 毎日午前3時に実行
0 3 * * * claude-code --agent performance-auditor "日次システム監査を実行"

# 週次CI/CD最適化チェック  
0 9 * * 1 claude-code --agent ci-cd-optimizer "週次パイプライン最適化チェック"
```

### 3. カスタマイズされたワークフロー

```bash
# プロジェクト固有の質問テンプレート
claude-code --agent feature-flag-architect \
  --context "environment=production,tenant-count=1000" \
  "新しいフラグ設計を最適化して"
```

## 🎯 成功のためのベストプラクティス

### 1. 具体的で明確なリクエスト
❌ 悪い例: "フラグを最適化して"
✅ 良い例: "本番環境で1000テナント対応のフラグ評価レイテンシを100ms以下にする最適化案を提案して"

### 2. コンテキスト情報の提供
```bash
claude-code --agent dynamodb-specialist \
  "現在のRCU使用率70%、P95レイテンシ150ms。コスト20%削減しつつパフォーマンス向上する設計を提案して"
```

### 3. 段階的な活用
1. **Individual**: 単一エージェントでの課題解決
2. **Collaborative**: 複数エージェントでの包括的分析  
3. **Automated**: ワークフローへの統合・自動化

## 📚 トラブルシューティング

### よくある問題と解決法

#### エージェントが期待した応答をしない
```bash
# より具体的なコンテキスト提供
claude-code --agent [エージェント名] \
  --verbose \
  "[具体的な状況] + [期待する成果] + [制約条件]"
```

#### 応答時間が遅い
```bash
# 軽量リクエストでテスト
claude-code --agent [エージェント名] \
  "現在の状況を簡潔に分析して"
```

#### 品質が期待に満たない
1. リクエストの具体性を向上
2. 必要なコンテキスト情報を追加
3. 段階的にリクエストを細分化

---

**Quick Start完了時間**: 約15分
**習熟目標時間**: 1週間
**マスター目標時間**: 1ヶ月

各エージェントを効果的に活用して、フィーチャーフラグシステムの開発効率と品質を最大化しましょう！