import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalyticsEngine,
  AnalyticsMetrics,
  UsagePattern,
  PredictionResult,
} from '../src/analytics-engine';
import { FEATURE_FLAGS, FeatureFlagContext } from '../src/models';

/**
 * Analytics Engine Comprehensive Tests
 *
 * 統計分析・予測機能の包括的テスト
 * TDD完全実装による高品質アナリティクス
 */

describe('Analytics Engine Comprehensive Tests', () => {
  let analyticsEngine: AnalyticsEngine;
  let mockDate: any;

  beforeEach(() => {
    analyticsEngine = new AnalyticsEngine();

    // 固定日時でテスト実行
    mockDate = vi.spyOn(Date, 'now').mockReturnValue(1642680000000); // 2022-01-20 12:00:00 UTC
  });

  afterEach(() => {
    mockDate.mockRestore();
  });

  describe('Metrics Recording and Calculation', () => {
    describe('GIVEN feature flag evaluations', () => {
      describe('WHEN recording evaluation metrics', () => {
        it('THEN tracks basic metrics correctly', () => {
          // Given: フラグ評価記録
          const context: FeatureFlagContext = {
            tenantId: 'tenant-123',
            userId: 'user-456',
            region: 'US',
          };

          // When: 複数回の評価記録
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 45);
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, false, 55);
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 35);

          // Then: メトリクスが正しく記録される
          const metrics = analyticsEngine.getMetrics(FEATURE_FLAGS.BILLING_V2);
          expect(metrics?.evaluationCount).toBe(3);
          expect(metrics?.enabledRate).toBeCloseTo(2 / 3, 10); // 3回中2回有効
          expect(metrics?.avgResponseTime).toBe(45); // (45 + 55 + 35) / 3
          expect(metrics?.errorRate).toBe(0);
          expect(metrics?.uniqueUsers).toBe(0);
          expect(metrics?.tenantDistribution).toEqual({
            'tenant-123': 3,
          });
        });

        it('THEN updates tenant distribution correctly', () => {
          // Given: 複数テナントからの評価
          const contexts = [
            { tenantId: 'tenant-a', userId: 'user-1' },
            { tenantId: 'tenant-a', userId: 'user-2' },
            { tenantId: 'tenant-b', userId: 'user-3' },
            { tenantId: 'tenant-c', userId: 'user-4' },
            { tenantId: 'tenant-a', userId: 'user-5' },
          ];

          // When: 各テナントから評価記録
          contexts.forEach(context => {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.NEW_DASHBOARD, context, true, 50);
          });

          // Then: テナント分布が正しく記録される
          const metrics = analyticsEngine.getMetrics(FEATURE_FLAGS.NEW_DASHBOARD);
          expect(metrics?.tenantDistribution).toEqual({
            'tenant-a': 3,
            'tenant-b': 1,
            'tenant-c': 1,
          });
        });

        it('THEN maintains history size limit', () => {
          // Given: 大量の評価記録（1000件超）
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 1500件の評価記録
          for (let i = 0; i < 1500; i++) {
            mockDate.mockReturnValue(1642680000000 + i * 1000); // 1秒ずつ増加
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, i % 2 === 0, 50);
          }

          // Then: 使用パターン分析で履歴制限確認（間接的検証）
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.BILLING_V2);
          const totalRecords = Object.values(pattern.timeOfDay).reduce(
            (sum, count) => sum + count,
            0
          );
          expect(totalRecords).toBeLessThanOrEqual(1000);
        });
      });
    });
  });

  describe('Usage Pattern Analysis', () => {
    describe('GIVEN usage history data', () => {
      describe('WHEN analyzing temporal patterns', () => {
        it('THEN identifies time-of-day patterns correctly', () => {
          // Given: 異なる時間帯の評価履歴
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          const timeSlots = [
            { hour: 9, count: 10 }, // 朝
            { hour: 14, count: 15 }, // 午後
            { hour: 18, count: 5 }, // 夕方
            { hour: 22, count: 2 }, // 夜
          ];

          // When: 各時間帯での評価記録
          timeSlots.forEach(({ hour, count }) => {
            for (let i = 0; i < count; i++) {
              // 2022-01-20の指定した時間で固定タイムスタンプを作成
              const date = new Date(2022, 0, 20, hour, i); // 月は0ベース
              mockDate.mockReturnValue(date.getTime());
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 50);
            }
          });

          // Then: 時間帯パターンが正しく分析される
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.BILLING_V2);
          expect(pattern.timeOfDay).toEqual({
            '9': 10,
            '14': 15,
            '18': 5,
            '22': 2,
          });
        });

        it('THEN identifies day-of-week patterns correctly', () => {
          // Given: 曜日別の評価履歴
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          const dayPatterns = [
            { dayOfWeek: 1, count: 20 }, // 月曜
            { dayOfWeek: 2, count: 25 }, // 火曜
            { dayOfWeek: 3, count: 30 }, // 水曜
            { dayOfWeek: 4, count: 15 }, // 木曜
            { dayOfWeek: 5, count: 10 }, // 金曜
            { dayOfWeek: 6, count: 5 }, // 土曜
            { dayOfWeek: 0, count: 3 }, // 日曜
          ];

          // When: 各曜日での評価記録
          dayPatterns.forEach(({ dayOfWeek, count }) => {
            for (let i = 0; i < count; i++) {
              // 指定した曜日の日付を作成 (2022年1月の適切な日付)
              const dates = {
                0: new Date(2022, 0, 16), // 日曜
                1: new Date(2022, 0, 17), // 月曜
                2: new Date(2022, 0, 18), // 火曜
                3: new Date(2022, 0, 19), // 水曜
                4: new Date(2022, 0, 20), // 木曜
                5: new Date(2022, 0, 21), // 金曜
                6: new Date(2022, 0, 22), // 土曜
              };
              const date = dates[dayOfWeek as keyof typeof dates];
              date.setHours(12, i); // 時間を12時+i分に設定
              mockDate.mockReturnValue(date.getTime());
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.NEW_DASHBOARD, context, true, 50);
            }
          });

          // Then: 曜日パターンが正しく分析される
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.NEW_DASHBOARD);
          expect(pattern.dayOfWeek).toEqual({
            '0': 3, // 日曜
            '1': 20, // 月曜
            '2': 25, // 火曜
            '3': 30, // 水曜
            '4': 15, // 木曜
            '5': 10, // 金曜
            '6': 5, // 土曜
          });
        });

        it('THEN analyzes regional distribution correctly', () => {
          // Given: 地域別の評価履歴
          const regions = [
            { region: 'US', count: 50 },
            { region: 'EU', count: 30 },
            { region: 'APAC', count: 20 },
          ];

          // When: 各地域からの評価記録
          regions.forEach(({ region, count }) => {
            for (let i = 0; i < count; i++) {
              const context: FeatureFlagContext = {
                tenantId: 'test',
                userId: `user-${i}`,
                region,
              };
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.ADVANCED_ANALYTICS, context, true, 50);
            }
          });

          // Then: 地域分布が正しく分析される
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.ADVANCED_ANALYTICS);
          expect(pattern.regionalDistribution).toEqual({
            US: 50,
            EU: 30,
            APAC: 20,
          });
        });

        it('THEN analyzes user cohorts correctly', () => {
          // Given: ユーザーコホート別の評価履歴
          const cohorts = [
            { cohort: 'premium', count: 40 },
            { cohort: 'standard', count: 60 },
            { cohort: 'trial', count: 20 },
          ];

          // When: 各コホートからの評価記録
          cohorts.forEach(({ cohort, count }) => {
            for (let i = 0; i < count; i++) {
              const context: FeatureFlagContext = {
                tenantId: 'test',
                userId: `user-${i}`,
                userCohort: cohort,
              };
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.ENHANCED_SECURITY, context, true, 50);
            }
          });

          // Then: コホート分布が正しく分析される
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.ENHANCED_SECURITY);
          expect(pattern.userCohorts).toEqual({
            premium: 40,
            standard: 60,
            trial: 20,
          });
        });
      });
    });
  });

  describe('Load Prediction Analysis', () => {
    describe('GIVEN historical usage data', () => {
      describe('WHEN predicting future load', () => {
        it('THEN provides conservative prediction for insufficient data', () => {
          // Given: データ不足のシナリオ（100件未満）
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 少量のデータ記録
          for (let i = 0; i < 50; i++) {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 50);
          }

          // When: 負荷予測実行
          const prediction = analyticsEngine.predictLoad(FEATURE_FLAGS.BILLING_V2, 24);

          // Then: 保守的な予測が返される
          expect(prediction.predictedLoad).toBe(50);
          expect(prediction.confidence).toBe(0.3);
          expect(prediction.trend).toBe('stable');
          expect(prediction.seasonality).toEqual([]);
        });

        it('THEN detects increasing trend correctly', () => {
          // Given: 増加傾向のデータ
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };
          const baseTime = Date.now() - 48 * 60 * 60 * 1000; // 48時間前から開始

          // When: 段階的に増加するデータ記録
          for (let hour = 0; hour < 48; hour++) {
            const count = hour < 24 ? 10 : 20; // 最初の24時間は10件/時、次の24時間は20件/時

            for (let i = 0; i < count; i++) {
              const timestamp = baseTime + hour * 60 * 60 * 1000 + i * 60 * 1000;
              mockDate.mockReturnValue(timestamp);
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.NEW_DASHBOARD, context, true, 50);
            }
          }

          // When: 負荷予測実行
          const prediction = analyticsEngine.predictLoad(FEATURE_FLAGS.NEW_DASHBOARD, 24);

          // Then: 増加傾向が検出される
          expect(prediction.trend).toBe('increasing');
          expect(prediction.predictedLoad).toBeGreaterThan(15); // 基準値より高い予測
          expect(prediction.confidence).toBeGreaterThan(0.5);
        });

        it('THEN detects decreasing trend correctly', () => {
          // Given: 減少傾向のデータ
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };
          const baseTime = Date.now() - 48 * 60 * 60 * 1000;

          // When: 段階的に減少するデータ記録
          for (let hour = 0; hour < 48; hour++) {
            const count = hour < 24 ? 20 : 8; // 最初の24時間は20件/時、次の24時間は8件/時

            for (let i = 0; i < count; i++) {
              const timestamp = baseTime + hour * 60 * 60 * 1000 + i * 60 * 1000;
              mockDate.mockReturnValue(timestamp);
              analyticsEngine.recordEvaluation(
                FEATURE_FLAGS.REAL_TIME_NOTIFICATIONS,
                context,
                true,
                50
              );
            }
          }

          // When: 負荷予測実行
          const prediction = analyticsEngine.predictLoad(FEATURE_FLAGS.REAL_TIME_NOTIFICATIONS, 24);

          // Then: 減少傾向が検出される
          expect(prediction.trend).toBe('decreasing');
          expect(prediction.predictedLoad).toBeLessThan(20); // 基準値より低い予測
        });

        it('THEN detects seasonal patterns', () => {
          // Given: 季節パターンのあるデータ
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };
          const baseTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 1週間前から

          // When: 時間別に変動するデータ記録
          for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
              // 9-17時にピークを作る
              const count = hour >= 9 && hour <= 17 ? 20 : 5;

              for (let i = 0; i < count; i++) {
                const timestamp =
                  baseTime + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000 + i * 60 * 1000;
                mockDate.mockReturnValue(timestamp);
                analyticsEngine.recordEvaluation(
                  FEATURE_FLAGS.ENHANCED_SECURITY,
                  context,
                  true,
                  50
                );
              }
            }
          }

          // When: 負荷予測実行
          const prediction = analyticsEngine.predictLoad(FEATURE_FLAGS.ENHANCED_SECURITY, 24);

          // Then: 季節パターンが検出される
          expect(prediction.seasonality).toHaveLength(1);
          expect(prediction.seasonality[0].type).toBe('hourly');
          expect(prediction.seasonality[0].amplitude).toBeGreaterThan(0.3);
        });
      });
    });
  });

  describe('Optimization Recommendations', () => {
    describe('GIVEN performance metrics', () => {
      describe('WHEN generating optimization recommendations', () => {
        it('THEN recommends cache TTL optimization for slow responses', () => {
          // Given: 遅いレスポンス時間のメトリクス
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 遅いレスポンス時間で評価記録
          for (let i = 0; i < 10; i++) {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 150); // 150ms
          }

          // When: 最適化提案生成
          const recommendations = analyticsEngine.generateOptimizationRecommendations(
            FEATURE_FLAGS.BILLING_V2
          );

          // Then: キャッシュTTL最適化が提案される
          const cacheRecommendation = recommendations.find(r => r.type === 'cache_ttl');
          expect(cacheRecommendation).toBeDefined();
          expect(cacheRecommendation?.priority).toBe('high');
          expect(cacheRecommendation?.expectedImprovement).toBe(0.6);
          expect(cacheRecommendation?.description).toContain('レスポンス時間が100msを超えています');
        });

        it('THEN recommends regional deployment for concentrated traffic', () => {
          // Given: 特定地域に集中したトラフィック
          const regions = [
            { region: 'US', count: 80 },
            { region: 'EU', count: 15 },
            { region: 'APAC', count: 5 },
          ];

          // When: 地域別評価記録
          regions.forEach(({ region, count }) => {
            for (let i = 0; i < count; i++) {
              const context: FeatureFlagContext = {
                tenantId: 'test',
                userId: `user-${i}`,
                region,
              };
              analyticsEngine.recordEvaluation(FEATURE_FLAGS.NEW_DASHBOARD, context, true, 50);
            }
          });

          // When: 最適化提案生成
          const recommendations = analyticsEngine.generateOptimizationRecommendations(
            FEATURE_FLAGS.NEW_DASHBOARD
          );

          // Then: 地域分散デプロイメントが提案される
          const regionalRecommendation = recommendations.find(
            r => r.type === 'regional_deployment'
          );
          expect(regionalRecommendation).toBeDefined();
          expect(regionalRecommendation?.priority).toBe('medium');
          expect(regionalRecommendation?.description).toContain(
            'US地域からのアクセスが70%を超えています'
          );
        });

        it('THEN recommends rollout strategy for partial enablement', () => {
          // Given: 部分的な有効化状態
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 30%の有効化率で評価記録
          for (let i = 0; i < 100; i++) {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.ADVANCED_ANALYTICS, context, i < 30, 50);
          }

          // When: 最適化提案生成
          const recommendations = analyticsEngine.generateOptimizationRecommendations(
            FEATURE_FLAGS.ADVANCED_ANALYTICS
          );

          // Then: ロールアウト戦略が提案される
          const rolloutRecommendation = recommendations.find(r => r.type === 'rollout_strategy');
          expect(rolloutRecommendation).toBeDefined();
          expect(rolloutRecommendation?.priority).toBe('low');
          expect(rolloutRecommendation?.description).toContain('現在の有効化率は30.');
        });

        it('THEN sorts recommendations by priority', () => {
          // Given: 複数の最適化対象条件
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user', region: 'US' };

          // When: 遅いレスポンス（高優先度）と集中トラフィック（中優先度）の両方
          for (let i = 0; i < 100; i++) {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.ENHANCED_SECURITY, context, i < 50, 120);
          }

          // When: 最適化提案生成
          const recommendations = analyticsEngine.generateOptimizationRecommendations(
            FEATURE_FLAGS.ENHANCED_SECURITY
          );

          // Then: 優先度順でソートされる
          expect(recommendations[0].priority).toBe('high'); // cache_ttl
          expect(recommendations[1].priority).toBe('medium'); // regional_deployment
          expect(recommendations[2].priority).toBe('low'); // rollout_strategy
        });
      });
    });
  });

  describe('System Statistics and Summary', () => {
    describe('GIVEN multiple flag metrics', () => {
      describe('WHEN generating system summary', () => {
        it('THEN provides comprehensive system statistics', () => {
          // Given: 複数フラグのメトリクス
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          const flagConfigs = [
            { flag: FEATURE_FLAGS.BILLING_V2, count: 100, responseTime: 40 },
            { flag: FEATURE_FLAGS.NEW_DASHBOARD, count: 80, responseTime: 60 },
            { flag: FEATURE_FLAGS.ADVANCED_ANALYTICS, count: 60, responseTime: 30 },
            { flag: FEATURE_FLAGS.REAL_TIME_NOTIFICATIONS, count: 40, responseTime: 70 },
            { flag: FEATURE_FLAGS.ENHANCED_SECURITY, count: 20, responseTime: 50 },
          ];

          // When: 各フラグの評価記録
          flagConfigs.forEach(({ flag, count, responseTime }) => {
            for (let i = 0; i < count; i++) {
              analyticsEngine.recordEvaluation(flag, context, true, responseTime);
            }
          });

          // When: システムサマリー生成
          const summary = analyticsEngine.generateStatsSummary();

          // Then: 正確な統計が生成される
          expect(summary.totalEvaluations).toBe(300); // 100+80+60+40+20
          expect(summary.averageResponseTime).toBe(50); // (40+60+30+70+50)/5
          expect(summary.topFlags).toHaveLength(5);
          expect(summary.topFlags[0]).toEqual({
            flagKey: FEATURE_FLAGS.BILLING_V2,
            evaluationCount: 100,
          });
          expect(summary.systemHealth).toBe('good'); // 50ms is in 'good' range
        });

        it('THEN calculates system health correctly', () => {
          // Given: 優秀なパフォーマンスのメトリクス
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 高速レスポンスで評価記録
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 25);

          // When: システムサマリー生成
          const summary = analyticsEngine.generateStatsSummary();

          // Then: 優秀な健康状態が報告される
          expect(summary.systemHealth).toBe('excellent'); // <50ms
          expect(summary.averageResponseTime).toBe(25);
        });

        it('THEN handles empty metrics gracefully', () => {
          // Given: メトリクスが記録されていない状態

          // When: システムサマリー生成
          const summary = analyticsEngine.generateStatsSummary();

          // Then: エラーなくデフォルト値が返される
          expect(summary.totalEvaluations).toBe(0);
          expect(summary.averageResponseTime).toBe(0);
          expect(summary.topFlags).toEqual([]);
          expect(summary.systemHealth).toBe('excellent'); // デフォルトで優秀
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('GIVEN unexpected input conditions', () => {
      describe('WHEN handling edge cases', () => {
        it('THEN handles null/undefined contexts gracefully', () => {
          // Given: 不完全なコンテキスト
          const incompleteContext: FeatureFlagContext = { tenantId: 'test' };

          // When: 不完全なコンテキストで評価記録
          expect(() => {
            analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, incompleteContext, true, 50);
          }).not.toThrow();

          // Then: メトリクスが記録される
          const metrics = analyticsEngine.getMetrics(FEATURE_FLAGS.BILLING_V2);
          expect(metrics?.evaluationCount).toBe(1);
        });

        it('THEN handles extreme response times', () => {
          // Given: 極端なレスポンス時間
          const context: FeatureFlagContext = { tenantId: 'test', userId: 'user' };

          // When: 極端な値で評価記録
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 0);
          analyticsEngine.recordEvaluation(FEATURE_FLAGS.BILLING_V2, context, true, 10000);

          // Then: 平均値が正しく計算される
          const metrics = analyticsEngine.getMetrics(FEATURE_FLAGS.BILLING_V2);
          expect(metrics?.avgResponseTime).toBe(5000); // (0 + 10000) / 2
        });

        it('THEN returns null for non-existent flag metrics', () => {
          // Given: 記録されていないフラグ

          // When: 存在しないフラグのメトリクス取得
          const metrics = analyticsEngine.getMetrics(FEATURE_FLAGS.BILLING_V2);

          // Then: nullが返される
          expect(metrics).toBeNull();
        });

        it('THEN handles analysis of non-existent flag patterns', () => {
          // Given: 記録されていないフラグ

          // When: 存在しないフラグのパターン分析
          const pattern = analyticsEngine.analyzeUsagePattern(FEATURE_FLAGS.BILLING_V2);

          // Then: 空のパターンが返される
          expect(pattern).toEqual({
            timeOfDay: {},
            dayOfWeek: {},
            regionalDistribution: {},
            userCohorts: {},
          });
        });
      });
    });
  });
});
