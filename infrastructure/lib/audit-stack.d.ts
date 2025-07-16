import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
export interface AuditStackProps extends cdk.StackProps {
    featureFlagsTable: dynamodb.Table;
    environment: string;
}
export declare class AuditStack extends cdk.Stack {
    readonly auditLogGroup: logs.LogGroup;
    readonly streamProcessorFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: AuditStackProps);
}
