import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface LambdaStackProps extends cdk.StackProps {
    stackName: string;
    featureFlagsTable: dynamodb.Table;
}
export declare class LambdaStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    private readonly envName;
    constructor(scope: Construct, id: string, props: LambdaStackProps);
}
