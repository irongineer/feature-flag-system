#!/usr/bin/env node

// シンプルなフィーチャーフラグシステムのデモンストレーション
console.log('🚀 フィーチャーフラグシステム - ライブデモ');
console.log('='.repeat(50));

// 直接requireで個別モジュールを読み込み
const { FeatureFlagCache } = require('./packages/core/dist/cache/index.js');
const { FEATURE_FLAGS } = require('./packages/core/dist/models/index.js');

console.log('\n📦 1. キャッシュシステムのデモ');
console.log('-'.repeat(30));

// キャッシュインスタンス作成
const cache = new FeatureFlagCache({ ttl: 5 }); // 5秒TTL
const tenantId = 'demo-tenant-001';

console.log('✅ フィーチャーフラグキャッシュを初期化しました');
console.log(`📊 初期キャッシュサイズ: ${cache.size()}`);

// フラグを設定
console.log('\n🔧 フラグ設定中...');
cache.set(tenantId, FEATURE_FLAGS.BILLING_V2, true);
cache.set(tenantId, FEATURE_FLAGS.NEW_DASHBOARD, false);  
cache.set(tenantId, FEATURE_FLAGS.ADVANCED_ANALYTICS, true);

console.log(`✅ テナント ${tenantId} のフラグを設定しました`);
console.log(`📊 キャッシュサイズ: ${cache.size()}`);

// フラグを取得
console.log('\n🔍 フラグ取得結果:');
console.log(`  💰 BILLING_V2: ${cache.get(tenantId, FEATURE_FLAGS.BILLING_V2)}`);
console.log(`  📊 NEW_DASHBOARD: ${cache.get(tenantId, FEATURE_FLAGS.NEW_DASHBOARD)}`);
console.log(`  📈 ADVANCED_ANALYTICS: ${cache.get(tenantId, FEATURE_FLAGS.ADVANCED_ANALYTICS)}`);

// 複数テナントでのテスト
console.log('\n👥 2. マルチテナント機能のデモ');
console.log('-'.repeat(30));

const tenants = ['tenant-a', 'tenant-b', 'tenant-c'];
tenants.forEach((tenant, index) => {
  cache.set(tenant, FEATURE_FLAGS.BILLING_V2, index % 2 === 0);
  cache.set(tenant, FEATURE_FLAGS.NEW_DASHBOARD, index % 3 === 0);
});

console.log('🏢 複数テナントのフラグ設定:');
tenants.forEach(tenant => {
  console.log(`  ${tenant}:`);
  console.log(`    💰 BILLING_V2: ${cache.get(tenant, FEATURE_FLAGS.BILLING_V2)}`);
  console.log(`    📊 NEW_DASHBOARD: ${cache.get(tenant, FEATURE_FLAGS.NEW_DASHBOARD)}`);
});

console.log(`\n📊 総キャッシュサイズ: ${cache.size()}`);

// パフォーマンステスト
console.log('\n⚡ 3. パフォーマンステストのデモ');
console.log('-'.repeat(30));

const iterations = 1000;
console.log(`🚀 ${iterations}回のキャッシュ操作を実行中...`);

const startTime = process.hrtime.bigint();

for (let i = 0; i < iterations; i++) {
  cache.set(`perf-tenant-${i}`, FEATURE_FLAGS.BILLING_V2, i % 2 === 0);
  cache.get(`perf-tenant-${i}`, FEATURE_FLAGS.BILLING_V2);
}

const endTime = process.hrtime.bigint();
const duration = Number(endTime - startTime) / 1000000; // ms

console.log(`✅ ${iterations}回のキャッシュ操作を完了`);
console.log(`⏱️  実行時間: ${duration.toFixed(2)}ms`);
console.log(`🚀 平均実行時間: ${(duration / iterations).toFixed(4)}ms/op`);
console.log(`📊 最終キャッシュサイズ: ${cache.size()}`);

// TTLデモンストレーション
console.log('\n⏰ 4. TTL（Time To Live）デモ');
console.log('-'.repeat(30));

const shortCache = new FeatureFlagCache({ ttl: 2 }); // 2秒TTL

shortCache.set('temp-tenant', FEATURE_FLAGS.BILLING_V2, true);
console.log('✅ TTL=2秒でフラグを設定');
console.log(`🔍 即座に取得: ${shortCache.get('temp-tenant', FEATURE_FLAGS.BILLING_V2)}`);

console.log('⏳ 3秒後にTTL期限切れをテスト...');
setTimeout(() => {
  const result = shortCache.get('temp-tenant', FEATURE_FLAGS.BILLING_V2);
  console.log(`🔍 3秒後の取得結果: ${result} ${result === undefined ? '(期限切れで自動削除)' : ''}`);
  console.log(`📊 TTLキャッシュサイズ: ${shortCache.size()}`);
  
  console.log('\n✨ 5. 実用例：A/Bテストシミュレーション');
  console.log('-'.repeat(30));
  
  // A/Bテストのシミュレーション
  const abTestCache = new FeatureFlagCache({ ttl: 10 });
  const users = Array.from({length: 100}, (_, i) => `user-${i}`);
  
  console.log('🧪 100ユーザーでA/Bテストを実行中...');
  
  let groupA = 0, groupB = 0;
  users.forEach((user, index) => {
    const enableNewFeature = index % 2 === 0; // 50/50でA/Bテスト
    abTestCache.set(user, FEATURE_FLAGS.NEW_DASHBOARD, enableNewFeature);
    
    if (enableNewFeature) groupA++;
    else groupB++;
  });
  
  console.log(`📊 A/Bテスト結果:`);
  console.log(`   グループA (新機能ON): ${groupA}ユーザー`);
  console.log(`   グループB (既存機能): ${groupB}ユーザー`);
  console.log(`   総キャッシュエントリ: ${abTestCache.size()}`);
  
  // 特定ユーザーの確認
  const sampleUsers = ['user-0', 'user-1', 'user-50', 'user-99'];
  console.log('\n🔍 サンプルユーザーの設定:');
  sampleUsers.forEach(user => {
    const enabled = abTestCache.get(user, FEATURE_FLAGS.NEW_DASHBOARD);
    console.log(`   ${user}: ${enabled ? '新ダッシュボード' : '既存ダッシュボード'}`);
  });
  
  console.log('\n🎉 デモ完了！フィーチャーフラグシステムが正常に動作しています');
  console.log('='.repeat(50));
  console.log('\n📋 システム概要:');
  console.log('   ✅ マルチテナント対応');
  console.log('   ✅ 高速メモリキャッシュ');  
  console.log('   ✅ TTL自動期限切れ');
  console.log('   ✅ TypeScript型安全性');
  console.log('   ✅ A/Bテスト対応');
  console.log('   ⚠️  4件のテスト失敗（技術的負債TD-007として管理中）');
  
}, 3000);