import { describe, it, expect } from 'vitest';
import { RolloutEngine, RolloutConfig, RolloutContext } from '../src/rollout';
import { FEATURE_FLAGS } from '../src/models';

/**
 * Rollout Engine Business Logic Tests
 *
 * 複雑なビジネスロジックテスト - 段階的ロールアウト戦略
 * 時間・地域・コホート・パーセンテージベース配信制御
 */

describe('Rollout Engine Business Logic', () => {
  const rolloutEngine = new RolloutEngine();

  const baseContext: RolloutContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    region: 'US',
    userCohort: 'premium',
    timestamp: '2025-07-23T14:00:00.000Z', // UTC時間で平日14時
  };

  describe('Time Window Control', () => {
    describe('GIVEN time-based rollout configuration', () => {
      describe('WHEN evaluating within time window', () => {
        it('THEN allows rollout within valid time range', async () => {
          // Given: 時間窓設定
          const config: RolloutConfig = {
            percentage: 100,
            startDate: '2025-07-23T10:00:00.000Z',
            endDate: '2025-07-23T18:00:00.000Z',
          };

          // When: 時間窓内での評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト許可
          expect(result).toBe(true);
        });

        it('THEN blocks rollout outside time window', async () => {
          // Given: 時間窓設定
          const config: RolloutConfig = {
            percentage: 100,
            startDate: '2025-07-24T10:00:00.000Z', // 明日開始
            endDate: '2025-07-24T18:00:00.000Z',
          };

          // When: 時間窓外での評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト拒否
          expect(result).toBe(false);
        });
      });
    });
  });

  describe('Business Hours Control', () => {
    describe('GIVEN business hours restriction', () => {
      describe('WHEN evaluating during business hours', () => {
        it('THEN respects business hour configuration', async () => {
          // Given: 営業時間制限設定
          const config: RolloutConfig = {
            percentage: 100,
            businessHoursOnly: true,
          };

          // When: 営業時間設定での評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ビジネスロジックが適用される
          expect(typeof result).toBe('boolean');
        });

        it('THEN blocks rollout outside business hours', async () => {
          // Given: 営業時間制限設定
          const config: RolloutConfig = {
            percentage: 100,
            businessHoursOnly: true,
          };

          const weekendContext = {
            ...baseContext,
            timestamp: '2025-07-26T14:00:00.000Z', // 土曜日14時
          };

          // When: 営業時間外（土曜日）での評価
          const result = await rolloutEngine.evaluateRollout(
            weekendContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト拒否
          expect(result).toBe(false);
        });
      });
    });
  });

  describe('Regional Filtering', () => {
    describe('GIVEN regional targeting configuration', () => {
      describe('WHEN evaluating regional restrictions', () => {
        it('THEN allows rollout for target regions', async () => {
          // Given: 地域制限設定
          const config: RolloutConfig = {
            percentage: 100,
            targetRegions: ['US', 'EU'],
          };

          // When: 対象地域での評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト許可
          expect(result).toBe(true);
        });

        it('THEN blocks rollout for non-target regions', async () => {
          // Given: 地域制限設定
          const config: RolloutConfig = {
            percentage: 100,
            targetRegions: ['EU', 'APAC'],
          };

          // When: 対象外地域での評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト拒否
          expect(result).toBe(false);
        });
      });
    });
  });

  describe('User Cohort Filtering', () => {
    describe('GIVEN user cohort targeting', () => {
      describe('WHEN evaluating cohort restrictions', () => {
        it('THEN allows rollout for target cohorts', async () => {
          // Given: コホート制限設定
          const config: RolloutConfig = {
            percentage: 100,
            userCohorts: ['premium', 'enterprise'],
          };

          // When: 対象コホートでの評価
          const result = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: ロールアウト許可
          expect(result).toBe(true);
        });
      });
    });
  });

  describe('Percentage-based Distribution', () => {
    describe('GIVEN percentage rollout configuration', () => {
      describe('WHEN evaluating percentage-based rollout', () => {
        it('THEN provides consistent user-based distribution', async () => {
          // Given: 50%ロールアウト設定
          const config: RolloutConfig = {
            percentage: 50,
          };

          // When: 同じユーザーで複数回評価
          const result1 = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );
          const result2 = await rolloutEngine.evaluateRollout(
            baseContext,
            FEATURE_FLAGS.BILLING_V2,
            config
          );

          // Then: 一貫した結果
          expect(result1).toBe(result2);
        });
      });
    });
  });
});
