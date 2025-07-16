import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface DatabaseStackProps extends cdk.StackProps {
    stackName: string;
}
export declare class DatabaseStack extends cdk.Stack {
    readonly featureFlagsTable: dynamodb.Table;
    private readonly envName;
    constructor(scope: Construct, id: string, props: DatabaseStackProps);
}
