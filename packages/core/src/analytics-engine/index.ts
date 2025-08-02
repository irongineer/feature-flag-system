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

export class AnalyticsEngine {
  private metricsData: Map<FeatureFlagKey, AnalyticsMetrics> = new Map();
  private usageHistory: Map<
    FeatureFlagKey,
    Array<{
      timestamp: number;
      context: FeatureFlagContext;
      enabled: boolean;
      responseTime: number;
    }>
  > = new Map();

  /**
   * フラグ評価メトリクスを記録
   */
  recordEvaluation(
    flagKey: FeatureFlagKey,
    context: FeatureFlagContext,
    enabled: boolean,
    responseTime: number
  ): void {
    // 使用履歴記録（メトリクス計算前に実行）
    const history = this.usageHistory.get(flagKey) || [];
    history.push({
      timestamp: Date.now(),
      context,
      enabled,
      responseTime,
    });

    // 履歴サイズ制限（最新1000件）
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    this.usageHistory.set(flagKey, history);

    // メトリクス更新
    const metrics = this.metricsData.get(flagKey) || {
      evaluationCount: 0,
      enabledRate: 0,
      avgResponseTime: 0,
      errorRate: 0,
      uniqueUsers: 0,
      tenantDistribution: {},
    };

    metrics.evaluationCount++;
    metrics.enabledRate = this.calculateEnabledRate(flagKey, enabled);
    metrics.avgResponseTime = this.updateAverageResponseTime(metrics, responseTime);

    if (context.tenantId) {
      metrics.tenantDistribution[context.tenantId] =
        (metrics.tenantDistribution[context.tenantId] || 0) + 1;
    }

    this.metricsData.set(flagKey, metrics);
  }

  /**
   * 使用パターン分析
   */
  analyzeUsagePattern(flagKey: FeatureFlagKey): UsagePattern {
    const history = this.usageHistory.get(flagKey) || [];

    const timeOfDay: Record<string, number> = {};
    const dayOfWeek: Record<string, number> = {};
    const regionalDistribution: Record<string, number> = {};
    const userCohorts: Record<string, number> = {};

    for (const record of history) {
      const date = new Date(record.timestamp);
      const hour = date.getHours().toString();
      const day = date.getDay().toString();

      timeOfDay[hour] = (timeOfDay[hour] || 0) + 1;
      dayOfWeek[day] = (dayOfWeek[day] || 0) + 1;

      // Note: region and userCohort are not in current FeatureFlagContext interface
      // These features will be added in future iterations
      const context = record.context as any;
      if (context.region) {
        regionalDistribution[context.region] = (regionalDistribution[context.region] || 0) + 1;
      }

      if (context.userCohort) {
        userCohorts[context.userCohort] = (userCohorts[context.userCohort] || 0) + 1;
      }
    }

    return {
      timeOfDay,
      dayOfWeek,
      regionalDistribution,
      userCohorts,
    };
  }

  /**
   * 負荷予測分析
   */
  predictLoad(flagKey: FeatureFlagKey, hoursAhead: number = 24): PredictionResult {
    const history = this.usageHistory.get(flagKey) || [];

    if (history.length < 100) {
      // データ不足の場合は保守的な予測
      return {
        predictedLoad: history.length,
        confidence: 0.3,
        trend: 'stable',
        seasonality: [],
      };
    }

    const hourlyData = this.aggregateHourlyData(history);
    const trend = this.calculateTrend(hourlyData);
    const seasonality = this.detectSeasonality(hourlyData);

    const basePrediction = this.calculateBasePrediction(hourlyData, hoursAhead);
    const seasonalAdjustment = this.applySeasonalAdjustment(
      basePrediction,
      seasonality,
      hoursAhead
    );
    const trendAdjustment = this.applyTrendAdjustment(seasonalAdjustment, trend, hoursAhead);

    return {
      predictedLoad: Math.max(0, trendAdjustment),
      confidence: this.calculateConfidence(history, hourlyData),
      trend,
      seasonality,
    };
  }

  /**
   * パフォーマンス最適化提案
   */
  generateOptimizationRecommendations(flagKey: FeatureFlagKey): OptimizationRecommendation[] {
    const metrics = this.metricsData.get(flagKey);
    const pattern = this.analyzeUsagePattern(flagKey);
    const recommendations: OptimizationRecommendation[] = [];

    if (!metrics) {
      return recommendations;
    }

    // キャッシュTTL最適化
    if (metrics.avgResponseTime > 100) {
      recommendations.push({
        type: 'cache_ttl',
        priority: 'high',
        expectedImprovement: 0.6,
        description:
          'レスポンス時間が100msを超えています。キャッシュTTLを延長することで改善が期待できます。',
        implementation: 'FeatureFlagCache の TTL を 300秒から 600秒に延長',
      });
    }

    // 地域分散最適化
    const totalEvaluations = Object.values(pattern.regionalDistribution).reduce((a, b) => a + b, 0);
    const dominantRegion = Object.entries(pattern.regionalDistribution).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (dominantRegion && dominantRegion[1] > totalEvaluations * 0.7) {
      recommendations.push({
        type: 'regional_deployment',
        priority: 'medium',
        expectedImprovement: 0.3,
        description: `${dominantRegion[0]}地域からのアクセスが70%を超えています。地域特化デプロイメントを検討してください。`,
        implementation: `${dominantRegion[0]}地域にエッジキャッシュを配置`,
      });
    }

    // ロールアウト戦略最適化
    if (metrics.enabledRate > 0.1 && metrics.enabledRate < 0.9) {
      const targetRate = metrics.enabledRate > 0.5 ? 1.0 : 0.0;
      recommendations.push({
        type: 'rollout_strategy',
        priority: 'low',
        expectedImprovement: 0.2,
        description: `現在の有効化率は${(metrics.enabledRate * 100).toFixed(1)}%です。段階的ロールアウトを検討してください。`,
        implementation: `目標有効化率: ${(targetRate * 100).toFixed(0)}%への段階的移行`,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  /**
   * メトリクス取得
   */
  getMetrics(flagKey: FeatureFlagKey): AnalyticsMetrics | null {
    return this.metricsData.get(flagKey) || null;
  }

  /**
   * 統計サマリー生成
   */
  generateStatsSummary(): {
    totalEvaluations: number;
    averageResponseTime: number;
    topFlags: Array<{ flagKey: FeatureFlagKey; evaluationCount: number }>;
    systemHealth: 'excellent' | 'good' | 'poor';
  } {
    const allMetrics = Array.from(this.metricsData.entries());

    const totalEvaluations = allMetrics.reduce(
      (sum, [, metrics]) => sum + metrics.evaluationCount,
      0
    );
    const averageResponseTime =
      allMetrics.reduce((sum, [, metrics]) => sum + metrics.avgResponseTime, 0) /
        allMetrics.length || 0;

    const topFlags = allMetrics
      .sort(([, a], [, b]) => b.evaluationCount - a.evaluationCount)
      .slice(0, 5)
      .map(([flagKey, metrics]) => ({ flagKey, evaluationCount: metrics.evaluationCount }));

    const systemHealth =
      averageResponseTime < 50 ? 'excellent' : averageResponseTime < 100 ? 'good' : 'poor';

    return {
      totalEvaluations,
      averageResponseTime,
      topFlags,
      systemHealth,
    };
  }

  // Private helper methods
  private calculateEnabledRate(flagKey: FeatureFlagKey, latestEnabled: boolean): number {
    const history = this.usageHistory.get(flagKey) || [];
    if (history.length === 0) return latestEnabled ? 1 : 0;

    const enabledCount = history.filter(record => record.enabled).length;
    return enabledCount / history.length;
  }

  private updateAverageResponseTime(metrics: AnalyticsMetrics, newResponseTime: number): number {
    const currentAvg = metrics.avgResponseTime;
    const count = metrics.evaluationCount;

    if (count === 0) return newResponseTime;
    return (currentAvg * (count - 1) + newResponseTime) / count;
  }

  private aggregateHourlyData(history: Array<any>): Record<number, number> {
    const hourlyData: Record<number, number> = {};

    for (const record of history) {
      const hour = Math.floor(record.timestamp / (1000 * 60 * 60));
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    }

    return hourlyData;
  }

  private calculateTrend(
    hourlyData: Record<number, number>
  ): 'increasing' | 'decreasing' | 'stable' {
    const hours = Object.keys(hourlyData).map(Number).sort();
    if (hours.length < 2) return 'stable';

    const recent = hours.slice(-24);
    const earlier = hours.slice(-48, -24);

    const recentAvg = recent.reduce((sum, hour) => sum + hourlyData[hour], 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, hour) => sum + hourlyData[hour], 0) / earlier.length;

    const change = (recentAvg - earlierAvg) / earlierAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private detectSeasonality(hourlyData: Record<number, number>): SeasonalityPattern[] {
    const patterns: SeasonalityPattern[] = [];

    // 時間別パターン検出（簡易版）
    const hours = Object.keys(hourlyData).map(Number);
    const hourlyCounts = hours.map(hour => hourlyData[hour]);

    if (hourlyCounts.length >= 24) {
      const maxHourly = Math.max(...hourlyCounts);
      const minHourly = Math.min(...hourlyCounts);
      const amplitude = (maxHourly - minHourly) / maxHourly;

      if (amplitude > 0.3) {
        patterns.push({
          type: 'hourly',
          peak: hours[hourlyCounts.indexOf(maxHourly)] % 24,
          amplitude,
        });
      }
    }

    return patterns;
  }

  private calculateBasePrediction(hourlyData: Record<number, number>, hoursAhead: number): number {
    const values = Object.values(hourlyData);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private applySeasonalAdjustment(
    basePrediction: number,
    seasonality: SeasonalityPattern[],
    hoursAhead: number
  ): number {
    let adjustment = 1.0;

    for (const pattern of seasonality) {
      if (pattern.type === 'hourly') {
        const targetHour = (new Date().getHours() + hoursAhead) % 24;
        const distanceFromPeak = Math.abs(targetHour - pattern.peak);
        const normalizedDistance = Math.min(distanceFromPeak, 24 - distanceFromPeak) / 12;
        adjustment *= 1 + pattern.amplitude * (1 - normalizedDistance);
      }
    }

    return basePrediction * adjustment;
  }

  private applyTrendAdjustment(prediction: number, trend: string, hoursAhead: number): number {
    const trendMultiplier = trend === 'increasing' ? 1.1 : trend === 'decreasing' ? 0.9 : 1.0;
    const timeAdjustment = Math.pow(trendMultiplier, hoursAhead / 24);
    return prediction * timeAdjustment;
  }

  private calculateConfidence(history: Array<any>, hourlyData: Record<number, number>): number {
    const dataPoints = Object.keys(hourlyData).length;
    const historyLength = history.length;

    // データ量ベースの信頼度計算
    const dataConfidence = Math.min(dataPoints / 168, 1.0); // 1週間分のデータで最大信頼度
    const sampleConfidence = Math.min(historyLength / 1000, 1.0); // 1000サンプルで最大信頼度

    return (dataConfidence + sampleConfidence) / 2;
  }
}
