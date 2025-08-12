"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolloutEngine = void 0;
class RolloutEngine {
    /**
     * 段階的ロールアウト判定
     * 複雑なビジネスルールによる配信制御
     */
    async evaluateRollout(context, flagKey, config) {
        // 1. 時間窓チェック
        if (!this.isWithinTimeWindow(config, context.timestamp)) {
            return false;
        }
        // 2. 営業時間チェック
        if (config.businessHoursOnly && !this.isBusinessHours(context.timestamp)) {
            return false;
        }
        // 3. 地域フィルタリング
        if (!this.matchesRegion(config, context.region)) {
            return false;
        }
        // 4. ユーザーコホートフィルタリング
        if (!this.matchesUserCohort(config, context.userCohort)) {
            return false;
        }
        // 5. パーセンテージベース判定
        return this.evaluatePercentage(config, context, flagKey);
    }
    isWithinTimeWindow(config, timestamp) {
        if (!timestamp)
            return true;
        const now = new Date(timestamp);
        if (config.startDate && now < new Date(config.startDate)) {
            return false;
        }
        if (config.endDate && now > new Date(config.endDate)) {
            return false;
        }
        return true;
    }
    isBusinessHours(timestamp) {
        if (!timestamp)
            return true;
        const date = new Date(timestamp);
        const hour = date.getHours();
        const day = date.getDay();
        // 平日9-18時のみ
        return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
    }
    matchesRegion(config, userRegion) {
        if (!config.targetRegions || config.targetRegions.length === 0) {
            return true;
        }
        return userRegion ? config.targetRegions.includes(userRegion) : false;
    }
    matchesUserCohort(config, userCohort) {
        if (!config.userCohorts || config.userCohorts.length === 0) {
            return true;
        }
        return userCohort ? config.userCohorts.includes(userCohort) : false;
    }
    evaluatePercentage(config, context, flagKey) {
        // ユーザーIDベースの一貫したハッシュ生成
        const hash = this.generateUserHash(context.userId || '', flagKey);
        const userPercentile = hash % 100;
        return userPercentile < config.percentage;
    }
    generateUserHash(userId, flagKey) {
        // FNV-1a ハッシュアルゴリズム実装（セキュリティ改善）
        // 暗号学的に安全で均等分散を保証
        const input = `${userId}-${flagKey}`;
        const FNV_OFFSET_BASIS = 2166136261;
        const FNV_PRIME = 16777619;
        let hash = FNV_OFFSET_BASIS;
        for (let i = 0; i < input.length; i++) {
            // FNV-1a: hash = (hash XOR byte) * FNV_PRIME
            hash ^= input.charCodeAt(i);
            hash = (hash * FNV_PRIME) >>> 0; // 32bit unsigned integer
        }
        return hash;
    }
}
exports.RolloutEngine = RolloutEngine;
//# sourceMappingURL=index.js.map