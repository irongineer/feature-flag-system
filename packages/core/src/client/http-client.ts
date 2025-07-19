import { FeatureFlagContext, FeatureFlagKey } from '../models';

export interface FeatureFlagHttpClientOptions {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface EvaluationRequest {
  tenantId: string;
  flagKey: string;
  userId?: string;
  userRole?: string;
  plan?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface EvaluationResponse {
  enabled: boolean;
  flagKey: string;
  reason: string;
  cached?: boolean;
}

export class FeatureFlagHttpClient {
  private options: Required<FeatureFlagHttpClientOptions>;
  private defaultValues: Map<string, boolean> = new Map();

  constructor(options: FeatureFlagHttpClientOptions) {
    this.options = {
      timeout: 5000,
      retries: 2,
      ...options,
    };
  }

  async isEnabled(flagKey: FeatureFlagKey, context: FeatureFlagContext): Promise<boolean> {
    try {
      // コンテキスト検証
      if (!context.tenantId) {
        console.warn('tenantId is required in FeatureFlagContext');
        return this.getDefaultValue(flagKey);
      }

      // APIリクエスト構築（オプショナルフィールドは条件付きで追加）
      const requestPayload: EvaluationRequest = {
        tenantId: context.tenantId,
        flagKey,
        environment: context.environment || 'production'
      };

      // オプショナルフィールドをundefinedの場合は送信しない
      if (context.userId) requestPayload.userId = context.userId;
      if (context.userRole) requestPayload.userRole = context.userRole;
      if (context.plan) requestPayload.plan = context.plan;
      if (context.metadata) requestPayload.metadata = context.metadata;

      const response = await this.sendRequest('/evaluate', requestPayload);
      return response.enabled;

    } catch (error) {
      console.error(`Feature flag evaluation failed for ${flagKey}:`, error);
      return this.getDefaultValue(flagKey);
    }
  }

  async getAllFlags(context: FeatureFlagContext): Promise<Record<string, boolean>> {
    try {
      if (!context.tenantId) {
        console.warn('tenantId is required in FeatureFlagContext');
        return {};
      }

      const requestPayload: Omit<EvaluationRequest, 'flagKey'> = {
        tenantId: context.tenantId,
        environment: context.environment || 'production'
      };

      // オプショナルフィールドを条件付きで追加
      if (context.userId) requestPayload.userId = context.userId;
      if (context.userRole) requestPayload.userRole = context.userRole;
      if (context.plan) requestPayload.plan = context.plan;
      if (context.metadata) requestPayload.metadata = context.metadata;

      const response = await this.sendRequest('/evaluate-all', requestPayload);
      return response.flags || {};

    } catch (error) {
      console.error('Bulk flag evaluation failed:', error);
      return {};
    }
  }

  private async sendRequest(endpoint: string, payload: any): Promise<any> {
    const url = `${this.options.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.options.apiKey}`,
      'User-Agent': 'FeatureFlagClient/1.0.0'
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.retries) {
          // 指数バックオフでリトライ
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private getDefaultValue(flagKey: string): boolean {
    // 安全なデフォルト値を返す（通常は false）
    return this.defaultValues.get(flagKey) || false;
  }

  public setDefaultValue(flagKey: string, defaultValue: boolean): void {
    this.defaultValues.set(flagKey, defaultValue);
  }
}