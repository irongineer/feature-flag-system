# 🌍 マルチ環境開発ガイド（FFシステム開発者向け）

## 概要

フィーチャーフラグシステム自体の開発において、環境対応機能の開発・改良方法を説明します。

## 🏗️ 環境対応アーキテクチャ

### システム構成

```typescript
// packages/core/src/utils/config.ts
export interface ApiEnvironmentConfig {
  name: string;
  api: {
    baseUrl: string;
    evaluateEndpoint: string;
    timeout: number;
  };
  database: {
    type: 'local' | 'dynamodb';
    dynamodb: {
      endpoint?: string;
      region: string;
      tableName: string;
    };
  };
  useInMemoryFlags: boolean;
  cors: {
    origins: string[];
  };
}

// 環境マッピング: API環境 → DynamoDB環境
const dynamoEnvironmentMapping = {
  local: 'development',
  dev: 'staging', 
  prod: 'production'
};
```

### 環境検出ロジック

```typescript
// packages/core/src/utils/config.ts
export function getCurrentEnvironment(): ApiEnvironment {
  const env = process.env.NODE_ENV || 'local';
  const stage = process.env.STAGE || env;
  
  // 正規化ロジック
  switch (stage.toLowerCase()) {
    case 'development':
    case 'local':
      return 'local';
    case 'staging': 
    case 'dev':
      return 'dev';
    case 'production':
    case 'prod':
      return 'prod';
    default:
      console.warn(`Unknown environment: ${stage}, defaulting to local`);
      return 'local';
  }
}
```

## 🔧 開発環境セットアップ

### 1. ローカル開発環境

```bash
# フルスタック開発環境
cd feature-flag-system

# 1. DynamoDB Local起動（オプション）
./scripts/start-local-aws.sh

# 2. APIサーバー起動
cd packages/api
NODE_ENV=local npm run dev

# 3. 管理画面起動  
cd packages/admin-ui
npm run dev

# 4. 勤怠アプリ起動（テスト用）
cd packages/admin-ui/attendance-saas
npx serve attendance-app.html
```

### 2. 開発環境テスト

```bash
# dev環境での動作確認
cd packages/api
NODE_ENV=development STAGE=dev USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-dev npm run dev

# prod環境での動作確認  
NODE_ENV=production STAGE=prod USE_IN_MEMORY_FLAGS=false \
FEATURE_FLAGS_TABLE_NAME=feature-flags-prod npm run dev
```

## 📝 新機能開発プロセス

### 環境対応新機能の開発手順

#### 1. 設定スキーマの拡張

```typescript
// packages/core/src/utils/config.ts
export interface ApiEnvironmentConfig {
  // 既存設定...
  
  // 新機能用設定追加例
  newFeature?: {
    enabled: boolean;
    endpoint?: string;
    timeout: number;
  };
}
```

#### 2. 環境設定ファイルの更新

```json
// config/environments.json
{
  "local": {
    "newFeature": {
      "enabled": true,
      "timeout": 1000
    }
  },
  "dev": {
    "newFeature": {
      "enabled": true,
      "endpoint": "https://dev-newfeature.example.com",
      "timeout": 5000
    }
  },
  "prod": {
    "newFeature": {
      "enabled": false,
      "endpoint": "https://newfeature.example.com", 
      "timeout": 3000
    }
  }
}
```

#### 3. 実装とテスト

```typescript
// packages/core/src/new-feature.ts
import { getCurrentEnvironment, loadEnvironmentConfig } from './utils/config';

export class NewFeatureService {
  private config: ApiEnvironmentConfig;
  
  constructor() {
    const env = getCurrentEnvironment();
    this.config = loadEnvironmentConfig(env);
  }
  
  async executeNewFeature(): Promise<void> {
    if (!this.config.newFeature?.enabled) {
      console.log('New feature disabled in current environment');
      return;
    }
    
    // 環境固有の実装
    if (this.config.database.type === 'local') {
      await this.executeLocalImplementation();
    } else {
      await this.executeDynamoImplementation();
    }
  }
  
  private async executeLocalImplementation(): Promise<void> {
    // ローカル環境用の高速実装
  }
  
  private async executeDynamoImplementation(): Promise<void> {
    // DynamoDB環境用の実装
  }
}
```

#### 4. 環境別テスト

```typescript
// packages/core/tests/new-feature.test.ts
describe('NewFeatureService', () => {
  beforeEach(() => {
    // 各テストで環境をリセット
    delete process.env.NODE_ENV;
    delete process.env.STAGE;
  });
  
  it('should work in local environment', async () => {
    process.env.NODE_ENV = 'local';
    const service = new NewFeatureService();
    await service.executeNewFeature();
    // アサーション
  });
  
  it('should work in dev environment', async () => {
    process.env.NODE_ENV = 'development';
    process.env.STAGE = 'dev';
    const service = new NewFeatureService();
    await service.executeNewFeature();
    // アサーション
  });
  
  it('should be disabled in prod by default', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STAGE = 'prod';
    const service = new NewFeatureService();
    await service.executeNewFeature();
    // 無効化されていることを確認
  });
});
```

## 🚀 DynamoDB設計パターン

### 環境分離設計

```typescript
// packages/core/src/evaluator/dynamo-client.ts
export class DynamoDbClient {
  constructor(options: {
    region: string;
    tableName: string;
    endpoint?: string;
    environment: Environment; // 'development' | 'staging' | 'production'
  }) {
    this.environment = options.environment;
    this.tableName = options.tableName;
    
    // 環境別のDynamoDBクライアント設定
    this.dynamoDb = new DynamoDBClient({
      region: options.region,
      endpoint: options.endpoint, // ローカル環境のみ
      retryMode: options.environment === 'production' ? 'adaptive' : 'standard',
      maxAttempts: options.environment === 'production' ? 3 : 1
    });
  }
  
  // パーティションキー設計：環境を含める
  private buildPrimaryKey(flagKey: string): string {
    return `FLAG#${this.environment}#${flagKey}`;
  }
  
  // GSI設計：環境別インデックス
  private buildGSI3PK(): string {
    return `FLAGS#${this.environment}`;
  }
}
```

### 環境間データ移行ツール

```typescript
// packages/core/src/migration/environment-migration.ts
export class EnvironmentMigration {
  async migrateFlagsBetweenEnvironments(options: {
    sourceEnv: Environment;
    targetEnv: Environment;
    flagKeys?: string[];
    dryRun: boolean;
  }): Promise<MigrationResult> {
    
    const sourceClient = new DynamoDbClient({
      environment: options.sourceEnv,
      tableName: this.getTableName(options.sourceEnv),
      region: 'ap-northeast-1'
    });
    
    const targetClient = new DynamoDbClient({
      environment: options.targetEnv,
      tableName: this.getTableName(options.targetEnv),
      region: 'ap-northeast-1'
    });
    
    // 移行実行
    const flags = await sourceClient.listFlags();
    const filteredFlags = options.flagKeys 
      ? flags.filter(f => options.flagKeys!.includes(f.flagKey))
      : flags;
    
    if (options.dryRun) {
      return { 
        migrationCount: filteredFlags.length,
        flags: filteredFlags.map(f => f.flagKey)
      };
    }
    
    // 実際の移行実行
    for (const flag of filteredFlags) {
      await targetClient.createFlag({
        ...flag,
        environment: options.targetEnv // 環境を更新
      });
    }
    
    return { migrationCount: filteredFlags.length };
  }
  
  private getTableName(environment: Environment): string {
    const tableMapping = {
      development: 'feature-flags-local',
      staging: 'feature-flags-dev',
      production: 'feature-flags-prod'
    };
    return tableMapping[environment];
  }
}
```

## 🧪 テスト戦略

### 環境別統合テスト

```typescript
// tests/integration/environment-integration.test.ts
describe('Environment Integration', () => {
  const environments: ApiEnvironment[] = ['local', 'dev', 'prod'];
  
  environments.forEach(env => {
    describe(`${env} environment`, () => {
      let client: FeatureFlagClient;
      
      beforeAll(async () => {
        // 環境固有のセットアップ
        process.env.NODE_ENV = env === 'local' ? 'local' : 
          env === 'dev' ? 'development' : 'production';
        process.env.STAGE = env;
        
        const config = loadEnvironmentConfig(env);
        client = new FeatureFlagClient(config);
        
        if (env !== 'local') {
          // dev/prod環境のデータベース準備
          await setupTestData(env);
        }
      });
      
      it('should create and evaluate flags', async () => {
        const flagKey = `test-flag-${env}-${Date.now()}`;
        
        // フラグ作成
        await client.createFlag({
          flagKey,
          description: `Test flag for ${env}`,
          defaultEnabled: true
        });
        
        // 評価
        const result = await client.isEnabled(flagKey, {
          tenantId: 'test-tenant'
        });
        
        expect(result).toBe(true);
      });
      
      afterAll(async () => {
        // クリーンアップ
        if (env !== 'local') {
          await cleanupTestData(env);
        }
      });
    });
  });
});
```

### パフォーマンステスト

```typescript
// tests/performance/environment-performance.test.ts
describe('Environment Performance', () => {
  it('should meet performance targets in all environments', async () => {
    const environments = ['local', 'dev', 'prod'];
    const results = {};
    
    for (const env of environments) {
      const config = loadEnvironmentConfig(env as ApiEnvironment);
      const client = new FeatureFlagClient(config);
      
      // 100回の評価実行
      const start = Date.now();
      const promises = Array(100).fill(0).map(() => 
        client.isEnabled('performance-test-flag', {
          tenantId: 'perf-test-tenant'
        })
      );
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      results[env] = {
        totalTime: duration,
        avgTime: duration / 100,
        requestsPerSecond: 100000 / duration
      };
    }
    
    // 環境別のパフォーマンス要件
    expect(results.local.avgTime).toBeLessThan(10); // ローカル: 10ms
    expect(results.dev.avgTime).toBeLessThan(100);  // dev: 100ms
    expect(results.prod.avgTime).toBeLessThan(50);  // prod: 50ms
  });
});
```

## 🔄 CI/CD統合

### GitHub Actions設定

```yaml
# .github/workflows/environment-tests.yml
name: Multi-Environment Tests
on: [push, pull_request]

jobs:
  test-local:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: local
      STAGE: local
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration:local
      
  test-dev:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: development  
      STAGE: dev
      USE_IN_MEMORY_FLAGS: false
      FEATURE_FLAGS_TABLE_NAME: feature-flags-dev-ci
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      - run: npm install
      - run: npm run test:integration:dev
      
  performance-test:
    runs-on: ubuntu-latest
    needs: [test-local, test-dev]
    steps:
      - uses: actions/checkout@v3
      - run: npm run test:performance
```

## 📊 監視・メトリクス

### 環境別メトリクス

```typescript
// packages/core/src/monitoring/environment-metrics.ts
export class EnvironmentMetrics {
  private environment: ApiEnvironment;
  
  constructor() {
    this.environment = getCurrentEnvironment();
  }
  
  async recordEvaluationMetrics(metrics: {
    flagKey: string;
    duration: number;
    success: boolean;
    source: 'in-memory' | 'dynamodb';
  }): Promise<void> {
    
    // 環境別のメトリクス送信
    const tags = {
      environment: this.environment,
      source: metrics.source,
      flag_key: metrics.flagKey
    };
    
    if (this.environment === 'prod') {
      // 本番環境：CloudWatch メトリクス
      await this.sendToCloudWatch({
        MetricName: 'FlagEvaluationDuration',
        Value: metrics.duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Environment', Value: this.environment },
          { Name: 'Source', Value: metrics.source }
        ]
      });
    } else if (this.environment === 'dev') {
      // 開発環境：詳細ログ
      console.log('Dev metrics:', { ...metrics, ...tags });
    }
    // ローカル環境：最小限のログ
  }
}
```

## 関連ドキュメント

- [環境設定詳細](../environments/README.md)
- [API開発ガイド](./api-development.md)
- [DynamoDB設計](./database-design.md)
- [運用手順書](../runbooks/environment-management.md)