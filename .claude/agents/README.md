# 📂 フィーチャーフラグシステム専用 Sub Agents

## 🎯 概要

本プロジェクト専用のClaude Code Sub agentsコレクション。1Issue1PR原則とExpert Review体制に最適化された専門AIアシスタント群。

## 🏗️ ディレクトリ構造

```
.claude/agents/
├── README.md                    # このファイル
├── expert-review/               # Expert Review観点別
│   ├── ddd-reviewer.md         # Eric Evans (DDD観点)
│   ├── architecture-reviewer.md # Martin Fowler (アーキテクチャ観点)
│   └── tdd-quality-checker.md  # 和田卓人 (品質・TDD観点)
├── domain-specialists/          # ドメイン専門
│   ├── feature-flag-architect.md # フィーチャーフラグ専門
│   ├── dynamodb-specialist.md   # DynamoDB設計・最適化
│   └── react-typescript-expert.md # React + TypeScript専門
├── development-lifecycle/       # 開発ライフサイクル
│   ├── requirements-analyst.md  # 要件分析
│   ├── task-decomposer.md      # タスク分解
│   ├── implementation-guide.md  # 実装ガイド
│   └── testing-specialist.md   # テスト専門
├── phase2-expansion/           # Phase 2拡張機能専門
│   ├── ab-testing-implementer.md # A/Bテスト機能
│   ├── gradual-rollout-expert.md # 段階的ロールアウト
│   └── metrics-specialist.md    # メトリクス・分析
└── automation-quality/        # 自動化・品質保証
    ├── ci-cd-optimizer.md      # CI/CD最適化
    ├── performance-auditor.md  # パフォーマンス監査
    └── security-scanner.md     # セキュリティ監査
```

## 🎭 Expert Review観点別Sub Agent

### Eric Evans (DDD観点)
- **境界コンテキスト**の明確化
- **ユビキタス言語**の一貫性チェック
- **ドメインモデル**の適切性検証

### Martin Fowler (アーキテクチャ観点)
- **レイヤードアーキテクチャ**準拠検証
- **責務分離**の適切性評価
- **拡張性・保守性**の考慮

### 和田卓人 (品質・TDD観点)
- **Red-Green-Refactor**サイクル実践支援
- **テストカバレッジ90%**達成チェック
- **リファクタリング品質**評価

## 🚀 使用方法

### 自動呼び出し
Claude Codeが文脈に応じて適切なSub agentを自動選択

### 明示的呼び出し
```bash
> Use the ddd-reviewer subagent to review this domain model
> Use the feature-flag-architect to design the A/B testing feature
> Use the tdd-quality-checker to ensure 90% test coverage
```

## 📋 Sub Agent作成原則

### 1. 単一責任の原則
- 1つのSub agentは1つの専門領域に特化
- 重複する責務の回避

### 2. 明確な役割定義
- 具体的な専門分野の明示
- 期待される成果物の定義

### 3. プロジェクト整合性
- 1Issue1PR原則への準拠
- DoD (Definition of Done) 基準の適用

## 🎯 品質基準

### Definition of Done対応
- [ ] 機能実装完了
- [ ] テストカバレッジ90%以上
- [ ] TypeScript型安全性100%
- [ ] E2Eテスト通過
- [ ] Expert Review完了（2名以上）
- [ ] CI/CD全チェック通過
- [ ] ドキュメント更新

### Expert Review自動化
各Sub agentがExpert Review観点を事前チェックし、品質向上を支援

---

**作成日**: 2025-01-17  
**プロジェクト**: フィーチャーフラグシステム  
**ステータス**: Phase 1.5完了 → Phase 2拡張機能開発対応