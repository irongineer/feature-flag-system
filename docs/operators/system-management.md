# 🏗️ システム管理・運用ガイド

## 概要

フィーチャーフラグシステムのインフラ運用・保守を行うシステム管理者向けの総合ガイドです。

## 🎯 システム管理者の責務

### インフラ運用
- ✅ APIサーバー・コンテナ管理
- ✅ DynamoDB運用・最適化  
- ✅ ネットワーク・セキュリティ管理
- ✅ 監視・アラート設定

### システム保守
- ✅ バックアップ・復旧
- ✅ パフォーマンス監視・調整
- ✅ セキュリティ監査・対応
- ✅ システム更新・パッチ適用

## 🏗️ インフラ構成

### 環境別構成

```yaml
# 本番環境構成
production:
  api_servers:
    - type: "AWS Lambda"
      runtime: "Node.js 18.x"
      memory: "1024MB"
      timeout: "30s"
      
  database:
    - type: "AWS DynamoDB"
      table: "feature-flags-prod"
      region: "ap-northeast-1"
      backup: "Point-in-time recovery"
      
  cache:
    - type: "API内蔵キャッシュ"
      ttl: "5分"
      
  load_balancer:
    - type: "AWS API Gateway"
      throttling: "10000 req/sec"
      caching: "enabled"

# 開発環境構成      
development:
  api_servers:
    - type: "AWS Lambda"
      runtime: "Node.js 18.x"
      memory: "512MB"
      
  database:
    - type: "AWS DynamoDB"
      table: "feature-flags-dev"
      region: "ap-northeast-1"
      
# ローカル環境構成
local:
  api_servers:
    - type: "Express Server"
      port: "3001"
      memory: "インメモリ"
      
  database:
    - type: "DynamoDB Local (Optional)"
      port: "8000"
```

## 📊 システム監視

### 主要メトリクス

```typescript
// システムヘルス指標
system_health: {
  api_response_time: {
    target: "< 100ms",
    warning: "> 200ms", 
    critical: "> 500ms"
  },
  error_rate: {
    target: "< 0.1%",
    warning: "> 1%",
    critical: "> 5%"
  },
  availability: {
    target: "> 99.9%",
    warning: "< 99.5%",
    critical: "< 99%"
  }
}

// DynamoDB指標
dynamodb_metrics: {
  read_capacity: {
    provisioned: 25,
    consumed: 15,
    utilization: "60%"
  },
  write_capacity: {
    provisioned: 25, 
    consumed: 8,
    utilization: "32%"
  },
  throttling: {
    read_throttles: 0,
    write_throttles: 0
  }
}
```

### アラート設定

```yaml
# CloudWatch アラート設定例
alerts:
  api_high_latency:
    metric: "API Gateway Latency"
    threshold: "> 500ms"
    duration: "2 minutes"
    action: "SNS notification"
    
  dynamodb_throttling:
    metric: "DynamoDB User Errors"
    threshold: "> 0"
    duration: "1 minute"
    action: "Auto-scaling + SNS"
    
  lambda_errors:
    metric: "Lambda Error Rate"
    threshold: "> 1%"
    duration: "3 minutes"
    action: "SNS + Slack notification"
```

## 🔧 環境別運用

### 本番環境運用

```bash
# 本番環境のモニタリング
aws cloudwatch get-metric-statistics \
  --namespace "AWS/DynamoDB" \
  --metric-name "ConsumedReadCapacityUnits" \
  --dimensions Name=TableName,Value=feature-flags-prod \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Lambda関数のログ確認
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/feature-flag"

# API Gateway のメトリクス
aws apigateway get-usage \
  --usage-plan-id "your-usage-plan-id" \
  --start-date "2025-08-16" \
  --end-date "2025-08-16"
```

### 開発環境運用

```bash
# 開発環境のテーブル管理
aws dynamodb describe-table --table-name feature-flags-dev

# 開発環境への新しいフラグのプロビジョニング
aws dynamodb put-item \
  --table-name feature-flags-dev \
  --item '{
    "PK": {"S": "FLAG#staging#new-feature"},
    "SK": {"S": "METADATA"},
    "flagKey": {"S": "new-feature"},
    "description": {"S": "New development feature"},
    "defaultEnabled": {"BOOL": false},
    "owner": {"S": "dev-team"},
    "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

### ローカル環境運用

```bash
# DynamoDB Localの起動
./scripts/start-local-aws.sh

# ローカルテーブルの確認
aws dynamodb list-tables --endpoint-url http://localhost:8000

# ローカルAPIサーバーの起動
cd packages/api
NODE_ENV=local npm run dev
```

## 🔐 セキュリティ管理

### IAM権限設定

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem", 
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-1:*:table/feature-flags-prod",
        "arn:aws:dynamodb:ap-northeast-1:*:table/feature-flags-dev"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream", 
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:*:*"
    }
  ]
}
```

### セキュリティベストプラクティス

```yaml
security_measures:
  api_authentication:
    - JWT tokens with 1-hour expiry
    - API key rotation every 90 days
    - Rate limiting (100 req/min per client)
    
  data_encryption:
    - DynamoDB encryption at rest
    - TLS 1.3 for data in transit
    - Secrets Manager for API keys
    
  access_control:
    - Environment-specific IAM roles
    - Principle of least privilege
    - Multi-factor authentication for admin access
    
  auditing:
    - CloudTrail for all API calls
    - DynamoDB streams for data changes
    - Detailed application logging
```

## 📈 パフォーマンス最適化

### DynamoDB最適化

```typescript
// パーティション設計の最適化
const optimizePartitionKey = (flagKey: string, environment: string): string => {
  // 環境とフラグキーでパーティションを分散
  return `FLAG#${environment}#${flagKey}`;
};

// GSI活用による効率的なクエリ
const listFlagsByOwner = async (owner: string, environment: string) => {
  return await dynamodb.query({
    TableName: 'feature-flags-prod',
    IndexName: 'GSI2-OWNER-INDEX',
    KeyConditionExpression: 'GSI2PK = :gsi2pk',
    ExpressionAttributeValues: {
      ':gsi2pk': `OWNER#${environment}#${owner}`
    }
  }).promise();
};
```

### キャッシュ戦略

```typescript
// 環境別キャッシュ設定
const getCacheConfig = (environment: string) => {
  return {
    local: {
      ttl: 60,          // 1分（開発効率重視）
      maxSize: 100      // 小さいキャッシュ
    },
    dev: {
      ttl: 300,         // 5分（バランス）
      maxSize: 1000     // 中程度のキャッシュ
    },
    prod: {
      ttl: 600,         // 10分（安定性重視）
      maxSize: 10000    // 大きなキャッシュ
    }
  }[environment];
};
```

## 🔄 バックアップ・復旧

### DynamoDBバックアップ

```bash
# オンデマンドバックアップ
aws dynamodb create-backup \
  --table-name feature-flags-prod \
  --backup-name "feature-flags-prod-manual-$(date +%Y%m%d-%H%M%S)"

# ポイントインタイム復旧の有効化
aws dynamodb update-continuous-backups \
  --table-name feature-flags-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# バックアップ一覧の確認
aws dynamodb list-backups --table-name feature-flags-prod
```

### 災害復旧手順

```yaml
disaster_recovery:
  rto: "15 minutes"  # Recovery Time Objective
  rpo: "5 minutes"   # Recovery Point Objective
  
  steps:
    1. "障害確認・影響範囲特定"
    2. "Kill-Switchによる緊急停止"
    3. "バックアップからの復旧"
    4. "データ整合性確認"
    5. "段階的サービス復旧"
    6. "事後検証・改善"
```

## 🚨 トラブルシューティング

### よくある問題と対処法

#### DynamoDB スロットリング

```bash
# 問題の確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=feature-flags-prod

# 対処：キャパシティの増加
aws dynamodb update-table \
  --table-name feature-flags-prod \
  --provisioned-throughput ReadCapacityUnits=50,WriteCapacityUnits=50
```

#### Lambda コールドスタート

```typescript
// 対処：接続プールの最適化
const dynamoClient = new DynamoDBClient({
  region: 'ap-northeast-1',
  maxAttempts: 3,
  retryMode: 'adaptive',
  // 接続再利用
  keepAlive: true,
  keepAliveMsecs: 1000
});
```

#### API Gateway タイムアウト

```yaml
# API Gateway設定の最適化
timeout_configuration:
  integration_timeout: "29 seconds"  # Lambda最大実行時間
  lambda_timeout: "15 seconds"       # 実際のLambda処理時間
  api_gateway_timeout: "30 seconds"  # API Gateway上限
```

## 📋 運用チェックリスト

### 日次チェック
- [ ] システムヘルス監視
- [ ] エラーログ確認
- [ ] パフォーマンスメトリクス確認
- [ ] セキュリティアラート確認

### 週次チェック  
- [ ] キャパシティ使用率確認
- [ ] バックアップ確認
- [ ] アクセスログ分析
- [ ] セキュリティパッチ確認

### 月次チェック
- [ ] コスト分析・最適化
- [ ] セキュリティ監査
- [ ] 災害復旧テスト
- [ ] 容量計画見直し

## 関連リソース

- [環境管理運用手順書](../runbooks/environment-management.md)
- [AWS DynamoDB ベストプラクティス](https://docs.aws.amazon.com/dynamodb/latest/developerguide/best-practices.html)
- [Lambda パフォーマンス最適化](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Gateway 監視](https://docs.aws.amazon.com/apigateway/latest/developerguide/monitoring-cloudwatch.html)