# 🔒 GitHub Branch Protection Rules設定ガイド

## 📋 概要

DoD準拠の開発プロセスを強制するためのBranch Protection Rules設定案です。  
**mainブランチへの直接pushを防ぎ、全てのマージでDoD達成を必須化**します。

## ⚙️ 設定手順

### 1. GitHub Repository Settings

```bash
# GitHub Web UIでの設定
1. Repository → Settings → Branches
2. "Add rule" をクリック
3. Branch name pattern: "main"
4. 以下の設定を適用
```

### 2. 必須設定項目

#### 📋 General Settings
```yaml
Branch name pattern: main
☑️ Restrict pushes that create files over 100MB
☑️ Restrict creation of branches matching this pattern
☑️ Restrict deletion of this branch
```

#### 🔒 Pull Request Settings
```yaml
☑️ Require a pull request before merging
  ☑️ Require approvals: 1 (minimum)
  ☑️ Dismiss stale reviews when new commits are pushed
  ☑️ Require review from code owners (if CODEOWNERS exists)
  ☑️ Restrict who can approve pull requests
  ☑️ Allow specified actors to bypass required pull requests: ❌
```

#### ✅ Status Check Settings (重要)
```yaml
☑️ Require status checks to pass before merging
  ☑️ Require branches to be up to date before merging
  
  Required status checks:
  ☑️ DoD Compliance Check (dod-verification / dod-verification)
  ☑️ Claude Code Review (claude-review / claude-review)  
  ☑️ Unit Tests (api) (ci / Unit Tests (api))
  ☑️ Unit Tests (core) (ci / Unit Tests (core))
  ☑️ Unit Tests (cli) (ci / Unit Tests (cli))
  ☑️ Unit Tests (sdk) (ci / Unit Tests (sdk))
  ☑️ Code Quality Checks (ci / Code Quality Checks)
  ☑️ Security Audit (ci / Security Audit)
  ☑️ Performance Tests (ci / Performance Tests)
  ☑️ CDK Validation (ci / CDK Validation)
```

#### 🚨 Additional Restrictions
```yaml
☑️ Require conversation resolution before merging
☑️ Require signed commits
☑️ Require linear history
☑️ Include administrators (管理者にも適用)
☑️ Allow force pushes: ❌
☑️ Allow deletions: ❌
```

## 🛠️ CLI設定方法 (自動化)

### GitHub CLI使用
```bash
# Repository設定確認
gh repo view --json defaultBranchRef,protectionRules

# Branch Protection設定
gh api repos/irongineer/feature-flag-system/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["DoD Compliance Check","Claude Code Review","Unit Tests (api)","Unit Tests (core)","Unit Tests (cli)","Unit Tests (sdk)","Code Quality Checks","Security Audit","Performance Tests","CDK Validation"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_linear_history=true \
  --field required_conversation_resolution=true
```

### 設定検証スクリプト
```bash
#!/bin/bash
# branch-protection-verify.sh

echo "🔍 Branch Protection Rules検証中..."

# 現在の設定取得
PROTECTION=$(gh api repos/irongineer/feature-flag-system/branches/main/protection)

# 必須チェック項目
REQUIRED_CHECKS=$(echo $PROTECTION | jq -r '.required_status_checks.contexts[]')
PR_REQUIRED=$(echo $PROTECTION | jq -r '.required_pull_request_reviews.required_approving_review_count')
FORCE_PUSH=$(echo $PROTECTION | jq -r '.allow_force_pushes.enabled')

echo "📋 必須ステータスチェック:"
echo "$REQUIRED_CHECKS"
echo ""
echo "🔍 PR承認要求数: $PR_REQUIRED"
echo "🚨 Force Push許可: $FORCE_PUSH"

# DoD Verification存在確認
if echo "$REQUIRED_CHECKS" | grep -q "DoD Compliance Check"; then
    echo "✅ DoD Verification設定済み"
else
    echo "❌ DoD Verification未設定"
fi

# Claude Code Review存在確認
if echo "$REQUIRED_CHECKS" | grep -q "Claude Code Review"; then
    echo "✅ Claude Code Review設定済み"
else
    echo "❌ Claude Code Review未設定"
fi
```

## 📊 設定効果

### 🔒 マージブロック効果
以下の場合、**自動的にマージがブロック**されます：

#### DoD未達成時
- ❌ DoD Verification CI失敗
- ❌ テストカバレッジ90%未満
- ❌ TypeScript型エラー存在
- ❌ E2Eテスト失敗

#### レビュー未完了時
- ❌ Claude Code Review変更要求中
- ❌ PR承認者不足
- ❌ Conversation未解決

#### CI/CD未通過時
- ❌ Unit Tests失敗
- ❌ Security Audit失敗  
- ❌ Performance Tests失敗
- ❌ Code Quality Issues存在

### ⚡ 開発フロー改善効果

#### Before (設定前)
```bash
❌ 直接mainへpush可能
❌ レビューなしマージ可能
❌ DoD未達成でもマージ可能
❌ 品質ゲートなし
```

#### After (設定後)
```bash
✅ PR経由のみマージ可能
✅ 必須レビュー・承認確保
✅ DoD 100%達成必須
✅ 包括的品質ゲート
```

## 🚨 緊急時対応

### ホットフィックス手順
```bash
# 1. 緊急修正ブランチ作成
git checkout -b hotfix/critical-security-fix

# 2. 修正実装
# ... 修正作業 ...

# 3. 最小限DoD対応
npm test              # 最低限のテスト確保
npm run lint          # コード品質確保
npm run typecheck     # 型安全性確保

# 4. Emergency PR作成
gh pr create --title "🚨 HOTFIX: Critical security fix" \
  --body "緊急修正: [詳細説明]"

# 5. 管理者承認でマージ
# (Branch Protection Rule例外適用)
```

### 設定変更時の注意
```bash
# Branch Protection Rule変更時は事前通知必須
1. 開発チーム全体への事前通知 (1週間前)
2. 変更理由・影響範囲の明確化
3. 段階的適用・検証期間設定
4. ロールバック計画準備
```

## 📈 運用監視

### 定期確認項目
```bash
# 週次確認
- Branch Protection Rule維持状況
- 必須ステータスチェック動作状況
- DoD達成率推移
- マージブロック発生状況

# 月次レビュー
- 設定効果測定
- 開発効率への影響評価
- 品質改善効果測定
- 必要に応じた設定調整
```

---

**Branch Protection Rulesにより、妥協なき品質確保と効率的な開発プロセスを両立しましょう！** 🔒