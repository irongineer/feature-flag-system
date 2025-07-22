import { vi } from 'vitest';
import { FeatureFlagContext, FeatureFlagKey, FEATURE_FLAGS } from '@feature-flag/core';

/**
 * Mock Factory for SDK Testing
 * 
 * t-wada TDD原則に基づくテストモック生成ファクトリー
 * 外部API品質保証のための包括的モック作成機能
 */

// Standard test contexts for different scenarios
export const TEST_CONTEXTS = {
  ENTERPRISE_USER: {
    tenantId: 'enterprise-tenant-001',
    userId: 'enterprise-user-001',
    userRole: 'admin',
    plan: 'enterprise',
    environment: 'production',
    metadata: {
      region: 'us-east-1',
      customerTier: 'premium'
    }
  } as FeatureFlagContext,

  STANDARD_USER: {
    tenantId: 'standard-tenant-002',
    userId: 'standard-user-002',
    userRole: 'user',
    plan: 'standard',
    environment: 'production',
    metadata: {
      region: 'us-west-2'
    }
  } as FeatureFlagContext,

  TRIAL_USER: {
    tenantId: 'trial-tenant-003',
    userId: 'trial-user-003',
    userRole: 'user',
    plan: 'trial',
    environment: 'production',
    metadata: {
      region: 'eu-west-1',
      trialExpiry: '2025-12-31'
    }
  } as FeatureFlagContext,

  MINIMAL_CONTEXT: {
    tenantId: 'minimal-tenant-004',
    environment: 'production'
  } as FeatureFlagContext,

  INVALID_CONTEXT: {
    // Missing required tenantId
    userId: 'invalid-user',
    environment: 'production'
  } as Partial<FeatureFlagContext>
};

// HTTP Response factories for different API scenarios
export class HttpResponseFactory {
  static success(flagKey: FeatureFlagKey, enabled: boolean = false, reason: string = 'Test response') {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        enabled,
        flagKey,
        reason,
        cached: false
      })
    } as unknown as Response;
  }

  static multipleFlags(flags: Record<string, boolean>) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        flags,
        cached: false
      })
    } as unknown as Response;
  }

  static badRequest(message: string = 'Invalid request') {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'INVALID_REQUEST'
      })
    } as unknown as Response;
  }

  static unauthorized(message: string = 'Invalid API key') {
    return {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'UNAUTHORIZED'
      })
    } as unknown as Response;
  }

  static forbidden(message: string = 'Access denied') {
    return {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'FORBIDDEN'
      })
    } as unknown as Response;
  }

  static notFound(message: string = 'Resource not found') {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'NOT_FOUND'
      })
    } as unknown as Response;
  }

  static rateLimited(retryAfter: number = 60) {
    return {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString()
      }),
      json: vi.fn().mockResolvedValue({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter
      })
    } as unknown as Response;
  }

  static serverError(message: string = 'Internal server error') {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'INTERNAL_ERROR'
      })
    } as unknown as Response;
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable') {
    return {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: message,
        code: 'SERVICE_UNAVAILABLE'
      })
    } as unknown as Response;
  }

  static timeout(delay: number = 6000) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout'));
      }, delay);
    });
  }
}

// Mock evaluator factory for integration testing
export const createMockEvaluator = (overrides: Partial<any> = {}) => {
  return {
    isEnabled: vi.fn().mockResolvedValue(false),
    invalidateCache: vi.fn().mockResolvedValue(undefined),
    invalidateAllCache: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
};

// Mock cache factory for testing cache behavior
export const createMockCache = (overrides: Partial<any> = {}) => {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    isExpired: vi.fn().mockReturnValue(false),
    ...overrides
  };
};

// Performance test data generation
export const generateLoadTestData = (count: number = 100): FeatureFlagContext[] => {
  return Array.from({ length: count }, (_, i) => ({
    tenantId: `load-test-tenant-${Math.floor(i / 10)}`, // 10 users per tenant
    userId: `load-user-${i}`,
    userRole: ['user', 'admin', 'viewer'][i % 3],
    plan: ['free', 'standard', 'enterprise'][i % 3],
    environment: 'production',
    metadata: {
      batchId: Math.floor(i / 10),
      index: i
    }
  }));
};

// API request validation helpers
export const validateApiRequest = (fetchCall: any, expectedOptions: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) => {
  const [actualUrl, actualOptions] = fetchCall;
  
  if (expectedOptions.url) {
    expect(actualUrl).toBe(expectedOptions.url);
  }
  
  if (expectedOptions.method) {
    expect(actualOptions.method).toBe(expectedOptions.method);
  }
  
  if (expectedOptions.headers) {
    Object.entries(expectedOptions.headers).forEach(([key, value]) => {
      expect(actualOptions.headers[key]).toBe(value);
    });
  }
  
  if (expectedOptions.body) {
    expect(JSON.parse(actualOptions.body)).toEqual(expectedOptions.body);
  }
};

// Retry behavior testing helper
export const simulateRetryScenario = (attempts: Response[], finalSuccess: boolean = true) => {
  const fetchMock = global.fetch as any;
  
  attempts.forEach((response, index) => {
    fetchMock.mockResolvedValueOnce(response);
  });
  
  if (finalSuccess) {
    fetchMock.mockResolvedValueOnce(HttpResponseFactory.success(FEATURE_FLAGS.BILLING_V2, true));
  }
};