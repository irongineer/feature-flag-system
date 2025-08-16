const FeatureFlagClient = require('./feature-flag-integration/client/index.js');

const client = new FeatureFlagClient({
  apiEndpoint: 'https://7wslqwkrvj.execute-api.ap-northeast-1.amazonaws.com/featureflagprodlambda',
  tenantId: 'attendance-tenant-001'
});

async function testFlags() {
  console.log('🚀 フィーチャーフラグ実運用テスト開始');
  console.log('==================================');
  
  const flags = [
    'attendance_new_dashboard',
    'attendance_mobile_app', 
    'attendance_ai_suggestions',
    'attendance_realtime_notifications',
    'attendance_advanced_reporting'
  ];
  
  console.log('📊 個別フラグ評価:');
  for (const flag of flags) {
    const enabled = await client.isEnabled(flag);
    console.log(`  ${flag}: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  }
  
  console.log('\n📋 一括フラグ評価:');
  const batchResults = await client.evaluateMultiple(flags);
  console.log(JSON.stringify(batchResults, null, 2));
  
  console.log('\n🔄 キャッシュテスト:');
  console.time('First call');
  await client.isEnabled('attendance_new_dashboard');
  console.timeEnd('First call');
  
  console.time('Cached call');
  await client.isEnabled('attendance_new_dashboard');
  console.timeEnd('Cached call');
  
  console.log('\n🎯 Kill-Switch シミュレーション:');
  console.log('  緊急時は管理画面からKill-Switchを有効化します');
  
  console.log('\n✅ フィーチャーフラグ実運用テスト完了');
  console.log('\n📱 デモアプリケーション:');
  console.log('  ブラウザで http://localhost:8080/demo-integration.html にアクセス');
  console.log('  実際のフィーチャーフラグ動作を確認できます');
}

testFlags().catch(console.error);