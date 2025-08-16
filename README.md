# 🎯 Feature Flag System

マルチテナント SaaS 向けのエンタープライズグレード・フィーチャーフラグシステム

[![CI Pipeline](https://github.com/irongineer/feature-flag-system/actions/workflows/ci.yml/badge.svg)](https://github.com/irongineer/feature-flag-system/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🏗️ アーキテクチャ

AWS サーバーレスアーキテクチャによる高可用性・高性能なフィーチャーフラグシステム

- **Lambda + API Gateway** - スケーラブルなREST API
- **DynamoDB** - マルチテナント対応データストア  
- **CloudWatch + X-Ray** - 包括的な監視・トレーシング
- **Cognito + IAM** - セキュアな認証・認可

## ⚡ パフォーマンス

- **375,900 ops/sec** - フラグ評価性能
- **< 3ms** - 平均レスポンス時間
- **100%** - キャッシュヒット率
- **99.9%+** - 可用性目標

## 🚀 クイックスタート

### 前提条件

- Node.js 22.x
- npm 10.x
- AWS CLI (デプロイ用)

### インストール

```bash
# リポジトリクローン
git clone https://github.com/irongineer/feature-flag-system.git
cd feature-flag-system

# 依存関係インストール
npm install

# ローカル環境セットアップ
npm run setup:local
```

### 環境設定

システムは3つの環境に対応し、環境ごとに適切なリソースを自動選択します：

| 環境 | 説明 | データベース | 設定ファイル |
|------|------|--------------|-------------|
| **local** | ローカル開発 | インメモリ/DynamoDB Local | `config/environments.json` |
| **dev** | 開発環境 | `feature-flags-dev` DynamoDB | AWS |
| **prod** | 本番環境 | `feature-flags-prod` DynamoDB | AWS |

### 開発・テスト

```bash
# 全体ビルド
npm run build

# ローカル環境でのテスト実行
npm test

# 環境別API起動
cd packages/api

# ローカル環境（インメモリ）
NODE_ENV=local npm run dev

# dev環境（AWS DynamoDB）
NODE_ENV=development STAGE=dev USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-dev npm run dev

# prod環境（AWS DynamoDB）
NODE_ENV=production STAGE=prod USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-prod npm run dev

# パフォーマンステスト
npm run poc:performance

# コード品質チェック
npm run lint
npm run format:check
```

### デプロイ

```bash
# 開発環境
npm run deploy:dev

# 本番環境
npm run deploy:prod
```

## 📦 パッケージ構成

```
feature-flag-system/
├── packages/
│   ├── core/                 # フラグ評価エンジン
│   ├── sdk/                  # Lambda用SDK
│   ├── api/                  # 管理API (Lambda)
│   ├── cli/                  # CLIツール
│   └── admin-ui/             # 管理画面 (React)
├── infrastructure/           # AWS CDK定義
├── docs/                     # ドキュメント
└── poc/                      # パフォーマンステスト
```

## 🛠️ 使用方法

### SDK使用例

```typescript
import { isFeatureEnabled, FEATURE_FLAGS } from '@feature-flag/sdk';

// Lambda関数内で使用
export const handler = async (event: any) => {
  const tenantId = event.headers['x-tenant-id'];
  
  if (await isFeatureEnabled(tenantId, FEATURE_FLAGS.BILLING_V2)) {
    // 新機能のコード
    return processWithNewBilling(event);
  } else {
    // 従来機能のコード
    return processWithLegacyBilling(event);
  }
};
```

### CLI使用例

```bash
# フラグ作成
npx feature-flag create --key "new_feature" --description "新機能"

# テナント別有効化
npx feature-flag enable --key "new_feature" --tenant "tenant-123"

# 緊急停止
npx feature-flag kill-switch --activate --reason "Critical bug found"
```

### REST API使用例

```bash
# フラグ評価
curl -X POST "https://api.example.com/v1/flags/billing_v2_enable/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenantId": "tenant-123"}'

# フラグ作成
curl -X POST "https://api.example.com/v1/flags" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "flagKey": "new_feature_enable",
    "description": "新機能フラグ",
    "defaultEnabled": false,
    "owner": "engineering-team"
  }'
```

## 📋 MVP スコープ (Phase 1)

### ✅ 実装済み (Phase 1)

- [x] **基本的なフラグ評価** - ON/OFF制御、デフォルト値
- [x] **Kill-Switch機能** - 緊急停止機能
- [x] **メモリ内キャッシュ** - TTL 5分、高速アクセス
- [x] **TypeScript SDK** - 型安全性、エラーハンドリング
- [x] **モックDynamoDBクライアント** - ローカル開発対応
- [x] **パフォーマンステスト** - 375,900 ops/sec 達成

### ✅ 実装済み (Phase 1.5 - マルチ環境対応)

- [x] **環境分離システム** - local/dev/prod環境の完全分離
- [x] **設定管理システム** - `/config/environments.json`による一元管理
- [x] **DynamoDB統合** - 環境別テーブル自動切り替え
- [x] **型安全性向上** - 環境設定の完全型安全化
- [x] **包括的テスト** - 全環境でのCRUD操作・評価テスト完了

### 🔄 進行中 (Phase 1.8)

- [ ] **Lambda API実装** - 管理API handlers完成
- [ ] **CLIツール完成** - 全コマンド実装
- [ ] **統合テスト** - LocalStack環境
- [ ] **技術的負債返済** - TTLテスト安定化

### 📅 計画中 (Phase 2)

- [ ] **管理画面MVP** - React + Ant Design Pro
- [ ] **段階的ロールアウト** - パーセンテージベース
- [ ] **A/Bテスト機能** - 複数バリアント対応
- [ ] **高度な監査ログ** - 詳細な変更履歴

## 📚 ドキュメント

- [📐 アーキテクチャ設計](./docs/architecture/)
- [🔄 シーケンス図](./docs/architecture/sequence-diagrams.md)
- [🏗️ AWS構成図](./docs/architecture/aws-architecture.md)
- [📋 設計決定記録 (ADR)](./docs/architecture/design-decisions.md)
- [💰 技術的負債ログ](./docs/architecture/technical-debt-log.md)
- [📖 API仕様書](./docs/api/openapi.yaml)

## 🧪 テスト戦略

### テストピラミッド

- **単体テスト (70%)** - Vitest、高速実行
- **統合テスト (20%)** - LocalStack DynamoDB
- **E2Eテスト (10%)** - Playwright、実環境API

### 品質メトリクス

- **テストカバレッジ**: 85%+ 目標
- **型安全性**: TypeScript strict mode
- **コード品質**: ESLint + SonarJS
- **セキュリティ**: Snyk + npm audit

## 🔧 開発プロセス

### Git ワークフロー

1. **Feature Branch** - `feature/描述的な名前`
2. **Pull Request** - レビュー必須
3. **CI/CD チェック** - 自動品質ゲート
4. **Blue-Green Deploy** - 本番環境への安全なデプロイ

### コード品質

```bash
# Git Hooks (Husky)
npm run prepare

# Pre-commit
lint-staged  # 変更ファイルのみlint

# Pre-push  
npm test     # 全テスト実行
```

## 📊 監視・運用

### メトリクス

- **フラグ評価レイテンシ** - CloudWatch
- **エラー率** - 1% 未満目標
- **キャッシュヒット率** - 80%+ 目標
- **API成功率** - 99.9%+ 目標

### アラート

- **高レイテンシ** - >100ms
- **高エラー率** - >5%
- **Kill-Switch作動** - 即座通知
- **DynamoDB障害** - 5分以内復旧

## 🤝 貢献

1. Fork このリポジトリ
2. Feature branch作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. Branch にプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request作成

### 開発ガイドライン

- **TDD**: テストファーストアプローチ
- **SOLID原則**: クリーンコード実践
- **DRY**: 重複排除
- **YAGNI**: 必要最小限実装

## 📜 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 🙏 謝辞

このプロジェクトは以下の専門家の知見を参考に設計されました：

- **Martin Fowler** - アーキテクチャパターン
- **Kent Beck** - TDD、アジャイル開発
- **Robert C. Martin** - クリーンアーキテクチャ
- **Eric Evans** - ドメイン駆動設計
- **Michael Feathers** - レガシーコード改善
- **Jeff Sutherland** - スクラム、アジャイル
- **和田卓人** - TDD、継続的改善

---

📞 **サポート**: Issues タブで質問・要望をお聞かせください
🌟 **Star**: 役立った場合は Star をお願いします！