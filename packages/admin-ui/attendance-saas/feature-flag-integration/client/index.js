/**
 * Feature Flag Client for Attendance Management SaaS
 * 
 * 勤怠管理SaaS用フィーチャーフラグクライアント
 */

class FeatureFlagClient {
  constructor(config) {
    this.apiEndpoint = config.apiEndpoint || 'https://7wslqwkrvj.execute-api.ap-northeast-1.amazonaws.com/featureflagprodlambda';
    this.tenantId = config.tenantId || 'attendance-tenant-001';
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5分
  }

  /**
   * フィーチャーフラグの状態を評価
   */
  async isEnabled(flagKey, userId = null) {
    try {
      // キャッシュチェック
      const cacheKey = `${this.tenantId}:${flagKey}:${userId || 'global'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        console.log(`[FeatureFlag] Cache hit for ${flagKey}:`, cached.enabled);
        return cached.enabled;
      }

      // API呼び出し
      const response = await fetch(`${this.apiEndpoint}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: this.tenantId,
          flagKey,
          userId,
          context: {
            timestamp: new Date().toISOString(),
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
          }
        })
      });

      if (!response.ok) {
        console.error(`[FeatureFlag] API error for ${flagKey}:`, response.status);
        return this.getDefaultValue(flagKey);
      }

      const result = await response.json();
      const enabled = result.enabled || false;

      // キャッシュ更新
      this.cache.set(cacheKey, {
        enabled,
        timestamp: Date.now()
      });

      console.log(`[FeatureFlag] Evaluated ${flagKey}:`, enabled);
      return enabled;

    } catch (error) {
      console.error(`[FeatureFlag] Error evaluating ${flagKey}:`, error);
      return this.getDefaultValue(flagKey);
    }
  }

  /**
   * デフォルト値を取得（フェイルセーフ）
   */
  getDefaultValue(flagKey) {
    const defaults = {
      'attendance_new_dashboard': false,
      'attendance_mobile_app': false,
      'attendance_ai_suggestions': false,
      'attendance_realtime_notifications': true,
      'attendance_advanced_reporting': false
    };
    
    return defaults[flagKey] || false;
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.cache.clear();
    console.log('[FeatureFlag] Cache cleared');
  }

  /**
   * 複数フラグの一括評価
   */
  async evaluateMultiple(flagKeys, userId = null) {
    const results = {};
    
    // 並列実行で高速化
    const promises = flagKeys.map(async (flagKey) => {
      const enabled = await this.isEnabled(flagKey, userId);
      return { flagKey, enabled };
    });

    const evaluations = await Promise.all(promises);
    
    evaluations.forEach(({ flagKey, enabled }) => {
      results[flagKey] = enabled;
    });

    return results;
  }
}

// Node.js環境での使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeatureFlagClient;
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.FeatureFlagClient = FeatureFlagClient;
}