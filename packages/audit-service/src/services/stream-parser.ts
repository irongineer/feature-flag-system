import { AuditEventType, ResourceType, AuditAction, AuditChanges } from '../types';

/**
 * DynamoDB Streamイベントを解析して監査ログ情報を抽出するサービス
 */
export class StreamEventParser {
  /**
   * ストリームレコードを解析してイベント情報を抽出
   */
  parseStreamRecord(record: { eventName: string; Keys?: any; NewImage?: any; OldImage?: any }): {
    resourceType: ResourceType | null;
    resourceId: string;
    eventType: AuditEventType | null;
    action: AuditAction;
  } {
    const { eventName, Keys, NewImage, OldImage } = record;

    // テーブルとリソースタイプを判定
    const resourceInfo = this.determineResourceType(Keys, NewImage, OldImage);
    if (!resourceInfo) {
      return {
        resourceType: null,
        resourceId: 'unknown',
        eventType: null,
        action: this.mapEventNameToAction(eventName),
      };
    }

    const { resourceType, resourceId } = resourceInfo;

    // イベントタイプを判定
    const eventType = this.determineEventType(eventName, resourceType, NewImage, OldImage);

    return {
      resourceType,
      resourceId,
      eventType,
      action: this.mapEventNameToAction(eventName),
    };
  }

  /**
   * 変更内容を抽出
   */
  extractChanges(OldImage?: any, NewImage?: any): AuditChanges {
    const changes: AuditChanges = {};

    if (OldImage) {
      changes.before = this.convertDynamoDbImage(OldImage);
    }

    if (NewImage) {
      changes.after = this.convertDynamoDbImage(NewImage);
    }

    // 変更されたフィールドを特定
    if (changes.before && changes.after) {
      changes.fields = this.getChangedFields(changes.before, changes.after);
    }

    return changes;
  }

  /**
   * リソースタイプとIDを判定
   */
  private determineResourceType(
    Keys?: any,
    NewImage?: any,
    OldImage?: any
  ): {
    resourceType: ResourceType;
    resourceId: string;
  } | null {
    const pk = Keys?.PK?.S || NewImage?.PK?.S || OldImage?.PK?.S;
    const sk = Keys?.SK?.S || NewImage?.SK?.S || OldImage?.SK?.S;

    if (!pk) {
      return null;
    }

    // FeatureFlags テーブル
    if (pk.startsWith('FLAG#') && sk === 'METADATA') {
      return {
        resourceType: 'feature_flag',
        resourceId: pk.replace('FLAG#', ''),
      };
    }

    // TenantOverrides テーブル
    if (pk.startsWith('TENANT#') && sk?.startsWith('FLAG#')) {
      return {
        resourceType: 'tenant_override',
        resourceId: `${pk}_${sk}`,
      };
    }

    // EmergencyControl テーブル
    if (pk === 'EMERGENCY') {
      return {
        resourceType: 'kill_switch',
        resourceId: sk || 'GLOBAL',
      };
    }

    return null;
  }

  /**
   * イベントタイプを判定
   */
  private determineEventType(
    eventName: string,
    resourceType: ResourceType,
    NewImage?: any,
    OldImage?: any
  ): AuditEventType | null {
    switch (resourceType) {
      case 'feature_flag':
        switch (eventName) {
          case 'INSERT':
            return 'flag_created';
          case 'MODIFY':
            return 'flag_updated';
          case 'REMOVE':
            return 'flag_deleted';
        }
        break;

      case 'tenant_override':
        switch (eventName) {
          case 'INSERT':
            return 'tenant_override_set';
          case 'MODIFY':
            return 'tenant_override_set';
          case 'REMOVE':
            return 'tenant_override_removed';
        }
        break;

      case 'kill_switch':
        if (eventName === 'INSERT' || eventName === 'MODIFY') {
          const newEnabled = NewImage?.enabled?.BOOL;
          const oldEnabled = OldImage?.enabled?.BOOL;

          if (newEnabled && !oldEnabled) {
            return 'kill_switch_activated';
          } else if (!newEnabled && oldEnabled) {
            return 'kill_switch_deactivated';
          } else {
            return 'kill_switch_activated'; // 新規作成時はactivatedとして扱う
          }
        }
        break;
    }

    return null;
  }

  /**
   * DynamoDBのイベント名をAuditActionにマッピング
   */
  private mapEventNameToAction(eventName: string): AuditAction {
    switch (eventName) {
      case 'INSERT':
        return 'CREATE';
      case 'MODIFY':
        return 'UPDATE';
      case 'REMOVE':
        return 'DELETE';
      default:
        return 'READ';
    }
  }

  /**
   * DynamoDB ImageをJavaScriptオブジェクトに変換
   */
  private convertDynamoDbImage(image: any): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(image)) {
      if (typeof value === 'object' && value !== null) {
        const attr = value as any;
        if (attr.S) {
          result[key] = attr.S;
        } else if (attr.N) {
          result[key] = Number(attr.N);
        } else if (attr.BOOL !== undefined) {
          result[key] = attr.BOOL;
        } else if (attr.SS) {
          result[key] = attr.SS;
        } else if (attr.NS) {
          result[key] = attr.NS.map(Number);
        } else if (attr.M) {
          result[key] = this.convertDynamoDbImage(attr.M);
        } else if (attr.L) {
          result[key] = attr.L.map((item: any) => this.convertDynamoDbImage({ temp: item }).temp);
        } else if (attr.NULL) {
          result[key] = null;
        }
      }
    }

    return result;
  }

  /**
   * 変更されたフィールドを特定
   */
  private getChangedFields(before: Record<string, any>, after: Record<string, any>): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      if (this.isValueChanged(before[key], after[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * 値が変更されているかチェック
   */
  private isValueChanged(beforeValue: any, afterValue: any): boolean {
    // 両方undefinedの場合は変更なし
    if (beforeValue === undefined && afterValue === undefined) {
      return false;
    }

    // 一方だけundefinedの場合は変更あり
    if (beforeValue === undefined || afterValue === undefined) {
      return true;
    }

    // オブジェクトの場合は再帰的に比較
    if (typeof beforeValue === 'object' && typeof afterValue === 'object') {
      return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    }

    // プリミティブ値の比較
    return beforeValue !== afterValue;
  }
}
