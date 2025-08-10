"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABTestAnalytics = exports.ABTestEngine = void 0;
class ABTestEngine {
    /**
     * A/Bテストバリアント選択
     * 一貫したユーザー体験を保証するハッシュベース分散
     */
    async assignVariant(context, flagKey, testConfig) {
        // 1. テストのアクティブ状態確認
        if (!testConfig.isActive) {
            return this.getControlVariant(testConfig);
        }
        // 2. 時間窓チェック
        if (!this.isWithinTestPeriod(testConfig, new Date().toISOString())) {
            return this.getControlVariant(testConfig);
        }
        // 3. トラフィック配分チェック
        if (!this.isInTrafficAllocation(context, flagKey, testConfig.trafficAllocation)) {
            return this.getControlVariant(testConfig);
        }
        // 4. セグメントターゲティング
        if (!this.matchesTargetSegment(context, testConfig.targetSegments)) {
            return this.getControlVariant(testConfig);
        }
        // 5. バリアント選択（一貫したハッシュベース）
        const selectedVariant = this.selectVariant(context, flagKey, testConfig);
        return {
            testId: testConfig.testId,
            variantId: selectedVariant.id,
            variantName: selectedVariant.name,
            config: selectedVariant.config,
            isControl: selectedVariant.id === 'control',
            timestamp: new Date().toISOString()
        };
    }
    /**
     * 複数A/Bテストの同時実行対応
     * テスト間の干渉を避けた配信制御
     */
    async assignMultipleVariants(context, experiments) {
        const results = [];
        // 実験間の独立性を保証
        for (const { flagKey, testConfig } of experiments) {
            const result = await this.assignVariant(context, flagKey, testConfig);
            results.push(result);
            // 次の実験のコンテキストに前の結果を反映
            context.previousVariants = {
                ...context.previousVariants,
                [flagKey]: result.variantId
            };
        }
        return results;
    }
    /**
     * コンバージョン追跡
     * A/Bテストの効果測定
     */
    async trackConversion(testId, variantId, userId, conversionValue, metadata) {
        // コンバージョンイベントの記録
        // 実際の実装では分析システムに送信
        const conversionEvent = {
            testId,
            variantId,
            userId,
            conversionValue,
            metadata,
            timestamp: new Date().toISOString()
        };
        // デバッグログ（実際の実装では分析システムに送信）
        console.debug('A/B Test Conversion:', conversionEvent);
    }
    isWithinTestPeriod(config, timestamp) {
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
    isInTrafficAllocation(context, flagKey, trafficAllocation) {
        if (trafficAllocation >= 100)
            return true;
        if (trafficAllocation <= 0)
            return false;
        const hash = this.generateUserHash(context.userId || '', `${flagKey}-traffic`);
        const userPercentile = hash % 100;
        return userPercentile < trafficAllocation;
    }
    matchesTargetSegment(context, targetSegments) {
        if (!targetSegments || targetSegments.length === 0) {
            return true;
        }
        // ユーザーセグメント情報から判定
        const userSegments = context.metadata?.segments || [];
        return targetSegments.some(segment => userSegments.includes(segment));
    }
    selectVariant(context, flagKey, testConfig) {
        const hash = this.generateUserHash(context.userId || '', `${flagKey}-${testConfig.testId}`);
        const totalWeight = testConfig.variants.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight === 0) {
            return this.getControlVariantFromConfig(testConfig);
        }
        const target = hash % totalWeight;
        let currentWeight = 0;
        for (const variant of testConfig.variants) {
            currentWeight += variant.weight;
            if (target < currentWeight) {
                return variant;
            }
        }
        // フォールバック: 最初のバリアント
        return testConfig.variants[0] || this.getControlVariantFromConfig(testConfig);
    }
    getControlVariant(testConfig) {
        const controlVariant = this.getControlVariantFromConfig(testConfig);
        return {
            testId: testConfig.testId,
            variantId: controlVariant.id,
            variantName: controlVariant.name,
            config: controlVariant.config,
            isControl: true,
            timestamp: new Date().toISOString()
        };
    }
    getControlVariantFromConfig(testConfig) {
        // コントロールバリアントを探す
        const controlVariant = testConfig.variants.find(v => v.id === 'control');
        if (controlVariant)
            return controlVariant;
        // コントロールがない場合は最初のバリアント
        if (testConfig.variants.length > 0)
            return testConfig.variants[0];
        // デフォルトコントロール
        return {
            id: 'control',
            name: 'Control',
            weight: 100,
            config: {}
        };
    }
    generateUserHash(userId, seed) {
        // FNV-1a ハッシュアルゴリズム（RolloutEngineと同じ）
        const input = `${userId}-${seed}`;
        const FNV_OFFSET_BASIS = 2166136261;
        const FNV_PRIME = 16777619;
        let hash = FNV_OFFSET_BASIS;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = (hash * FNV_PRIME) >>> 0;
        }
        return hash;
    }
}
exports.ABTestEngine = ABTestEngine;
/**
 * A/Bテスト統計分析ヘルパー
 */
class ABTestAnalytics {
    /**
     * 統計的有意性の計算
     */
    calculateSignificance(controlMetrics, variantMetrics, confidenceLevel = 0.95) {
        // 簡易的な統計計算（実際の実装では専門的な統計ライブラリを使用）
        const controlRate = controlMetrics.conversionRate;
        const variantRate = variantMetrics.conversionRate;
        const improvement = ((variantRate - controlRate) / controlRate) * 100;
        // プレースホルダー実装（実際の統計計算は専門ライブラリが必要）
        return {
            pValue: 0.05, // プレースホルダー
            isSignificant: Math.abs(improvement) > 5, // 5%以上の改善で有意とする簡易判定
            confidenceInterval: [variantRate - 0.05, variantRate + 0.05], // プレースホルダー
            improvement
        };
    }
}
exports.ABTestAnalytics = ABTestAnalytics;
//# sourceMappingURL=index.js.map