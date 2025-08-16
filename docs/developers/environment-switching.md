# 🌍 環境切り替えガイド（開発者向け）

## 概要

フィーチャーフラグシステムは3つの環境に対応し、開発フェーズに応じて適切な環境を選択できます。

## 環境の種類

| 環境 | 用途 | データソース | 特徴 |
|------|------|-------------|------|
| **local** | ローカル開発・単体テスト | インメモリ | 高速、データは揮発性 |
| **dev** | 統合テスト・機能検証 | `feature-flags-dev` DynamoDB | 永続化、チーム共有 |
| **prod** | 本番運用 | `feature-flags-prod` DynamoDB | 本番データ、高可用性 |

## クライアント実装

### 1. 自動環境検出

```typescript
import { getCurrentEnvironment, loadEnvironmentConfig } from '@feature-flag/core';

// 環境自動検出
const environment = getCurrentEnvironment(); // NODE_ENV, STAGEから自動判定
const config = loadEnvironmentConfig(environment);

console.log(`Running in ${environment} environment`);
console.log(`API endpoint: ${config.api.baseUrl}`);
```

### 2. 環境別クライアント初期化

```typescript
import { FeatureFlagClient } from '@feature-flag/core';

// 環境設定を使用したクライアント作成
const client = new FeatureFlagClient({
  baseUrl: config.api.baseUrl,
  timeout: config.api.timeout,
  headers: {
    'X-Environment': environment  // 環境情報をヘッダーに追加
  }
});
```

### 3. 環境コンテキストの設定

```typescript
// 基本コンテキスト（全環境共通）
const baseContext = {
  tenantId: 'tenant-123'
};

// 環境情報を含むコンテキスト
const contextWithEnv = {
  ...baseContext,
  environment: environment,  // 明示的な環境指定
  metadata: {
    buildVersion: process.env.BUILD_VERSION,
    deploymentId: process.env.DEPLOYMENT_ID
  }
};

const isEnabled = await client.isEnabled('new-feature', contextWithEnv);
```

## 環境別開発フロー

### ローカル開発

```bash
# 1. 環境変数設定
export NODE_ENV=local
export STAGE=local

# 2. APIサーバー起動（別ターミナル）
cd packages/api
npm run dev

# 3. フロントエンド開発
cd your-app
npm run dev
```

```typescript
// ローカル開発時のクライアント設定
const client = new FeatureFlagClient({
  baseUrl: 'http://localhost:3001/api',  // ローカルAPI
  timeout: 5000
});

// 高速開発のためのフラグ設定
await client.createFlag({
  flagKey: 'dev-feature',
  description: '開発中機能',
  defaultEnabled: true
});
```

### 統合テスト環境

```bash
# 1. dev環境への切り替え
export NODE_ENV=development
export STAGE=dev
export USE_IN_MEMORY_FLAGS=false
export FEATURE_FLAGS_TABLE_NAME=feature-flags-dev

# 2. AWS認証確認
aws sts get-caller-identity

# 3. アプリケーション起動
npm start
```

```typescript
// dev環境でのテスト
const testClient = new FeatureFlagClient({
  baseUrl: 'https://dev-api.feature-flags.example.com/api',
  apiKey: process.env.DEV_API_KEY
});

// チーム共有フラグの確認
const flags = await testClient.getAllFlags({
  tenantId: 'test-tenant'
});

console.log('Dev environment flags:', flags);
```

### 本番デプロイ

```bash
# 1. 本番環境設定
export NODE_ENV=production
export STAGE=prod
export USE_IN_MEMORY_FLAGS=false
export FEATURE_FLAGS_TABLE_NAME=feature-flags-prod

# 2. 本番ビルド
npm run build

# 3. デプロイ
npm run deploy:prod
```

```typescript
// 本番環境での安全な実装
const prodClient = new FeatureFlagClient({
  baseUrl: 'https://api.feature-flags.example.com/api',
  apiKey: process.env.PROD_API_KEY,
  timeout: 3000,
  retries: 3
});

// フェイルセーフ実装
const getFeatureFlag = async (flagKey: string, context: any): Promise<boolean> => {
  try {
    return await prodClient.isEnabled(flagKey, context);
  } catch (error) {
    console.error(`Flag evaluation failed for ${flagKey}:`, error);
    // 本番では保守的にfalseを返す
    return false;
  }
};
```

## 環境間のデータ管理

### フラグの環境間移行

```typescript
// dev環境からprod環境へのフラグ移行
import { migrateFlagsBetweenEnvironments } from '@feature-flag/migration';

await migrateFlagsBetweenEnvironments({
  source: {
    environment: 'dev',
    tableName: 'feature-flags-dev'
  },
  destination: {
    environment: 'prod',
    tableName: 'feature-flags-prod'
  },
  flags: ['billing_v2_enable', 'new_dashboard'],
  dryRun: true  // 本番移行前の確認
});
```

### 環境固有の設定

```typescript
// 環境別設定の管理
const getEnvironmentSpecificConfig = (env: string) => {
  const configs = {
    local: {
      cacheTimeout: 60,      // 1分（開発効率重視）
      logLevel: 'debug',
      enableMetrics: false
    },
    dev: {
      cacheTimeout: 300,     // 5分（バランス）
      logLevel: 'info',
      enableMetrics: true
    },
    prod: {
      cacheTimeout: 600,     // 10分（安定性重視）
      logLevel: 'warn',
      enableMetrics: true
    }
  };
  
  return configs[env] || configs.local;
};
```

## トラブルシューティング

### 環境検出の問題

```typescript
// 環境検出のデバッグ
import { getCurrentEnvironment } from '@feature-flag/core';

console.log('Environment variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`STAGE: ${process.env.STAGE}`);

const detectedEnv = getCurrentEnvironment();
console.log(`Detected environment: ${detectedEnv}`);

// 強制的な環境指定
const forceEnv = process.env.FORCE_ENVIRONMENT || detectedEnv;
```

### API接続の問題

```typescript
// 接続テスト関数
const testEnvironmentConnection = async (env: string) => {
  try {
    const config = loadEnvironmentConfig(env);
    const response = await fetch(`${config.api.baseUrl}/health`);
    
    if (response.ok) {
      console.log(`✅ ${env} environment: Connected`);
    } else {
      console.error(`❌ ${env} environment: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ ${env} environment: ${error.message}`);
  }
};

// 全環境のテスト
await Promise.all([
  testEnvironmentConnection('local'),
  testEnvironmentConnection('dev'),
  testEnvironmentConnection('prod')
]);
```

### データ同期の問題

```typescript
// 環境間のデータ整合性チェック
const compareEnvironmentData = async () => {
  const devFlags = await devClient.getAllFlags({ tenantId: 'test' });
  const prodFlags = await prodClient.getAllFlags({ tenantId: 'test' });
  
  const devKeys = new Set(devFlags.map(f => f.flagKey));
  const prodKeys = new Set(prodFlags.map(f => f.flagKey));
  
  const onlyInDev = [...devKeys].filter(k => !prodKeys.has(k));
  const onlyInProd = [...prodKeys].filter(k => !devKeys.has(k));
  
  console.log('Flags only in dev:', onlyInDev);
  console.log('Flags only in prod:', onlyInProd);
};
```

## ベストプラクティス

### 1. 環境別実装パターン

```typescript
// 環境を意識した実装
class FeatureFlagService {
  private client: FeatureFlagClient;
  private environment: string;
  
  constructor() {
    this.environment = getCurrentEnvironment();
    const config = loadEnvironmentConfig(this.environment);
    
    this.client = new FeatureFlagClient({
      baseUrl: config.api.baseUrl,
      timeout: config.api.timeout,
      // 環境別の設定
      cacheEnabled: this.environment !== 'local',
      retries: this.environment === 'prod' ? 3 : 1
    });
  }
  
  async getFlag(flagKey: string, context: any): Promise<boolean> {
    // 環境別のフォールバック戦略
    const defaultValue = this.getEnvironmentDefault(flagKey);
    
    try {
      return await this.client.isEnabled(flagKey, {
        ...context,
        environment: this.environment
      });
    } catch (error) {
      if (this.environment === 'prod') {
        // 本番は保守的
        return false;
      } else {
        // 開発環境は寛容
        return defaultValue;
      }
    }
  }
  
  private getEnvironmentDefault(flagKey: string): boolean {
    // 開発環境では新機能を有効に
    if (this.environment === 'local') {
      return true;
    }
    return false;
  }
}
```

### 2. テスト環境での実装

```typescript
// 環境別テストの実装
describe('Feature Flag Integration', () => {
  beforeEach(() => {
    // テスト用環境設定
    process.env.NODE_ENV = 'test';
    process.env.STAGE = 'local';
  });
  
  it('should work in local environment', async () => {
    const service = new FeatureFlagService();
    const enabled = await service.getFlag('test-flag', {
      tenantId: 'test-tenant'
    });
    
    expect(enabled).toBeDefined();
  });
  
  it('should handle dev environment', async () => {
    process.env.STAGE = 'dev';
    
    const service = new FeatureFlagService();
    // dev環境特有のテスト
  });
});
```

### 3. CI/CD統合

```yaml
# GitHub Actions例
name: Multi-Environment Test
on: [push, pull_request]

jobs:
  test-local:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: local
      STAGE: local
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      
  test-dev:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: development
      STAGE: dev
    steps:
      - uses: actions/checkout@v3
      - run: npm run test:integration
```

## 関連ドキュメント

- [環境設定詳細ガイド](../environments/README.md)
- [運用手順書](../runbooks/environment-management.md)
- [API仕様書](../api/openapi.yaml)
- [トラブルシューティング](./environment-troubleshooting.md)