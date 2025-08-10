import { FeatureFlagKey, FeatureFlagContext } from '@feature-flag/core';

/**
 * HTTP Client for Feature Flag API
 * 
 * SDK HTTP統合テスト用のAPIクライアント
 * 認証・リトライ・エラーハンドリング機能を提供
 */

export interface HttpClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface EvaluationRequest {
  tenantId: string;
  flagKey: FeatureFlagKey;
  context?: Partial<FeatureFlagContext>;
}

export interface EvaluationResponse {
  enabled: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export class HttpClient {
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  async evaluateFlag(request: EvaluationRequest): Promise<EvaluationResponse> {
    const url = `${this.config.baseUrl}/api/evaluate`;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        const response = await this.makeRequest(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(request),
        });

        if (response.ok) {
          return await response.json() as EvaluationResponse;
        }

        // 4xx エラーはリトライしない（即座に失敗）
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Client error: ${response.status} ${response.statusText}`);
        }

        // 5xx エラーは最後の試行でない限りリトライ
        if (response.status >= 500) {
          if (attempt === this.config.retryAttempts) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
          // リトライ前に待機
          await this.delay(this.config.retryDelay! * attempt);
          continue;
        }

        // その他の予期しないレスポンス
        throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);

      } catch (error) {
        // 4xxエラーや明確なエラーはそのまま投げる
        if (error instanceof Error && (
          error.message.includes('Client error') ||
          error.message.includes('Request timeout') ||
          error.message.includes('Unexpected response')
        )) {
          throw error;
        }

        // ネットワークエラーなどはリトライ
        if (attempt === this.config.retryAttempts) {
          throw error;
        }
        
        // リトライ前に待機
        await this.delay(this.config.retryDelay! * attempt);
      }
    }

    throw new Error('Unexpected error in retry logic');
  }

  async listFlags(): Promise<Array<{ flagKey: string; description: string; enabled: boolean }>> {
    const url = `${this.config.baseUrl}/api/flags`;
    
    const response = await this.makeRequest(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list flags: ${response.status} ${response.statusText}`);
    }

    return await response.json() as { flagKey: string; description: string; enabled: boolean; }[];
  }

  async createFlag(flagData: {
    flagKey: string;
    description: string;
    defaultEnabled: boolean;
    owner: string;
  }): Promise<void> {
    const url = `${this.config.baseUrl}/api/flags`;
    
    const response = await this.makeRequest(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(flagData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create flag: ${response.status} ${response.statusText}`);
    }
  }

  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}