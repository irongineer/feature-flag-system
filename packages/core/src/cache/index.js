"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagCache = exports.MockTimeProvider = exports.RealTimeProvider = void 0;
class RealTimeProvider {
    now() {
        return Date.now();
    }
}
exports.RealTimeProvider = RealTimeProvider;
class MockTimeProvider {
    currentTime = 0;
    now() {
        return this.currentTime;
    }
    setTime(time) {
        this.currentTime = time;
    }
    advanceTime(milliseconds) {
        this.currentTime += milliseconds;
    }
}
exports.MockTimeProvider = MockTimeProvider;
class FeatureFlagCache {
    cache;
    defaultTtl;
    timeProvider;
    constructor(options = {}) {
        this.cache = new Map();
        // 正しいデフォルトTTL設定: options.ttlがundefinedでない場合は値を使用、そうでなければ300000
        this.defaultTtl = options.ttl !== undefined ? options.ttl : 300000; // 5分 (300秒 * 1000ms)
        this.timeProvider = options.timeProvider || new RealTimeProvider();
    }
    get(tenantId, flagKey) {
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
    set(tenantId, flagKey, value, ttl) {
        const key = this.createKey(tenantId, flagKey);
        const effectiveTtl = ttl !== undefined ? ttl : this.defaultTtl;
        // TTLが0以下の場合は保存しない（即座に期限切れ扱い）
        if (effectiveTtl <= 0) {
            return;
        }
        const entry = {
            value,
            timestamp: this.timeProvider.now(),
            ttl: effectiveTtl,
        };
        this.cache.set(key, entry);
    }
    invalidate(tenantId, flagKey) {
        const key = this.createKey(tenantId, flagKey);
        this.cache.delete(key);
    }
    invalidateAll() {
        this.cache.clear();
    }
    isExpired() {
        // 簡易実装: 最初のエントリが期限切れかチェック
        for (const [, entry] of this.cache) {
            return this.timeProvider.now() > entry.timestamp + entry.ttl;
        }
        return false;
    }
    size() {
        // 期限切れのエントリをクリーンアップしてからサイズを返す
        this.cleanup();
        return this.cache.size;
    }
    keys() {
        this.cleanup();
        return Array.from(this.cache.keys());
    }
    cleanup() {
        const now = this.timeProvider.now();
        const keysToDelete = [];
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
    createKey(tenantId, flagKey) {
        return `${tenantId}:${flagKey}`;
    }
}
exports.FeatureFlagCache = FeatureFlagCache;
//# sourceMappingURL=index.js.map