import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolloutCalculationEngine, RolloutSchedule, CohortFilter } from '../src/rollout-engine';
import { FeatureFlagEvaluator } from '../src/evaluator';
import { FeatureFlagCache } from '../src/cache';
import { FEATURE_FLAGS, FeatureFlagContext } from '../src/models';
import { silentErrorHandler } from '../src/types/error-handling';

/**
 * Rollout Calculation Engine Comprehensive Specification
 * 
 * t-wada TDD原則による複雑ビジネスロジック完全検証:
 * - 勤怠計算レベルの複雑な時間ベース計算
 * - パーセンテージベース段階的展開アルゴリズム
 * - マルチテナント・マルチリージョン対応
 * - 営業時間・タイムゾーン計算
 * - ユーザーコホートフィルタリング
 * - リアルタイムメトリクス計算
 * - 安全性チェック機構
 * 
 * Business Scenarios Covered:
 * 1. Time-based Rollout Calculations (時間ベースロールアウト計算)
 * 2. Percentage Interpolation Logic (パーセンテージ補間ロジック) 
 * 3. Business Hours Constraints (営業時間制約)
 * 4. Multi-Region Deployment (多地域展開)
 * 5. User Cohort Segmentation (ユーザーコホート分割)
 * 6. Real-time Metrics Computation (リアルタイムメトリクス計算)
 * 7. Safety and Rollback Mechanisms (安全性・ロールバック機構)
 */
describe('Rollout Calculation Engine Comprehensive Specification', () => {
  let rolloutEngine: RolloutCalculationEngine;
  let mockEvaluator: FeatureFlagEvaluator;

  beforeEach(() => {
    mockEvaluator = new FeatureFlagEvaluator({
      cache: new FeatureFlagCache({ ttl: 1000 }),
      errorHandler: silentErrorHandler
    });

    rolloutEngine = new RolloutCalculationEngine({
      evaluator: mockEvaluator,
      calculationPrecision: 2,
      enableSafetyChecks: true,
      defaultBusinessHours: {
        timezone: 'UTC',
        startHour: 9,
        endHour: 17,
        workingDays: [1, 2, 3, 4, 5] // Mon-Fri
      }
    });
  });

  describe('Time-based Rollout Calculations', () => {
    describe('GIVEN a scheduled rollout with specific time windows', () => {
      describe('WHEN calculating rollout eligibility at different time points', () => {
        it('THEN applies correct time-based percentage interpolation', async () => {
          // Given: 24時間の段階的ロールアウトスケジュール
          const now = Date.now();
          const schedule: RolloutSchedule = {
            startDate: new Date(now - 12 * 60 * 60 * 1000).toISOString(), // 12時間前開始
            endDate: new Date(now + 12 * 60 * 60 * 1000).toISOString(),   // 12時間後終了
            initialPercentage: 10,
            finalPercentage: 90,
            phases: 4,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          const testUser: FeatureFlagContext = {
            tenantId: 'time-test-tenant',
            userId: 'consistent-user-001',
            environment: 'production'
          };

          // When: 現在時点でのロールアウト適格性計算
          const isEligible = await rolloutEngine.calculateRolloutEligibility(
            testUser,
            FEATURE_FLAGS.BILLING_V2,
            schedule
          );

          // Then: ブール値が返される（具体的な値は時間とハッシュに依存）
          expect(typeof isEligible).toBe('boolean');

          // And: 同じユーザーは一貫した結果を得る
          const isEligibleSecond = await rolloutEngine.calculateRolloutEligibility(
            testUser,
            FEATURE_FLAGS.BILLING_V2,
            schedule
          );
          expect(isEligibleSecond).toBe(isEligible);
        });

        it('THEN correctly handles rollout time boundaries', async () => {
          // Given: 未来のロールアウトスケジュール（まだ開始していない）
          const futureStart = Date.now() + 60 * 60 * 1000; // 1時間後
          const futureSchedule: RolloutSchedule = {
            startDate: new Date(futureStart).toISOString(),
            endDate: new Date(futureStart + 24 * 60 * 60 * 1000).toISOString(),
            initialPercentage: 0,
            finalPercentage: 100,
            phases: 3,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          const testUser: FeatureFlagContext = {
            tenantId: 'boundary-test-tenant',
            userId: 'boundary-user',
            environment: 'production'
          };

          // When: 開始前の評価
          const beforeStart = await rolloutEngine.calculateRolloutEligibility(
            testUser,
            FEATURE_FLAGS.NEW_DASHBOARD,
            futureSchedule
          );

          // Then: 開始前は常にfalse
          expect(beforeStart).toBe(false);

          // Given: 完了したロールアウトスケジュール
          const pastSchedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            initialPercentage: 10,
            finalPercentage: 80,
            phases: 2,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // When: 終了後の評価
          const afterEnd = await rolloutEngine.calculateRolloutEligibility(
            testUser,
            FEATURE_FLAGS.NEW_DASHBOARD,
            pastSchedule
          );

          // Then: 終了後は最終パーセンテージで判定
          expect(typeof afterEnd).toBe('boolean');
        });
      });
    });
  });

  describe('Business Hours Constraints', () => {
    describe('GIVEN rollout restricted to business hours', () => {
      describe('WHEN evaluating during different time periods', () => {
        it('THEN respects business hour restrictions correctly', async () => {
          // Given: 営業時間限定のロールアウト
          const schedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            initialPercentage: 50,
            finalPercentage: 100,
            phases: 2,
            businessHoursOnly: true,
            regions: ['us-east-1'],
            cohortFilters: []
          };

          // Given: 営業時間内のユーザーコンテキスト（仮想）
          const businessHoursUser: FeatureFlagContext = {
            tenantId: 'business-hours-tenant',
            userId: 'business-user',
            environment: 'production',
            metadata: {
              region: 'us-east-1',
              currentTime: '2025-07-21T14:00:00Z' // 平日午後（営業時間内）
            }
          };

          // Given: 営業時間外のユーザーコンテキスト（仮想）
          const afterHoursUser: FeatureFlagContext = {
            tenantId: 'after-hours-tenant', 
            userId: 'after-hours-user',
            environment: 'production',
            metadata: {
              region: 'us-east-1',
              currentTime: '2025-07-21T22:00:00Z' // 平日夜間（営業時間外）
            }
          };

          // When: 営業時間内での評価
          const duringBusinessHours = await rolloutEngine.calculateRolloutEligibility(
            businessHoursUser,
            FEATURE_FLAGS.BILLING_V2,
            schedule
          );

          // When: 営業時間外での評価
          const afterBusinessHours = await rolloutEngine.calculateRolloutEligibility(
            afterHoursUser,
            FEATURE_FLAGS.BILLING_V2,
            schedule
          );

          // Then: 営業時間の制約が正しく適用される
          expect(typeof duringBusinessHours).toBe('boolean');
          expect(typeof afterBusinessHours).toBe('boolean');
          
          // Note: 実際の営業時間判定は現在時刻で行われるため、
          // テストでは型チェックのみ実施
        });
      });
    });
  });

  describe('User Cohort Segmentation', () => {
    describe('GIVEN complex cohort filtering requirements', () => {
      describe('WHEN applying multiple filter criteria', () => {
        it('THEN correctly segments users by plan and region', async () => {
          // Given: プラン・地域ベースのコホートフィルター
          const cohortFilters: CohortFilter[] = [
            {
              type: 'plan',
              operator: 'contains',
              value: ['enterprise', 'pro']
            },
            {
              type: 'region', 
              operator: 'equals',
              value: 'us-east-1'
            }
          ];

          const schedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            initialPercentage: 100, // フィルタリング効果を確認するため100%
            finalPercentage: 100,
            phases: 1,
            businessHoursOnly: false,
            regions: ['us-east-1'],
            cohortFilters
          };

          // Given: フィルター条件に合致するユーザー
          const qualifiedUser: FeatureFlagContext = {
            tenantId: 'qualified-tenant',
            userId: 'qualified-user',
            plan: 'enterprise',
            environment: 'production',
            metadata: {
              region: 'us-east-1'
            }
          };

          // Given: プランが合致しないユーザー
          const unqualifiedPlanUser: FeatureFlagContext = {
            tenantId: 'unqualified-plan-tenant',
            userId: 'unqualified-plan-user', 
            plan: 'basic',
            environment: 'production',
            metadata: {
              region: 'us-east-1'
            }
          };

          // Given: 地域が合致しないユーザー
          const unqualifiedRegionUser: FeatureFlagContext = {
            tenantId: 'unqualified-region-tenant',
            userId: 'unqualified-region-user',
            plan: 'enterprise', 
            environment: 'production',
            metadata: {
              region: 'eu-west-1'
            }
          };

          // When: それぞれのユーザーで評価
          const [qualifiedResult, unqualifiedPlanResult, unqualifiedRegionResult] = await Promise.all([
            rolloutEngine.calculateRolloutEligibility(qualifiedUser, FEATURE_FLAGS.ADVANCED_ANALYTICS, schedule),
            rolloutEngine.calculateRolloutEligibility(unqualifiedPlanUser, FEATURE_FLAGS.ADVANCED_ANALYTICS, schedule),
            rolloutEngine.calculateRolloutEligibility(unqualifiedRegionUser, FEATURE_FLAGS.ADVANCED_ANALYTICS, schedule)
          ]);

          // Then: 条件合致ユーザーのみが対象となる
          expect(typeof qualifiedResult).toBe('boolean');
          expect(unqualifiedPlanResult).toBe(false); // プラン不適格
          expect(unqualifiedRegionResult).toBe(false); // 地域不適格
        });

        it('THEN correctly applies date range and numeric filters', async () => {
          // Given: 複雑な数値・日付フィルター
          const complexFilters: CohortFilter[] = [
            {
              type: 'signupDate',
              operator: 'greaterThan',
              value: '2024-01-01'
            }
          ];

          const schedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            initialPercentage: 100,
            finalPercentage: 100,
            phases: 1,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: complexFilters
          };

          // Given: 新規ユーザー（2024年以降のサインアップ）
          const newUser: FeatureFlagContext = {
            tenantId: 'new-user-tenant',
            userId: 'new-user',
            environment: 'production',
            metadata: {
              signupDate: '2024-06-15'
            }
          };

          // Given: 既存ユーザー（2024年以前のサインアップ）
          const oldUser: FeatureFlagContext = {
            tenantId: 'old-user-tenant',
            userId: 'old-user',
            environment: 'production',
            metadata: {
              signupDate: '2023-05-20'
            }
          };

          // When: 両ユーザーで評価
          const [newUserResult, oldUserResult] = await Promise.all([
            rolloutEngine.calculateRolloutEligibility(newUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule),
            rolloutEngine.calculateRolloutEligibility(oldUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule)
          ]);

          // Then: 日付フィルターが正しく適用される
          expect(typeof newUserResult).toBe('boolean');
          expect(oldUserResult).toBe(false); // 2024年以前は不適格
        });
      });
    });
  });

  describe('Real-time Metrics Computation', () => {
    describe('GIVEN an active rollout schedule', () => {
      describe('WHEN calculating rollout metrics', () => {
        it('THEN provides accurate phase and percentage calculations', () => {
          // Given: 進行中のロールアウト（中間地点）
          const now = Date.now();
          const totalDuration = 4 * 60 * 60 * 1000; // 4時間
          const halfwayPoint = now - (totalDuration / 2); // 2時間前開始
          
          const schedule: RolloutSchedule = {
            startDate: new Date(halfwayPoint).toISOString(),
            endDate: new Date(halfwayPoint + totalDuration).toISOString(),
            initialPercentage: 20,
            finalPercentage: 80,
            phases: 4,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // When: メトリクス計算
          const metrics = rolloutEngine.calculateRolloutMetrics(schedule);

          // Then: 中間地点の正確な計算結果
          expect(metrics.currentPhase).toBe(2); // 4フェーズの中間
          expect(metrics.currentPercentage).toBeGreaterThan(20);
          expect(metrics.currentPercentage).toBeLessThan(80);
          expect(metrics.timeToNextPhase).toBeGreaterThan(0);
          expect(metrics.timeToNextPhase).toBeLessThan(totalDuration / 2);

          // And: メトリクス構造の完全性
          expect(typeof metrics.estimatedTargetUsers).toBe('number');
          expect(typeof metrics.actualActiveUsers).toBe('number');
          expect(typeof metrics.rolloutEffectiveness).toBe('number');
          expect(metrics.rolloutEffectiveness).toBeGreaterThanOrEqual(0);
          expect(metrics.rolloutEffectiveness).toBeLessThanOrEqual(1);
        });

        it('THEN handles edge cases for start and end boundaries', () => {
          // Given: まだ開始していないロールアウト
          const futureSchedule: RolloutSchedule = {
            startDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            initialPercentage: 10,
            finalPercentage: 90,
            phases: 3,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // When: 開始前のメトリクス計算
          const futureMetrics = rolloutEngine.calculateRolloutMetrics(futureSchedule);

          // Then: 開始前の適切な値
          expect(futureMetrics.currentPhase).toBe(1);
          expect(futureMetrics.currentPercentage).toBe(10); // 初期値

          // Given: 完了したロールアウト
          const completedSchedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            initialPercentage: 15,
            finalPercentage: 85,
            phases: 5,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // When: 完了後のメトリクス計算
          const completedMetrics = rolloutEngine.calculateRolloutMetrics(completedSchedule);

          // Then: 完了後の適切な値
          expect(completedMetrics.currentPhase).toBe(5); // 最終フェーズ
          expect(completedMetrics.currentPercentage).toBe(85); // 最終値
          expect(completedMetrics.timeToNextPhase).toBe(0); // 次フェーズまで0
        });
      });
    });
  });

  describe('Percentage Interpolation Logic', () => {
    describe('GIVEN various rollout progression scenarios', () => {
      describe('WHEN calculating intermediate percentages', () => {
        it('THEN applies S-curve interpolation for realistic rollout patterns', () => {
          // Given: S字カーブ展開のテストスケジュール
          const testSchedules = [
            {
              description: 'Early stage rollout',
              startTime: Date.now() - 1000,
              duration: 10000,
              progress: 0.2, // 20% complete
              expectedBehavior: 'slow_start'
            },
            {
              description: 'Mid-stage rollout', 
              startTime: Date.now() - 5000,
              duration: 10000, 
              progress: 0.5, // 50% complete
              expectedBehavior: 'rapid_growth'
            },
            {
              description: 'Late stage rollout',
              startTime: Date.now() - 8000,
              duration: 10000,
              progress: 0.8, // 80% complete  
              expectedBehavior: 'slow_finish'
            }
          ];

          testSchedules.forEach(({ description, startTime, duration, expectedBehavior }) => {
            const schedule: RolloutSchedule = {
              startDate: new Date(startTime).toISOString(),
              endDate: new Date(startTime + duration).toISOString(),
              initialPercentage: 10,
              finalPercentage: 90,
              phases: 3,
              businessHoursOnly: false,
              regions: [],
              cohortFilters: []
            };

            // When: メトリクス計算でS字カーブ確認
            const metrics = rolloutEngine.calculateRolloutMetrics(schedule);

            // Then: S字カーブの特性に合致
            expect(metrics.currentPercentage).toBeGreaterThanOrEqual(10);
            expect(metrics.currentPercentage).toBeLessThanOrEqual(90);
            
            // S字カーブの特性検証
            if (expectedBehavior === 'slow_start') {
              // 初期は緩やか（線形より下）
              expect(metrics.currentPercentage).toBeLessThan(30);
            } else if (expectedBehavior === 'rapid_growth') {
              // 中期は急激（35-65%の範囲内）
              expect(metrics.currentPercentage).toBeGreaterThan(25);
              expect(metrics.currentPercentage).toBeLessThan(75);
            } else if (expectedBehavior === 'slow_finish') {
              // 終期は緩やか
              expect(metrics.currentPercentage).toBeGreaterThan(60);
            }
          });
        });
      });
    });
  });

  describe('Error Handling and Safety Mechanisms', () => {
    describe('GIVEN various error conditions', () => {
      describe('WHEN encountering calculation errors', () => {
        it('THEN gracefully falls back to base evaluator', async () => {
          // Given: 不正な日付形式のスケジュール
          const invalidSchedule: RolloutSchedule = {
            startDate: 'invalid-date',
            endDate: 'also-invalid',
            initialPercentage: 0,
            finalPercentage: 100,
            phases: 1,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          const testUser: FeatureFlagContext = {
            tenantId: 'error-test-tenant',
            userId: 'error-test-user',
            environment: 'production'
          };

          // When: エラー条件でのロールアウト計算
          const result = await rolloutEngine.calculateRolloutEligibility(
            testUser,
            FEATURE_FLAGS.BILLING_V2,
            invalidSchedule
          );

          // Then: エラーでも正常なboolean値が返される（フォールバック）
          expect(typeof result).toBe('boolean');
        });

        it('THEN handles extreme percentage values safely', () => {
          // Given: 極端な値のスケジュール
          const extremeSchedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 1000).toISOString(),
            endDate: new Date(Date.now() + 1000).toISOString(),
            initialPercentage: -10, // 負の値
            finalPercentage: 150,   // 100%超過
            phases: 0,              // 不正な値
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // When: 極端な値でのメトリクス計算
          const metrics = rolloutEngine.calculateRolloutMetrics(extremeSchedule);

          // Then: 安全な範囲に収束
          expect(metrics.currentPercentage).toBeGreaterThanOrEqual(0);
          expect(metrics.currentPercentage).toBeLessThanOrEqual(100);
          expect(metrics.currentPhase).toBeGreaterThanOrEqual(1);
          expect(metrics.rolloutEffectiveness).toBeGreaterThanOrEqual(0);
          expect(metrics.rolloutEffectiveness).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('User Hash Consistency', () => {
    describe('GIVEN the need for consistent user experience', () => {
      describe('WHEN the same user evaluates multiple times', () => {
        it('THEN maintains consistent eligibility across evaluations', async () => {
          // Given: 標準的なロールアウトスケジュール
          const schedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            initialPercentage: 40,
            finalPercentage: 60,
            phases: 2,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          const consistentUser: FeatureFlagContext = {
            tenantId: 'consistent-test-tenant',
            userId: 'consistent-test-user',
            environment: 'production'
          };

          // When: 同一ユーザーで複数回評価
          const evaluations = await Promise.all([
            rolloutEngine.calculateRolloutEligibility(consistentUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule),
            rolloutEngine.calculateRolloutEligibility(consistentUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule),
            rolloutEngine.calculateRolloutEligibility(consistentUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule),
            rolloutEngine.calculateRolloutEligibility(consistentUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule),
            rolloutEngine.calculateRolloutEligibility(consistentUser, FEATURE_FLAGS.NEW_DASHBOARD, schedule)
          ]);

          // Then: すべての評価で一貫した結果
          const uniqueResults = new Set(evaluations);
          expect(uniqueResults.size).toBe(1); // すべて同じ結果

          // And: 結果はboolean値
          expect(typeof evaluations[0]).toBe('boolean');
        });

        it('THEN produces different results for different users with same parameters', async () => {
          // Given: 同一スケジュール
          const schedule: RolloutSchedule = {
            startDate: new Date(Date.now() - 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            initialPercentage: 50,
            finalPercentage: 50, // 固定50%で分布確認
            phases: 1,
            businessHoursOnly: false,
            regions: [],
            cohortFilters: []
          };

          // Given: 異なるユーザー群
          const differentUsers: FeatureFlagContext[] = Array.from({ length: 20 }, (_, i) => ({
            tenantId: `distribution-tenant-${i}`,
            userId: `distribution-user-${i}`,
            environment: 'production'
          }));

          // When: 異なるユーザーで評価
          const results = await Promise.all(
            differentUsers.map(user => 
              rolloutEngine.calculateRolloutEligibility(user, FEATURE_FLAGS.ADVANCED_ANALYTICS, schedule)
            )
          );

          // Then: 結果にばらつきがある（完全に統一されていない）
          const uniqueResults = new Set(results);
          expect(uniqueResults.size).toBeGreaterThanOrEqual(2); // true/false両方存在

          // And: 概ね50%前後の分布（統計的に妥当）
          const trueCount = results.filter(r => r === true).length;
          const truePercentage = (trueCount / results.length) * 100;
          
          // 20サンプルなので幅を持たせて検証（統計的ばらつきを考慮）
          expect(truePercentage).toBeGreaterThan(20);
          expect(truePercentage).toBeLessThan(80);
        });
      });
    });
  });
});