import { vi } from 'vitest';

/**
 * SDK Test Setup Configuration
 * 
 * t-wada TDD原則に基づくSDK外部API品質保証テスト環境構築
 * - HTTP Client Mock設定
 * - Authentication Mock設定  
 * - Error Handling Mock設定
 * - Performance測定ユーティリティ
 */

// Global fetch mock for HTTP client testing
global.fetch = vi.fn();

// Console methods mock（テスト出力をクリーンに保つ）
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Reset fetch mock to default success response
  (global.fetch as any).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({
      enabled: false,
      flagKey: 'test-flag',
      reason: 'Default test response'
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  });
});

// Performance testing utility
export const measurePerformance = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

// HTTP Response mock factory
export const createMockResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: any;
  delay?: number;
}): Response => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    body = {},
    delay = 0
  } = options;

  const response = {
    ok,
    status,
    statusText,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: vi.fn().mockImplementation(async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return body;
    })
  } as unknown as Response;

  return response;
};

// Network error simulation
export const simulateNetworkError = (errorType: 'timeout' | 'network' | 'dns' = 'network') => {
  const errors = {
    timeout: new Error('Request timeout'),
    network: new Error('Network error'),
    dns: new Error('DNS resolution failed')
  };
  
  (global.fetch as any).mockRejectedValue(errors[errorType]);
};

// Authentication error simulation
export const simulateAuthError = (status = 401, statusText = 'Unauthorized') => {
  (global.fetch as any).mockResolvedValue(createMockResponse({
    ok: false,
    status,
    statusText,
    body: { error: 'Authentication failed' }
  }));
};