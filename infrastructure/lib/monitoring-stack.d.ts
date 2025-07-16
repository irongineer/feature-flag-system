import * as cdk from 'aws-cdk-lib';
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
export declare class MonitoringStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
