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
  weight: number; // 0-100の重み配分
  config: Record<string, any>; // バリエーション固有の設定
}

export interface ABTestConfig {
  testId: string;
  name: string;
  description?: string;
  isActive: boolean;
  variants: ABTestVariant[];
  trafficAllocation: number; // 0-100, テスト対象ユーザーの割合
  startDate?: string;
  endDate?: string;
  targetSegments?: string[]; // ユーザーセグメント
  conversionMetric?: string; // コンバージョン指標
}

export interface ABTestContext extends FeatureFlagContext {
  sessionId?: string;
  experiment?: string;
  previousVariants?: Record<string, string>; // 既存の実験バリアント
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

export class ABTestEngine {
  /**
   * A/Bテストバリアント選択
   * 一貫したユーザー体験を保証するハッシュベース分散
   */
  async assignVariant(
    context: ABTestContext,
    flagKey: FeatureFlagKey,
    testConfig: ABTestConfig
  ): Promise<ABTestResult> {
    // 1. テストのアクティブ状態確認
    if (!testConfig.isActive) {
      return this.getControlVariant(testConfig);
    }

    // 2. 時間窓チェック
    if (!this.isWithinTestPeriod(testConfig, context.timestamp)) {
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
  async assignMultipleVariants(
    context: ABTestContext,
    experiments: Array<{ flagKey: FeatureFlagKey; testConfig: ABTestConfig }>
  ): Promise<ABTestResult[]> {
    const results: ABTestResult[] = [];
    
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
  async trackConversion(
    testId: string,
    variantId: string,
    userId: string,
    conversionValue?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
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

  private isWithinTestPeriod(config: ABTestConfig, timestamp?: string): boolean {
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

  private isInTrafficAllocation(
    context: ABTestContext,
    flagKey: FeatureFlagKey,
    trafficAllocation: number
  ): boolean {
    if (trafficAllocation >= 100) return true;
    if (trafficAllocation <= 0) return false;
    
    const hash = this.generateUserHash(context.userId || '', `${flagKey}-traffic`);
    const userPercentile = hash % 100;
    
    return userPercentile < trafficAllocation;
  }

  private matchesTargetSegment(context: ABTestContext, targetSegments?: string[]): boolean {
    if (!targetSegments || targetSegments.length === 0) {
      return true;
    }
    
    // ユーザーセグメント情報から判定
    const userSegments = context.metadata?.segments as string[] || [];
    return targetSegments.some(segment => userSegments.includes(segment));
  }

  private selectVariant(
    context: ABTestContext,
    flagKey: FeatureFlagKey,
    testConfig: ABTestConfig
  ): ABTestVariant {
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

  private getControlVariant(testConfig: ABTestConfig): ABTestResult {
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

  private getControlVariantFromConfig(testConfig: ABTestConfig): ABTestVariant {
    // コントロールバリアントを探す
    const controlVariant = testConfig.variants.find(v => v.id === 'control');
    if (controlVariant) return controlVariant;
    
    // コントロールがない場合は最初のバリアント
    if (testConfig.variants.length > 0) return testConfig.variants[0];
    
    // デフォルトコントロール
    return {
      id: 'control',
      name: 'Control',
      weight: 100,
      config: {}
    };
  }

  private generateUserHash(userId: string, seed: string): number {
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

/**
 * A/Bテスト統計分析ヘルパー
 */
export class ABTestAnalytics {
  /**
   * 統計的有意性の計算
   */
  calculateSignificance(
    controlMetrics: ABTestMetrics,
    variantMetrics: ABTestMetrics,
    confidenceLevel: number = 0.95
  ): {
    pValue: number;
    isSignificant: boolean;
    confidenceInterval: [number, number];
    improvement: number;
  } {
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