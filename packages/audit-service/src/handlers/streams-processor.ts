import { DynamoDBStreamEvent, DynamoDBStreamHandler, Context } from 'aws-lambda';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { 
  AuditLogEntry 
} from '../types';
import { FeatureFlagKey } from '../../../core/src/models';
import { AuditLogger } from '../services/audit-logger';
import { StreamEventParser } from '../services/stream-parser';

// 環境変数
const LOG_GROUP_NAME = process.env.AUDIT_LOG_GROUP_NAME || '/aws/lambda/feature-flag-audit';
const AWS_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// CloudWatch Logsクライアント
const cloudWatchLogs = new CloudWatchLogsClient({ region: AWS_REGION });

// 監査ロガー
const auditLogger = new AuditLogger({
  logGroupName: LOG_GROUP_NAME,
  region: AWS_REGION,
  cloudWatchClient: cloudWatchLogs,
});

// ストリームイベントパーサー
const streamParser = new StreamEventParser();

/**
 * DynamoDB Streams イベント処理ハンドラー
 * フィーチャーフラグの変更を監査ログに記録
 */
export const handler: DynamoDBStreamHandler = async (
  event: DynamoDBStreamEvent,
  context: Context
): Promise<void> => {
  console.log(`Processing ${event.Records.length} DynamoDB stream records`);

  const auditEntries: AuditLogEntry[] = [];

  try {
    for (const record of event.Records) {
      if (!record.dynamodb) {
        console.warn('Skipping record without DynamoDB data:', record);
        continue;
      }

      // ストリームレコードを監査ログエントリに変換
      const auditEntry = await convertStreamRecordToAuditEntry(record, context);
      
      if (auditEntry) {
        auditEntries.push(auditEntry);
      }
    }

    // 監査ログを一括送信
    if (auditEntries.length > 0) {
      await auditLogger.logBatch(auditEntries);
      console.log(`Successfully logged ${auditEntries.length} audit entries`);
    }

  } catch (error) {
    console.error('Error processing DynamoDB stream records:', error);
    
    // 重要な監査ログの損失を防ぐため、エラーログも記録
    await auditLogger.logError({
      error: error instanceof Error ? error.message : 'Unknown error',
      event: 'stream_processing_error',
      recordCount: event.Records.length,
      requestId: context.awsRequestId,
    });
    
    throw error;
  }
};

/**
 * DynamoDBストリームレコードを監査ログエントリに変換
 */
async function convertStreamRecordToAuditEntry(
  record: any,
  context: Context
): Promise<AuditLogEntry | null> {
  try {
    const { eventName, dynamodb } = record;
    const { Keys, NewImage, OldImage, ApproximateCreationDateTime } = dynamodb;

    // レコードタイプとアクションを判定
    const { resourceType, resourceId, eventType, action } = streamParser.parseStreamRecord({
      eventName,
      Keys,
      NewImage,
      OldImage,
    });

    if (!resourceType || !eventType) {
      console.warn('Could not determine resource type or event type for record:', record);
      return null;
    }

    // 変更内容を抽出
    const changes = streamParser.extractChanges(OldImage, NewImage);

    // 監査ログエントリを構築
    const auditEntry: AuditLogEntry = {
      id: generateAuditId(context.awsRequestId, record.dynamodb.SequenceNumber),
      timestamp: new Date(ApproximateCreationDateTime * 1000).toISOString(),
      eventType,
      resourceType,
      resourceId,
      action,
      actor: {
        type: 'system',
        id: 'dynamodb-streams',
        name: 'DynamoDB Streams Processor',
      },
      changes,
      metadata: {
        correlationId: context.awsRequestId,
        requestId: context.awsRequestId,
        tenantId: extractTenantId(Keys, NewImage, OldImage),
        flagKey: extractFlagKey(Keys, NewImage, OldImage) as FeatureFlagKey,
        environment: ENVIRONMENT,
      },
      source: {
        service: 'feature-flag-audit-service',
        version: SERVICE_VERSION,
        region: AWS_REGION,
        environment: ENVIRONMENT,
      },
    };

    return auditEntry;

  } catch (error) {
    console.error('Error converting stream record to audit entry:', error);
    return null;
  }
}

/**
 * 監査ログID生成
 */
function generateAuditId(requestId: string, sequenceNumber: string): string {
  return `audit_${requestId}_${sequenceNumber}_${Date.now()}`;
}

/**
 * DynamoDBレコードからテナントIDを抽出
 */
function extractTenantId(Keys?: any, NewImage?: any, OldImage?: any): string | undefined {
  // TenantOverridesテーブルのPKから抽出
  const pk = Keys?.PK?.S || NewImage?.PK?.S || OldImage?.PK?.S;
  if (pk && pk.startsWith('TENANT#')) {
    return pk.replace('TENANT#', '');
  }
  
  // その他のテーブルからテナント情報を抽出
  return NewImage?.tenantId?.S || OldImage?.tenantId?.S;
}

/**
 * DynamoDBレコードからフラグキーを抽出
 */
function extractFlagKey(Keys?: any, NewImage?: any, OldImage?: any): string | undefined {
  // 各テーブルの構造に応じてフラグキーを抽出
  const sk = Keys?.SK?.S || NewImage?.SK?.S || OldImage?.SK?.S;
  if (sk && sk.startsWith('FLAG#')) {
    return sk.replace('FLAG#', '');
  }
  
  return NewImage?.flagKey?.S || OldImage?.flagKey?.S || Keys?.flagKey?.S;
}

// モジュールが直接実行された場合のテスト用コード
if (require.main === module) {
  console.log('DynamoDB Streams Processor initialized');
  console.log(`Log Group: ${LOG_GROUP_NAME}`);
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Environment: ${ENVIRONMENT}`);
}