import { CacheEntry } from '../models';

export interface TimeProvider {
  now(): number;
}

export class RealTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }
}

export class MockTimeProvider implements TimeProvider {
  private currentTime = 0;

  now(): number {
    return this.currentTime;
  }

  setTime(time: number): void {
    this.currentTime = time;
  }

  advanceTime(milliseconds: number): void {
    this.currentTime += milliseconds;
  }
}

export class FeatureFlagCache {
  private cache: Map<string, CacheEntry>;
  private defaultTtl: number;
  private timeProvider: TimeProvider;

  constructor(options: { ttl?: number; timeProvider?: TimeProvider } = {}) {
    this.cache = new Map();
    // 正しいデフォルトTTL設定: options.ttlがundefinedでない場合は値を使用、そうでなければ300000
    this.defaultTtl = options.ttl !== undefined ? options.ttl : 300000; // 5分 (300秒 * 1000ms)
    this.timeProvider = options.timeProvider || new RealTimeProvider();
  }

  get(tenantId: string, flagKey: string): boolean | undefined {
    const key = this.createKey(tenantId, flagKey);
    const entry = this.cache.get(key);
    
    if (!entry) {
      // アクセス時にクリーンアップを実行
      this.cleanup();
      return undefined;
    }
    
    // TTL チェック: 現在時刻がエントリの期限切れ時刻を過ぎているかチェック
    const currentTime = this.timeProvider.now();
    const expirationTime = entry.timestamp + entry.ttl;
    if (currentTime > expirationTime) {
      this.cache.delete(key);
      // 期限切れを発見したときに全体的なクリーンアップを実行
      this.cleanup();
      return undefined;
    }
    
    return entry.value;
  }

  set(tenantId: string, flagKey: string, value: boolean, ttl?: number): void {
    const key = this.createKey(tenantId, flagKey);
    const effectiveTtl = ttl !== undefined ? ttl : this.defaultTtl;
    
    // TTLが0以下の場合は保存しない（即座に期限切れ扱い）
    if (effectiveTtl <= 0) {
      return;
    }
    
    const entry: CacheEntry = {
      value,
      timestamp: this.timeProvider.now(),
      ttl: effectiveTtl,
    };
    
    this.cache.set(key, entry);
  }

  invalidate(tenantId: string, flagKey: string): void {
    const key = this.createKey(tenantId, flagKey);
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  isExpired(): boolean {
    // 簡易実装: 最初のエントリが期限切れかチェック
    for (const [, entry] of this.cache) {
      return this.timeProvider.now() > entry.timestamp + entry.ttl;
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
    const now = this.timeProvider.now();
    const keysToDelete: string[] = [];
    
    // 期限切れのキーを収集
    for (const [key, entry] of this.cache.entries()) {
      const expirationTime = entry.timestamp + entry.ttl;
      if (now > expirationTime) {
        keysToDelete.push(key);
      }
    }
    
    // 期限切れのエントリを削除
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private createKey(tenantId: string, flagKey: string): string {
    return `${tenantId}:${flagKey}`;
  }
}