import { describe, it, expect, beforeEach } from 'vitest';
import { StreamEventParser } from '../src/services/stream-parser';
import { AuditEventType, ResourceType, AuditAction } from '../src/types';

/**
 * Stream Event Parser Comprehensive Tests
 * 
 * DynamoDBストリーム解析の包括的テスト - 詳細ロジック・エラーハンドリング
 * TDD完全実装による高品質保証
 */

describe('Stream Event Parser Comprehensive Tests', () => {
  let parser: StreamEventParser;

  beforeEach(() => {
    parser = new StreamEventParser();
  });

  describe('Feature Flag Stream Processing', () => {
    describe('GIVEN feature flag stream records', () => {
      describe('WHEN processing flag creation events', () => {
        it('THEN parses INSERT events correctly', () => {
          // Given: フラグ作成ストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'FLAG#billing_v2_enable' },
              SK: { S: 'METADATA' }
            },
            NewImage: {
              PK: { S: 'FLAG#billing_v2_enable' },
              SK: { S: 'METADATA' },
              flagKey: { S: 'billing_v2_enable' },
              description: { S: 'Billing v2 feature' },
              defaultEnabled: { BOOL: false },
              owner: { S: 'billing-team' },
              createdAt: { S: '2025-07-23T06:00:00.000Z' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'feature_flag',
            resourceId: 'billing_v2_enable',
            eventType: 'flag_created',
            action: 'CREATE'
          });
        });

        it('THEN extracts changes for creation events', () => {
          // Given: フラグ作成の変更内容
          const newImage = {
            flagKey: { S: 'test_flag' },
            description: { S: 'Test flag' },
            defaultEnabled: { BOOL: true },
            owner: { S: 'test-team' },
            expiresAt: { S: '2025-12-31T23:59:59.000Z' }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, newImage);

          // Then: 新規作成内容が抽出される
          expect(changes).toEqual({
            after: {
              flagKey: 'test_flag',
              description: 'Test flag',
              defaultEnabled: true,
              owner: 'test-team',
              expiresAt: '2025-12-31T23:59:59.000Z'
            }
          });
        });
      });

      describe('WHEN processing flag update events', () => {
        it('THEN parses MODIFY events correctly', () => {
          // Given: フラグ更新ストリームレコード
          const record = {
            eventName: 'MODIFY',
            Keys: {
              PK: { S: 'FLAG#new_dashboard_enable' },
              SK: { S: 'METADATA' }
            },
            OldImage: {
              flagKey: { S: 'new_dashboard_enable' },
              defaultEnabled: { BOOL: false }
            },
            NewImage: {
              flagKey: { S: 'new_dashboard_enable' },
              defaultEnabled: { BOOL: true }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'feature_flag',
            resourceId: 'new_dashboard_enable',
            eventType: 'flag_updated',
            action: 'UPDATE'
          });
        });

        it('THEN extracts field changes correctly', () => {
          // Given: フラグ更新の変更内容
          const oldImage = {
            flagKey: { S: 'test_flag' },
            description: { S: 'Old description' },
            defaultEnabled: { BOOL: false },
            owner: { S: 'old-team' }
          };

          const newImage = {
            flagKey: { S: 'test_flag' },
            description: { S: 'New description' },
            defaultEnabled: { BOOL: true },
            owner: { S: 'old-team' }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(oldImage, newImage);

          // Then: 変更されたフィールドが特定される
          expect(changes.fields).toEqual(['description', 'defaultEnabled']);
          expect(changes.before).toEqual({
            flagKey: 'test_flag',
            description: 'Old description',
            defaultEnabled: false,
            owner: 'old-team'
          });
          expect(changes.after).toEqual({
            flagKey: 'test_flag',
            description: 'New description',
            defaultEnabled: true,
            owner: 'old-team'
          });
        });
      });

      describe('WHEN processing flag deletion events', () => {
        it('THEN parses REMOVE events correctly', () => {
          // Given: フラグ削除ストリームレコード
          const record = {
            eventName: 'REMOVE',
            Keys: {
              PK: { S: 'FLAG#deprecated_feature' },
              SK: { S: 'METADATA' }
            },
            OldImage: {
              flagKey: { S: 'deprecated_feature' },
              defaultEnabled: { BOOL: false }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'feature_flag',
            resourceId: 'deprecated_feature',
            eventType: 'flag_deleted',
            action: 'DELETE'
          });
        });
      });
    });
  });

  describe('Tenant Override Stream Processing', () => {
    describe('GIVEN tenant override stream records', () => {
      describe('WHEN processing override creation', () => {
        it('THEN parses tenant override correctly', () => {
          // Given: テナントオーバーライドストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'TENANT#tenant-123' },
              SK: { S: 'FLAG#billing_v2_enable' }
            },
            NewImage: {
              PK: { S: 'TENANT#tenant-123' },
              SK: { S: 'FLAG#billing_v2_enable' },
              tenantId: { S: 'tenant-123' },
              flagKey: { S: 'billing_v2_enable' },
              enabled: { BOOL: true },
              updatedBy: { S: 'admin@example.com' },
              reason: { S: 'Special customer request' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'tenant_override',
            resourceId: 'TENANT#tenant-123_FLAG#billing_v2_enable',
            eventType: 'tenant_override_set',
            action: 'CREATE'
          });
        });

        it('THEN handles override updates as set events', () => {
          // Given: テナントオーバーライド更新ストリームレコード
          const record = {
            eventName: 'MODIFY',
            Keys: {
              PK: { S: 'TENANT#tenant-456' },
              SK: { S: 'FLAG#new_dashboard_enable' }
            },
            OldImage: {
              enabled: { BOOL: false },
              reason: { S: 'Old reason' }
            },
            NewImage: {
              enabled: { BOOL: true },
              reason: { S: 'New reason' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'tenant_override',
            resourceId: 'TENANT#tenant-456_FLAG#new_dashboard_enable',
            eventType: 'tenant_override_set',
            action: 'UPDATE'
          });
        });

        it('THEN handles override removal correctly', () => {
          // Given: テナントオーバーライド削除ストリームレコード
          const record = {
            eventName: 'REMOVE',
            Keys: {
              PK: { S: 'TENANT#tenant-789' },
              SK: { S: 'FLAG#advanced_analytics_enable' }
            },
            OldImage: {
              enabled: { BOOL: true },
              updatedBy: { S: 'admin@example.com' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'tenant_override',
            resourceId: 'TENANT#tenant-789_FLAG#advanced_analytics_enable',
            eventType: 'tenant_override_removed',
            action: 'DELETE'
          });
        });
      });
    });
  });

  describe('Kill Switch Stream Processing', () => {
    describe('GIVEN kill switch stream records', () => {
      describe('WHEN processing kill switch activation', () => {
        it('THEN parses activation events correctly', () => {
          // Given: キルスイッチ有効化ストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'billing_v2_enable' }
            },
            NewImage: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'billing_v2_enable' },
              enabled: { BOOL: true },
              reason: { S: 'Critical bug detected' },
              activatedBy: { S: 'ops-team@example.com' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'kill_switch',
            resourceId: 'billing_v2_enable',
            eventType: 'kill_switch_activated',
            action: 'CREATE'
          });
        });

        it('THEN parses deactivation events correctly', () => {
          // Given: キルスイッチ無効化ストリームレコード
          const record = {
            eventName: 'MODIFY',
            Keys: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'new_dashboard_enable' }
            },
            OldImage: {
              enabled: { BOOL: true },
              reason: { S: 'Performance issue' }
            },
            NewImage: {
              enabled: { BOOL: false },
              reason: { S: 'Issue resolved' },
              deactivatedBy: { S: 'dev-team@example.com' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'kill_switch',
            resourceId: 'new_dashboard_enable',
            eventType: 'kill_switch_deactivated',
            action: 'UPDATE'
          });
        });

        it('THEN handles global kill switch correctly', () => {
          // Given: グローバルキルスイッチストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'GLOBAL' }
            },
            NewImage: {
              enabled: { BOOL: true },
              reason: { S: 'System-wide emergency' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: 正しく解析される
          expect(result).toEqual({
            resourceType: 'kill_switch',
            resourceId: 'GLOBAL',
            eventType: 'kill_switch_activated',
            action: 'CREATE'
          });
        });
      });
    });
  });

  describe('Complex DynamoDB Data Type Handling', () => {
    describe('GIVEN complex DynamoDB attribute types', () => {
      describe('WHEN processing nested objects', () => {
        it('THEN converts Map (M) attributes correctly', () => {
          // Given: ネストされたMapを含むDynamoDBイメージ
          const image = {
            metadata: {
              M: {
                version: { S: '1.0' },
                config: {
                  M: {
                    timeout: { N: '5000' },
                    enabled: { BOOL: true }
                  }
                }
              }
            }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: ネストされた構造が正しく変換される
          expect(changes.after).toEqual({
            metadata: {
              version: '1.0',
              config: {
                timeout: 5000,
                enabled: true
              }
            }
          });
        });

        it('THEN converts List (L) attributes correctly', () => {
          // Given: Listを含むDynamoDBイメージ
          const image = {
            tags: {
              L: [
                { S: 'production' },
                { S: 'critical' },
                { M: { category: { S: 'feature' }, priority: { N: '1' } } }
              ]
            },
            permissions: {
              SS: ['read', 'write', 'admin']
            }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: Listが正しく変換される
          expect(changes.after).toEqual({
            tags: [
              'production',
              'critical',
              { category: 'feature', priority: 1 }
            ],
            permissions: ['read', 'write', 'admin']
          });
        });

        it('THEN handles NULL values correctly', () => {
          // Given: NULL値を含むDynamoDBイメージ
          const image = {
            optionalField: { NULL: true },
            requiredField: { S: 'value' },
            numberSet: { NS: ['1', '2', '3'] }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: NULL値が正しく処理される
          expect(changes.after).toEqual({
            optionalField: null,
            requiredField: 'value',
            numberSet: [1, 2, 3]
          });
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('GIVEN malformed stream records', () => {
      describe('WHEN processing records with missing keys', () => {
        it('THEN handles missing PK gracefully', () => {
          // Given: PKが不足しているレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              SK: { S: 'METADATA' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: エラーハンドリングされる
          expect(result).toEqual({
            resourceType: null,
            resourceId: 'unknown',
            eventType: null,
            action: 'CREATE'
          });
        });

        it('THEN handles unknown resource patterns', () => {
          // Given: 不明なリソースパターンのレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'UNKNOWN#resource' },
              SK: { S: 'UNKNOWN' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: エラーハンドリングされる
          expect(result).toEqual({
            resourceType: null,
            resourceId: 'unknown',
            eventType: null,
            action: 'CREATE'
          });
        });

        it('THEN handles unexpected event names', () => {
          // Given: 予期しないイベント名
          const record = {
            eventName: 'UNKNOWN_EVENT',
            Keys: {
              PK: { S: 'FLAG#test' },
              SK: { S: 'METADATA' }
            }
          };

          // When: ストリームレコードを解析
          const result = parser.parseStreamRecord(record);

          // Then: デフォルトアクションが設定される
          expect(result.action).toBe('READ');
        });
      });

      describe('WHEN processing corrupt DynamoDB images', () => {
        it('THEN handles malformed attribute values', () => {
          // Given: 不正な属性値を含むイメージ
          const image = {
            validField: { S: 'valid' },
            corruptField: { INVALID_TYPE: 'corrupt' },
            emptyField: {}
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: 有効なフィールドのみ処理される
          expect(changes.after).toEqual({
            validField: 'valid'
          });
        });

        it('THEN handles deeply nested corrupt data', () => {
          // Given: 深くネストされた不正データ
          const image = {
            metadata: {
              M: {
                valid: { S: 'value' },
                invalid: { CORRUPT: 'data' },
                nested: {
                  M: {
                    deep: { N: 'not_a_number' }
                  }
                }
              }
            }
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: 有効な部分のみ抽出される
          expect(changes.after?.metadata?.valid).toBe('value');
          expect(changes.after?.metadata?.nested?.deep).toBeNaN();
        });
      });
    });
  });

  describe('Performance and Large Data Handling', () => {
    describe('GIVEN large stream records', () => {
      describe('WHEN processing records with many fields', () => {
        it('THEN handles large field changes efficiently', () => {
          // Given: 多数のフィールドを持つレコード
          const createLargeImage = (size: number) => {
            const image: any = {};
            for (let i = 0; i < size; i++) {
              image[`field_${i}`] = { S: `value_${i}` };
            }
            return image;
          };

          const oldImage = createLargeImage(100);
          const newImage = createLargeImage(100);
          
          // いくつかのフィールドを変更
          newImage.field_10 = { S: 'changed_value_10' };
          newImage.field_50 = { S: 'changed_value_50' };

          // When: 変更内容を抽出
          const startTime = Date.now();
          const changes = parser.extractChanges(oldImage, newImage);
          const duration = Date.now() - startTime;

          // Then: 効率的に処理される（100ms以内）
          expect(duration).toBeLessThan(100);
          expect(changes.fields).toEqual(['field_10', 'field_50']);
        });

        it('THEN handles deeply nested structures', () => {
          // Given: 深くネストされた構造
          const createDeepImage = (depth: number): any => {
            if (depth === 0) {
              return { S: 'leaf_value' };
            }
            return {
              M: {
                [`level_${depth}`]: createDeepImage(depth - 1)
              }
            };
          };

          const image = {
            deepField: createDeepImage(10)
          };

          // When: 変更内容を抽出
          const changes = parser.extractChanges(undefined, image);

          // Then: 深いネストが正しく処理される
          expect(changes.after?.deepField?.level_10?.level_9).toBeDefined();
        });
      });
    });
  });
});