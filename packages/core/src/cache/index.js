"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagCache = void 0;
class FeatureFlagCache {
    cache;
    defaultTtl;
    constructor(options = {}) {
        this.cache = new Map();
        this.defaultTtl = options.ttl || 300; // 5分
    }
    get(tenantId, flagKey) {
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
    set(tenantId, flagKey, value, ttl) {
        const key = this.createKey(tenantId, flagKey);
        const entry = {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.defaultTtl,
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
            return Date.now() > entry.timestamp + entry.ttl * 1000;
        }
        return false;
    }
    size() {
        return this.cache.size;
    }
    createKey(tenantId, flagKey) {
        return `${tenantId}:${flagKey}`;
    }
}
exports.FeatureFlagCache = FeatureFlagCache;
//# sourceMappingURL=index.js.map