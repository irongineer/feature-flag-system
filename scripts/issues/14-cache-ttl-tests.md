# [TECHNICAL DEBT] Fix time-dependent cache TTL tests

**Labels:** `technical-debt`, `testing`

## Technical Debt Description
キャッシュTTL機能のテストが時間依存で不安定になる問題の修正。

## Current Issue
- 4つのTTLテストが時間依存で時々失敗する
- テスト実行時間のばらつきがテスト結果に影響
- CI/CD環境での不安定性

## Impact Analysis
- **Risk Level:** Medium
- **Maintenance Impact:** テストの信頼性低下
- **Development Impact:** 開発者の生産性阻害
- **Business Impact:** 低（機能自体は正常動作）

## Proposed Solution
1. モックタイマー使用（vi.useFakeTimers）
2. 時間制御可能なテスト設計
3. TTL検証の別手法検討

## Effort Estimation
**Story Points:** 2  
**Timeline:** Sprint 3  
**Assignee:** Core team

## Dependencies
- Vitest mock機能の詳細調査
- 既存テストケースの影響調査

## Reference
Technical Debt Log: TD-003

## Success Criteria
- [ ] 全TTLテストが安定して通過
- [ ] テスト実行時間の短縮
- [ ] CI/CDでの信頼性向上