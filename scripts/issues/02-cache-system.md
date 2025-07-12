# [TASK] TTL-based Caching System Implementation

**Labels:** `task`, `cache`, `performance`, `completed`

## Task Description
高性能なTTLベースキャッシュシステムの実装。メモリ効率化とパフォーマンス最適化を実現。

## Implementation Details
- FeatureFlagCache クラスの実装 (`packages/core/src/cache/index.ts`)
- TTL（Time To Live）機能
- 自動クリーンアップ機能
- メモリ効率的な実装

## Acceptance Criteria
- [x] TTLベースの期限管理
- [x] 自動期限切れアイテム削除
- [x] メモリ効率的な実装
- [x] 高速アクセス性能

## Dependencies
なし（独立したコンポーネント）

## Notes
Technical Debt TD-003として時間依存テストの改善が必要。MVP段階では許容される範囲内。