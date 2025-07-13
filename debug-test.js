// デバッグ用スクリプト
const { FeatureFlagCache, MockTimeProvider } = require('./packages/core/dist/cache/index.js');
const { FEATURE_FLAGS } = require('./packages/core/dist/models/index.js');

// Test 1: Zero TTL
console.log('\n=== Test 1: Zero TTL ===');
const mockTimeProvider = new MockTimeProvider();
const zeroTTLCache = new FeatureFlagCache({ ttl: 0, timeProvider: mockTimeProvider });

console.log('MockTimeProvider methods:', Object.getOwnPropertyNames(MockTimeProvider.prototype));
console.log('mockTimeProvider methods:', Object.getOwnPropertyNames(mockTimeProvider));

mockTimeProvider.setTime(1000);
console.log('Before set:');
zeroTTLCache.set('tenant-123', FEATURE_FLAGS.BILLING_V2, true);
console.log('After set:');
const result1 = zeroTTLCache.get('tenant-123', FEATURE_FLAGS.BILLING_V2);
console.log('Get result:', result1);
console.log('Cache size:', zeroTTLCache.size());

// Test 2: TTL expiration  
console.log('\n=== Test 2: TTL Expiration ===');
const mockTimeProvider2 = new MockTimeProvider();
const ttlCache = new FeatureFlagCache({ ttl: 50, timeProvider: mockTimeProvider2 });

mockTimeProvider2.setTime(1000);
console.log('Before set (time=1000):');
ttlCache.set('tenant-123', FEATURE_FLAGS.BILLING_V2, true);
console.log('After set:');

const result2a = ttlCache.get('tenant-123', FEATURE_FLAGS.BILLING_V2);
console.log('Get result (time=1000):', result2a);

mockTimeProvider2.setTime(1051); // 1000 + 51 (TTL=50, so this should be expired)
console.log('After time advance (time=1051):');
const result2b = ttlCache.get('tenant-123', FEATURE_FLAGS.BILLING_V2);
console.log('Get result (time=1051):', result2b);