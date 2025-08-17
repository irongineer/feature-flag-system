# 🔧 トラブルシューティング

> **⚠️ このドキュメントは現在準備中です**
> 
> フィーチャーフラグシステムのトラブルシューティングガイドを準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [モニタリング](./monitoring.md) - 監視と診断
> - [デプロイメントガイド](./deployment-guide.md) - 基本運用

## 🚨 よくある問題と解決方法

### API接続エラー

```bash
# ヘルスチェック
curl http://localhost:3001/api/health

# サービス状態確認
npm run status
```

### フラグ評価の失敗

```typescript
// エラーハンドリング
try {
  const result = await flagClient.isEnabled('feature', context);
} catch (error) {
  console.error('Flag evaluation failed:', error);
  return false;  // フェイルセーフ値
}
```

### データベース接続問題

```bash
# DynamoDB Local確認
aws dynamodb list-tables --endpoint-url http://localhost:8000

# AWS DynamoDB確認
aws dynamodb describe-table --table-name feature-flags-dev
```

## 🔍 診断ツール

| ツール | 用途 | コマンド |
|--------|------|----------|
| **ヘルスチェック** | サービス状態 | `curl /api/health` |
| **ログ確認** | エラー診断 | `npm run logs` |
| **メトリクス** | パフォーマンス | `npm run metrics` |

## 📚 関連ドキュメント

- [モニタリング](./monitoring.md) - 監視設定
- [デプロイメントガイド](./deployment-guide.md) - 運用手順

## 📞 緊急サポート

緊急時の連絡先：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)
- 🚨 [緊急対応チーム](mailto:emergency@example.com)