import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AuditStackProps extends cdk.StackProps {
  featureFlagsTable: dynamodb.Table;
  environment: string;
}

export class AuditStack extends cdk.Stack {
  public readonly auditLogGroup: logs.LogGroup;
  public readonly streamProcessorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AuditStackProps) {
    super(scope, id, props);

    const { featureFlagsTable, environment } = props;

    // CloudWatch Logs ロググループ
    this.auditLogGroup = new logs.LogGroup(this, 'AuditLogGroup', {
      logGroupName: `/aws/lambda/feature-flag-audit-${environment}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Streams処理Lambda関数
    this.streamProcessorFunction = new lambda.Function(this, 'StreamProcessor', {
      functionName: `feature-flag-audit-processor-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'streams-processor.handler',
      code: lambda.Code.fromAsset('../packages/audit-service/dist'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        AUDIT_LOG_GROUP_NAME: this.auditLogGroup.logGroupName,
        AWS_REGION: this.region,
        SERVICE_VERSION: '1.0.0',
        ENVIRONMENT: environment,
      },
      description: 'Process DynamoDB streams for feature flag audit logging',
    });

    // DynamoDB Streamsイベントソースを追加
    this.streamProcessorFunction.addEventSource(
      new lambdaEventSources.DynamoEventSource(featureFlagsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
        reportBatchItemFailures: true,
        filters: [
          // フィーチャーフラグ関連のレコードのみ処理
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual('INSERT')
              .or(lambda.FilterRule.isEqual('MODIFY'))
              .or(lambda.FilterRule.isEqual('REMOVE')),
          }),
        ],
      })
    );

    // CloudWatch Logsへの書き込み権限
    this.auditLogGroup.grantWrite(this.streamProcessorFunction);

    // DynamoDBテーブルの読み取り権限
    featureFlagsTable.grantStreamRead(this.streamProcessorFunction);

    // CloudWatch Logsの管理権限（ログストリーム作成用）
    this.streamProcessorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:DescribeLogStreams',
          'logs:PutLogEvents',
        ],
        resources: [
          this.auditLogGroup.logGroupArn,
          `${this.auditLogGroup.logGroupArn}:*`,
        ],
      })
    );

    // 監査ログクエリ用Lambda関数
    const auditQueryFunction = new lambda.Function(this, 'AuditQueryFunction', {
      functionName: `feature-flag-audit-query-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'audit-query.handler',
      code: lambda.Code.fromAsset('../packages/audit-service/dist'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      environment: {
        AUDIT_LOG_GROUP_NAME: this.auditLogGroup.logGroupName,
        AWS_REGION: this.region,
        ENVIRONMENT: environment,
      },
      description: 'Query audit logs for feature flag changes',
    });

    // CloudWatch Logsの読み取り権限
    auditQueryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:GetLogEvents',
          'logs:FilterLogEvents',
          'logs:StartQuery',
          'logs:StopQuery',
          'logs:GetQueryResults',
        ],
        resources: [
          this.auditLogGroup.logGroupArn,
          `${this.auditLogGroup.logGroupArn}:*`,
        ],
      })
    );

    // デッドレターキュー用のSQS（オプション）
    // const dlq = new sqs.Queue(this, 'AuditDLQ', {
    //   queueName: `feature-flag-audit-dlq-${environment}`,
    //   retentionPeriod: cdk.Duration.days(14),
    // });

    // ストリーム処理失敗時の通知用SNSトピック（オプション）
    // const alertTopic = new sns.Topic(this, 'AuditAlert', {
    //   topicName: `feature-flag-audit-alerts-${environment}`,
    // });

    // Lambda関数のエラー監視
    const errorAlarm = new cdk.aws_cloudwatch.Alarm(this, 'StreamProcessorErrors', {
      alarmName: `feature-flag-audit-errors-${environment}`,
      metric: this.streamProcessorFunction.metricErrors({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // 処理時間の監視
    const durationAlarm = new cdk.aws_cloudwatch.Alarm(this, 'StreamProcessorDuration', {
      alarmName: `feature-flag-audit-duration-${environment}`,
      metric: this.streamProcessorFunction.metricDuration({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 30000, // 30秒
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // 出力
    new cdk.CfnOutput(this, 'AuditLogGroupName', {
      value: this.auditLogGroup.logGroupName,
      description: 'Audit log group name',
    });

    new cdk.CfnOutput(this, 'StreamProcessorFunctionName', {
      value: this.streamProcessorFunction.functionName,
      description: 'Stream processor function name',
    });

    new cdk.CfnOutput(this, 'AuditQueryFunctionName', {
      value: auditQueryFunction.functionName,
      description: 'Audit query function name',
    });

    // タグ
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Service', 'FeatureFlag');
    cdk.Tags.of(this).add('Component', 'AuditLogging');
  }
}