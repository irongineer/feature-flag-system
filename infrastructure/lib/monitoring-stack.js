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
exports.MonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
class MonitoringStack extends cdk.Stack {
    envName;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.envName = props.stackName;
        // アラート通知用SNSトピック
        const alertTopic = new sns.Topic(this, 'FeatureFlagAlerts', {
            topicName: `feature-flag-alerts-${this.envName.toLowerCase()}`,
            displayName: 'Feature Flag System Alerts',
        });
        // CloudWatch Dashboard
        const dashboard = new cloudwatch.Dashboard(this, 'FeatureFlagDashboard', {
            dashboardName: `feature-flag-dashboard-${this.envName.toLowerCase()}`,
        });
        // API Gateway メトリクス
        const apiErrorRate = new cloudwatch.MathExpression({
            expression: '(m1/m2)*100',
            usingMetrics: {
                m1: props.api.metricClientError({ period: cdk.Duration.minutes(5) }),
                m2: props.api.metricCount({ period: cdk.Duration.minutes(5) }),
            },
            label: 'API Error Rate (%)',
        });
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway Metrics',
            left: [
                props.api.metricCount({ label: 'Request Count' }),
                props.api.metricLatency({ label: 'Latency' }),
            ],
            right: [apiErrorRate],
            period: cdk.Duration.minutes(5),
            width: 12,
        }));
        // DynamoDB メトリクス
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'DynamoDB Metrics',
            left: [
                props.featureFlagsTable.metricConsumedReadCapacityUnits({ label: 'Read Capacity' }),
                props.featureFlagsTable.metricConsumedWriteCapacityUnits({ label: 'Write Capacity' }),
            ],
            right: [
                props.featureFlagsTable.metricThrottledRequests({ label: 'Throttled Requests' }),
            ],
            period: cdk.Duration.minutes(5),
            width: 12,
        }));
        // Lambda メトリクス（存在する場合）
        if (props.evaluationLambda) {
            dashboard.addWidgets(new cloudwatch.GraphWidget({
                title: 'Evaluation Lambda Metrics',
                left: [
                    props.evaluationLambda.metricInvocations({ label: 'Invocations' }),
                    props.evaluationLambda.metricDuration({ label: 'Duration' }),
                ],
                right: [
                    props.evaluationLambda.metricErrors({ label: 'Errors' }),
                    props.evaluationLambda.metricThrottles({ label: 'Throttles' }),
                ],
                period: cdk.Duration.minutes(5),
                width: 12,
            }));
        }
        // アラーム設定
        // API Gateway エラー率アラーム
        const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
            alarmName: `feature-flag-api-error-rate-${this.envName.toLowerCase()}`,
            alarmDescription: 'API Gateway error rate is too high',
            metric: apiErrorRate,
            threshold: 5, // 5%以上
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        apiErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
        // DynamoDB スロットリングアラーム
        const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
            alarmName: `feature-flag-dynamo-throttle-${this.envName.toLowerCase()}`,
            alarmDescription: 'DynamoDB is being throttled',
            metric: props.featureFlagsTable.metricThrottledRequests(),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });
        dynamoThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
        // Lambda エラーアラーム
        if (props.evaluationLambda) {
            const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
                alarmName: `feature-flag-lambda-errors-${this.envName.toLowerCase()}`,
                alarmDescription: 'Lambda function errors detected',
                metric: props.evaluationLambda.metricErrors(),
                threshold: 5,
                evaluationPeriods: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            });
            lambdaErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
        }
        // カスタムメトリクス用ログフィルター
        const logGroup = new logs.LogGroup(this, 'FeatureFlagLogGroup', {
            logGroupName: `/aws/lambda/feature-flag-${this.envName.toLowerCase()}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // カスタムメトリクス: Kill-Switch発動
        const killSwitchMetric = new logs.MetricFilter(this, 'KillSwitchMetric', {
            logGroup,
            filterPattern: logs.FilterPattern.literal('[timestamp, requestId, level="ERROR", message="Kill-switch activated"]'),
            metricNamespace: 'FeatureFlag',
            metricName: 'KillSwitchActivated',
            metricValue: '1',
            defaultValue: 0,
        });
        // Kill-Switch発動アラーム
        const killSwitchAlarm = new cloudwatch.Alarm(this, 'KillSwitchAlarm', {
            alarmName: `feature-flag-kill-switch-${this.envName.toLowerCase()}`,
            alarmDescription: 'Kill-switch has been activated',
            metric: new cloudwatch.Metric({
                namespace: 'FeatureFlag',
                metricName: 'KillSwitchActivated',
                statistic: 'Sum',
                period: cdk.Duration.minutes(1),
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });
        killSwitchAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
        // 出力
        new cdk.CfnOutput(this, 'DashboardUrl', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
            description: 'CloudWatch Dashboard URL',
        });
        new cdk.CfnOutput(this, 'AlertTopicArn', {
            value: alertTopic.topicArn,
            description: 'SNS Alert Topic ARN',
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCxzRkFBd0U7QUFDeEUsMkRBQTZDO0FBQzdDLHlEQUEyQztBQWUzQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0IsT0FBTyxDQUFTO0lBRWpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDO1FBRS9CLGlCQUFpQjtRQUNqQixNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzFELFNBQVMsRUFBRSx1QkFBdUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUM5RCxXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztRQUVILHVCQUF1QjtRQUN2QixNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ3ZFLGFBQWEsRUFBRSwwQkFBMEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRTtTQUN0RSxDQUFDLENBQUM7UUFFSCxvQkFBb0I7UUFDcEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxVQUFVLENBQUMsY0FBYyxDQUFDO1lBQ2pELFVBQVUsRUFBRSxhQUFhO1lBQ3pCLFlBQVksRUFBRTtnQkFDWixFQUFFLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLENB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LEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUM7WUFDRixTQUFTLEVBQUUsQ0FBQztZQUNaLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLGtDQUFrQztTQUNyRixDQUFDLENBQUM7UUFFSCxlQUFlLENBQUMsY0FBYyxDQUM1QixJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FDNUMsQ0FBQztRQUVGLEtBQUs7UUFDTCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUseURBQXlELElBQUksQ0FBQyxNQUFNLG9CQUFvQixTQUFTLENBQUMsYUFBYSxFQUFFO1lBQ3hILFdBQVcsRUFBRSwwQkFBMEI7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxRQUFRO1lBQzFCLFdBQVcsRUFBRSxxQkFBcUI7U0FDbkMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMUtELDBDQTBLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hBY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzbnNTdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhY2tOYW1lOiBzdHJpbmc7XG4gIGZlYXR1cmVGbGFnc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIGV2YWx1YXRpb25MYW1iZGE/OiBsYW1iZGEuRnVuY3Rpb247XG4gIG1hbmFnZW1lbnRMYW1iZGE/OiBsYW1iZGEuRnVuY3Rpb247XG59XG5cbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwcml2YXRlIHJlYWRvbmx5IGVudk5hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcbiAgICB0aGlzLmVudk5hbWUgPSBwcm9wcy5zdGFja05hbWU7XG5cbiAgICAvLyDjgqLjg6njg7zjg4jpgJrnn6XnlKhTTlPjg4jjg5Tjg4Pjgq9cbiAgICBjb25zdCBhbGVydFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnRmVhdHVyZUZsYWdBbGVydHMnLCB7XG4gICAgICB0b3BpY05hbWU6IGBmZWF0dXJlLWZsYWctYWxlcnRzLSR7dGhpcy5lbnZOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnRmVhdHVyZSBGbGFnIFN5c3RlbSBBbGVydHMnLFxuICAgIH0pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBEYXNoYm9hcmRcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0ZlYXR1cmVGbGFnRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYGZlYXR1cmUtZmxhZy1kYXNoYm9hcmQtJHt0aGlzLmVudk5hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkg44Oh44OI44Oq44Kv44K5XG4gICAgY29uc3QgYXBpRXJyb3JSYXRlID0gbmV3IGNsb3Vkd2F0Y2guTWF0aEV4cHJlc3Npb24oe1xuICAgICAgZXhwcmVzc2lvbjogJyhtMS9tMikqMTAwJyxcbiAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICBtMTogcHJvcHMuYXBpLm1ldHJpY0NsaWVudEVycm9yKHsgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcbiAgICAgICAgbTI6IHByb3BzLmFwaS5tZXRyaWNDb3VudCh7IHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXG4gICAgICB9LFxuICAgICAgbGFiZWw6ICdBUEkgRXJyb3IgUmF0ZSAoJSknLFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgTWV0cmljcycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBwcm9wcy5hcGkubWV0cmljQ291bnQoeyBsYWJlbDogJ1JlcXVlc3QgQ291bnQnIH0pLFxuICAgICAgICAgIHByb3BzLmFwaS5tZXRyaWNMYXRlbmN5KHsgbGFiZWw6ICdMYXRlbmN5JyB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFthcGlFcnJvclJhdGVdLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBEeW5hbW9EQiDjg6Hjg4jjg6rjgq/jgrlcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiBNZXRyaWNzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIHByb3BzLmZlYXR1cmVGbGFnc1RhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoeyBsYWJlbDogJ1JlYWQgQ2FwYWNpdHknIH0pLFxuICAgICAgICAgIHByb3BzLmZlYXR1cmVGbGFnc1RhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHsgbGFiZWw6ICdXcml0ZSBDYXBhY2l0eScgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgcHJvcHMuZmVhdHVyZUZsYWdzVGFibGUubWV0cmljVGhyb3R0bGVkUmVxdWVzdHMoeyBsYWJlbDogJ1Rocm90dGxlZCBSZXF1ZXN0cycgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIExhbWJkYSDjg6Hjg4jjg6rjgq/jgrnvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuZXZhbHVhdGlvbkxhbWJkYSkge1xuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0V2YWx1YXRpb24gTGFtYmRhIE1ldHJpY3MnLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljSW52b2NhdGlvbnMoeyBsYWJlbDogJ0ludm9jYXRpb25zJyB9KSxcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljRHVyYXRpb24oeyBsYWJlbDogJ0R1cmF0aW9uJyB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgICBwcm9wcy5ldmFsdWF0aW9uTGFtYmRhLm1ldHJpY0Vycm9ycyh7IGxhYmVsOiAnRXJyb3JzJyB9KSxcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljVGhyb3R0bGVzKHsgbGFiZWw6ICdUaHJvdHRsZXMnIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOCouODqeODvOODoOioreWumlxuXG4gICAgLy8gQVBJIEdhdGV3YXkg44Ko44Op44O8546H44Ki44Op44O844OgXG4gICAgY29uc3QgYXBpRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGlFcnJvclJhdGVBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1hcGktZXJyb3ItcmF0ZS0ke3RoaXMuZW52TmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZXJyb3IgcmF0ZSBpcyB0b28gaGlnaCcsXG4gICAgICBtZXRyaWM6IGFwaUVycm9yUmF0ZSxcbiAgICAgIHRocmVzaG9sZDogNSwgLy8gNSXku6XkuIpcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBhcGlFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBEeW5hbW9EQiDjgrnjg63jg4Pjg4jjg6rjg7PjgrDjgqLjg6njg7zjg6BcbiAgICBjb25zdCBkeW5hbW9UaHJvdHRsZUFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0R5bmFtb1Rocm90dGxlQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGBmZWF0dXJlLWZsYWctZHluYW1vLXRocm90dGxlLSR7dGhpcy5lbnZOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdEeW5hbW9EQiBpcyBiZWluZyB0aHJvdHRsZWQnLFxuICAgICAgbWV0cmljOiBwcm9wcy5mZWF0dXJlRmxhZ3NUYWJsZS5tZXRyaWNUaHJvdHRsZWRSZXF1ZXN0cygpLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgfSk7XG5cbiAgICBkeW5hbW9UaHJvdHRsZUFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyBMYW1iZGEg44Ko44Op44O844Ki44Op44O844OgXG4gICAgaWYgKHByb3BzLmV2YWx1YXRpb25MYW1iZGEpIHtcbiAgICAgIGNvbnN0IGxhbWJkYUVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnTGFtYmRhRXJyb3JBbGFybScsIHtcbiAgICAgICAgYWxhcm1OYW1lOiBgZmVhdHVyZS1mbGFnLWxhbWJkYS1lcnJvcnMtJHt0aGlzLmVudk5hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIGVycm9ycyBkZXRlY3RlZCcsXG4gICAgICAgIG1ldHJpYzogcHJvcHMuZXZhbHVhdGlvbkxhbWJkYS5tZXRyaWNFcnJvcnMoKSxcbiAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgfSk7XG5cbiAgICAgIGxhbWJkYUVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRUb3BpYylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g44Kr44K544K/44Og44Oh44OI44Oq44Kv44K555So44Ot44Kw44OV44Kj44Or44K/44O8XG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnRmVhdHVyZUZsYWdMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvbGFtYmRhL2ZlYXR1cmUtZmxhZy0ke3RoaXMuZW52TmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyDjgqvjgrnjgr/jg6Djg6Hjg4jjg6rjgq/jgrk6IEtpbGwtU3dpdGNo55m65YuVXG4gICAgY29uc3Qga2lsbFN3aXRjaE1ldHJpYyA9IG5ldyBsb2dzLk1ldHJpY0ZpbHRlcih0aGlzLCAnS2lsbFN3aXRjaE1ldHJpYycsIHtcbiAgICAgIGxvZ0dyb3VwLFxuICAgICAgZmlsdGVyUGF0dGVybjogbG9ncy5GaWx0ZXJQYXR0ZXJuLmxpdGVyYWwoJ1t0aW1lc3RhbXAsIHJlcXVlc3RJZCwgbGV2ZWw9XCJFUlJPUlwiLCBtZXNzYWdlPVwiS2lsbC1zd2l0Y2ggYWN0aXZhdGVkXCJdJyksXG4gICAgICBtZXRyaWNOYW1lc3BhY2U6ICdGZWF0dXJlRmxhZycsXG4gICAgICBtZXRyaWNOYW1lOiAnS2lsbFN3aXRjaEFjdGl2YXRlZCcsXG4gICAgICBtZXRyaWNWYWx1ZTogJzEnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAwLFxuICAgIH0pO1xuXG4gICAgLy8gS2lsbC1Td2l0Y2jnmbrli5XjgqLjg6njg7zjg6BcbiAgICBjb25zdCBraWxsU3dpdGNoQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnS2lsbFN3aXRjaEFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgZmVhdHVyZS1mbGFnLWtpbGwtc3dpdGNoLSR7dGhpcy5lbnZOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdLaWxsLXN3aXRjaCBoYXMgYmVlbiBhY3RpdmF0ZWQnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdGZWF0dXJlRmxhZycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdLaWxsU3dpdGNoQWN0aXZhdGVkJyxcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcygxKSxcbiAgICAgIH0pLFxuICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgfSk7XG5cbiAgICBraWxsU3dpdGNoQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKGFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIOWHuuWKm1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke2Rhc2hib2FyZC5kYXNoYm9hcmROYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiBhbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgQWxlcnQgVG9waWMgQVJOJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==