# 🏗️ フィーチャーフラグシステム運用者向けドキュメント

> **注意**: このドキュメントは段階的に作成中です。多くのリンク先ファイルが **(準備中)** 状態です。

## 📋 概要

このセクションでは、フィーチャーフラグシステム自体の運用・保守を行う運用者向けの情報を提供します。

## 🎯 システム運用者の責務

### インフラ運用
- ✅ サーバー・コンテナ管理
- ✅ データベース運用・最適化
- ✅ ネットワーク・セキュリティ管理
- ✅ 監視・アラート設定

### システム保守
- ✅ バックアップ・復旧
- ✅ パフォーマンス監視・調整
- ✅ セキュリティ監査・対応
- ✅ システム更新・パッチ適用

### 可用性管理
- ✅ 障害対応・復旧
- ✅ 負荷分散・スケーリング
- ✅ 災害対策・事業継続
- ✅ SLA監視・改善

## 🚀 クイックスタート

### 💡 最初にやること
1. [システム概要の理解](#システム概要)
2. [インフラ構成の確認](#インフラ構成)
3. [監視ダッシュボードの設定](#監視)
4. [緊急時対応手順の確認](#緊急時対応)

### 🏗️ インフラ構成
```yaml
# 本番環境構成例
production:
  api_servers:
    - type: "AWS EC2"
      instances: 3
      size: "t3.large"
      auto_scaling: true
    
  database:
    - type: "AWS RDS PostgreSQL"
      instances: 1
      backup: "automated"
      multi_az: true
    
  cache:
    - type: "AWS ElastiCache Redis"
      instances: 2
      cluster_mode: true
    
  load_balancer:
    - type: "AWS ALB"
      health_check: true
      ssl_termination: true
```

## 📚 運用ガイド

### 📖 基本運用（推定時間: 3-4時間）
1. [システム概要](./system-overview.md)
2. [インフラ構成](./infrastructure-setup.md)
3. [日常運用手順](./daily-operations.md)
4. [監視・メトリクス](./monitoring.md)

### 🔧 システム管理（推定時間: 4-5時間）
1. [データベース管理](./database-operations.md)
2. [キャッシュ管理](./cache-operations.md)
3. [ログ管理](./log-management.md)
4. [バックアップ・復旧](./backup-recovery.md)

### 🔐 セキュリティ（推定時間: 3-4時間）
1. [セキュリティ管理](./security-management.md)
2. [アクセス制御](./access-control.md)
3. [監査ログ](./audit-logging.md)
4. [脆弱性対応](./vulnerability-management.md)

### 📊 パフォーマンス（推定時間: 4-5時間）
1. [パフォーマンス監視](./performance-monitoring.md)
2. [チューニング](./performance-tuning.md)
3. [スケーリング](./scaling.md)
4. [キャパシティプランニング](./capacity-planning.md)

## 🏗️ インフラ管理

### 📊 システム構成
```yaml
# システム構成図
┌─────────────────────────────────────────────┐
│                Load Balancer                │
│           (AWS ALB/NGINX)                   │
└─────────────────┬───────────────────────────┘
                  │
          ┌───────┴───────┐
          │               │
    ┌─────▼─────┐   ┌─────▼─────┐
    │API Server 1│   │API Server 2│
    │  (Express) │   │  (Express) │
    └─────┬─────┘   └─────┬─────┘
          │               │
          └───────┬───────┘
                  │
    ┌─────────────▼─────────────┐
    │       Database           │
    │   (PostgreSQL/MySQL)     │
    └─────────────┬─────────────┘
                  │
    ┌─────────────▼─────────────┐
    │         Cache            │
    │       (Redis)            │
    └──────────────────────────┘
```

### 🔧 デプロイメント
#### Docker Compose構成
```yaml
version: '3.8'
services:
  api:
    image: feature-flag-api:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - database
      - cache

  database:
    image: postgres:14
    environment:
      - POSTGRES_DB=feature_flags
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Kubernetes構成
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: feature-flag-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: feature-flag-api
  template:
    metadata:
      labels:
        app: feature-flag-api
    spec:
      containers:
      - name: api
        image: feature-flag-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 📊 監視・メトリクス

### 🔍 監視ダッシュボード
#### 主要メトリクス
```typescript
// 監視すべき指標
system_metrics: {
  // システム全体
  api_availability: 99.9,
  database_availability: 99.9,
  cache_availability: 99.9,
  
  // パフォーマンス
  api_response_time_p95: 200, // ms
  database_query_time_p95: 50, // ms
  cache_hit_rate: 95, // %
  
  // リソース使用量
  cpu_usage: 45, // %
  memory_usage: 60, // %
  disk_usage: 30, // %
  
  // ネットワーク
  network_in: 100, // MB/s
  network_out: 50, // MB/s
  
  // エラー率
  error_rate: 0.05, // %
  timeout_rate: 0.01 // %
}
```

#### アラート設定
```yaml
# アラート設定例
alerts:
  - name: "API High Error Rate"
    condition: "error_rate > 1%"
    duration: "5m"
    severity: "critical"
    notification: ["email", "slack", "pager"]
  
  - name: "Database Connection Pool Full"
    condition: "db_connection_pool_usage > 90%"
    duration: "2m"
    severity: "warning"
    notification: ["email", "slack"]
  
  - name: "Cache Memory Usage High"
    condition: "redis_memory_usage > 80%"
    duration: "5m"
    severity: "warning"
    notification: ["email"]
  
  - name: "API Response Time High"
    condition: "api_response_time_p95 > 500ms"
    duration: "5m"
    severity: "warning"
    notification: ["slack"]
```

### 📈 レポート機能
#### 日次レポート
```typescript
daily_report: {
  date: '2025-07-18',
  system_health: {
    uptime: 99.98,
    total_requests: 25000000,
    successful_requests: 24987500,
    failed_requests: 12500,
    avg_response_time: 125 // ms
  },
  resource_usage: {
    peak_cpu: 78,
    peak_memory: 85,
    peak_disk: 45,
    avg_cpu: 52,
    avg_memory: 68,
    avg_disk: 35
  },
  database_metrics: {
    total_queries: 50000000,
    slow_queries: 250,
    deadlocks: 2,
    avg_query_time: 35 // ms
  },
  cache_metrics: {
    hit_rate: 94.5,
    miss_rate: 5.5,
    evictions: 1250,
    memory_usage: 75
  }
}
```

## 🔧 データベース管理

### 📊 データベース運用
#### 日常メンテナンス
```sql
-- 日次メンテナンス
-- 1. 統計情報更新
ANALYZE;

-- 2. インデックス再構築（必要に応じて）
REINDEX DATABASE feature_flags;

-- 3. 古いデータの削除
DELETE FROM evaluation_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 4. バキューム（PostgreSQL）
VACUUM ANALYZE;
```

#### パフォーマンス最適化
```sql
-- スロークエリの確認
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;

-- インデックス使用状況
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- テーブルサイズ確認
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 🔄 バックアップ・復旧
#### 自動バックアップ
```bash
#!/bin/bash
# 自動バックアップスクリプト

# 設定
DATABASE_URL="postgresql://user:password@localhost/feature_flags"
BACKUP_DIR="/backups/feature_flags"
RETENTION_DAYS=30

# バックアップ実行
BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DATABASE_URL > $BACKUP_FILE

# 圧縮
gzip $BACKUP_FILE

# 古いバックアップを削除
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# バックアップ検証
if [ -f "${BACKUP_FILE}.gz" ]; then
    echo "Backup completed: ${BACKUP_FILE}.gz"
else
    echo "Backup failed" >&2
    exit 1
fi
```

#### 復旧手順
```bash
# 復旧手順
# 1. データベースの停止
sudo systemctl stop feature-flag-api

# 2. 現在のデータベースをバックアップ
pg_dump feature_flags > /tmp/current_backup.sql

# 3. データベースの再作成
dropdb feature_flags
createdb feature_flags

# 4. バックアップから復旧
gunzip -c /backups/feature_flags/backup_20250718_120000.sql.gz | psql feature_flags

# 5. サービスの再開
sudo systemctl start feature-flag-api

# 6. 動作確認
curl -f http://localhost:3000/health
```

## 🔐 セキュリティ管理

### 🛡️ セキュリティ設定
#### ファイアウォール設定
```bash
# UFW設定例
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要なポートのみ許可
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow from 10.0.0.0/8 to any port 5432  # PostgreSQL (内部ネットワークのみ)
sudo ufw allow from 10.0.0.0/8 to any port 6379  # Redis (内部ネットワークのみ)

sudo ufw enable
```

#### SSL/TLS設定
```nginx
# NGINX SSL設定
server {
    listen 443 ssl http2;
    server_name your-feature-flag-api.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 🔍 監査ログ
#### ログ収集
```typescript
// 監査ログの例
audit_log: {
  timestamp: '2025-07-18T10:30:00Z',
  event_type: 'flag_updated',
  user_id: 'admin-123',
  user_role: 'admin',
  resource: 'feature_flags',
  resource_id: 'new-dashboard',
  action: 'update',
  details: {
    old_value: { enabled: false },
    new_value: { enabled: true },
    environment: 'production'
  },
  ip_address: '192.168.1.100',
  user_agent: 'Chrome/120.0.0.0',
  request_id: 'req-abc123'
}
```

## 🚨 緊急時対応

### 🔥 障害対応手順
#### 自動復旧
```bash
#!/bin/bash
# 自動復旧スクリプト

# ヘルスチェック
check_health() {
    curl -f http://localhost:3000/health > /dev/null 2>&1
    return $?
}

# サービス再起動
restart_service() {
    echo "Restarting service..."
    sudo systemctl restart feature-flag-api
    sleep 10
}

# 復旧処理
if ! check_health; then
    echo "Service is down. Attempting recovery..."
    restart_service
    
    if check_health; then
        echo "Service recovered successfully"
    else
        echo "Recovery failed. Manual intervention required"
        # アラート送信
        curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
            -H 'Content-type: application/json' \
            --data '{"text":"Feature Flag Service is down and auto-recovery failed"}'
    fi
fi
```

### 📋 インシデント対応チェックリスト
- [ ] 障害の検知・確認
- [ ] 影響範囲の調査
- [ ] 関係者への通知
- [ ] 緊急対応の実施
- [ ] 復旧作業の実施
- [ ] 動作確認
- [ ] 事後検証の実施
- [ ] 再発防止策の検討

## 📈 パフォーマンス最適化

### 🚀 スケーリング戦略
#### 水平スケーリング
```yaml
# Kubernetes HPA設定
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: feature-flag-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: feature-flag-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 垂直スケーリング
```yaml
# リソース制限の調整
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### 📊 キャパシティプランニング
```typescript
// キャパシティ計算例
capacity_planning: {
  current_metrics: {
    requests_per_second: 1000,
    cpu_usage: 45,
    memory_usage: 60,
    response_time_p95: 150
  },
  projected_growth: {
    requests_growth: 2.0, // 2倍
    expected_requests_per_second: 2000,
    required_cpu_capacity: 90,
    required_memory_capacity: 120
  },
  recommendations: {
    scale_out: true,
    additional_instances: 2,
    upgrade_instance_type: false
  }
}
```

## 🔧 ツール・リソース

### 管理ツール
- [Kubernetes Dashboard](https://your-k8s-dashboard.com)
- [Grafana](https://your-grafana.com)
- [Prometheus](https://your-prometheus.com)
- [ELK Stack](https://your-elk.com)

### 監視ツール
- [Datadog](https://your-datadog.com)
- [New Relic](https://your-newrelic.com)
- [AWS CloudWatch](https://your-cloudwatch.com)

### 連絡先
- システム開発チーム: system-dev@your-company.com
- セキュリティチーム: security@your-company.com
- 24時間緊急対応: +81-xx-xxxx-xxxx

## 📚 学習リソース

### 🎓 トレーニング
- [システム運用トレーニング](./training/system-operations.md)
- [Kubernetes運用トレーニング](./training/kubernetes-operations.md)
- [セキュリティ運用トレーニング](./training/security-operations.md)

### 📖 参考資料
- [運用ベストプラクティス](./best-practices.md)
- [災害対策ガイド](./disaster-recovery.md)
- [セキュリティチェックリスト](./security-checklist.md)

---

## 🎯 運用の成功指標

### 📊 SLA目標
- **可用性**: 99.9% 以上
- **応答時間**: 95パーセンタイル 200ms 以下
- **エラー率**: 0.1% 以下
- **復旧時間**: 15分以内

### 📈 継続的改善
- 週次の運用レビュー
- 月次のパフォーマンス分析
- 四半期の災害対策訓練
- 年次のシステム全体見直し

**次のステップ**: [インフラ構築](./infrastructure-setup.md)から始めましょう！