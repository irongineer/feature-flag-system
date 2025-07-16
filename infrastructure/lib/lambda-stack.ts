import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface LambdaStackProps extends cdk.StackProps {
  featureFlagsTable: dynamodb.Table;
}

export class LambdaStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Lambda実行ロール
    const lambdaRole = new iam.Role(this, 'FeatureFlagLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // DynamoDBアクセス権限
    props.featureFlagsTable.grantReadWriteData(lambdaRole);

    // 共通のLambda設定
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role: lambdaRole,
      environment: {
        FEATURE_FLAGS_TABLE_NAME: props.featureFlagsTable.tableName,
        NODE_ENV: this.stackName.toLowerCase(),
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
    };

    // API Gateway
    this.api = new apigateway.RestApi(this, 'FeatureFlagApi', {
      restApiName: `feature-flag-api-${this.stackName.toLowerCase()}`,
      description: 'Feature Flag Management API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: {
        stageName: this.stackName.toLowerCase(),
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // フラグ評価Lambda
    const evaluationLambda = new lambda.Function(this, 'EvaluationFunction', {
      ...commonLambdaProps,
      functionName: `feature-flag-evaluation-${this.stackName.toLowerCase()}`,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Evaluation request:', JSON.stringify(event, null, 2));
          
          // 実装はpackages/api/src/handlers/evaluation.tsに移行予定
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              enabled: false,
              reason: 'Mock implementation',
              timestamp: new Date().toISOString(),
            }),
          };
        };
      `),
    });

    // 管理機能Lambda
    const managementLambda = new lambda.Function(this, 'ManagementFunction', {
      ...commonLambdaProps,
      functionName: `feature-flag-management-${this.stackName.toLowerCase()}`,
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Management request:', JSON.stringify(event, null, 2));
          
          const method = event.httpMethod;
          const path = event.path;
          
          // 実装はpackages/api/src/handlers/management.tsに移行予定
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              message: 'Management API endpoint',
              method,
              path,
              timestamp: new Date().toISOString(),
            }),
          };
        };
      `),
    });

    // API Gateway統合

    // /evaluate エンドポイント
    const evaluateResource = this.api.root.addResource('evaluate');
    evaluateResource.addMethod('POST', new apigateway.LambdaIntegration(evaluationLambda));

    // /flags エンドポイント（管理用）
    const flagsResource = this.api.root.addResource('flags');
    flagsResource.addMethod('GET', new apigateway.LambdaIntegration(managementLambda));
    flagsResource.addMethod('POST', new apigateway.LambdaIntegration(managementLambda));
    
    const flagResource = flagsResource.addResource('{flagKey}');
    flagResource.addMethod('GET', new apigateway.LambdaIntegration(managementLambda));
    flagResource.addMethod('PUT', new apigateway.LambdaIntegration(managementLambda));
    flagResource.addMethod('DELETE', new apigateway.LambdaIntegration(managementLambda));

    // /tenants エンドポイント
    const tenantsResource = this.api.root.addResource('tenants');
    const tenantResource = tenantsResource.addResource('{tenantId}');
    const tenantFlagsResource = tenantResource.addResource('flags');
    const tenantFlagResource = tenantFlagsResource.addResource('{flagKey}');
    
    tenantFlagResource.addMethod('GET', new apigateway.LambdaIntegration(managementLambda));
    tenantFlagResource.addMethod('PUT', new apigateway.LambdaIntegration(managementLambda));
    tenantFlagResource.addMethod('DELETE', new apigateway.LambdaIntegration(managementLambda));

    // /emergency エンドポイント（Kill-Switch）
    const emergencyResource = this.api.root.addResource('emergency');
    emergencyResource.addMethod('POST', new apigateway.LambdaIntegration(managementLambda));
    emergencyResource.addMethod('DELETE', new apigateway.LambdaIntegration(managementLambda));

    // 出力
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'EvaluationLambdaArn', {
      value: evaluationLambda.functionArn,
      description: 'Evaluation Lambda ARN',
    });

    new cdk.CfnOutput(this, 'ManagementLambdaArn', {
      value: managementLambda.functionArn,
      description: 'Management Lambda ARN',
    });
  }
}