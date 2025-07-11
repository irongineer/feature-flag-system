#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// 環境設定
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

const prodEnv = {
  account: process.env.CDK_PROD_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_PROD_REGION || 'ap-northeast-1',
};

// 開発環境
const devDatabaseStack = new DatabaseStack(app, 'FeatureFlagDevDatabaseStack', {
  env: devEnv,
  stackName: 'Dev',
  tags: {
    Environment: 'Development',
    Service: 'FeatureFlag',
  },
});

const devLambdaStack = new LambdaStack(app, 'FeatureFlagDevLambdaStack', {
  env: devEnv,
  stackName: 'Dev',
  featureFlagsTable: devDatabaseStack.featureFlagsTable,
  tags: {
    Environment: 'Development',
    Service: 'FeatureFlag',
  },
});

const devMonitoringStack = new MonitoringStack(app, 'FeatureFlagDevMonitoringStack', {
  env: devEnv,
  stackName: 'Dev',
  featureFlagsTable: devDatabaseStack.featureFlagsTable,
  api: devLambdaStack.api,
  tags: {
    Environment: 'Development',
    Service: 'FeatureFlag',
  },
});

// 本番環境
const prodDatabaseStack = new DatabaseStack(app, 'FeatureFlagProdDatabaseStack', {
  env: prodEnv,
  stackName: 'Prod',
  tags: {
    Environment: 'Production',
    Service: 'FeatureFlag',
  },
});

const prodLambdaStack = new LambdaStack(app, 'FeatureFlagProdLambdaStack', {
  env: prodEnv,
  stackName: 'Prod',
  featureFlagsTable: prodDatabaseStack.featureFlagsTable,
  tags: {
    Environment: 'Production',
    Service: 'FeatureFlag',
  },
});

const prodMonitoringStack = new MonitoringStack(app, 'FeatureFlagProdMonitoringStack', {
  env: prodEnv,
  stackName: 'Prod',
  featureFlagsTable: prodDatabaseStack.featureFlagsTable,
  api: prodLambdaStack.api,
  tags: {
    Environment: 'Production',
    Service: 'FeatureFlag',
  },
});

// 依存関係の設定
devLambdaStack.addDependency(devDatabaseStack);
devMonitoringStack.addDependency(devLambdaStack);

prodLambdaStack.addDependency(prodDatabaseStack);
prodMonitoringStack.addDependency(prodLambdaStack);