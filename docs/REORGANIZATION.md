# ドキュメント構造整理計画

## 現状の問題

1. **役割の重複**: `operators` と `system-operators` の区別が不明確
2. **内容の重複**: 環境管理が複数のドキュメントに分散
3. **ナビゲーションの複雑さ**: 読み手が適切なドキュメントを見つけにくい

## 新しい構造提案

### 📁 統合後の構造

```
docs/
├── README.md                    # ドキュメント全体の目次
├── quickstart/                  # 新規ユーザー向け
│   ├── README.md
│   ├── developers.md
│   └── operators.md
├── developers/                  # アプリケーション開発者
│   ├── README.md
│   ├── environment-switching.md
│   └── ...
├── operators/                   # アプリケーション運用者 (統合後)
│   ├── README.md
│   ├── system-management.md     # 旧system-operators内容を統合
│   └── ...
├── environments/               # 環境設定（共通）
│   └── README.md
├── runbooks/                   # 運用手順書（共通）
│   ├── environment-management.md
│   └── ...
├── api/                        # API仕様
├── architecture/               # アーキテクチャ設計
└── reference/                  # リファレンス資料
```

### 🔄 統合計画

1. **`system-operators/` → `operators/`** に統合
2. **`system-developers/` → `developers/`** に統合  
3. **環境関連ドキュメント** を `environments/` と `runbooks/` に集約
4. **役割別アクセス** を明確化

## 読み手別のドキュメントマッピング

| 読み手 | 主要ドキュメント | 補助ドキュメント |
|-------|-----------------|-----------------|
| **新規ユーザー** | `quickstart/` | `README.md` |
| **アプリ開発者** | `developers/` | `environments/`, `api/` |
| **運用者** | `operators/` | `runbooks/`, `environments/` |
| **システム管理者** | `operators/system-management.md` | `architecture/` |
| **QA・テスター** | `qa/` | `developers/`, `runbooks/` |

## 実装手順

1. ✅ 環境対応ドキュメントの作成・更新完了
2. 🔄 役割別ドキュメントの統合
3. ⏳ 重複コンテンツの整理
4. ⏳ ナビゲーション改善
5. ⏳ 旧ファイルの削除・リダイレクト設定