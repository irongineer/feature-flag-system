import { describe, it, expect } from 'vitest';
import { StreamEventParser } from '../src/services/stream-parser';
import { AuditLogEntry } from '../src/types';

/**
 * Audit Service 基本機能テスト
 * 
 * 基本的な動作確認のためのシンプルなテスト
 */
describe('Audit Service 基本機能テスト', () => {
  
  describe('StreamEventParser', () => {
    it('THEN インスタンスが正しく作成される', () => {
      const parser = new StreamEventParser();
      expect(parser).toBeInstanceOf(StreamEventParser);
      expect(parser.parseStreamRecord).toBeDefined();
      expect(parser.extractChanges).toBeDefined();
    });
    
    it('THEN フラグ作成レコードが正しく解析される', () => {
      const parser = new StreamEventParser();
      const record = {
        eventName: 'INSERT',
        Keys: {
          PK: { S: 'FLAG#test_flag' },
          SK: { S: 'METADATA' }
        },
        NewImage: {
          flagKey: { S: 'test_flag' },
          defaultEnabled: { BOOL: true }
        }
      };
      
      const result = parser.parseStreamRecord(record);
      
      expect(result.resourceType).toBe('feature_flag');
      expect(result.resourceId).toBe('test_flag');
      expect(result.eventType).toBe('flag_created');
      expect(result.action).toBe('CREATE');
    });
  });

  describe('Type Definitions', () => {
    it('THEN AuditLogEntry型が正しく定義される', () => {
      const sampleEntry: AuditLogEntry = {
        id: 'test-id',
        timestamp: '2025-07-22T10:00:00.000Z',
        eventType: 'flag_created',
        resourceType: 'feature_flag',
        resourceId: 'test-flag',
        action: 'CREATE',
        actor: {
          type: 'system',
          id: 'test-actor',
          name: 'Test Actor'
        },
        changes: {
          after: { enabled: true }
        },
        metadata: {
          correlationId: 'test-correlation'
        },
        source: {
          service: 'test-service',
          version: '1.0.0',
          region: 'ap-northeast-1',
          environment: 'test'
        }
      };
      
      expect(sampleEntry).toBeDefined();
      expect(sampleEntry.eventType).toBe('flag_created');
      expect(sampleEntry.resourceType).toBe('feature_flag');
    });
  });

  describe('DynamoDB Image Conversion', () => {
    it('THEN 文字列値が正しく変換される', () => {
      const parser = new StreamEventParser();
      const image = {
        testField: { S: 'test value' },
        emptyField: { S: '' },
        numberField: { N: '42' },
        boolField: { BOOL: true }
      };
      
      const changes = parser.extractChanges(undefined, image);
      
      expect(changes.after?.testField).toBe('test value');
      expect(changes.after?.emptyField).toBe('');
      expect(changes.after?.numberField).toBe(42);
      expect(changes.after?.boolField).toBe(true);
    });
  });

  describe('EventType Mapping', () => {
    it('THEN 各種イベントタイプが正しく判定される', () => {
      const parser = new StreamEventParser();
      
      // Flag Created
      const createRecord = {
        eventName: 'INSERT',
        Keys: { PK: { S: 'FLAG#new_flag' }, SK: { S: 'METADATA' } },
        NewImage: { flagKey: { S: 'new_flag' } }
      };
      const createResult = parser.parseStreamRecord(createRecord);
      expect(createResult.eventType).toBe('flag_created');
      
      // Flag Updated  
      const updateRecord = {
        eventName: 'MODIFY',
        Keys: { PK: { S: 'FLAG#existing_flag' }, SK: { S: 'METADATA' } },
        OldImage: { enabled: { BOOL: false } },
        NewImage: { enabled: { BOOL: true } }
      };
      const updateResult = parser.parseStreamRecord(updateRecord);
      expect(updateResult.eventType).toBe('flag_updated');
      
      // Flag Deleted
      const deleteRecord = {
        eventName: 'REMOVE',
        Keys: { PK: { S: 'FLAG#deleted_flag' }, SK: { S: 'METADATA' } },
        OldImage: { flagKey: { S: 'deleted_flag' } }
      };
      const deleteResult = parser.parseStreamRecord(deleteRecord);
      expect(deleteResult.eventType).toBe('flag_deleted');
    });
  });

  describe('Change Detection', () => {
    it('THEN 変更されたフィールドが正しく検出される', () => {
      const parser = new StreamEventParser();
      const beforeImage = {
        field1: { S: 'old_value' },
        field2: { N: '10' },
        unchanged: { S: 'same' }
      };
      const afterImage = {
        field1: { S: 'new_value' },
        field2: { N: '20' },
        unchanged: { S: 'same' },
        newField: { BOOL: true }
      };
      
      const changes = parser.extractChanges(beforeImage, afterImage);
      
      expect(changes.fields).toContain('field1');
      expect(changes.fields).toContain('field2');
      expect(changes.fields).toContain('newField');
      expect(changes.fields).not.toContain('unchanged');
    });
  });
});