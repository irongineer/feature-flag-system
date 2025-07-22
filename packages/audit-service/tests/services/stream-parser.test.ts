import { describe, it, expect, beforeEach } from 'vitest';
import { StreamEventParser } from '../../src/services/stream-parser';
import { AuditEventType, ResourceType, AuditAction } from '../../src/types';
import { DynamoDBStreamFactory } from '../helpers/mock-factory';

/**
 * StreamEventParser DynamoDBストリーム解析テストスイート
 * 
 * t-wada TDD原則によるDynamoDBストリームイベント解析品質保証テスト:
 * - DynamoDBストリームレコード解析テスト
 * - リソースタイプ・イベントタイプ判定テスト
 * - 変更内容抽出・比較テスト
 * - DynamoDB Image変換テスト
 * - エラーケース・エッジケース処理テスト
 * - パフォーマンス・スケーラビリティテスト
 * 
 * DynamoDBストリーム解析品質保証カバレッジ:
 * 1. Stream Record Parsing & Type Determination
 * 2. Resource Type & Event Type Mapping
 * 3. Change Detection & Field Comparison
 * 4. DynamoDB Image Conversion
 * 5. Edge Cases & Error Handling
 * 6. Performance & Scalability
 */
describe('StreamEventParser DynamoDBストリーム解析テストスイート', () => {

  let streamParser: StreamEventParser;

  beforeEach(() => {
    streamParser = new StreamEventParser();
  });

  describe('DynamoDB Stream Record Parsing', () => {
    describe('GIVEN DynamoDBストリームレコード', () => {
      describe('WHEN フィーチャーフラグイベント解析', () => {
        it('THEN flag_created イベントが正しく解析される', () => {
          // Given: フラグ作成のDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.flagCreated('billing_v2_enable');

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいフラグ作成イベント情報が抽出される
          expect(result.resourceType).toBe('feature_flag');
          expect(result.resourceId).toBe('billing_v2_enable');
          expect(result.eventType).toBe('flag_created');
          expect(result.action).toBe('CREATE');
        });

        it('THEN flag_updated イベントが正しく解析される', () => {
          // Given: フラグ更新のDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.flagUpdated('new_dashboard_enable');

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいフラグ更新イベント情報が抽出される
          expect(result.resourceType).toBe('feature_flag');
          expect(result.resourceId).toBe('new_dashboard_enable');
          expect(result.eventType).toBe('flag_updated');
          expect(result.action).toBe('UPDATE');
        });

        it('THEN flag_deleted イベントが正しく解析される', () => {
          // Given: フラグ削除のDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.flagDeleted('advanced_analytics_enable');

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいフラグ削除イベント情報が抽出される
          expect(result.resourceType).toBe('feature_flag');
          expect(result.resourceId).toBe('advanced_analytics_enable');
          expect(result.eventType).toBe('flag_deleted');
          expect(result.action).toBe('DELETE');
        });
      });

      describe('WHEN テナントオーバーライドイベント解析', () => {
        it('THEN tenant_override_set イベントが正しく解析される', () => {
          // Given: テナントオーバーライド設定のDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.tenantOverrideSet('enterprise-tenant-001', 'billing_v2_enable');

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいオーバーライド設定イベント情報が抽出される
          expect(result.resourceType).toBe('tenant_override');
          expect(result.resourceId).toBe('TENANT#enterprise-tenant-001_FLAG#billing_v2_enable');
          expect(result.eventType).toBe('tenant_override_set');
          expect(result.action).toBe('CREATE');
        });

        it('THEN tenant_override_removed イベントが正しく解析される', () => {
          // Given: テナントオーバーライド削除のDynamoDBストリームレコード
          const record = {
            eventName: 'REMOVE',
            Keys: {
              PK: { S: 'TENANT#standard-tenant-002' },
              SK: { S: 'FLAG#new_dashboard_enable' }
            },
            OldImage: {
              PK: { S: 'TENANT#standard-tenant-002' },
              SK: { S: 'FLAG#new_dashboard_enable' },
              tenantId: { S: 'standard-tenant-002' },
              flagKey: { S: 'new_dashboard_enable' },
              enabled: { BOOL: true }
            }
          };

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいオーバーライド削除イベント情報が抽出される
          expect(result.resourceType).toBe('tenant_override');
          expect(result.resourceId).toBe('TENANT#standard-tenant-002_FLAG#new_dashboard_enable');
          expect(result.eventType).toBe('tenant_override_removed');
          expect(result.action).toBe('DELETE');
        });
      });

      describe('WHEN キルスイッチイベント解析', () => {
        it('THEN kill_switch_activated イベントが正しく解析される', () => {
          // Given: キルスイッチ有効化のDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.killSwitchActivated('billing_v2_enable');

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいキルスイッチ有効化イベント情報が抽出される
          expect(result.resourceType).toBe('kill_switch');
          expect(result.resourceId).toBe('FLAG#billing_v2_enable');
          expect(result.eventType).toBe('kill_switch_activated');
          expect(result.action).toBe('UPDATE');
        });

        it('THEN kill_switch_deactivated イベントが正しく解析される', () => {
          // Given: キルスイッチ無効化のDynamoDBストリームレコード
          const record = {
            eventName: 'MODIFY',
            Keys: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'FLAG#advanced_analytics_enable' }
            },
            OldImage: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'FLAG#advanced_analytics_enable' },
              flagKey: { S: 'advanced_analytics_enable' },
              enabled: { BOOL: true },
              reason: { S: 'Emergency activation' }
            },
            NewImage: {
              PK: { S: 'EMERGENCY' },
              SK: { S: 'FLAG#advanced_analytics_enable' },
              flagKey: { S: 'advanced_analytics_enable' },
              enabled: { BOOL: false },
              reason: { S: 'Emergency deactivation' }
            }
          };

          // When: ストリームレコード解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 正しいキルスイッチ無効化イベント情報が抽出される
          expect(result.resourceType).toBe('kill_switch');
          expect(result.resourceId).toBe('FLAG#advanced_analytics_enable');
          expect(result.eventType).toBe('kill_switch_deactivated');
          expect(result.action).toBe('UPDATE');
        });
      });
    });
  });

  describe('Resource Type & Event Type Mapping', () => {
    describe('GIVEN リソースタイプ判定要件', () => {
      describe('WHEN 未知のリソースタイプ処理', () => {
        it('THEN 未知のリソースではnullが返される', () => {
          // Given: 未知のリソースタイプのDynamoDBストリームレコード
          const record = DynamoDBStreamFactory.unknownEvent();

          // When: 未知リソースの解析
          const result = streamParser.parseStreamRecord(record);

          // Then: リソースタイプとイベントタイプがnullになる
          expect(result.resourceType).toBeNull();
          expect(result.eventType).toBeNull();
          expect(result.resourceId).toBe('unknown');
          expect(result.action).toBe('UPDATE');
        });

        it('THEN PKが存在しない場合の処理', () => {
          // Given: PKが存在しないストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {},
            NewImage: {
              someField: { S: 'some value' }
            }
          };

          // When: PKなしレコードの解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 適切にnull値が返される
          expect(result.resourceType).toBeNull();
          expect(result.eventType).toBeNull();
          expect(result.resourceId).toBe('unknown');
        });
      });

      describe('WHEN エッジケースのリソースタイプ', () => {
        it('THEN 複雑なPK/SK構造が正しく解析される', () => {
          // Given: 複雑なキー構造のDynamoDBストリームレコード
          const record = {
            eventName: 'INSERT',
            Keys: {
              PK: { S: 'FLAG#complex_flag_name_with_underscores_and_numbers_123' },
              SK: { S: 'METADATA' }
            },
            NewImage: {
              PK: { S: 'FLAG#complex_flag_name_with_underscores_and_numbers_123' },
              SK: { S: 'METADATA' },
              flagKey: { S: 'complex_flag_name_with_underscores_and_numbers_123' }
            }
          };

          // When: 複雑キー構造の解析
          const result = streamParser.parseStreamRecord(record);

          // Then: 複雑なフラグ名が正しく抽出される
          expect(result.resourceType).toBe('feature_flag');
          expect(result.resourceId).toBe('complex_flag_name_with_underscores_and_numbers_123');
          expect(result.eventType).toBe('flag_created');
        });
      });
    });
  });

  describe('Change Detection & Field Comparison', () => {
    describe('GIVEN 変更内容抽出要件', () => {
      describe('WHEN Before/After変更抽出', () => {
        it('THEN フラグ更新の変更内容が正確に抽出される', () => {
          // Given: フラグ更新のBefore/Afterイメージ
          const record = DynamoDBStreamFactory.flagUpdated('billing_v2_enable');

          // When: 変更内容の抽出
          const changes = streamParser.extractChanges(record.OldImage, record.NewImage);

          // Then: Before/After状態と変更フィールドが正確に抽出される
          expect(changes.before).toBeDefined();
          expect(changes.after).toBeDefined();
          expect(changes.fields).toBeDefined();
          
          expect(changes.before?.description).toBe('Old billing_v2_enable description');
          expect(changes.after?.description).toBe('Updated billing_v2_enable description');
          expect(changes.before?.defaultEnabled).toBe(false);
          expect(changes.after?.defaultEnabled).toBe(true);
          
          expect(changes.fields).toContain('description');
          expect(changes.fields).toContain('defaultEnabled');
          expect(changes.fields).toContain('owner');
        });

        it('THEN INSERTイベントではAfterのみが抽出される', () => {
          // Given: フラグ作成のINSERTイベント（Beforeなし）
          const record = DynamoDBStreamFactory.flagCreated('new_flag');

          // When: INSERT変更内容の抽出
          const changes = streamParser.extractChanges(undefined, record.NewImage);

          // Then: Afterのみが存在し、Beforeは存在しない
          expect(changes.before).toBeUndefined();
          expect(changes.after).toBeDefined();
          expect(changes.fields).toBeUndefined();
          
          expect(changes.after?.flagKey).toBe('new_flag');
          expect(changes.after?.defaultEnabled).toBe(true);
        });

        it('THEN REMOVEイベントではBeforeのみが抽出される', () => {
          // Given: フラグ削除のREMOVEイベント（Afterなし）
          const record = DynamoDBStreamFactory.flagDeleted('deleted_flag');

          // When: REMOVE変更内容の抽出
          const changes = streamParser.extractChanges(record.OldImage, undefined);

          // Then: Beforeのみが存在し、Afterは存在しない
          expect(changes.before).toBeDefined();
          expect(changes.after).toBeUndefined();
          expect(changes.fields).toBeUndefined();
          
          expect(changes.before?.flagKey).toBe('deleted_flag');
          expect(changes.before?.defaultEnabled).toBe(false);
        });
      });

      describe('WHEN 変更フィールド特定', () => {
        it('THEN プリミティブ値の変更が正確に検出される', () => {
          // Given: プリミティブフィールド変更のBefore/After
          const beforeImage = {
            stringField: { S: 'old_value' },
            numberField: { N: '10' },
            boolField: { BOOL: false }
          };
          const afterImage = {
            stringField: { S: 'new_value' },
            numberField: { N: '20' },
            boolField: { BOOL: true }
          };

          // When: 変更内容抽出
          const changes = streamParser.extractChanges(beforeImage, afterImage);

          // Then: 全ての変更フィールドが検出される
          expect(changes.fields).toContain('stringField');
          expect(changes.fields).toContain('numberField');
          expect(changes.fields).toContain('boolField');
          expect(changes.fields).toHaveLength(3);
        });

        it('THEN 複雑なオブジェクト構造の変更が検出される', () => {
          // Given: ネストオブジェクト変更のBefore/After
          const beforeImage = {
            configuration: {
              M: {
                rolloutPercentage: { N: '0' },
                targetAudience: { SS: ['beta-users'] }
              }
            },
            metadata: {
              M: {
                tags: { SS: ['tag1', 'tag2'] },
                owner: { S: 'old-owner' }
              }
            }
          };
          const afterImage = {
            configuration: {
              M: {
                rolloutPercentage: { N: '50' },
                targetAudience: { SS: ['beta-users', 'premium-users'] }
              }
            },
            metadata: {
              M: {
                tags: { SS: ['tag1', 'tag2', 'tag3'] },
                owner: { S: 'new-owner' }
              }
            }
          };

          // When: 複雑構造の変更抽出
          const changes = streamParser.extractChanges(beforeImage, afterImage);

          // Then: ネストオブジェクトの変更が正確に検出される
          expect(changes.fields).toContain('configuration');
          expect(changes.fields).toContain('metadata');
          expect(changes.before?.configuration).toBeDefined();
          expect(changes.after?.configuration).toBeDefined();
        });

        it('THEN フィールド追加・削除が正確に検出される', () => {
          // Given: フィールド追加・削除のBefore/After
          const beforeImage = {
            existingField: { S: 'value' },
            removedField: { S: 'will_be_removed' }
          };
          const afterImage = {
            existingField: { S: 'value' },
            newField: { S: 'newly_added' }
          };

          // When: フィールド追加・削除の変更抽出
          const changes = streamParser.extractChanges(beforeImage, afterImage);

          // Then: 追加・削除フィールドが正確に検出される
          expect(changes.fields).toContain('removedField'); // 削除されたフィールド
          expect(changes.fields).toContain('newField'); // 追加されたフィールド
          expect(changes.fields).not.toContain('existingField'); // 変更なし
          expect(changes.before?.removedField).toBe('will_be_removed');
          expect(changes.after?.newField).toBe('newly_added');
        });
      });
    });
  });

  describe('DynamoDB Image Conversion', () => {
    describe('GIVEN DynamoDB属性タイプ変換要件', () => {
      describe('WHEN 各種データタイプ変換', () => {
        it('THEN 文字列タイプ(S)が正しく変換される', () => {
          // Given: 文字列タイプのDynamoDB Image
          const image = {
            stringField: { S: 'test string value' },
            emptyStringField: { S: '' }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 文字列値が正しく変換される
          expect(changes.after?.stringField).toBe('test string value');
          expect(changes.after?.emptyStringField).toBe('');
        });

        it('THEN 数値タイプ(N)が正しく変換される', () => {
          // Given: 数値タイプのDynamoDB Image
          const image = {
            integerField: { N: '42' },
            floatField: { N: '3.14159' },
            negativeField: { N: '-100' }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 数値が正しく変換される
          expect(changes.after?.integerField).toBe(42);
          expect(changes.after?.floatField).toBe(3.14159);
          expect(changes.after?.negativeField).toBe(-100);
        });

        it('THEN ブール値タイプ(BOOL)が正しく変換される', () => {
          // Given: ブール値タイプのDynamoDB Image
          const image = {
            trueField: { BOOL: true },
            falseField: { BOOL: false }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: ブール値が正しく変換される
          expect(changes.after?.trueField).toBe(true);
          expect(changes.after?.falseField).toBe(false);
        });

        it('THEN 文字列セット(SS)が正しく変換される', () => {
          // Given: 文字列セットタイプのDynamoDB Image
          const image = {
            tagsField: { SS: ['tag1', 'tag2', 'tag3'] },
            emptySetField: { SS: [] }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 文字列配列が正しく変換される
          expect(changes.after?.tagsField).toEqual(['tag1', 'tag2', 'tag3']);
          expect(changes.after?.emptySetField).toEqual([]);
        });

        it('THEN 数値セット(NS)が正しく変換される', () => {
          // Given: 数値セットタイプのDynamoDB Image
          const image = {
            scoresField: { NS: ['100', '95', '87'] }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 数値配列が正しく変換される
          expect(changes.after?.scoresField).toEqual([100, 95, 87]);
        });

        it('THEN マップタイプ(M)が正しく変換される', () => {
          // Given: マップタイプのDynamoDB Image
          const image = {
            configurationField: {
              M: {
                enabled: { BOOL: true },
                threshold: { N: '10' },
                name: { S: 'test config' },
                nested: {
                  M: {
                    level: { N: '2' }
                  }
                }
              }
            }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: ネストオブジェクトが正しく変換される
          expect(changes.after?.configurationField).toEqual({
            enabled: true,
            threshold: 10,
            name: 'test config',
            nested: {
              level: 2
            }
          });
        });

        it('THEN リストタイプ(L)が正しく変換される', () => {
          // Given: リストタイプのDynamoDB Image
          const image = {
            mixedListField: {
              L: [
                { S: 'string item' },
                { N: '42' },
                { BOOL: true },
                { M: { nested: { S: 'nested value' } } }
              ]
            }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 混在型リストが正しく変換される
          expect(changes.after?.mixedListField).toEqual([
            'string item',
            42,
            true,
            { nested: 'nested value' }
          ]);
        });

        it('THEN NULL値が正しく変換される', () => {
          // Given: NULL値のDynamoDB Image
          const image = {
            nullField: { NULL: true },
            regularField: { S: 'not null' }
          };

          // When: DynamoDB Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: NULL値が正しく変換される
          expect(changes.after?.nullField).toBeNull();
          expect(changes.after?.regularField).toBe('not null');
        });
      });
    });
  });

  describe('Edge Cases & Error Handling', () => {
    describe('GIVEN エッジケース処理要件', () => {
      describe('WHEN 不正・不完全データ処理', () => {
        it('THEN 空のストリームレコードが適切に処理される', () => {
          // Given: 空のストリームレコード
          const emptyRecord = {
            eventName: 'INSERT',
            Keys: {},
            NewImage: {}
          };

          // When: 空レコード解析
          const result = streamParser.parseStreamRecord(emptyRecord);

          // Then: エラーなく適切にnull値が返される
          expect(result.resourceType).toBeNull();
          expect(result.eventType).toBeNull();
          expect(result.resourceId).toBe('unknown');
          expect(result.action).toBe('CREATE');
        });

        it('THEN 不正なDynamoDB属性が適切にスキップされる', () => {
          // Given: 不正な属性タイプのDynamoDB Image
          const image = {
            validField: { S: 'valid value' },
            invalidField: { INVALID_TYPE: 'should be ignored' },
            emptyAttributeField: {}
          };

          // When: 不正データ含有Image変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 有効なフィールドのみが変換される
          expect(changes.after?.validField).toBe('valid value');
          expect(changes.after?.invalidField).toBeUndefined();
          expect(changes.after?.emptyAttributeField).toBeUndefined();
        });

        it('THEN 破損したマップ・リスト構造が適切に処理される', () => {
          // Given: 破損したネスト構造のDynamoDB Image
          const image = {
            brokenMapField: {
              M: {
                validNested: { S: 'valid' },
                brokenNested: { INVALID: 'broken' }
              }
            },
            brokenListField: {
              L: [
                { S: 'valid item' },
                { INVALID: 'broken item' },
                {}
              ]
            }
          };

          // When: 破損構造の変換
          const changes = streamParser.extractChanges(undefined, image);

          // Then: 有効な部分のみが変換される
          expect(changes.after?.brokenMapField?.validNested).toBe('valid');
          expect(changes.after?.brokenMapField?.brokenNested).toBeUndefined();
          expect(changes.after?.brokenListField).toHaveLength(3);
          expect(changes.after?.brokenListField[0]).toBe('valid item');
        });
      });
    });
  });

  describe('Performance & Scalability', () => {
    describe('GIVEN パフォーマンス要件', () => {
      describe('WHEN 大規模データ処理', () => {
        it('THEN 大容量DynamoDB Imageの効率的変換', () => {
          // Given: 大容量のDynamoDB Image
          const largeImage: any = {};
          for (let i = 0; i < 100; i++) {
            largeImage[`field_${i}`] = { S: `value_${i}` };
            largeImage[`number_${i}`] = { N: i.toString() };
            largeImage[`bool_${i}`] = { BOOL: i % 2 === 0 };
          }

          const startTime = Date.now();

          // When: 大容量Image変換
          const changes = streamParser.extractChanges(undefined, largeImage);

          const duration = Date.now() - startTime;

          // Then: 適切な時間で変換完了（100フィールドを50ms以内）
          expect(duration).toBeLessThan(50);
          expect(Object.keys(changes.after!)).toHaveLength(300); // 100 * 3 types
        });

        it('THEN 深いネスト構造の効率的処理', () => {
          // Given: 深いネスト構造のDynamoDB Image
          let deepNested: any = { BOOL: true };
          for (let level = 0; level < 10; level++) {
            deepNested = { M: { [`level_${level}`]: deepNested } };
          }
          
          const image = { deepField: deepNested };
          const startTime = Date.now();

          // When: 深いネスト構造の変換
          const changes = streamParser.extractChanges(undefined, image);

          const duration = Date.now() - startTime;

          // Then: 深いネストでも効率的に処理（10レベルを20ms以内）
          expect(duration).toBeLessThan(20);
          expect(changes.after?.deepField).toBeDefined();
        });

        it('THEN 大量変更フィールド検出の効率性', () => {
          // Given: 大量フィールド変更のBefore/After
          const beforeImage: any = {};
          const afterImage: any = {};
          
          for (let i = 0; i < 50; i++) {
            beforeImage[`field_${i}`] = { S: `old_value_${i}` };
            afterImage[`field_${i}`] = { S: `new_value_${i}` };
          }

          const startTime = Date.now();

          // When: 大量変更フィールド検出
          const changes = streamParser.extractChanges(beforeImage, afterImage);

          const duration = Date.now() - startTime;

          // Then: 効率的な変更検出（50フィールド変更を30ms以内）
          expect(duration).toBeLessThan(30);
          expect(changes.fields).toHaveLength(50);
        });
      });
    });
  });

  describe('Data Type Coverage & Validation', () => {
    describe('GIVEN データタイプ網羅性要件', () => {
      describe('WHEN 全DynamoDBデータタイプ処理', () => {
        it('THEN 全属性タイプが網羅的に処理される', () => {
          // Given: 全DynamoDB属性タイプを含むImage
          const comprehensiveImage = {
            stringAttr: { S: 'string value' },
            numberAttr: { N: '42' },
            boolAttr: { BOOL: true },
            nullAttr: { NULL: true },
            stringSetAttr: { SS: ['item1', 'item2'] },
            numberSetAttr: { NS: ['1', '2', '3'] },
            mapAttr: {
              M: {
                nestedString: { S: 'nested' },
                nestedNumber: { N: '100' }
              }
            },
            listAttr: {
              L: [
                { S: 'list item' },
                { N: '999' },
                { BOOL: false }
              ]
            }
          };

          // When: 全属性タイプの変換
          const changes = streamParser.extractChanges(undefined, comprehensiveImage);

          // Then: 全てのタイプが正しく変換される
          expect(changes.after?.stringAttr).toBe('string value');
          expect(changes.after?.numberAttr).toBe(42);
          expect(changes.after?.boolAttr).toBe(true);
          expect(changes.after?.nullAttr).toBeNull();
          expect(changes.after?.stringSetAttr).toEqual(['item1', 'item2']);
          expect(changes.after?.numberSetAttr).toEqual([1, 2, 3]);
          expect(changes.after?.mapAttr).toEqual({
            nestedString: 'nested',
            nestedNumber: 100
          });
          expect(changes.after?.listAttr).toEqual(['list item', 999, false]);
        });
      });
    });
  });
});