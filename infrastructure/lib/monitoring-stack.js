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
    constructor(scope, id, props) {
        super(scope, id, props);
        // アラート通知用SNSトピック
        const alertTopic = new sns.Topic(this, 'FeatureFlagAlerts', {
            topicName: `feature-flag-alerts-${this.stackName.toLowerCase()}`,
            displayName: 'Feature Flag System Alerts',
        });
        // CloudWatch Dashboard
        const dashboard = new cloudwatch.Dashboard(this, 'FeatureFlagDashboard', {
            dashboardName: `feature-flag-dashboard-${this.stackName.toLowerCase()}`,
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
            alarmName: `feature-flag-api-error-rate-${this.stackName.toLowerCase()}`,
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
            alarmName: `feature-flag-dynamo-throttle-${this.stackName.toLowerCase()}`,
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
                alarmName: `feature-flag-lambda-errors-${this.stackName.toLowerCase()}`,
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
            logGroupName: `/aws/lambda/feature-flag-${this.stackName.toLowerCase()}`,
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
            alarmName: `feature-flag-kill-switch-${this.stackName.toLowerCase()}`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCxzRkFBd0U7QUFDeEUsMkRBQTZDO0FBQzdDLHlEQUEyQztBQWMzQyxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixpQkFBaUI7UUFDakIsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMxRCxTQUFTLEVBQUUsdUJBQXVCLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEVBQUU7WUFDaEUsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUN2RSxhQUFhLEVBQUUsMEJBQTBCLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEVBQUU7U0FDeEUsQ0FBQyxDQUFDO1FBRUgsb0JBQW9CO1FBQ3BCLE1BQU0sWUFBWSxHQUFHLElBQUksVUFBVSxDQUFDLGNBQWMsQ0FBQztZQUNqRCxVQUFVLEVBQUUsYUFBYTtZQUN6QixZQUFZLEVBQUU7Z0JBQ1osRUFBRSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDcEUsRUFBRSxFQUFFLEtB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U0FBUyxFQUFFLENBQUM7WUFDWixpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxrQ0FBa0M7U0FDckYsQ0FBQyxDQUFDO1FBRUgsZUFBZSxDQUFDLGNBQWMsQ0FDNUIsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQzVDLENBQUM7UUFFRixLQUFLO1FBQ0wsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLHlEQUF5RCxJQUFJLENBQUMsTUFBTSxvQkFBb0IsU0FBUyxDQUFDLGFBQWEsRUFBRTtZQUN4SCxXQUFXLEVBQUUsMEJBQTBCO1NBQ3hDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxVQUFVLENBQUMsUUFBUTtZQUMxQixXQUFXLEVBQUUscUJBQXFCO1NBQ25DLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXZLRCwwQ0F1S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoQWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc25zU3Vic2NyaXB0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTW9uaXRvcmluZ1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGZlYXR1cmVGbGFnc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIGV2YWx1YXRpb25MYW1iZGE/OiBsYW1iZGEuRnVuY3Rpb247XG4gIG1hbmFnZW1lbnRMYW1iZGE/OiBsYW1iZGEuRnVuY3Rpb247XG59XG5cbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOOCouODqeODvOODiOmAmuefpeeUqFNOU+ODiOODlOODg+OCr1xuICAgIGNvbnN0IGFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdGZWF0dXJlRmxhZ0FsZXJ0cycsIHtcbiAgICAgIHRvcGljTmFtZTogYGZlYXR1cmUtZmxhZy1hbGVydHMtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ0ZlYXR1cmUgRmxhZyBTeXN0ZW0gQWxlcnRzJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdGZWF0dXJlRmxhZ0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBmZWF0dXJlLWZsYWctZGFzaGJvYXJkLSR7dGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkg44Oh44OI44Oq44Kv44K5XG4gICAgY29uc3QgYXBpRXJyb3JSYXRlID0gbmV3IGNsb3Vkd2F0Y2guTWF0aEV4cHJlc3Npb24oe1xuICAgICAgZXhwcmVzc2lvbjogJyhtMS9tMikqMTAwJyxcbiAgICAgIHVzaW5nTWV0cmljczoge1xuICAgICAgICBtMTogcHJvcHMuYXBpLm1ldHJpY0NsaWVudEVycm9yKHsgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSB9KSxcbiAgICAgICAgbTI6IHByb3BzLmFwaS5tZXRyaWNDb3VudCh7IHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkgfSksXG4gICAgICB9LFxuICAgICAgbGFiZWw6ICdBUEkgRXJyb3IgUmF0ZSAoJSknLFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgTWV0cmljcycsXG4gICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICBwcm9wcy5hcGkubWV0cmljQ291bnQoeyBsYWJlbDogJ1JlcXVlc3QgQ291bnQnIH0pLFxuICAgICAgICAgIHByb3BzLmFwaS5tZXRyaWNMYXRlbmN5KHsgbGFiZWw6ICdMYXRlbmN5JyB9KSxcbiAgICAgICAgXSxcbiAgICAgICAgcmlnaHQ6IFthcGlFcnJvclJhdGVdLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBEeW5hbW9EQiDjg6Hjg4jjg6rjgq/jgrlcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdEeW5hbW9EQiBNZXRyaWNzJyxcbiAgICAgICAgbGVmdDogW1xuICAgICAgICAgIHByb3BzLmZlYXR1cmVGbGFnc1RhYmxlLm1ldHJpY0NvbnN1bWVkUmVhZENhcGFjaXR5VW5pdHMoeyBsYWJlbDogJ1JlYWQgQ2FwYWNpdHknIH0pLFxuICAgICAgICAgIHByb3BzLmZlYXR1cmVGbGFnc1RhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHsgbGFiZWw6ICdXcml0ZSBDYXBhY2l0eScgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgcHJvcHMuZmVhdHVyZUZsYWdzVGFibGUubWV0cmljVGhyb3R0bGVkUmVxdWVzdHMoeyBsYWJlbDogJ1Rocm90dGxlZCBSZXF1ZXN0cycgfSksXG4gICAgICAgIF0sXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIExhbWJkYSDjg6Hjg4jjg6rjgq/jgrnvvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuZXZhbHVhdGlvbkxhbWJkYSkge1xuICAgICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgICB0aXRsZTogJ0V2YWx1YXRpb24gTGFtYmRhIE1ldHJpY3MnLFxuICAgICAgICAgIGxlZnQ6IFtcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljSW52b2NhdGlvbnMoeyBsYWJlbDogJ0ludm9jYXRpb25zJyB9KSxcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljRHVyYXRpb24oeyBsYWJlbDogJ0R1cmF0aW9uJyB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJpZ2h0OiBbXG4gICAgICAgICAgICBwcm9wcy5ldmFsdWF0aW9uTGFtYmRhLm1ldHJpY0Vycm9ycyh7IGxhYmVsOiAnRXJyb3JzJyB9KSxcbiAgICAgICAgICAgIHByb3BzLmV2YWx1YXRpb25MYW1iZGEubWV0cmljVGhyb3R0bGVzKHsgbGFiZWw6ICdUaHJvdHRsZXMnIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOCouODqeODvOODoOioreWumlxuXG4gICAgLy8gQVBJIEdhdGV3YXkg44Ko44Op44O8546H44Ki44Op44O844OgXG4gICAgY29uc3QgYXBpRXJyb3JBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGlFcnJvclJhdGVBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1hcGktZXJyb3ItcmF0ZS0ke3RoaXMuc3RhY2tOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBlcnJvciByYXRlIGlzIHRvbyBoaWdoJyxcbiAgICAgIG1ldHJpYzogYXBpRXJyb3JSYXRlLFxuICAgICAgdGhyZXNob2xkOiA1LCAvLyA1JeS7peS4ilxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGFwaUVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKGFsZXJ0VG9waWMpXG4gICAgKTtcblxuICAgIC8vIER5bmFtb0RCIOOCueODreODg+ODiOODquODs+OCsOOCouODqeODvOODoFxuICAgIGNvbnN0IGR5bmFtb1Rocm90dGxlQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRHluYW1vVGhyb3R0bGVBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1keW5hbW8tdGhyb3R0bGUtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRHluYW1vREIgaXMgYmVpbmcgdGhyb3R0bGVkJyxcbiAgICAgIG1ldHJpYzogcHJvcHMuZmVhdHVyZUZsYWdzVGFibGUubWV0cmljVGhyb3R0bGVkUmVxdWVzdHMoKSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgIH0pO1xuXG4gICAgZHluYW1vVGhyb3R0bGVBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRUb3BpYylcbiAgICApO1xuXG4gICAgLy8gTGFtYmRhIOOCqOODqeODvOOCouODqeODvOODoFxuICAgIGlmIChwcm9wcy5ldmFsdWF0aW9uTGFtYmRhKSB7XG4gICAgICBjb25zdCBsYW1iZGFFcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0xhbWJkYUVycm9yQWxhcm0nLCB7XG4gICAgICAgIGFsYXJtTmFtZTogYGZlYXR1cmUtZmxhZy1sYW1iZGEtZXJyb3JzLSR7dGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIGVycm9ycyBkZXRlY3RlZCcsXG4gICAgICAgIG1ldHJpYzogcHJvcHMuZXZhbHVhdGlvbkxhbWJkYS5tZXRyaWNFcnJvcnMoKSxcbiAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgfSk7XG5cbiAgICAgIGxhbWJkYUVycm9yQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24oYWxlcnRUb3BpYylcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g44Kr44K544K/44Og44Oh44OI44Oq44Kv44K555So44Ot44Kw44OV44Kj44Or44K/44O8XG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnRmVhdHVyZUZsYWdMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvbGFtYmRhL2ZlYXR1cmUtZmxhZy0ke3RoaXMuc3RhY2tOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIOOCq+OCueOCv+ODoOODoeODiOODquOCr+OCuTogS2lsbC1Td2l0Y2jnmbrli5VcbiAgICBjb25zdCBraWxsU3dpdGNoTWV0cmljID0gbmV3IGxvZ3MuTWV0cmljRmlsdGVyKHRoaXMsICdLaWxsU3dpdGNoTWV0cmljJywge1xuICAgICAgbG9nR3JvdXAsXG4gICAgICBmaWx0ZXJQYXR0ZXJuOiBsb2dzLkZpbHRlclBhdHRlcm4ubGl0ZXJhbCgnW3RpbWVzdGFtcCwgcmVxdWVzdElkLCBsZXZlbD1cIkVSUk9SXCIsIG1lc3NhZ2U9XCJLaWxsLXN3aXRjaCBhY3RpdmF0ZWRcIl0nKSxcbiAgICAgIG1ldHJpY05hbWVzcGFjZTogJ0ZlYXR1cmVGbGFnJyxcbiAgICAgIG1ldHJpY05hbWU6ICdLaWxsU3dpdGNoQWN0aXZhdGVkJyxcbiAgICAgIG1ldHJpY1ZhbHVlOiAnMScsXG4gICAgICBkZWZhdWx0VmFsdWU6IDAsXG4gICAgfSk7XG5cbiAgICAvLyBLaWxsLVN3aXRjaOeZuuWLleOCouODqeODvOODoFxuICAgIGNvbnN0IGtpbGxTd2l0Y2hBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdLaWxsU3dpdGNoQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGBmZWF0dXJlLWZsYWcta2lsbC1zd2l0Y2gtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnS2lsbC1zd2l0Y2ggaGFzIGJlZW4gYWN0aXZhdGVkJyxcbiAgICAgIG1ldHJpYzogbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnRmVhdHVyZUZsYWcnLFxuICAgICAgICBtZXRyaWNOYW1lOiAnS2lsbFN3aXRjaEFjdGl2YXRlZCcsXG4gICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSksXG4gICAgICB9KSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgIH0pO1xuXG4gICAga2lsbFN3aXRjaEFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbihhbGVydFRvcGljKVxuICAgICk7XG5cbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHtkYXNoYm9hcmQuZGFzaGJvYXJkTmFtZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZFdhdGNoIERhc2hib2FyZCBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsZXJ0VG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogYWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIEFsZXJ0IFRvcGljIEFSTicsXG4gICAgfSk7XG4gIH1cbn0iXX0=