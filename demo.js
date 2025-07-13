#!/usr/bin/env node

// フィーチャーフラグシステムのデモンストレーション
console.log('🚀 フィーチャーフラグシステム - ライブデモ');
console.log('='.repeat(50));

const { FeatureFlagEvaluator, FeatureFlagCache, FEATURE_FLAGS } = require('./packages/core/dist/index.js');

// 1. キャッシュシステムのデモ
console.log('\n📦 1. キャッシュシステムのデモ');
console.log('-'.repeat(30));

const cache = new FeatureFlagCache({ ttl: 5 }); // 5秒TTL
const tenantId = 'demo-tenant-001';

// フラグを設定
cache.set(tenantId, FEATURE_FLAGS.BILLING_V2, true);
cache.set(tenantId, FEATURE_FLAGS.NEW_DASHBOARD, false);
cache.set(tenantId, FEATURE_FLAGS.ADVANCED_ANALYTICS, true);

console.log(`✅ テナント ${tenantId} のフラグを設定しました`);
console.log(`📊 キャッシュサイズ: ${cache.size()}`);

// フラグを取得
console.log('\n🔍 フラグ取得結果:');
console.log(`  BILLING_V2: ${cache.get(tenantId, FEATURE_FLAGS.BILLING_V2)}`);
console.log(`  NEW_DASHBOARD: ${cache.get(tenantId, FEATURE_FLAGS.NEW_DASHBOARD)}`);
console.log(`  ADVANCED_ANALYTICS: ${cache.get(tenantId, FEATURE_FLAGS.ADVANCED_ANALYTICS)}`);

// 2. フィーチャーフラグ評価エンジンのデモ
console.log('\n⚙️ 2. フィーチャーフラグ評価エンジンのデモ');
console.log('-'.repeat(30));

// モックDynamoDBクライアント（実際のAWS接続なし）
class MockDynamoClient {
  constructor() {
    this.flags = new Map([
      [FEATURE_FLAGS.BILLING_V2, { defaultEnabled: true, description: '新しい請求システム' }],
      [FEATURE_FLAGS.NEW_DASHBOARD, { defaultEnabled: false, description: '新しいダッシュボード' }],
      [FEATURE_FLAGS.ADVANCED_ANALYTICS, { defaultEnabled: true, description: '高度な分析機能' }]
    ]);
    
    this.overrides = new Map([
      [`${tenantId}:${FEATURE_FLAGS.BILLING_V2}`, false], // テナントで無効化
      [`${tenantId}:${FEATURE_FLAGS.NEW_DASHBOARD}`, true] // テナントで有効化
    ]);
  }

  async get(params) {
    if (params.TableName === 'FeatureFlags') {
      const flagKey = params.Key.flagKey.S;
      const flag = this.flags.get(flagKey);
      if (flag) {
        return {
          Item: {
            flagKey: { S: flagKey },
            defaultEnabled: { BOOL: flag.defaultEnabled },
            description: { S: flag.description }
          }
        };
      }
    } else if (params.TableName === 'TenantOverrides') {
      const tenantId = params.Key.tenantId.S;
      const flagKey = params.Key.flagKey.S;
      const key = `${tenantId}:${flagKey}`;
      const override = this.overrides.get(key);
      if (override !== undefined) {
        return {
          Item: {
            tenantId: { S: tenantId },
            flagKey: { S: flagKey },
            enabled: { BOOL: override }
          }
        };
      }
    }
    return {};
  }
}

const mockDynamoDB = new MockDynamoClient();
const evaluator = new FeatureFlagEvaluator(mockDynamoDB);

// フラグ評価のデモ
async function demonstrateEvaluation() {
  console.log(`\n🎯 テナント ${tenantId} でのフラグ評価:`);
  
  for (const flagKey of Object.values(FEATURE_FLAGS)) {
    try {
      const result = await evaluator.isEnabled(tenantId, flagKey);
      const flag = mockDynamoDB.flags.get(flagKey);
      const override = mockDynamoDB.overrides.get(`${tenantId}:${flagKey}`);
      
      console.log(`  ${flagKey}:`);
      console.log(`    📄 デフォルト: ${flag?.defaultEnabled}`);
      console.log(`    🔧 オーバーライド: ${override !== undefined ? override : 'なし'}`);
      console.log(`    ✨ 最終結果: ${result}`);
      console.log();
    } catch (error) {
      console.log(`  ${flagKey}: ❌ エラー - ${error.message}`);
    }
  }
}

// 3. パフォーマンステストのデモ
console.log('\n⚡ 3. パフォーマンステストのデモ');
console.log('-'.repeat(30));

async function performanceDemo() {
  const iterations = 1000;
  const startTime = process.hrtime.bigint();
  
  for (let i = 0; i < iterations; i++) {
    cache.set(`tenant-${i}`, FEATURE_FLAGS.BILLING_V2, i % 2 === 0);
    cache.get(`tenant-${i}`, FEATURE_FLAGS.BILLING_V2);
  }
  
  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1000000; // ms
  
  console.log(`✅ ${iterations}回のキャッシュ操作を完了`);
  console.log(`⏱️  実行時間: ${duration.toFixed(2)}ms`);
  console.log(`🚀 平均実行時間: ${(duration / iterations).toFixed(4)}ms/op`);
  console.log(`📊 最終キャッシュサイズ: ${cache.size()}`);
}

// 4. TTLデモンストレーション
async function ttlDemo() {
  console.log('\n⏰ 4. TTL（Time To Live）デモ');
  console.log('-'.repeat(30));
  
  const shortCache = new FeatureFlagCache({ ttl: 2 }); // 2秒TTL
  
  shortCache.set('temp-tenant', FEATURE_FLAGS.BILLING_V2, true);
  console.log(`✅ TTL=2秒でフラグを設定`);
  console.log(`🔍 即座に取得: ${shortCache.get('temp-tenant', FEATURE_FLAGS.BILLING_V2)}`);
  
  console.log('⏳ 3秒後にTTL期限切れをテスト...');
  setTimeout(() => {
    const result = shortCache.get('temp-tenant', FEATURE_FLAGS.BILLING_V2);
    console.log(`🔍 3秒後の取得結果: ${result} (undefined = 期限切れ)`);
    console.log(`📊 キャッシュサイズ: ${shortCache.size()}`);
    
    console.log('\n🎉 デモ完了！フィーチャーフラグシステムが正常に動作しています');
    console.log('='.repeat(50));
  }, 3000);
}

// デモ実行
async function runDemo() {
  await demonstrateEvaluation();
  await performanceDemo();
  await ttlDemo();
}

runDemo().catch(console.error);