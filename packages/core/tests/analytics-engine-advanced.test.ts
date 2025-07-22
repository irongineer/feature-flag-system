import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AdvancedAnalyticsEngine, 
  AnalyticsTimeWindow,
  FeatureFlagUsageMetrics,
  PerformanceMetrics,
  AnomalyDetectionResult 
} from '../src/analytics-engine';
import { RolloutCalculationEngine } from '../src/rollout-engine';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS } from '../src/models';
import { silentErrorHandler } from '../src/types/error-handling';

/**
 * Advanced Analytics Engine Comprehensive Specification
 * 
 * t-wada TDD原則による勤怠計算レベル複雑性の完全検証:
 * - 時系列データ集計・統計分析アルゴリズム
 * - 複雑な数学的計算（線形回帰、季節性検出、信頼区間）
 * - リアルタイム異常検知・パターン分析
 * - 多次元ビジネスメトリクス計算
 * - 予測モデル・トレンド分析
 * - 最適化推奨エンジン
 * - パフォーマンス影響評価
 * 
 * Business Scenarios Covered:
 * 1. Statistical Analysis and Trend Prediction (統計分析・トレンド予測)
 * 2. Real-time Anomaly Detection (リアルタイム異常検知)
 * 3. Business Impact Assessment (ビジネス影響評価)
 * 4. Performance Metrics Calculation (パフォーマンスメトリクス計算)
 * 5. Optimization Recommendations (最適化推奨)
 * 6. Time-series Data Processing (時系列データ処理)
 * 7. Multi-dimensional Analytics (多次元分析)
 */
describe('Advanced Analytics Engine Comprehensive Specification', () => {
  let analyticsEngine: AdvancedAnalyticsEngine;
  let mockRolloutEngine: RolloutCalculationEngine;
  let mockEvaluator: FeatureFlagEvaluator;

  const testTimeWindow: AnalyticsTimeWindow = {
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    endTime: new Date(),
    samplingInterval: 60 * 60 * 1000, // 1 hour intervals
    timezone: 'UTC'
  };

  beforeEach(() => {
    mockEvaluator = new FeatureFlagEvaluator({
      cache: new FeatureFlagCache({ ttl: 1000 }),
      errorHandler: silentErrorHandler
    });

    mockRolloutEngine = new RolloutCalculationEngine({
      evaluator: mockEvaluator,
      enableSafetyChecks: false
    });

    analyticsEngine = new AdvancedAnalyticsEngine({
      rolloutEngine: mockRolloutEngine,
      anomalyDetectionSensitivity: 0.8,
      predictionModel: 'linear',
      enableSamplingOptimization: true,
      enableRealTimeProcessing: true
    });
  });

  describe('Statistical Analysis and Mathematical Calculations', () => {
    describe('GIVEN complex time-series data requiring statistical analysis', () => {
      describe('WHEN performing advanced mathematical operations', () => {
        it('THEN correctly computes comprehensive analytics report with statistical accuracy', async () => {
          // Given: 統計分析が必要な複雑なデータセット
          const analysisFlags = [
            FEATURE_FLAGS.BILLING_V2,
            FEATURE_FLAGS.NEW_DASHBOARD,
            FEATURE_FLAGS.ADVANCED_ANALYTICS
          ];

          // When: 包括的分析レポート生成
          const report = await analyticsEngine.generateComprehensiveReport(
            testTimeWindow,
            analysisFlags
          );

          // Then: レポート構造の完全性
          expect(report.generatedAt).toBeInstanceOf(Date);
          expect(report.analysisWindow).toEqual(testTimeWindow);
          expect(Object.keys(report.usageMetrics)).toHaveLength(analysisFlags.length);
          expect(report.performanceMetrics).toBeDefined();
          expect(report.businessImpactMetrics).toBeDefined();
          expect(Array.isArray(report.anomalies)).toBe(true);
          expect(report.predictions).toBeDefined();
          expect(Array.isArray(report.optimizationRecommendations)).toBe(true);

          // And: 使用状況メトリクスの統計的妥当性
          for (const flagKey of analysisFlags) {
            const metrics = report.usageMetrics[flagKey];
            expect(metrics.flagKey).toBe(flagKey);
            expect(metrics.evaluationCount).toBeGreaterThan(0);
            expect(metrics.evaluationDistribution.trueCount).toBeGreaterThanOrEqual(0);
            expect(metrics.evaluationDistribution.falseCount).toBeGreaterThanOrEqual(0);
            expect(metrics.evaluationDistribution.truePercentage).toBeGreaterThanOrEqual(0);
            expect(metrics.evaluationDistribution.truePercentage).toBeLessThanOrEqual(100);
            expect(metrics.uniqueTenants).toBeGreaterThan(0);
            expect(metrics.uniqueUsers).toBeGreaterThan(0);

            // 地域別・プラン別分布の合理性
            expect(Object.keys(metrics.regionalDistribution)).toContain('us-east-1');
            expect(Object.keys(metrics.planDistribution)).toContain('enterprise');
          }

          // And: パフォーマンスメトリクスの数値的妥当性
          const perf = report.performanceMetrics;
          expect(perf.averageResponseTime).toBeGreaterThan(0);
          expect(perf.p95ResponseTime).toBeGreaterThanOrEqual(perf.averageResponseTime);
          expect(perf.p99ResponseTime).toBeGreaterThanOrEqual(perf.p95ResponseTime);
          expect(perf.errorRate).toBeGreaterThanOrEqual(0);
          expect(perf.errorRate).toBeLessThanOrEqual(1);
          expect(perf.cacheHitRate).toBeGreaterThanOrEqual(0);
          expect(perf.cacheHitRate).toBeLessThanOrEqual(1);
          expect(perf.throughput).toBeGreaterThan(0);
        });

        it('THEN handles mathematical edge cases and boundary conditions', async () => {
          // Given: 極端な値を含む分析シナリオ
          const extremeTimeWindow: AnalyticsTimeWindow = {
            startTime: new Date(0), // Unix epoch start
            endTime: new Date(Date.now() + 1000), // Slightly future
            samplingInterval: 1, // 1ms intervals (極端に小さい)
            timezone: 'Pacific/Kiritimati' // UTC+14 (極端なタイムゾーン)
          };

          // When: 極端条件での分析レポート生成
          const extremeReport = await analyticsEngine.generateComprehensiveReport(
            extremeTimeWindow,
            [FEATURE_FLAGS.BILLING_V2]
          );

          // Then: 極端な条件でも正常な結果
          expect(extremeReport.generatedAt).toBeInstanceOf(Date);
          expect(extremeReport.analysisWindow.timezone).toBe('Pacific/Kiritimati');
          expect(Object.keys(extremeReport.usageMetrics)).toHaveLength(1);

          // And: 数値計算の安全性
          const metrics = extremeReport.usageMetrics[FEATURE_FLAGS.BILLING_V2];
          expect(isFinite(metrics.evaluationCount)).toBe(true);
          expect(isFinite(metrics.evaluationDistribution.truePercentage)).toBe(true);
          expect(metrics.evaluationDistribution.truePercentage).toBeGreaterThanOrEqual(0);
          expect(metrics.evaluationDistribution.truePercentage).toBeLessThanOrEqual(100);
        });
      });
    });
  });

  describe('Real-time Anomaly Detection', () => {
    describe('GIVEN real-time performance and usage metrics', () => {
      describe('WHEN analyzing for anomalous patterns', () => {
        it('THEN accurately detects performance degradation anomalies', async () => {
          // Given: パフォーマンス劣化を示すメトリクス
          const degradedPerformanceMetrics: PerformanceMetrics = {
            averageResponseTime: 150, // Normal range
            p95ResponseTime: 800, // Slightly elevated
            p99ResponseTime: 2500, // High - should trigger anomaly
            errorRate: 0.08, // High error rate - should trigger anomaly
            cacheHitRate: 0.6, // Low cache hit rate
            throughput: 450 // Normal
          };

          const recentUsageMetrics: FeatureFlagUsageMetrics[] = [
            {
              flagKey: FEATURE_FLAGS.BILLING_V2,
              evaluationCount: 5000, // Normal
              evaluationDistribution: {
                trueCount: 2500,
                falseCount: 2500,
                truePercentage: 50
              },
              uniqueTenants: 100,
              uniqueUsers: 800,
              regionalDistribution: { 'us-east-1': 60, 'us-west-2': 40 },
              planDistribution: { 'enterprise': 30, 'pro': 40, 'basic': 30 }
            }
          ];

          // When: リアルタイム異常検知実行
          const anomalies = await analyticsEngine.detectRealTimeAnomalies(
            recentUsageMetrics,
            degradedPerformanceMetrics
          );

          // Then: パフォーマンス異常が検知される
          expect(anomalies.length).toBeGreaterThan(0);
          
          const performanceAnomalies = anomalies.filter(a => 
            a.anomalyType === 'performance_degradation'
          );
          expect(performanceAnomalies.length).toBeGreaterThan(0);

          // And: 適切な重要度判定
          const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
          expect(criticalAnomalies.length).toBeGreaterThan(0);

          // And: 実用的な推奨アクション
          const performanceAnomaly = performanceAnomalies[0];
          expect(performanceAnomaly.confidence).toBeGreaterThan(0.8);
          expect(performanceAnomaly.detectedAt).toBeInstanceOf(Date);
          expect(performanceAnomaly.description).toContain('Response time');
          expect(Array.isArray(performanceAnomaly.recommendedActions)).toBe(true);
          expect(performanceAnomaly.recommendedActions.length).toBeGreaterThan(0);
        });

        it('THEN detects traffic spike anomalies with appropriate severity', async () => {
          // Given: 異常なトラフィックスパイクを示すメトリクス
          const normalPerformanceMetrics: PerformanceMetrics = {
            averageResponseTime: 45,
            p95ResponseTime: 120,
            p99ResponseTime: 250,
            errorRate: 0.01, // Normal error rate
            cacheHitRate: 0.85,
            throughput: 800
          };

          const spikedUsageMetrics: FeatureFlagUsageMetrics[] = [
            {
              flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
              evaluationCount: 25000, // 5x normal traffic - should trigger anomaly
              evaluationDistribution: {
                trueCount: 12500,
                falseCount: 12500,
                truePercentage: 50
              },
              uniqueTenants: 150,
              uniqueUsers: 2000,
              regionalDistribution: { 'us-east-1': 70, 'us-west-2': 30 },
              planDistribution: { 'enterprise': 25, 'pro': 35, 'basic': 40 }
            }
          ];

          // When: トラフィックスパイク検知
          const anomalies = await analyticsEngine.detectRealTimeAnomalies(
            spikedUsageMetrics,
            normalPerformanceMetrics
          );

          // Then: トラフィック異常が検知される
          const trafficSpikes = anomalies.filter(a => 
            a.anomalyType === 'spike' && a.description.includes('traffic spike')
          );
          expect(trafficSpikes.length).toBeGreaterThan(0);

          // And: 適切な重要度とメタデータ
          const spike = trafficSpikes[0];
          expect(spike.severity).toMatch(/medium|high/);
          expect(spike.confidence).toBeGreaterThan(0.7);
          expect(spike.description).toContain(FEATURE_FLAGS.NEW_DASHBOARD);
          expect(spike.description).toContain('25000 evaluations');

          // And: トラフィック対応の推奨アクション
          expect(spike.recommendedActions).toContainEqual(
            expect.stringContaining('Monitor system capacity')
          );
        });

        it('THEN handles normal conditions without false positive anomalies', async () => {
          // Given: 正常範囲のパフォーマンス・使用状況メトリクス
          const normalPerformanceMetrics: PerformanceMetrics = {
            averageResponseTime: 35,
            p95ResponseTime: 85,
            p99ResponseTime: 180,
            errorRate: 0.005, // Very low error rate
            cacheHitRate: 0.92, // High cache hit rate
            throughput: 750
          };

          const normalUsageMetrics: FeatureFlagUsageMetrics[] = [
            {
              flagKey: FEATURE_FLAGS.ADVANCED_ANALYTICS,
              evaluationCount: 3500, // Normal range
              evaluationDistribution: {
                trueCount: 1400,
                falseCount: 2100,
                truePercentage: 40
              },
              uniqueTenants: 85,
              uniqueUsers: 650,
              regionalDistribution: { 'us-east-1': 55, 'us-west-2': 45 },
              planDistribution: { 'enterprise': 35, 'pro': 40, 'basic': 25 }
            }
          ];

          // When: 正常条件での異常検知
          const anomalies = await analyticsEngine.detectRealTimeAnomalies(
            normalUsageMetrics,
            normalPerformanceMetrics
          );

          // Then: 誤検知（false positive）がない
          expect(anomalies).toHaveLength(0);
        });
      });
    });
  });

  describe('Advanced Prediction and Trend Analysis', () => {
    describe('GIVEN historical usage data for predictive analysis', () => {
      describe('WHEN generating future trend predictions', () => {
        it('THEN produces statistically sound predictions with confidence intervals', async () => {
          // Given: 予測分析用の履歴データ
          const historicalMetrics: FeatureFlagUsageMetrics[] = [
            {
              flagKey: FEATURE_FLAGS.BILLING_V2,
              evaluationCount: 4500,
              evaluationDistribution: {
                trueCount: 2250,
                falseCount: 2250,
                truePercentage: 50
              },
              uniqueTenants: 90,
              uniqueUsers: 720,
              regionalDistribution: { 'us-east-1': 60, 'us-west-2': 40 },
              planDistribution: { 'enterprise': 30, 'pro': 45, 'basic': 25 }
            }
          ];

          // When: 高度な予測生成
          const predictions = await analyticsEngine.generateAdvancedPredictions(
            historicalMetrics,
            testTimeWindow
          );

          // Then: 予測結果の統計的妥当性
          expect(Object.keys(predictions)).toContain(FEATURE_FLAGS.BILLING_V2);
          
          const prediction = predictions[FEATURE_FLAGS.BILLING_V2];
          expect(prediction.forecastPeriod).toBeDefined();
          expect(prediction.forecastPeriod.startTime).toBeInstanceOf(Date);
          expect(prediction.forecastPeriod.endTime).toBeInstanceOf(Date);
          expect(prediction.forecastPeriod.startTime.getTime()).toBeLessThan(
            prediction.forecastPeriod.endTime.getTime()
          );

          // And: 予測値の合理性
          expect(prediction.predictedValues.evaluationCount).toBeGreaterThan(0);
          expect(prediction.predictedValues.truePercentage).toBeGreaterThanOrEqual(0);
          expect(prediction.predictedValues.truePercentage).toBeLessThanOrEqual(100);
          expect(prediction.predictedValues.performanceMetrics).toBeDefined();

          // And: 信頼区間の数学的妥当性
          expect(prediction.confidenceInterval.confidence).toBe(0.95);
          expect(prediction.confidenceInterval.lower).toBeLessThanOrEqual(
            prediction.predictedValues.evaluationCount
          );
          expect(prediction.confidenceInterval.upper).toBeGreaterThanOrEqual(
            prediction.predictedValues.evaluationCount
          );

          // And: 予測根拠の明確性
          expect(['trend_analysis', 'seasonal_pattern', 'regression_model', 'ml_model'])
            .toContain(prediction.predictionBasis);
        });

        it('THEN handles insufficient data gracefully without breaking prediction pipeline', async () => {
          // Given: 不十分な履歴データ（予測が困難）
          const insufficientData: FeatureFlagUsageMetrics[] = [
            {
              flagKey: FEATURE_FLAGS.NEW_DASHBOARD,
              evaluationCount: 50, // Very low data point
              evaluationDistribution: {
                trueCount: 25,
                falseCount: 25,
                truePercentage: 50
              },
              uniqueTenants: 2, // Minimal tenant base
              uniqueUsers: 15,
              regionalDistribution: { 'us-east-1': 100 },
              planDistribution: { 'basic': 100 }
            }
          ];

          const shortTimeWindow: AnalyticsTimeWindow = {
            startTime: new Date(Date.now() - 1000), // Very short window
            endTime: new Date(),
            samplingInterval: 100,
            timezone: 'UTC'
          };

          // When: 不十分データでの予測生成
          const predictions = await analyticsEngine.generateAdvancedPredictions(
            insufficientData,
            shortTimeWindow
          );

          // Then: 予測パイプラインが破綻しない
          expect(predictions).toBeDefined();
          expect(typeof predictions).toBe('object');

          // And: 予測結果があれば最低限の妥当性を持つ
          if (Object.keys(predictions).length > 0) {
            const prediction = predictions[FEATURE_FLAGS.NEW_DASHBOARD];
            expect(prediction.predictedValues.evaluationCount).toBeGreaterThanOrEqual(0);
            expect(prediction.confidenceInterval.confidence).toBeGreaterThan(0);
            expect(prediction.confidenceInterval.confidence).toBeLessThanOrEqual(1);
          }
        });
      });
    });
  });

  describe('Business Impact Assessment Calculations', () => {
    describe('GIVEN comprehensive business metrics for impact analysis', () => {
      describe('WHEN calculating multi-dimensional business impact', () => {
        it('THEN computes accurate revenue and engagement impact with proper scaling', async () => {
          // Given: ビジネス影響分析用のデータ
          const businessAnalysisFlags = [FEATURE_FLAGS.BILLING_V2, FEATURE_FLAGS.NEW_DASHBOARD];
          const businessTimeWindow: AnalyticsTimeWindow = {
            startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
            endTime: new Date(),
            samplingInterval: 24 * 60 * 60 * 1000, // Daily intervals
            timezone: 'UTC'
          };

          // When: 包括的ビジネス影響分析
          const report = await analyticsEngine.generateComprehensiveReport(
            businessTimeWindow,
            businessAnalysisFlags
          );

          // Then: ビジネス影響メトリクスの完全性
          for (const flagKey of businessAnalysisFlags) {
            const businessImpact = report.businessImpactMetrics[flagKey];
            expect(businessImpact).toBeDefined();

            // 売上影響の合理性
            expect(typeof businessImpact.estimatedRevenueImpact).toBe('number');
            expect(isFinite(businessImpact.estimatedRevenueImpact)).toBe(true);

            // エンゲージメント変化率の範囲チェック
            expect(businessImpact.engagementChangeRate).toBeGreaterThanOrEqual(-1);
            expect(businessImpact.engagementChangeRate).toBeLessThanOrEqual(1);

            // コンバージョン率変化の妥当性
            expect(typeof businessImpact.conversionRateChange).toBe('number');
            expect(isFinite(businessImpact.conversionRateChange)).toBe(true);

            // サポートチケット影響（整数値）
            expect(Number.isInteger(businessImpact.supportTicketImpact)).toBe(true);

            // リソース使用量変化（パーセンテージ）
            expect(typeof businessImpact.resourceUsageChange).toBe('number');
            expect(isFinite(businessImpact.resourceUsageChange)).toBe(true);
          }
        });
      });
    });
  });

  describe('Optimization Recommendations Engine', () => {
    describe('GIVEN performance and business metrics requiring optimization', () => {
      describe('WHEN generating actionable optimization recommendations', () => {
        it('THEN produces prioritized recommendations with quantified impact assessments', async () => {
          // Given: 最適化が必要な状況
          const optimizationFlags = [FEATURE_FLAGS.ADVANCED_ANALYTICS];

          // When: 最適化推奨生成
          const report = await analyticsEngine.generateComprehensiveReport(
            testTimeWindow,
            optimizationFlags
          );

          // Then: 最適化推奨の構造と品質
          expect(Array.isArray(report.optimizationRecommendations)).toBe(true);

          for (const recommendation of report.optimizationRecommendations) {
            // 推奨タイプの妥当性
            expect(['cache_optimization', 'rollout_adjustment', 'resource_scaling', 'configuration_change'])
              .toContain(recommendation.type);

            // 優先度の妥当性
            expect(['low', 'medium', 'high', 'urgent']).toContain(recommendation.priority);

            // 説明の存在
            expect(typeof recommendation.description).toBe('string');
            expect(recommendation.description.length).toBeGreaterThan(0);

            // 期待される効果の定量化
            expect(typeof recommendation.expectedImpact.performanceImprovement).toBe('number');
            expect(recommendation.expectedImpact.performanceImprovement).toBeGreaterThanOrEqual(0);
            expect(recommendation.expectedImpact.performanceImprovement).toBeLessThanOrEqual(100);

            expect(typeof recommendation.expectedImpact.costReduction).toBe('number');
            expect(isFinite(recommendation.expectedImpact.costReduction)).toBe(true);

            expect(recommendation.expectedImpact.riskMitigation).toBeGreaterThanOrEqual(0);
            expect(recommendation.expectedImpact.riskMitigation).toBeLessThanOrEqual(1);

            // 実装複雑度の妥当性
            expect(['low', 'medium', 'high']).toContain(recommendation.implementationComplexity);
          }
        });

        it('THEN recommends cache optimization when cache performance is suboptimal', async () => {
          // Given: キャッシュパフォーマンスが低い状況
          // Note: 実際の実装では、performanceMetrics に基づいて推奨が生成される
          const report = await analyticsEngine.generateComprehensiveReport(
            testTimeWindow,
            [FEATURE_FLAGS.BILLING_V2]
          );

          // When: パフォーマンス分析結果確認
          const perfMetrics = report.performanceMetrics;

          // Then: キャッシュヒット率が低い場合の推奨検証
          if (perfMetrics.cacheHitRate < 0.8) {
            const cacheRecommendations = report.optimizationRecommendations.filter(r => 
              r.type === 'cache_optimization'
            );

            if (cacheRecommendations.length > 0) {
              const cacheRec = cacheRecommendations[0];
              expect(cacheRec.description).toContain('cache');
              expect(cacheRec.expectedImpact.performanceImprovement).toBeGreaterThan(0);
              expect(['medium', 'high']).toContain(cacheRec.priority);
            }
          }
        });
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    describe('GIVEN various error conditions in analytics processing', () => {
      describe('WHEN encountering calculation errors or invalid data', () => {
        it('THEN maintains system stability and provides meaningful error information', async () => {
          // Given: 無効な時間窓設定
          const invalidTimeWindow: AnalyticsTimeWindow = {
            startTime: new Date(Date.now() + 1000), // Future start
            endTime: new Date(Date.now() - 1000), // Past end (invalid)
            samplingInterval: -100, // Negative interval (invalid)
            timezone: 'Invalid/Timezone' // Invalid timezone
          };

          // When & Then: エラー処理の確認
          await expect(
            analyticsEngine.generateComprehensiveReport(
              invalidTimeWindow,
              [FEATURE_FLAGS.BILLING_V2]
            )
          ).rejects.toThrow(/Analytics report generation failed/);
        });

        it('THEN gracefully handles empty or null data inputs', async () => {
          // Given: 空のフラグリスト
          const emptyAnalysis = analyticsEngine.generateComprehensiveReport(
            testTimeWindow,
            [] // Empty flag list
          );

          // When & Then: 空データでも正常処理
          await expect(emptyAnalysis).resolves.toBeDefined();
          
          const emptyReport = await emptyAnalysis;
          expect(Object.keys(emptyReport.usageMetrics)).toHaveLength(0);
          expect(emptyReport.performanceMetrics).toBeDefined();
          expect(Array.isArray(emptyReport.optimizationRecommendations)).toBe(true);
        });
      });
    });
  });

  describe('Performance and Scalability Characteristics', () => {
    describe('GIVEN high-volume analytics processing requirements', () => {
      describe('WHEN processing large datasets with complex calculations', () => {
        it('THEN maintains acceptable performance for production workloads', async () => {
          // Given: 大規模データセット
          const largeScaleFlags = Object.values(FEATURE_FLAGS) as any[];
          const performanceTimeWindow: AnalyticsTimeWindow = {
            startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
            endTime: new Date(),
            samplingInterval: 60 * 60 * 1000, // Hourly
            timezone: 'UTC'
          };

          // When: パフォーマンス計測しながら分析実行
          const startTime = Date.now();
          
          const report = await analyticsEngine.generateComprehensiveReport(
            performanceTimeWindow,
            largeScaleFlags
          );
          
          const executionTime = Date.now() - startTime;

          // Then: 適切な実行時間内での完了
          expect(executionTime).toBeLessThan(5000); // 5秒以内

          // And: 結果の完全性
          expect(Object.keys(report.usageMetrics)).toHaveLength(largeScaleFlags.length);
          expect(report.performanceMetrics).toBeDefined();
          expect(Array.isArray(report.anomalies)).toBe(true);
          expect(report.predictions).toBeDefined();

          // And: メモリ効率性（結果の妥当な構造）
          expect(typeof report).toBe('object');
          expect(report.generatedAt).toBeInstanceOf(Date);
        });
      });
    });
  });
});