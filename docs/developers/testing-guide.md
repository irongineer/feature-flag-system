# 🧪 テストガイド

> **⚠️ このドキュメントは現在準備中です**
> 
> フィーチャーフラグのテスト戦略とベストプラクティスを準備中です。完全版は近日公開予定です。
> 
> **現在利用可能な代替案：**
> - [実装サンプル](./examples/README.md) - テスト例を含む
> - [クイックスタート](./quickstart.md) - 基本的なテスト確認方法

## 🎯 基本的なテスト例

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('フィーチャーフラグテスト', () => {
  it('フラグが有効な場合のテスト', async () => {
    const mockClient = {
      isEnabled: vi.fn().mockResolvedValue(true)
    };
    
    const result = await mockClient.isEnabled('test-flag', {
      tenantId: 'test-tenant'
    });
    
    expect(result).toBe(true);
  });
});
```

## 📚 関連ドキュメント

- [実装サンプル](./examples/README.md) - 詳細なテスト例

## 📞 サポート

テストについてご質問がある場合：
- 📧 [GitHub Issues](https://github.com/your-org/feature-flag-system/issues)