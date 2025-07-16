import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  featureFlagsTable: dynamodb.Table;
  api: apigateway.RestApi;
  evaluationLambda?: lambda.Function;
  managementLambda?: lambda.Function;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
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

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [
          props.api.metricCount({ label: 'Request Count' }),
          props.api.metricLatency({ label: 'Latency' }),
        ],
        right: [apiErrorRate],
        period: cdk.Duration.minutes(5),
        width: 12,
      })
    );

    // DynamoDB メトリクス
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
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
      })
    );

    // Lambda メトリクス（存在する場合）
    if (props.evaluationLambda) {
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
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
        })
      );
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

    apiErrorAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(alertTopic)
    );

    // DynamoDB スロットリングアラーム
    const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
      alarmName: `feature-flag-dynamo-throttle-${this.stackName.toLowerCase()}`,
      alarmDescription: 'DynamoDB is being throttled',
      metric: props.featureFlagsTable.metricThrottledRequests(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    dynamoThrottleAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(alertTopic)
    );

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

      lambdaErrorAlarm.addAlarmAction(
        new cloudwatchActions.SnsAction(alertTopic)
      );
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

    killSwitchAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(alertTopic)
    );

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