import { FeatureFlagKey, FeatureFlagContext } from '../models';
/**
 * Advanced Analytics Engine
 *
 * フィーチャーフラグの統計分析・予測機能
 * 使用パターン分析・パフォーマンス予測・最適化提案
 */
export interface AnalyticsMetrics {
    evaluationCount: number;
    enabledRate: number;
    avgResponseTime: number;
    errorRate: number;
    uniqueUsers: number;
    tenantDistribution: Record<string, number>;
}
export interface UsagePattern {
    timeOfDay: Record<string, number>;
    dayOfWeek: Record<string, number>;
    regionalDistribution: Record<string, number>;
    userCohorts: Record<string, number>;
}
export interface PredictionResult {
    predictedLoad: number;
    confidence: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    seasonality: SeasonalityPattern[];
}
export interface SeasonalityPattern {
    type: 'hourly' | 'daily' | 'weekly';
    peak: number;
    amplitude: number;
}
export interface OptimizationRecommendation {
    type: 'cache_ttl' | 'regional_deployment' | 'rollout_strategy';
    priority: 'high' | 'medium' | 'low';
    expectedImprovement: number;
    description: string;
    implementation: string;
}
export declare class AnalyticsEngine {
    private metricsData;
    private usageHistory;
    /**
     * フラグ評価メトリクスを記録
     */
    recordEvaluation(flagKey: FeatureFlagKey, context: FeatureFlagContext, enabled: boolean, responseTime: number): void;
    /**
     * 使用パターン分析
     */
    analyzeUsagePattern(flagKey: FeatureFlagKey): UsagePattern;
    /**
     * 負荷予測分析
     */
    predictLoad(flagKey: FeatureFlagKey, hoursAhead?: number): PredictionResult;
    /**
     * パフォーマンス最適化提案
     */
    generateOptimizationRecommendations(flagKey: FeatureFlagKey): OptimizationRecommendation[];
    /**
     * メトリクス取得
     */
    getMetrics(flagKey: FeatureFlagKey): AnalyticsMetrics | null;
    /**
     * 統計サマリー生成
     */
    generateStatsSummary(): {
        totalEvaluations: number;
        averageResponseTime: number;
        topFlags: Array<{
            flagKey: FeatureFlagKey;
            evaluationCount: number;
        }>;
        systemHealth: 'excellent' | 'good' | 'poor';
    };
    private calculateEnabledRate;
    private updateAverageResponseTime;
    private aggregateHourlyData;
    private calculateTrend;
    private detectSeasonality;
    private calculateBasePrediction;
    private applySeasonalAdjustment;
    private applyTrendAdjustment;
    private calculateConfidence;
}
