import type { FeatureFlagKey } from '@feature-flag/core';

// 監査ログエントリ
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  resourceType: ResourceType;
  resourceId: string;
  action: AuditAction;
  actor: AuditActor;
  changes: AuditChanges;
  metadata: AuditMetadata;
  source: AuditSource;
}

// 監査イベントタイプ
export type AuditEventType = 
  | 'flag_created'
  | 'flag_updated' 
  | 'flag_deleted'
  | 'tenant_override_set'
  | 'tenant_override_removed'
  | 'kill_switch_activated'
  | 'kill_switch_deactivated'
  | 'flag_evaluated';

// リソースタイプ
export type ResourceType = 
  | 'feature_flag'
  | 'tenant_override'
  | 'kill_switch';

// 監査アクション
export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'ACTIVATE'
  | 'DEACTIVATE';

// 実行者情報
export interface AuditActor {
  type: 'user' | 'system' | 'api' | 'cli';
  id: string;
  name?: string;
  email?: string;
  roles?: string[];
  sessionId?: string;
}

// 変更内容
export interface AuditChanges {
  before?: Record<string, any>;
  after?: Record<string, any>;
  fields?: string[];
}

// メタデータ
export interface AuditMetadata {
  correlationId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  tenantId?: string;
  flagKey?: FeatureFlagKey;
  reason?: string;
  environment?: string;
}

// 監査ソース
export interface AuditSource {
  service: string;
  version: string;
  region: string;
  environment: string;
}

// DynamoDB Streamイベント処理用
export interface StreamRecord {
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  eventSource: string;
  eventSourceARN: string;
  dynamodb: {
    Keys?: Record<string, any>;
    NewImage?: Record<string, any>;
    OldImage?: Record<string, any>;
    ApproximateCreationDateTime?: number;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
  };
}

// CloudWatch Logs設定
export interface LogsConfig {
  logGroupName: string;
  logStreamName: string;
  region: string;
  retentionInDays?: number;
}

// 監査ログクエリパラメータ
export interface AuditLogQuery {
  startTime?: string;
  endTime?: string;
  eventType?: AuditEventType;
  resourceType?: ResourceType;
  resourceId?: string;
  actorId?: string;
  tenantId?: string;
  flagKey?: FeatureFlagKey;
  limit?: number;
  nextToken?: string;
}

// 監査ログレスポンス
export interface AuditLogResponse {
  logs: AuditLogEntry[];
  nextToken?: string;
  totalCount?: number;
}

// 監査設定
export interface AuditConfig {
  enabled: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  bufferSize: number;
  flushInterval: number;
  enabledEvents: AuditEventType[];
  enabledResources: ResourceType[];
  excludeFields?: string[];
  encryptSensitiveData: boolean;
}