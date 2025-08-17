# 📋 レビュー対応ガイド - DoD準拠プロセス

## 🎯 概要

PR提出・更新後のレビュー確認とDoD達成を必須化した開発プロセスガイドです。  
全ての開発者は、マージ前に必ず以下のプロセスを完了する必要があります。

## 🔄 レビュー対応フロー

### 1. PR提出・更新後の自動プロセス

```bash
# PR作成・更新時に自動実行される処理
┌─ PR Created/Updated ─┐
│                      │
├─ Claude Code Review  ── 自動レビュー実行
├─ DoD Verification CI ── 6項目自動チェック  
├─ CI/CD Pipeline     ── lint・test・build
└─ Branch Protection  ── マージブロック設定
```

### 2. 開発者の必須対応手順

#### Step 1: Claude Code レビュー確認 (必須)
```bash
# 1. PR画面でClaude Codeレビューを確認
gh pr view <PR-NUMBER> --comments

# 2. レビューステータス確認
# - ✅ Approved: そのまま進行
# - 🔄 Commented: 指摘事項を確認・対応検討
# - ❌ Changes Requested: 必須修正事項あり
```

#### Step 2: 指摘事項の分類・対応 (必須)
```bash
# Critical Issues (即座修正必須)
- セキュリティ脆弱性
- 型安全性違反  
- パフォーマンス重大問題
- アーキテクチャ違反

# High Priority (次Push前修正必須)
- テストカバレッジ不足
- ドキュメント不整合
- コード品質問題
- 命名規則違反

# Medium/Low Priority (計画的改善)
- リファクタリング提案
- 最適化案
- 拡張性改善提案
```

#### Step 3: DoD Compliance Report確認 (必須)
```bash
# PR画面の「DoD Compliance Report」コメントを確認
📋 Definition of Done (DoD) Compliance Report
DoD達成率: XX% (Y/6)

✅/❌ 機能実装完了
✅/❌ テストカバレッジ90%以上  
✅/❌ TypeScript型安全性100%
✅/❌ E2Eテスト通過
✅/❌ Expert Review完了
✅/❌ CI/CD全チェック通過

# 100%達成まで対応継続
```

#### Step 4: 修正実装・Push (必須)
```bash
# 指摘事項対応実装
git add .
git commit -m "fix: Claude Code指摘事項対応"
git push

# → 自動で再検証実行
# → DoD Compliance Report自動更新
```

### 3. マージ実行条件チェック

#### 🟢 マージ可能条件
- ✅ DoD Verification CI: 通過
- ✅ Claude Code Review: Approved (変更要求なし)
- ✅ DoD達成率: 100%
- ✅ 全必須CIチェック: 通過
- ✅ Branch Protection Rules: 満足

#### 🔴 マージブロック条件
- ❌ DoD Verification CI: 失敗
- ❌ Claude Code Review: Changes Requested
- ❌ DoD達成率: 100%未満
- ❌ 必須CIチェック: 失敗
- ❌ テストカバレッジ: 90%未満

## 📋 レビュー対応チェックリスト

### Claude Code Expert Review対応
- [ ] **レビューコメント全確認** - 見落としなく全て確認
- [ ] **Critical Issues即座対応** - セキュリティ・型安全性等
- [ ] **High Priority対応** - テスト・ドキュメント等
- [ ] **対応完了Push** - 修正をコミット・プッシュ
- [ ] **再レビュー確認** - 変更要求が解消されたか確認

### DoD Verification対応
- [ ] **6項目全確認** - 機能・テスト・型・E2E・レビュー・CI
- [ ] **未達成項目特定** - 具体的な修正箇所特定
- [ ] **修正実装完了** - 全DoD要件満足まで対応
- [ ] **100%達成確認** - DoD Compliance Report確認
- [ ] **継続監視** - 新しい変更でDoD維持

### 最終マージ前確認
- [ ] **全自動チェック通過** - CI・CD・DoD検証
- [ ] **Expert Review承認** - Claude Code + Human Review
- [ ] **影響範囲確認** - 他機能への悪影響なし
- [ ] **ロールバック準備** - 問題時の切り戻し手順確認

## ⚡ 効率的な対応のコツ

### レビュー指摘の迅速対応
```bash
# 1. 指摘事項をIssueとして管理
gh issue create --title "レビュー指摘事項対応 - PR #86"

# 2. Sub agentを活用した対応
claude-code --agent ddd-reviewer "指摘事項の具体的修正方法提案"
claude-code --agent architecture-reviewer "アーキテクチャ違反の修正案"

# 3. 修正後の事前確認
npm run lint && npm run typecheck && npm test
```

### DoD未達成項目の体系的対応
```bash
# テストカバレッジ向上
npm run test:coverage
# → 不足箇所特定 → テスト追加

# 型安全性100%達成  
npx tsc --noEmit --strict
# → エラー箇所特定 → 型定義修正

# E2Eテスト通過
npm run test:e2e
# → 失敗箇所特定 → 実装修正
```

## 🚨 緊急時の対応

### Critical Issues発見時
1. **即座修正**: セキュリティ・性能重大問題
2. **ホットフィックス**: 別ブランチで緊急対応
3. **影響調査**: 既存コードへの波及調査
4. **再検証**: 修正後の包括的テスト

### DoD要件を満たせない場合
1. **要件見直し**: Product Owner・Tech Leadと相談
2. **分割実装**: 機能を分けて段階的実装
3. **技術的負債**: 明示的な負債として記録・計画
4. **例外承認**: 明確な理由と期限での例外承認

---

**このガイドに従い、品質を妥協することなく効率的な開発プロセスを実現しましょう！** 🚀