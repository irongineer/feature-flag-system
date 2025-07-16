"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class AuditStack extends cdk.Stack {
    auditLogGroup;
    streamProcessorFunction;
    constructor(scope, id, props) {
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
        this.streamProcessorFunction.addEventSource(new lambdaEventSources.DynamoEventSource(featureFlagsTable, {
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
        }));
        // CloudWatch Logsへの書き込み権限
        this.auditLogGroup.grantWrite(this.streamProcessorFunction);
        // DynamoDBテーブルの読み取り権限
        featureFlagsTable.grantStreamRead(this.streamProcessorFunction);
        // CloudWatch Logsの管理権限（ログストリーム作成用）
        this.streamProcessorFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
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
        auditQueryFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
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
exports.AuditStack = AuditStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaXQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhdWRpdC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELHlGQUEyRTtBQUUzRSwyREFBNkM7QUFDN0MseURBQTJDO0FBUTNDLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZCLGFBQWEsQ0FBZ0I7SUFDN0IsdUJBQXVCLENBQWtCO0lBRXpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVqRCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUM1RCxZQUFZLEVBQUUsa0NBQWtDLFdBQVcsRUFBRTtZQUM3RCxTQUFTLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTO1lBQ3ZDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsNkJBQTZCO1FBQzdCLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzFFLFlBQVksRUFBRSxnQ0FBZ0MsV0FBVyxFQUFFO1lBQzNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLDJCQUEyQjtZQUNwQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0NBQWdDLENBQUM7WUFDN0QsT0FBTyxFQUFFLEdBQUcsQ0FB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LWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBBdWRpdFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGZlYXR1cmVGbGFnc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEF1ZGl0U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXVkaXRMb2dHcm91cDogbG9ncy5Mb2dHcm91cDtcbiAgcHVibGljIHJlYWRvbmx5IHN0cmVhbVByb2Nlc3NvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEF1ZGl0U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBmZWF0dXJlRmxhZ3NUYWJsZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dzIOODreOCsOOCsOODq+ODvOODl1xuICAgIHRoaXMuYXVkaXRMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBdWRpdExvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvZmVhdHVyZS1mbGFnLWF1ZGl0LSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBTdHJlYW1z5Yem55CGTGFtYmRh6Zai5pWwXG4gICAgdGhpcy5zdHJlYW1Qcm9jZXNzb3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0cmVhbVByb2Nlc3NvcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1wcm9jZXNzb3ItJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnc3RyZWFtcy1wcm9jZXNzb3IuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3BhY2thZ2VzL2F1ZGl0LXNlcnZpY2UvZGlzdCcpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBVURJVF9MT0dfR1JPVVBfTkFNRTogdGhpcy5hdWRpdExvZ0dyb3VwLmxvZ0dyb3VwTmFtZSxcbiAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFNFUlZJQ0VfVkVSU0lPTjogJzEuMC4wJyxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2VzcyBEeW5hbW9EQiBzdHJlYW1zIGZvciBmZWF0dXJlIGZsYWcgYXVkaXQgbG9nZ2luZycsXG4gICAgfSk7XG5cbiAgICAvLyBEeW5hbW9EQiBTdHJlYW1z44Kk44OZ44Oz44OI44K944O844K544KS6L+95YqgXG4gICAgdGhpcy5zdHJlYW1Qcm9jZXNzb3JGdW5jdGlvbi5hZGRFdmVudFNvdXJjZShcbiAgICAgIG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuRHluYW1vRXZlbnRTb3VyY2UoZmVhdHVyZUZsYWdzVGFibGUsIHtcbiAgICAgICAgc3RhcnRpbmdQb3NpdGlvbjogbGFtYmRhLlN0YXJ0aW5nUG9zaXRpb24uTEFURVNULFxuICAgICAgICBiYXRjaFNpemU6IDEwLFxuICAgICAgICBtYXhCYXRjaGluZ1dpbmRvdzogY2RrLkR1cmF0aW9uLnNlY29uZHMoNSksXG4gICAgICAgIHJldHJ5QXR0ZW1wdHM6IDMsXG4gICAgICAgIHJlcG9ydEJhdGNoSXRlbUZhaWx1cmVzOiB0cnVlLFxuICAgICAgICBmaWx0ZXJzOiBbXG4gICAgICAgICAgLy8g44OV44Kj44O844OB44Oj44O844OV44Op44Kw6Zai6YCj44Gu44Os44Kz44O844OJ44Gu44G/5Yem55CGXG4gICAgICAgICAgbGFtYmRhLkZpbHRlckNyaXRlcmlhLmZpbHRlcih7XG4gICAgICAgICAgICBldmVudE5hbWU6IGxhbWJkYS5GaWx0ZXJSdWxlLmlzRXF1YWwoJ0lOU0VSVCcpXG4gICAgICAgICAgICAgIC5vcihsYW1iZGEuRmlsdGVyUnVsZS5pc0VxdWFsKCdNT0RJRlknKSlcbiAgICAgICAgICAgICAgLm9yKGxhbWJkYS5GaWx0ZXJSdWxlLmlzRXF1YWwoJ1JFTU9WRScpKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc+OBuOOBruabuOOBjei+vOOBv+aoqemZkFxuICAgIHRoaXMuYXVkaXRMb2dHcm91cC5ncmFudFdyaXRlKHRoaXMuc3RyZWFtUHJvY2Vzc29yRnVuY3Rpb24pO1xuXG4gICAgLy8gRHluYW1vRELjg4bjg7zjg5bjg6vjga7oqq3jgb/lj5bjgormqKnpmZBcbiAgICBmZWF0dXJlRmxhZ3NUYWJsZS5ncmFudFN0cmVhbVJlYWQodGhpcy5zdHJlYW1Qcm9jZXNzb3JGdW5jdGlvbik7XG5cbiAgICAvLyBDbG91ZFdhdGNoIExvZ3Pjga7nrqHnkIbmqKnpmZDvvIjjg63jgrDjgrnjg4jjg6rjg7zjg6DkvZzmiJDnlKjvvIlcbiAgICB0aGlzLnN0cmVhbVByb2Nlc3NvckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zJyxcbiAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICB0aGlzLmF1ZGl0TG9nR3JvdXAubG9nR3JvdXBBcm4sXG4gICAgICAgICAgYCR7dGhpcy5hdWRpdExvZ0dyb3VwLmxvZ0dyb3VwQXJufToqYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIOebo+afu+ODreOCsOOCr+OCqOODqueUqExhbWJkYemWouaVsFxuICAgIGNvbnN0IGF1ZGl0UXVlcnlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1ZGl0UXVlcnlGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1xdWVyeS0ke2Vudmlyb25tZW50fWAsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdhdWRpdC1xdWVyeS5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vcGFja2FnZXMvYXVkaXQtc2VydmljZS9kaXN0JyksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFVRElUX0xPR19HUk9VUF9OQU1FOiB0aGlzLmF1ZGl0TG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUXVlcnkgYXVkaXQgbG9ncyBmb3IgZmVhdHVyZSBmbGFnIGNoYW5nZXMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz44Gu6Kqt44G/5Y+W44KK5qip6ZmQXG4gICAgYXVkaXRRdWVyeUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dHcm91cHMnLFxuICAgICAgICAgICdsb2dzOkRlc2NyaWJlTG9nU3RyZWFtcycsXG4gICAgICAgICAgJ2xvZ3M6R2V0TG9nRXZlbnRzJyxcbiAgICAgICAgICAnbG9nczpGaWx0ZXJMb2dFdmVudHMnLFxuICAgICAgICAgICdsb2dzOlN0YXJ0UXVlcnknLFxuICAgICAgICAgICdsb2dzOlN0b3BRdWVyeScsXG4gICAgICAgICAgJ2xvZ3M6R2V0UXVlcnlSZXN1bHRzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgdGhpcy5hdWRpdExvZ0dyb3VwLmxvZ0dyb3VwQXJuLFxuICAgICAgICAgIGAke3RoaXMuYXVkaXRMb2dHcm91cC5sb2dHcm91cEFybn06KmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyDjg4fjg4Pjg4njg6zjgr/jg7zjgq3jg6Xjg7znlKjjga5TUVPvvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICAvLyBjb25zdCBkbHEgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdBdWRpdERMUScsIHtcbiAgICAvLyAgIHF1ZXVlTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1kbHEtJHtlbnZpcm9ubWVudH1gLFxuICAgIC8vICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgLy8gfSk7XG5cbiAgICAvLyDjgrnjg4jjg6rjg7zjg6Dlh6bnkIblpLHmlZfmmYLjga7pgJrnn6XnlKhTTlPjg4jjg5Tjg4Pjgq/vvIjjgqrjg5fjgrfjg6fjg7PvvIlcbiAgICAvLyBjb25zdCBhbGVydFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQXVkaXRBbGVydCcsIHtcbiAgICAvLyAgIHRvcGljTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1hbGVydHMtJHtlbnZpcm9ubWVudH1gLFxuICAgIC8vIH0pO1xuXG4gICAgLy8gTGFtYmRh6Zai5pWw44Gu44Ko44Op44O855uj6KaWXG4gICAgY29uc3QgZXJyb3JBbGFybSA9IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1N0cmVhbVByb2Nlc3NvckVycm9ycycsIHtcbiAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1lcnJvcnMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgbWV0cmljOiB0aGlzLnN0cmVhbVByb2Nlc3NvckZ1bmN0aW9uLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2RrLmF3c19jbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIC8vIOWHpueQhuaZgumWk+OBruebo+imllxuICAgIGNvbnN0IGR1cmF0aW9uQWxhcm0gPSBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdTdHJlYW1Qcm9jZXNzb3JEdXJhdGlvbicsIHtcbiAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1hdWRpdC1kdXJhdGlvbi0ke2Vudmlyb25tZW50fWAsXG4gICAgICBtZXRyaWM6IHRoaXMuc3RyZWFtUHJvY2Vzc29yRnVuY3Rpb24ubWV0cmljRHVyYXRpb24oe1xuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IDMwMDAwLCAvLyAzMOenklxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjZGsuYXdzX2Nsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgLy8g5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1ZGl0TG9nR3JvdXBOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXVkaXRMb2dHcm91cC5sb2dHcm91cE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1ZGl0IGxvZyBncm91cCBuYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdHJlYW1Qcm9jZXNzb3JGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdHJlYW1Qcm9jZXNzb3JGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0cmVhbSBwcm9jZXNzb3IgZnVuY3Rpb24gbmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVkaXRRdWVyeUZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiBhdWRpdFF1ZXJ5RnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBdWRpdCBxdWVyeSBmdW5jdGlvbiBuYW1lJyxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCsFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZXJ2aWNlJywgJ0ZlYXR1cmVGbGFnJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdDb21wb25lbnQnLCAnQXVkaXRMb2dnaW5nJyk7XG4gIH1cbn0iXX0=