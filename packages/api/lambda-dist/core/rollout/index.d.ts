import { FeatureFlagKey, FeatureFlagContext } from '../models';
/**
 * Advanced Rollout Engine
 *
 * 複雑なビジネスロジックエンジン - 段階的ロールアウト戦略
 * 時間ベース・パーセンテージベース・条件ベース配信制御
 */
export interface RolloutConfig {
    percentage: number;
    startDate?: string;
    endDate?: string;
    targetRegions?: string[];
    userCohorts?: string[];
    businessHoursOnly?: boolean;
}
export interface RolloutContext extends FeatureFlagContext {
    region?: string;
    userCohort?: string;
    timestamp?: string;
}
export declare class RolloutEngine {
    /**
     * 段階的ロールアウト判定
     * 複雑なビジネスルールによる配信制御
     */
    evaluateRollout(context: RolloutContext, flagKey: FeatureFlagKey, config: RolloutConfig): Promise<boolean>;
    private isWithinTimeWindow;
    private isBusinessHours;
    private matchesRegion;
    private matchesUserCohort;
    private evaluatePercentage;
    private generateUserHash;
}
