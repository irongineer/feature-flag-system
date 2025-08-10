import { FeatureFlagKey, FeatureFlagContext } from '../models';
/**
 * A/B Test Engine
 *
 * A/Bテスト機能の実装 - Phase 2拡張機能
 * 複数バリエーションの配信制御とコンバージョン追跡
 */
export interface ABTestVariant {
    id: string;
    name: string;
    weight: number;
    config: Record<string, any>;
}
export interface ABTestConfig {
    testId: string;
    name: string;
    description?: string;
    isActive: boolean;
    variants: ABTestVariant[];
    trafficAllocation: number;
    startDate?: string;
    endDate?: string;
    targetSegments?: string[];
    conversionMetric?: string;
}
export interface ABTestContext extends FeatureFlagContext {
    sessionId?: string;
    experiment?: string;
    previousVariants?: Record<string, string>;
}
export interface ABTestResult {
    testId: string;
    variantId: string;
    variantName: string;
    config: Record<string, any>;
    isControl: boolean;
    timestamp: string;
}
export interface ABTestMetrics {
    testId: string;
    variantId: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    lastUpdated: string;
}
export declare class ABTestEngine {
    /**
     * A/Bテストバリアント選択
     * 一貫したユーザー体験を保証するハッシュベース分散
     */
    assignVariant(context: ABTestContext, flagKey: FeatureFlagKey, testConfig: ABTestConfig): Promise<ABTestResult>;
    /**
     * 複数A/Bテストの同時実行対応
     * テスト間の干渉を避けた配信制御
     */
    assignMultipleVariants(context: ABTestContext, experiments: Array<{
        flagKey: FeatureFlagKey;
        testConfig: ABTestConfig;
    }>): Promise<ABTestResult[]>;
    /**
     * コンバージョン追跡
     * A/Bテストの効果測定
     */
    trackConversion(testId: string, variantId: string, userId: string, conversionValue?: number, metadata?: Record<string, any>): Promise<void>;
    private isWithinTestPeriod;
    private isInTrafficAllocation;
    private matchesTargetSegment;
    private selectVariant;
    private getControlVariant;
    private getControlVariantFromConfig;
    private generateUserHash;
}
/**
 * A/Bテスト統計分析ヘルパー
 */
export declare class ABTestAnalytics {
    /**
     * 統計的有意性の計算
     */
    calculateSignificance(controlMetrics: ABTestMetrics, variantMetrics: ABTestMetrics, confidenceLevel?: number): {
        pValue: number;
        isSignificant: boolean;
        confidenceInterval: [number, number];
        improvement: number;
    };
}
//# sourceMappingURL=index.d.ts.map