import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, HttpClientConfig, EvaluationRequest } from '../src/http-client';
import { FEATURE_FLAGS } from '@feature-flag/core';

/**
 * SDK HTTP Client Integration Tests
 * 
 * HTTP通信の包括的テスト - 認証・リトライ・エラーハンドリング
 * TDD方式での段階的実装とモック戦略
 */

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SDK HTTP Client Integration Tests', () => {
  let httpClient: HttpClient;
  let config: HttpClientConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      baseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 100, // 短縮してテスト高速化
    };
    httpClient = new HttpClient(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Authentication Handling', () => {
    describe('GIVEN HTTP client with API key', () => {
      describe('WHEN making authenticated requests', () => {
        it('THEN includes Bearer token in headers', async () => {
          // Given: 認証ヘッダー付きリクエスト
          const request: EvaluationRequest = {
            tenantId: 'tenant-123',
            flagKey: FEATURE_FLAGS.BILLING_V2,
          };

          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ enabled: true }),
          });

          // When: 認証付きフラグ評価
          await httpClient.evaluateFlag(request);

          // Then: Bearerトークンがヘッダーに含まれる
          expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/api/evaluate',
            expect.objectContaining({
              headers: expect.objectContaining({
                'Authorization': 'Bearer test-api-key',
                'Content-Type': 'application/json',
              }),
            })
          );
        });

        it('THEN handles missing API key gracefully', async () => {
          // Given: APIキーなしのクライアント
          const clientWithoutKey = new HttpClient({
            baseUrl: 'https://api.example.com',
          });

          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ enabled: true }),
          });

          // When: 認証なしリクエスト
          await clientWithoutKey.evaluateFlag({
            tenantId: 'tenant-123',
            flagKey: FEATURE_FLAGS.BILLING_V2,
          });

          // Then: Authorizationヘッダーなし
          const callArgs = mockFetch.mock.calls[0][1];
          expect(callArgs.headers).not.toHaveProperty('Authorization');
        });
      });
    });
  });

  describe('Retry Logic Implementation', () => {
    describe('GIVEN server errors (5xx)', () => {
      describe('WHEN API returns temporary failures', () => {
        it('THEN retries with exponential backoff', async () => {
          // Given: リトライロジック設定
          vi.useFakeTimers();
          
          const request: EvaluationRequest = {
            tenantId: 'tenant-123',
            flagKey: FEATURE_FLAGS.BILLING_V2,
          };

          // 最初の2回は500エラー、3回目は成功
          mockFetch
            .mockResolvedValueOnce({
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
            })
            .mockResolvedValueOnce({
              ok: false,
              status: 502,
              statusText: 'Bad Gateway',
            })
            .mockResolvedValueOnce({
              ok: true,
              json: async () => ({ enabled: true }),
            });

          // When: リトライが必要なリクエスト実行
          const evaluatePromise = httpClient.evaluateFlag(request);
          
          // リトライ待機時間を進める
          await vi.advanceTimersByTimeAsync(100); // 1回目リトライ
          await vi.advanceTimersByTimeAsync(200); // 2回目リトライ

          const result = await evaluatePromise;

          // Then: 3回試行して成功
          expect(mockFetch).toHaveBeenCalledTimes(3);
          expect(result).toEqual({ enabled: true });
        });

        it('THEN fails after max retry attempts', async () => {
          // Given: すべてのリトライが失敗するシナリオ
          vi.useFakeTimers();

          mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });

          // When: 最大リトライ数を超えるエラー
          const evaluatePromise = httpClient.evaluateFlag({
            tenantId: 'tenant-123',
            flagKey: FEATURE_FLAGS.BILLING_V2,
          });

          // リトライ待機時間を進める
          await vi.advanceTimersByTimeAsync(100);
          await vi.advanceTimersByTimeAsync(200);
          await vi.advanceTimersByTimeAsync(300);

          // Then: エラーがスローされる
          await expect(evaluatePromise).rejects.toThrow('Server error: 500 Internal Server Error');
          expect(mockFetch).toHaveBeenCalledTimes(3);
        });
      });

      describe('WHEN API returns client errors (4xx)', () => {
        it('THEN does not retry client errors', async () => {
          // Given: クライアントエラー設定
          mockFetch.mockResolvedValue({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
          });

          // When: 認証エラーでリクエスト
          await expect(
            httpClient.evaluateFlag({
              tenantId: 'tenant-123',
              flagKey: FEATURE_FLAGS.BILLING_V2,
            })
          ).rejects.toThrow('Client error: 401 Unauthorized');

          // Then: リトライせずに即座に失敗
          expect(mockFetch).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe('Timeout Handling', () => {
    describe('GIVEN configured timeout', () => {
      describe('WHEN request exceeds timeout', () => {
        it('THEN aborts request and throws timeout error', async () => {
          // Given: タイムアウト設定
          const shortTimeoutClient = new HttpClient({
            ...config,
            timeout: 1000,
          });

          // AbortController のモック
          const mockAbort = vi.fn();
          const originalAbortController = global.AbortController;
          global.AbortController = vi.fn().mockImplementation(() => ({
            abort: mockAbort,
            signal: { aborted: false },
          }));

          // fetch がタイムアウトエラーを投げるようにモック
          mockFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

          // When: タイムアウトが発生するリクエスト
          await expect(
            shortTimeoutClient.evaluateFlag({
              tenantId: 'tenant-123',
              flagKey: FEATURE_FLAGS.BILLING_V2,
            })
          ).rejects.toThrow('Request timeout after 1000ms');

          // Then: AbortController が呼ばれる
          expect(global.AbortController).toHaveBeenCalled();
          
          // Cleanup
          global.AbortController = originalAbortController;
        });
      });
    });
  });

  describe('Error Response Handling', () => {
    describe('GIVEN various API error scenarios', () => {
      describe('WHEN handling network errors', () => {
        it('THEN handles network connectivity issues', async () => {
          // Given: ネットワークエラー設定
          mockFetch.mockRejectedValue(new Error('Network error'));

          // When: ネットワークエラーでリクエスト
          await expect(
            httpClient.evaluateFlag({
              tenantId: 'tenant-123',
              flagKey: FEATURE_FLAGS.BILLING_V2,
            })
          ).rejects.toThrow('Network error');

          // Then: リトライが実行される
          expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('THEN handles malformed JSON responses', async () => {
          // Given: 不正なJSONレスポンス
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => {
              throw new Error('Invalid JSON');
            },
          });

          // When: JSON解析エラー
          await expect(
            httpClient.evaluateFlag({
              tenantId: 'tenant-123',
              flagKey: FEATURE_FLAGS.BILLING_V2,
            })
          ).rejects.toThrow('Invalid JSON');
        });
      });
    });
  });

  describe('API Integration Methods', () => {
    describe('GIVEN flag evaluation API', () => {
      describe('WHEN evaluating flags', () => {
        it('THEN sends correct request format', async () => {
          // Given: フラグ評価リクエスト
          const request: EvaluationRequest = {
            tenantId: 'tenant-123',
            flagKey: FEATURE_FLAGS.BILLING_V2,
            context: {
              userId: 'user-456',
              userRole: 'admin',
            },
          };

          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
              enabled: true,
              reason: 'Default value',
              metadata: { version: '1.0' },
            }),
          });

          // When: フラグ評価実行
          const result = await httpClient.evaluateFlag(request);

          // Then: 正しいリクエスト形式
          expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/api/evaluate',
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify(request),
            })
          );

          expect(result).toEqual({
            enabled: true,
            reason: 'Default value',
            metadata: { version: '1.0' },
          });
        });
      });
    });

    describe('GIVEN flag management APIs', () => {
      describe('WHEN listing flags', () => {
        it('THEN retrieves flag list successfully', async () => {
          // Given: フラグ一覧取得
          const mockFlags = [
            { flagKey: 'billing_v2_enable', description: 'Billing v2', enabled: true },
            { flagKey: 'new_dashboard_enable', description: 'New dashboard', enabled: false },
          ];

          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockFlags,
          });

          // When: フラグ一覧取得
          const flags = await httpClient.listFlags();

          // Then: 正しいAPIエンドポイント呼び出し
          expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/api/flags',
            expect.objectContaining({
              method: 'GET',
            })
          );

          expect(flags).toEqual(mockFlags);
        });
      });

      describe('WHEN creating flags', () => {
        it('THEN creates flag with correct data', async () => {
          // Given: フラグ作成データ
          const flagData = {
            flagKey: 'new_feature_enable',
            description: 'New feature toggle',
            defaultEnabled: false,
            owner: 'development-team',
          };

          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({}),
          });

          // When: フラグ作成
          await httpClient.createFlag(flagData);

          // Then: 正しいPOSTリクエスト
          expect(mockFetch).toHaveBeenCalledWith(
            'https://api.example.com/api/flags',
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify(flagData),
            })
          );
        });
      });
    });
  });
});