import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly featureFlagsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // メインテーブル: フラグ定義、テナントオーバーライド、Kill-Switch
    this.featureFlagsTable = new dynamodb.Table(this, 'FeatureFlagsTable', {
      tableName: `feature-flags-${this.stackName.toLowerCase()}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      
      // 暗号化設定
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      
      // タグはStackレベルで設定
    });

    // GSI1: 有効期限でのクエリ用
    this.featureFlagsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-EXPIRES-INDEX',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: オーナー別フラグ一覧用 (Query最適化)
    this.featureFlagsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-OWNER-INDEX',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: 全フラグ一覧効率化用 (Scan代替)
    this.featureFlagsTable.addGlobalSecondaryIndex({
      indexName: 'GSI3-FLAGS-INDEX',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['flagKey', 'description', 'defaultEnabled', 'owner', 'createdAt', 'expiresAt'],
    });

    // GSI4: 環境横断フラグ一覧用
    this.featureFlagsTable.addGlobalSecondaryIndex({
      indexName: 'GSI4-GLOBAL-INDEX',
      partitionKey: { name: 'GSI4PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 監査ログテーブル
    const auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: `feature-flags-audit-${this.stackName.toLowerCase()}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // "AUDIT#${timestamp}"
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // "ACTION#${actionId}"
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl', // 90日後に自動削除
      
      // タグはStackレベルで設定
    });

    // GSI: ユーザー別の監査ログ検索用
    auditLogTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 出力
    new cdk.CfnOutput(this, 'FeatureFlagsTableName', {
      value: this.featureFlagsTable.tableName,
      description: 'Feature flags table name',
    });

    new cdk.CfnOutput(this, 'FeatureFlagsTableArn', {
      value: this.featureFlagsTable.tableArn,
      description: 'Feature flags table ARN',
    });

    new cdk.CfnOutput(this, 'AuditLogTableName', {
      value: auditLogTable.tableName,
      description: 'Audit log table name',
    });
  }
}