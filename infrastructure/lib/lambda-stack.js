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
    envName;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.envName = props.stackName;
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
                stageName: this.envName.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
            },
        });
        // フラグ評価Lambda
        const evaluationLambda = new lambda.Function(this, 'EvaluationFunction', {
            ...commonLambdaProps,
            functionName: `feature-flag-evaluation-${this.stackName.toLowerCase()}`,
            code: lambda.Code.fromAsset('../packages/api/evaluation-lambda.zip'),
            handler: 'handlers/evaluation.handler',
        });
        // 管理機能Lambda
        const managementLambda = new lambda.Function(this, 'ManagementFunction', {
            ...commonLambdaProps,
            functionName: `feature-flag-management-${this.stackName.toLowerCase()}`,
            code: lambda.Code.fromAsset('../packages/api/evaluation-lambda.zip'),
            handler: 'handlers/management.handler',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsdUVBQXlEO0FBRXpELHlEQUEyQztBQUMzQywyREFBNkM7QUFRN0MsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEIsR0FBRyxDQUFxQjtJQUN2QixPQUFPLENBQVM7SUFFakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFFL0IsY0FBYztRQUNkLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDN0QsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDO1lBQzNELGVBQWUsRUFBRTtnQkFDZixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBDQUEwQyxDQUFDO2FBQ3ZGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsaUJBQWlCO1FBQ2pCLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV2RCxjQUFjO1FBQ2QsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxVQUFVO1lBQ2hCLFdBQVcsRUFBRTtnQkFDWCx3QkFBd0IsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUztnQkFDM0QsUUFBUSxFQUFFLElBQUksQ0FB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QyxDQUFDLENBQUM7UUFFMUYsS0FBSztRQUNMLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtTQUMvQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQyxXQUFXO1lBQ25DLFdBQVcsRUFBRSx1QkFBdUI7U0FDckMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsV0FBVztZQUNuQyxXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpIRCxrQ0FpSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFja05hbWU6IHN0cmluZztcbiAgZmVhdHVyZUZsYWdzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHByaXZhdGUgcmVhZG9ubHkgZW52TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBMYW1iZGFTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gICAgdGhpcy5lbnZOYW1lID0gcHJvcHMuc3RhY2tOYW1lO1xuXG4gICAgLy8gTGFtYmRh5a6f6KGM44Ot44O844OrXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRmVhdHVyZUZsYWdMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRHluYW1vRELjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBwcm9wcy5mZWF0dXJlRmxhZ3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG5cbiAgICAvLyDlhbHpgJrjga5MYW1iZGHoqK3lrppcbiAgICBjb25zdCBjb21tb25MYW1iZGFQcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMl9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEZFQVRVUkVfRkxBR1NfVEFCTEVfTkFNRTogcHJvcHMuZmVhdHVyZUZsYWdzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBOT0RFX0VOVjogdGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9O1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0ZlYXR1cmVGbGFnQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGBmZWF0dXJlLWZsYWctYXBpLSR7dGhpcy5zdGFja05hbWUudG9Mb3dlckNhc2UoKX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdGZWF0dXJlIEZsYWcgTWFuYWdlbWVudCBBUEknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdBdXRob3JpemF0aW9uJ10sXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IHRoaXMuZW52TmFtZS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g44OV44Op44Kw6KmV5L6hTGFtYmRhXG4gICAgY29uc3QgZXZhbHVhdGlvbkxhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0V2YWx1YXRpb25GdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZmVhdHVyZS1mbGFnLWV2YWx1YXRpb24tJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3BhY2thZ2VzL2FwaS9ldmFsdWF0aW9uLWxhbWJkYS56aXAnKSxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVycy9ldmFsdWF0aW9uLmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgLy8g566h55CG5qmf6IO9TGFtYmRhXG4gICAgY29uc3QgbWFuYWdlbWVudExhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01hbmFnZW1lbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZmVhdHVyZS1mbGFnLW1hbmFnZW1lbnQtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL3BhY2thZ2VzL2FwaS9ldmFsdWF0aW9uLWxhbWJkYS56aXAnKSxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVycy9tYW5hZ2VtZW50LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXnntbHlkIhcblxuICAgIC8vIC9ldmFsdWF0ZSDjgqjjg7Pjg4njg53jgqTjg7Pjg4hcbiAgICBjb25zdCBldmFsdWF0ZVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnZXZhbHVhdGUnKTtcbiAgICBldmFsdWF0ZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGV2YWx1YXRpb25MYW1iZGEpKTtcblxuICAgIC8vIC9mbGFncyDjgqjjg7Pjg4njg53jgqTjg7Pjg4jvvIjnrqHnkIbnlKjvvIlcbiAgICBjb25zdCBmbGFnc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnZmxhZ3MnKTtcbiAgICBmbGFnc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuICAgIGZsYWdzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuICAgIFxuICAgIGNvbnN0IGZsYWdSZXNvdXJjZSA9IGZsYWdzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tmbGFnS2V5fScpO1xuICAgIGZsYWdSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG1hbmFnZW1lbnRMYW1iZGEpKTtcbiAgICBmbGFnUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG4gICAgZmxhZ1Jlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuXG4gICAgLy8gL3RlbmFudHMg44Ko44Oz44OJ44Od44Kk44Oz44OIXG4gICAgY29uc3QgdGVuYW50c1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgndGVuYW50cycpO1xuICAgIGNvbnN0IHRlbmFudFJlc291cmNlID0gdGVuYW50c1Jlc291cmNlLmFkZFJlc291cmNlKCd7dGVuYW50SWR9Jyk7XG4gICAgY29uc3QgdGVuYW50RmxhZ3NSZXNvdXJjZSA9IHRlbmFudFJlc291cmNlLmFkZFJlc291cmNlKCdmbGFncycpO1xuICAgIGNvbnN0IHRlbmFudEZsYWdSZXNvdXJjZSA9IHRlbmFudEZsYWdzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tmbGFnS2V5fScpO1xuICAgIFxuICAgIHRlbmFudEZsYWdSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKG1hbmFnZW1lbnRMYW1iZGEpKTtcbiAgICB0ZW5hbnRGbGFnUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihtYW5hZ2VtZW50TGFtYmRhKSk7XG4gICAgdGVuYW50RmxhZ1Jlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuXG4gICAgLy8gL2VtZXJnZW5jeSDjgqjjg7Pjg4njg53jgqTjg7Pjg4jvvIhLaWxsLVN3aXRjaO+8iVxuICAgIGNvbnN0IGVtZXJnZW5jeVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnZW1lcmdlbmN5Jyk7XG4gICAgZW1lcmdlbmN5UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuICAgIGVtZXJnZW5jeVJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24obWFuYWdlbWVudExhbWJkYSkpO1xuXG4gICAgLy8g5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2YWx1YXRpb25MYW1iZGFBcm4nLCB7XG4gICAgICB2YWx1ZTogZXZhbHVhdGlvbkxhbWJkYS5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRXZhbHVhdGlvbiBMYW1iZGEgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdNYW5hZ2VtZW50TGFtYmRhQXJuJywge1xuICAgICAgdmFsdWU6IG1hbmFnZW1lbnRMYW1iZGEuZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ01hbmFnZW1lbnQgTGFtYmRhIEFSTicsXG4gICAgfSk7XG4gIH1cbn0iXX0=