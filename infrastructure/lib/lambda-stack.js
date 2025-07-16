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
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class LambdaStack extends cdk.Stack {
    api;
    constructor(scope, id, props) {
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
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsdUVBQXlEO0FBRXpELHlEQUEyQztBQUMzQywyREFBNkM7QUFPN0MsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEIsR0FBRyxDQUFxQjtJQUV4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGNBQWM7UUFDZCxNQUFNLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQzdELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUMzRCxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtTQUNGLENBQUMsQ0FBQztRQUVILGlCQUFpQjtRQUNqQixLQUFLLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFdkQsY0FBYztRQUNkLE1BQU0saUJBQWlCLEdBQUc7WUFDeEIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsZUFBZTtZQUN4QixJQUFJLEVBQUUsVUFBVTtZQUNoQixXQUFXLEVBQUU7Z0JBQ1gsd0JBQXdCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFNBQVM7Z0JBQzNELFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRTthQUN2QztZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFD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QUNMLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtTQUMvQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXO1lBQ25DLFdBQVcsRUFBRSx1QkFBdUI7U0FDckMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsV0FBVztZQUNuQyxXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXZKRCxrQ0F1SkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBmZWF0dXJlRmxhZ3NUYWJsZTogZHluYW1vZGIuVGFibGU7XG59XG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTGFtYmRhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gTGFtYmRh5a6f6KGM44Ot44O844OrXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRmVhdHVyZUZsYWdMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vRELjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBwcm9wcy5mZWF0dXJlRmxhZ3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyDlhbHpgJrjga5MYW1iZGHoqK3lrppcbiAgICBjb25zdCBjb21tb25MYW1iZGFQcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEZFQVRVUkVfRkxBR1NfVEFCTEVfTkFNRTogcHJvcHMuZmVhdHVyZUZsYWdzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBOT0RFX0VOVjogdGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9O1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0ZlYXR1cmVGbGFnQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGBmZWF0dXJlLWZsYWctYXBpLSR7dGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdGZWF0dXJlIEZsYWcgTWFuYWdlbWVudCBBUEknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IHRoaXMuc3RhY2tOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIHRocm90dGxpbmdSYXRlTGltaXQ6IDEwMDAsXG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiAyMDAwLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g44OV44Op44Kw6KmV5L6hTGFtYmRhXG4gICAgY29uc3QgZXZhbHVhdGlvbkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V2YWx1YXRpb25GdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZmVhdHVyZS1mbGFnLWV2YWx1YXRpb24tJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0V2YWx1YXRpb24gcmVxdWVzdDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIOWun+ijheOBr3BhY2thZ2VzL2FwaS9zcmMvaGFuZGxlcnMvZXZhbHVhdGlvbi50c+OBq+enu+ihjOS6iOWumlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgcmVhc29uOiAnTW9jayBpbXBsZW1lbnRhdGlvbicsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgIH0pO1xuXG4gICAgLy8g566h55CG5qmf6IO9TGFtYmRhXG4gICAgY29uc3QgbWFuYWdlbWVudExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01hbmFnZW1lbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZmVhdHVyZS1mbGFnLW1hbmFnZW1lbnQtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ01hbmFnZW1lbnQgcmVxdWVzdDonLCBKU09OLnN0cmluZ2lmeShldmVudCwgbnVsbCwgMikpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IG1ldGhvZCA9IGV2ZW50Lmh0dHBNZXRob2Q7XG4gICAgICAgICAgY29uc3QgcGF0aCA9IGV2ZW50LnBhdGg7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8g5a6f6KOF44GvcGFja2FnZXMvYXBpL3NyYy9oYW5kbGVycy9tYW5hZ2VtZW50LnRz44Gr56e76KGM5LqI5a6aXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIG1lc3NhZ2U6ICdNYW5hZ2VtZW50IEFQSSBlbmRwb2ludCcsXG4gICAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheee1seWQiFxuXG4gICAgLy8gL2V2YWx1YXRlIOOCqOODs+ODieODneOCpOODs+ODiFxuICAgIGNvbnN0IGV2YWx1YXRlUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdldmFsdWF0ZScpO1xuICAgIGV2YWx1YXRlUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZXZhbHVhdGlvbkxhbWJkYSkpO1xuXG4gICAgLy8gL2ZsYWdzIOOCqOODs+ODieODneOCpOODs+ODiO+8iOeuoeeQhueUqO+8iVxuICAgIGNvbnN0IGZsYWdzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdmbGFncycpO1xuICAgIGZsYWdzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG4gICAgZmxhZ3NSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG4gICAgXG4gICAgY29uc3QgZmxhZ1Jlc291cmNlID0gZmxhZ3NSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2ZsYWdLZXl9Jyk7XG4gICAgZmxhZ1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuICAgIGZsYWdSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG1hbmFnZW1lbnRMYW1iZGEpKTtcbiAgICBmbGFnUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG5cbiAgICAvLyAvdGVuYW50cyDjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICBjb25zdCB0ZW5hbnRzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCd0ZW5hbnRzJyk7XG4gICAgY29uc3QgdGVuYW50UmVzb3VyY2UgPSB0ZW5hbnRzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t0ZW5hbnRJZH0nKTtcbiAgICBjb25zdCB0ZW5hbnRGbGFnc1Jlc291cmNlID0gdGVuYW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ZsYWdzJyk7XG4gICAgY29uc3QgdGVuYW50RmxhZ1Jlc291cmNlID0gdGVuYW50RmxhZ3NSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2ZsYWdLZXl9Jyk7XG4gICAgXG4gICAgdGVuYW50RmxhZ1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuICAgIHRlbmFudEZsYWdSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG1hbmFnZW1lbnRMYW1iZGEpKTtcbiAgICB0ZW5hbnRGbGFnUmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG5cbiAgICAvLyAvZW1lcmdlbmN5IOOCqOODs+ODieODneOCpOODs+ODiO+8iEtpbGwtU3dpdGNo77yJXG4gICAgY29uc3QgZW1lcmdlbmN5UmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdlbWVyZ2VuY3knKTtcbiAgICBlbWVyZ2VuY3lSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG4gICAgZW1lcmdlbmN5UmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG5cbiAgICAvLyDlh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRXZhbHVhdGlvbkxhbWJkYUFybicsIHtcbiAgICAgIHZhbHVlOiBldmFsdWF0aW9uTGFtYmRhLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmFsdWF0aW9uIExhbWJkYSBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ01hbmFnZW1lbnRMYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogbWFuYWdlbWVudExhbWJkYS5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFuYWdlbWVudCBMYW1iZGEgQVJOJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==