import { CacheEntry, FeatureFlagKey } from '../models';

export class FeatureFlagCache {
  private cache: Map<string, CacheEntry>;
  private defaultTtl: number;

  constructor(options: { ttl?: number } = {}) {
    this.cache = new Map();
    this.defaultTtl = options.ttl || 300; // 5分
  }

  get(tenantId: string, flagKey: FeatureFlagKey): boolean | undefined {
    const key = this.createKey(tenantId, flagKey);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // TTL チェック
    if (Date.now() > entry.timestamp + entry.ttl * 1000) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(tenantId: string, flagKey: FeatureFlagKey, value: boolean, ttl?: number): void {
    const key = this.createKey(tenantId, flagKey);
    const effectiveTtl = ttl !== undefined ? ttl : this.defaultTtl;
    
    // TTLが0以下の場合は即座に期限切れとして扱う
    if (effectiveTtl <= 0) {
      return;
    }
    
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: effectiveTtl,
    };
    
    this.cache.set(key, entry);
  }

  invalidate(tenantId: string, flagKey: FeatureFlagKey): void {
    const key = this.createKey(tenantId, flagKey);
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  isExpired(): boolean {
    // 簡易実装: 最初のエントリが期限切れかチェック
    for (const [, entry] of this.cache) {
      return Date.now() > entry.timestamp + entry.ttl * 1000;
    }
    return false;
  }

  size(): number {
    // 期限切れのエントリをクリーンアップしてからサイズを返す
    this.cleanup();
    return this.cache.size;
  }

  keys(): string[] {
    this.cleanup();
    return Array.from(this.cache.keys());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }

  private createKey(tenantId: string, flagKey: FeatureFlagKey): string {
    return `${tenantId}:${flagKey}`;
  }
}