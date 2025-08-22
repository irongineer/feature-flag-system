# フィーチャーフラグシステム専用 Sub Agent 統合マニュアル

## 🎯 プロジェクト特化活用戦略

### 1. CLAUDE.md連携最適化

#### プロジェクト固有コンテキストの活用
```bash
# CLAUDE.mdの内容を基にした専門的支援
claude-code --agent feature-flag-architect \
  "CLAUDE.mdに記載された1Issue1PR原則とExpert Review体制を考慮して、新しいフラグ設計パターンを提案して"

claude-code --agent ddd-reviewer \
  "マルチテナントSaaS向けフィーチャーフラグシステムのドメインモデル（CLAUDE.md記載）をベースに、テナント分離機能を改善して"
```

#### 環境別最適化支援
```bash
# 環境設定（CLAUDE.md準拠）での最適化
claude-code --agent dynamodb-specialist \
  "local/dev/prod 3環境構成（CLAUDE.md記載）でのDynamoDBテーブル設計を最適化。環境別テーブル命名規則も考慮して"

claude-code --agent performance-auditor \
  "E2Eテスト環境（Playwright）でのパフォーマンス監査。CLAUDE.mdの品質基準90%カバレッジを達成する方法"
```

### 2. 開発ワークフロー統合

#### 1Issue1PR原則サポート
```bash
#!/bin/bash
# scripts/one-issue-one-pr-support.sh

ISSUE_NUMBER=$1
ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title --jq '.title')

echo "🎯 1Issue1PR原則サポート: Issue #$ISSUE_NUMBER"

# Issue分析と実装計画
claude-code --agent feature-flag-architect \
  "Issue #$ISSUE_NUMBER: '$ISSUE_TITLE' の実装計画をフィーチャーフラグ観点で作成。単一責任原則に基づく実装範囲の明確化"

# ドメイン設計支援
claude-code --agent ddd-reviewer \
  "Issue #$ISSUE_NUMBER: '$ISSUE_TITLE' に必要なドメインモデル設計。既存境界コンテキストとの整合性確保"

# アーキテクチャ適合性事前確認
claude-code --agent architecture-reviewer \
  "Issue #$ISSUE_NUMBER: '$ISSUE_TITLE' の実装がレイヤードアーキテクチャに与える影響分析"

# 実装ブランチ作成
git checkout -b "feature/issue-$ISSUE_NUMBER-$(echo $ISSUE_TITLE | tr ' ' '-' | tr '[:upper:]' '[:lower:]')"

echo "✅ 1Issue1PR準備完了"
```

#### Expert Review 2名承認体制自動化
```bash
#!/bin/bash
# scripts/expert-review-automation.sh

PR_NUMBER=$1

echo "🏛️ Expert Review 2名承認体制自動化"

# 並列Expert Review実行
{
  claude-code --agent ddd-reviewer \
    "PR#$PR_NUMBER をDDD観点でレビュー。Eric Evans基準での評価とCLAUDE.md準拠確認" &
    
  claude-code --agent architecture-reviewer \
    "PR#$PR_NUMBER をアーキテクチャ観点でレビュー。Martin Fowler基準での評価とCLAUDE.md準拠確認" &
    
  claude-code --agent tdd-quality-checker \
    "PR#$PR_NUMBER を品質観点でレビュー。和田卓人基準での評価とDoD完全達成確認" &
    
  wait
}

# レビュー結果統合
cat > "reviews/PR-$PR_NUMBER-expert-review.md" << 'EOF'
# Expert Review委員会報告書

## 📋 Review Committee
- **Eric Evans** (DDD観点): `ddd-reviewer`
- **Martin Fowler** (アーキテクチャ観点): `architecture-reviewer`  
- **和田卓人** (TDD・品質観点): `tdd-quality-checker`

## 🎯 CLAUDE.md準拠チェック
- [ ] 1Issue1PR原則準拠
- [ ] DoD基準100%達成
- [ ] Expert Review 2名承認
- [ ] TypeScript型安全性100%
- [ ] テストカバレッジ90%以上

## 📊 統合判定
**承認状況**: 3名中 X名承認
**マージ可否**: ⚠️ 要改善 / ✅ マージ可能

## 🔗 詳細レビュー
各Expert Reviewerの詳細評価は上記の並列実行結果を参照
EOF

echo "✅ Expert Review 2名承認体制実行完了"
```

### 3. Phase 1.5完了機能との統合

#### 環境別DynamoDB最適化
```bash
# 環境統合機能活用の最適化
claude-code --agent dynamodb-specialist \
  "feature-flags-local/dev/prod テーブル群の効率的運用戦略。環境切り替え機能（CLAUDE.md Phase 1.5完了）を考慮したパフォーマンス最適化"

# 型安全性100%達成の継続支援
claude-code --agent tdd-quality-checker \
  "TypeScript完全対応（CLAUDE.md Phase 1.5）を維持しながら新機能を追加する品質戦略"
```

#### E2Eテスト環境統合
```bash
# Playwright E2Eテストとの統合
claude-code --agent ci-cd-optimizer \
  "ChromiumでのE2E成功・WebKit成功・Firefox改善が必要（CLAUDE.md記載）な現状を考慮したCI/CD最適化"

claude-code --agent performance-auditor \
  "E2Eテスト実行時のパフォーマンス監視。特にFirefoxブラウザ固有の応答遅延問題（20秒タイムアウト）への対策"
```

### 4. Phase 2実装準備加速

#### A/Bテスト機能事前設計
```bash
# 既存システムとの統合を考慮したA/Bテスト設計
claude-code --agent ab-testing-implementer \
  "現在のフィーチャーフラグシステム（DynamoDB Single Table Design、マルチテナント対応）にA/Bテスト機能を統合する実装計画。CLAUDE.md記載のアーキテクチャ原則準拠"

# 段階的ロールアウト準備
claude-code --agent gradual-rollout-expert \
  "Phase 1.5環境分離機能を活用した段階的ロールアウト戦略。local→dev→prod環境での安全な機能展開計画"
```

#### 統計的分析基盤準備
```bash
# データ収集・分析基盤の事前設計
claude-code --agent performance-auditor \
  "A/Bテスト結果分析に必要なメトリクス収集基盤設計。既存のDynamoDB設計との整合性確保"

claude-code --agent dynamodb-specialist \
  "A/Bテスト実験データ・結果データの効率的DynamoDB設計。Single Table Designパターン拡張"
```

### 5. 日常開発支援の実用化

#### Morning Standup支援
```bash
#!/bin/bash
# scripts/morning-standup-support.sh

echo "🌅 朝会支援 - フィーチャーフラグシステム"

# 昨日の変更影響分析
echo "=== 昨日の変更影響分析 ==="
YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d')
CHANGED_FILES=$(git log --since="$YESTERDAY 00:00" --until="$YESTERDAY 23:59" --name-only --pretty=format: | sort | uniq)

if [[ -n "$CHANGED_FILES" ]]; then
  claude-code --agent performance-auditor \
    "昨日の変更ファイル: $CHANGED_FILES。システム全体への影響とパフォーマンス観点での注意点"
else
  echo "昨日の変更なし"
fi

# 今日の開発計画確認
echo "=== 今日の開発計画確認 ==="
claude-code --agent feature-flag-architect \
  "今日予定されている開発タスクでフィーチャーフラグ設計が必要な箇所の事前確認"

# 品質状況確認
echo "=== 品質状況確認 ==="
claude-code --agent tdd-quality-checker \
  "現在のテストカバレッジ状況とCLAUDE.md DoD基準達成状況の確認"

echo "✅ 朝会支援完了"
```

#### コードレビュー準備支援
```bash
#!/bin/bash
# scripts/code-review-preparation.sh

echo "👀 コードレビュー準備支援"

# 変更内容の事前分析
STAGED_FILES=$(git diff --cached --name-only)

if [[ -n "$STAGED_FILES" ]]; then
  echo "=== ステージング済みファイル分析 ==="
  
  # DDD観点での事前チェック
  claude-code --agent ddd-reviewer \
    "レビュー予定ファイル: $STAGED_FILES。ドメインモデル変更の妥当性とCLAUDE.md準拠の事前確認"
  
  # アーキテクチャ観点での事前チェック
  claude-code --agent architecture-reviewer \
    "レビュー予定ファイル: $STAGED_FILES。レイヤードアーキテクチャ適合性の事前確認"
  
  # パフォーマンス影響の事前評価
  claude-code --agent performance-auditor \
    "レビュー予定ファイル: $STAGED_FILES。パフォーマンス影響の事前評価"
    
else
  echo "ステージングされたファイルなし"
fi

echo "✅ コードレビュー準備完了"
```

### 6. プロジェクト固有メトリクス監視

#### フィーチャーフラグ特化メトリクス
```bash
#!/bin/bash
# scripts/feature-flag-metrics.sh

echo "📊 フィーチャーフラグシステム専用メトリクス"

# フラグ評価パフォーマンス監視
claude-code --agent performance-auditor \
  "フラグ評価API（/api/evaluate）の応答時間分析。CLAUDE.md記載の100ms以下目標達成状況"

# マルチテナント性能分析
claude-code --agent dynamodb-specialist \
  "マルチテナント環境での1000テナント対応状況分析。DynamoDBパーティション分散とクエリ効率"

# 環境別品質メトリクス
claude-code --agent tdd-quality-checker \
  "local/dev/prod 3環境でのテスト実行状況。環境固有の品質課題とCLAUDE.md DoD達成率"

# CI/CD効率メトリクス
claude-code --agent ci-cd-optimizer \
  "E2Eテスト（Chromium/WebKit/Firefox）実行時間分析。CLAUDE.md記載のFirefox課題改善状況"

echo "✅ 専用メトリクス分析完了"
```

#### ビジネス価値測定
```bash
#!/bin/bash
# scripts/business-value-metrics.sh

echo "💰 ビジネス価値メトリクス測定"

# デプロイ効率向上測定
claude-code --agent gradual-rollout-expert \
  "デプロイとリリース分離（CLAUDE.mdコンセプト）による価値提供速度改善の定量評価"

# 開発効率向上測定
claude-code --agent ci-cd-optimizer \
  "Expert Review自動化・DoD自動チェックによる開発効率向上の定量評価"

# 品質向上によるコスト削減
claude-code --agent tdd-quality-checker \
  "90%テストカバレッジ達成による本番バグ削減効果とコスト影響分析"

# フィーチャーフラグ運用効果
claude-code --agent feature-flag-architect \
  "フィーチャーフラグ活用による機能展開リスク削減とビジネス価値創出効果"

echo "✅ ビジネス価値測定完了"
```

## 🎯 プロジェクト成功のKPI

### 開発効率KPI
- **Expert Review時間**: 4時間 → 30分（87.5%短縮）
- **PR作成からマージ**: 2日 → 4時間（83%短縮）
- **ビルド時間**: 10分 → 3分（70%短縮）

### 品質向上KPI
- **テストカバレッジ**: 継続90%以上維持
- **本番バグ検出**: 月12件 → 月2件（83%削減）
- **アーキテクチャ適合率**: 98%以上維持

### ビジネス価値KPI
- **機能リリース頻度**: 週1回 → 日2回（1400%向上）
- **ロールバック率**: 5% → 0.5%（90%削減）
- **開発者生産性**: 300%向上

---

**プロジェクト統合成功の秘訣**:
1. **CLAUDE.md準拠** - プロジェクト原則の一貫した適用
2. **段階的導入** - Phase毎の着実な機能統合
3. **継続的改善** - メトリクス駆動での最適化
4. **チーム協働** - Expert Review体制との完全統合

フィーチャーフラグシステムに最適化されたSub agentエコシステムで、プロジェクト目標を確実に達成しましょう！ 🚀