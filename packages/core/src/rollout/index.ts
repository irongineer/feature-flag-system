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

export class RolloutEngine {
  /**
   * 段階的ロールアウト判定
   * 複雑なビジネスルールによる配信制御
   */
  async evaluateRollout(
    context: RolloutContext,
    flagKey: FeatureFlagKey,
    config: RolloutConfig
  ): Promise<boolean> {
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

  private isWithinTimeWindow(config: RolloutConfig, timestamp?: string): boolean {
    if (!timestamp) return true;
    
    const now = new Date(timestamp);
    
    if (config.startDate && now < new Date(config.startDate)) {
      return false;
    }
    
    if (config.endDate && now > new Date(config.endDate)) {
      return false;
    }
    
    return true;
  }

  private isBusinessHours(timestamp?: string): boolean {
    if (!timestamp) return true;
    
    const date = new Date(timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    // 平日9-18時のみ
    return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
  }

  private matchesRegion(config: RolloutConfig, userRegion?: string): boolean {
    if (!config.targetRegions || config.targetRegions.length === 0) {
      return true;
    }
    
    return userRegion ? config.targetRegions.includes(userRegion) : false;
  }

  private matchesUserCohort(config: RolloutConfig, userCohort?: string): boolean {
    if (!config.userCohorts || config.userCohorts.length === 0) {
      return true;
    }
    
    return userCohort ? config.userCohorts.includes(userCohort) : false;
  }

  private evaluatePercentage(
    config: RolloutConfig, 
    context: RolloutContext, 
    flagKey: FeatureFlagKey
  ): boolean {
    // ユーザーIDベースの一貫したハッシュ生成
    const hash = this.generateUserHash(context.userId || '', flagKey);
    const userPercentile = hash % 100;
    
    return userPercentile < config.percentage;
  }

  private generateUserHash(userId: string, flagKey: FeatureFlagKey): number {
    // 簡単なハッシュ関数（本格実装では crypto を使用）
    let hash = 0;
    const input = `${userId}-${flagKey}`;
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    return Math.abs(hash);
  }
}