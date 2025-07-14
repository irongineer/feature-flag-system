import { 
  CloudWatchLogsClient, 
  CreateLogStreamCommand, 
  PutLogEventsCommand,
  DescribeLogStreamsCommand,
  CreateLogGroupCommand,
  ResourceAlreadyExistsException
} from '@aws-sdk/client-cloudwatch-logs';
import { AuditLogEntry, LogsConfig } from '../types';

/**
 * CloudWatch Logs に監査ログを送信するサービス
 */
export class AuditLogger {
  private client: CloudWatchLogsClient;
  private config: LogsConfig;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor(config: {
    logGroupName: string;
    region: string;
    cloudWatchClient?: CloudWatchLogsClient;
    retentionInDays?: number;
  }) {
    this.client = config.cloudWatchClient || new CloudWatchLogsClient({ region: config.region });
    this.config = {
      logGroupName: config.logGroupName,
      logStreamName: this.generateLogStreamName(),
      region: config.region,
      retentionInDays: config.retentionInDays || 30,
    };
    this.logStreamName = this.config.logStreamName;
  }

  /**
   * 単一の監査ログエントリを記録
   */
  async log(entry: AuditLogEntry): Promise<void> {
    await this.logBatch([entry]);
  }

  /**
   * 複数の監査ログエントリを一括記録
   */
  async logBatch(entries: AuditLogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      // ログストリームが存在することを確認
      await this.ensureLogStreamExists();

      // ログイベントを構築
      const logEvents = entries.map(entry => ({
        timestamp: new Date(entry.timestamp).getTime(),
        message: JSON.stringify({
          ...entry,
          // CloudWatch Logsで検索しやすくするため重要フィールドを先頭に
          '@timestamp': entry.timestamp,
          '@eventType': entry.eventType,
          '@resourceType': entry.resourceType,
          '@resourceId': entry.resourceId,
          '@actorId': entry.actor.id,
          '@tenantId': entry.metadata.tenantId,
          '@flagKey': entry.metadata.flagKey,
        }),
      }));

      // タイムスタンプでソート（CloudWatch Logsの要件）
      logEvents.sort((a, b) => a.timestamp - b.timestamp);

      // CloudWatch Logsに送信
      const command = new PutLogEventsCommand({
        logGroupName: this.config.logGroupName,
        logStreamName: this.logStreamName,
        logEvents,
        sequenceToken: this.sequenceToken,
      });

      const response = await this.client.send(command);
      this.sequenceToken = response.nextSequenceToken;

      console.log(`Successfully sent ${entries.length} log events to CloudWatch`);

    } catch (error) {
      console.error('Error sending logs to CloudWatch:', error);
      throw error;
    }
  }

  /**
   * エラーログを記録
   */
  async logError(errorInfo: {
    error: string;
    event: string;
    recordCount?: number;
    requestId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const errorEntry: AuditLogEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      eventType: 'flag_evaluated', // エラー用のイベントタイプがないため代用
      resourceType: 'feature_flag',
      resourceId: 'system',
      action: 'READ',
      actor: {
        type: 'system',
        id: 'audit-service',
        name: 'Audit Service Error Handler',
      },
      changes: {
        after: {
          error: errorInfo.error,
          event: errorInfo.event,
          recordCount: errorInfo.recordCount,
          requestId: errorInfo.requestId,
          ...errorInfo.metadata,
        },
      },
      metadata: {
        correlationId: errorInfo.requestId,
        requestId: errorInfo.requestId,
      },
      source: {
        service: 'feature-flag-audit-service',
        version: process.env.SERVICE_VERSION || '1.0.0',
        region: this.config.region,
        environment: process.env.ENVIRONMENT || 'dev',
      },
    };

    await this.log(errorEntry);
  }

  /**
   * ログストリームが存在することを確認し、必要に応じて作成
   */
  private async ensureLogStreamExists(): Promise<void> {
    try {
      // ロググループの存在確認・作成
      await this.ensureLogGroupExists();

      // ログストリームの存在確認
      const describeCommand = new DescribeLogStreamsCommand({
        logGroupName: this.config.logGroupName,
        logStreamNamePrefix: this.logStreamName,
      });

      const response = await this.client.send(describeCommand);
      const existingStream = response.logStreams?.find(
        stream => stream.logStreamName === this.logStreamName
      );

      if (existingStream) {
        this.sequenceToken = existingStream.uploadSequenceToken;
        return;
      }

      // ログストリームを作成
      const createCommand = new CreateLogStreamCommand({
        logGroupName: this.config.logGroupName,
        logStreamName: this.logStreamName,
      });

      await this.client.send(createCommand);
      console.log(`Created log stream: ${this.logStreamName}`);

    } catch (error) {
      if (error instanceof ResourceAlreadyExistsException) {
        // ストリームが既に存在する場合は無視
        return;
      }
      console.error('Error ensuring log stream exists:', error);
      throw error;
    }
  }

  /**
   * ロググループが存在することを確認し、必要に応じて作成
   */
  private async ensureLogGroupExists(): Promise<void> {
    try {
      const command = new CreateLogGroupCommand({
        logGroupName: this.config.logGroupName,
      });

      await this.client.send(command);
      console.log(`Created log group: ${this.config.logGroupName}`);

    } catch (error) {
      if (error instanceof ResourceAlreadyExistsException) {
        // ロググループが既に存在する場合は無視
        return;
      }
      console.error('Error creating log group:', error);
      throw error;
    }
  }

  /**
   * ログストリーム名を生成
   * 形式: YYYY/MM/DD/[$LATEST]abcdefgh-ijkl-mnop-qrst-uvwxyz123456
   */
  private generateLogStreamName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Lambda実行コンテキストの識別子（擬似）
    const containerId = Math.random().toString(36).substr(2, 32);
    
    return `${year}/${month}/${day}/[$LATEST]${containerId}`;
  }
}