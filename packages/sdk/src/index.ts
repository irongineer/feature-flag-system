import { 
  FeatureFlagEvaluator, 
  FeatureFlagCache, 
  FeatureFlagKey, 
  FeatureFlagContext, 
  FEATURE_FLAGS 
} from '@feature-flag/core';

let globalCache: FeatureFlagCache | undefined;
let globalEvaluator: FeatureFlagEvaluator | undefined;

export function getFeatureFlagClient(): FeatureFlagEvaluator {
  if (!globalCache || globalCache.isExpired()) {
    globalCache = new FeatureFlagCache({ ttl: 300 }); // 5分
  }
  
  if (!globalEvaluator) {
    globalEvaluator = new FeatureFlagEvaluator({ cache: globalCache });
  }
  
  return globalEvaluator;
}

export async function isFeatureEnabled(
  tenantId: string,
  flagKey: FeatureFlagKey,
  context: Partial<FeatureFlagContext> = {}
): Promise<boolean> {
  const client = getFeatureFlagClient();
  const fullContext: FeatureFlagContext = {
    tenantId,
    ...context,
  };
  
  return client.isEnabled(fullContext, flagKey);
}

export class FeatureFlagClient {
  private evaluator: FeatureFlagEvaluator;

  constructor(options: { cache?: FeatureFlagCache } = {}) {
    const cache = options.cache || new FeatureFlagCache({ ttl: 300 });
    this.evaluator = new FeatureFlagEvaluator({ cache });
  }

  async isEnabled(
    context: FeatureFlagContext,
    flagKey: FeatureFlagKey
  ): Promise<boolean> {
    try {
      return await this.evaluator.isEnabled(context, flagKey);
    } catch (error) {
      console.error('FeatureFlag evaluation failed:', error);
      return false; // フェイルセーフ
    }
  }

  async invalidateCache(tenantId: string, flagKey: FeatureFlagKey): Promise<void> {
    await this.evaluator.invalidateCache(tenantId, flagKey);
  }

  async invalidateAllCache(): Promise<void> {
    await this.evaluator.invalidateAllCache();
  }
}

// 便利関数のエクスポート
export { FEATURE_FLAGS, FeatureFlagKey, FeatureFlagContext } from '@feature-flag/core';