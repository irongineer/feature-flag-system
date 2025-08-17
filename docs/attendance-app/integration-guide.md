# 🔗 勤怠アプリ統合ガイド

> **⚠️ このドキュメントは現在準備中です**
> 
> 勤怠管理アプリとフィーチャーフラグシステムの統合ガイドを準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [開発者統合ガイド](../developers/examples/README.md) - 基本的な統合方法
> - [API仕様](../developers/api-reference.md) - API詳細

## 🎯 基本的な統合例

### React コンポーネントでの使用

```tsx
import React from 'react';
import { useFeatureFlag } from './hooks/useFeatureFlag';

const AttendanceApp = () => {
  const { isEnabled } = useFeatureFlag('new-attendance-ui', {
    tenantId: 'company-123'
  });

  return (
    <div>
      {isEnabled ? (
        <NewAttendanceInterface />
      ) : (
        <LegacyAttendanceInterface />
      )}
    </div>
  );
};
```

### 環境別設定

```typescript
// config/feature-flags.ts
export const featureFlagConfig = {
  local: {
    apiUrl: 'http://localhost:3001/api'
  },
  dev: {
    apiUrl: 'https://dev-api.feature-flags.example.com/api'
  },
  prod: {
    apiUrl: 'https://api.feature-flags.example.com/api'
  }
};
```

## 🚀 実装手順

1. **フィーチャーフラグクライアント初期化**
2. **コンポーネントでのフラグ評価**
3. **条件分岐による機能切り替え**
4. **エラーハンドリング実装**

## 📚 関連ドキュメント

- [開発者統合ガイド](../developers/examples/README.md) - 詳細な実装例
- [API仕様](../developers/api-reference.md) - API詳細情報

## 📞 サポート

統合についてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)