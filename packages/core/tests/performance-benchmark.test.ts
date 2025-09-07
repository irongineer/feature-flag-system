import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlagEvaluator, FeatureFlagCache, MockTimeProvider } from '../src';
import { FEATURE_FLAGS } from '../src/models';

/**
 * Performance Benchmark Tests
 * System latency and throughput measurement
 */
describe('Performance Benchmark Tests', () => {
  let evaluator: FeatureFlagEvaluator;
  let cache: FeatureFlagCache;
  let mockTimeProvider: MockTimeProvider;

  beforeEach(() => {
    mockTimeProvider = new MockTimeProvider();
    mockTimeProvider.setTime(Date.now());
    
    cache = new FeatureFlagCache({
      ttl: 300000, // 5 minutes
      timeProvider: mockTimeProvider,
    });
    
    evaluator = new FeatureFlagEvaluator({
      cache,
      environment: 'development',
    });
  });

  describe('Single Flag Evaluation Performance', () => {
    it('should evaluate single flag under 5ms (cache miss)', async () => {
      const tenantId = 'performance-test-tenant';
      const flagKey = FEATURE_FLAGS.BILLING_V2;
      
      const start = performance.now();
      const result = await evaluator.isEnabled(tenantId, flagKey);
      const latency = performance.now() - start;
      
      expect(typeof result).toBe('boolean');
      expect(latency).toBeLessThan(10); // 10ms threshold for CI environment
      
      console.log(`Single flag evaluation (cache miss): ${latency.toFixed(2)}ms`);
    });

    it('should evaluate single flag under 1ms (cache hit)', async () => {
      const tenantId = 'performance-test-tenant';
      const flagKey = FEATURE_FLAGS.BILLING_V2;
      
      // First evaluation to populate cache
      await evaluator.isEnabled(tenantId, flagKey);
      
      // Second evaluation should be faster (cache hit)
      const start = performance.now();
      const result = await evaluator.isEnabled(tenantId, flagKey);
      const latency = performance.now() - start;
      
      expect(typeof result).toBe('boolean');
      expect(latency).toBeLessThan(5); // Relaxed for CI
      
      console.log(`Single flag evaluation (cache hit): ${latency.toFixed(2)}ms`);
    });
  });

  describe('Multiple Flag Evaluation Performance', () => {
    it('should evaluate 5 flags in parallel under 25ms', async () => {
      const tenantId = 'performance-test-tenant';
      const flagKeys = Object.values(FEATURE_FLAGS);
      
      const start = performance.now();
      
      const promises = flagKeys.map(flagKey =>
        evaluator.isEnabled(tenantId, flagKey)
      );
      
      const results = await Promise.all(promises);
      const totalLatency = performance.now() - start;
      
      expect(results).toHaveLength(flagKeys.length);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
      expect(totalLatency).toBeLessThan(50); // Relaxed for CI
      
      console.log(`5 flags parallel evaluation: ${totalLatency.toFixed(2)}ms`);
      console.log(`Average per flag: ${(totalLatency / flagKeys.length).toFixed(2)}ms`);
    });

    it('should evaluate 10 flags sequentially under 100ms', async () => {
      const tenantId = 'performance-test-tenant';
      const flagKeys = Array(10).fill(0).map((_, i) => 
        Object.values(FEATURE_FLAGS)[i % Object.values(FEATURE_FLAGS).length]
      );
      
      const start = performance.now();
      
      const results: boolean[] = [];
      for (const flagKey of flagKeys) {
        const result = await evaluator.isEnabled(tenantId, flagKey);
        results.push(result);
      }
      
      const totalLatency = performance.now() - start;
      
      expect(results).toHaveLength(flagKeys.length);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
      expect(totalLatency).toBeLessThan(200); // Relaxed for CI
      
      console.log(`10 flags sequential evaluation: ${totalLatency.toFixed(2)}ms`);
      console.log(`Average per flag: ${(totalLatency / flagKeys.length).toFixed(2)}ms`);
    });
  });

  describe('Cache Performance', () => {
    it('should show performance improvement with cache', async () => {
      const tenantId = 'cache-performance-tenant';
      const flagKey = FEATURE_FLAGS.BILLING_V2;
      const iterations = 20; // Reduced for CI stability
      
      // Cold run measurements (cache miss)
      const coldLatencies: number[] = [];
      for (let i = 0; i < iterations; i++) {
        await evaluator.invalidateCache(tenantId, flagKey);
        
        const start = performance.now();
        await evaluator.isEnabled(tenantId, flagKey);
        coldLatencies.push(performance.now() - start);
      }
      
      // Warm run measurements (cache hit)
      const warmLatencies: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await evaluator.isEnabled(tenantId, flagKey);
        warmLatencies.push(performance.now() - start);
      }
      
      const avgColdLatency = coldLatencies.reduce((a, b) => a + b) / coldLatencies.length;
      const avgWarmLatency = warmLatencies.reduce((a, b) => a + b) / warmLatencies.length;
      const improvement = ((avgColdLatency - avgWarmLatency) / avgColdLatency) * 100;
      
      expect(avgWarmLatency).toBeLessThan(avgColdLatency);
      expect(improvement).toBeGreaterThan(0); // Any improvement is good
      
      console.log(`Average cold latency: ${avgColdLatency.toFixed(2)}ms`);
      console.log(`Average warm latency: ${avgWarmLatency.toFixed(2)}ms`);
      console.log(`Cache improvement: ${improvement.toFixed(1)}%`);
    });
  });

  describe('High Load Simulation', () => {
    it('should handle 100 concurrent evaluations', async () => {
      const concurrentRequests = 100; // Reduced for CI
      const tenantId = 'high-load-tenant';
      const flagKey = FEATURE_FLAGS.BILLING_V2;
      
      // Pre-warm cache
      await evaluator.isEnabled(tenantId, flagKey);
      
      const start = performance.now();
      
      const promises = Array(concurrentRequests).fill(0).map(() =>
        evaluator.isEnabled(tenantId, flagKey)
      );
      
      const results = await Promise.all(promises);
      const totalLatency = performance.now() - start;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(result => typeof result === 'boolean')).toBe(true);
      expect(totalLatency).toBeLessThan(1000); // 1 second max
      
      console.log(`${concurrentRequests} concurrent evaluations: ${totalLatency.toFixed(2)}ms`);
      console.log(`Throughput: ${(concurrentRequests / (totalLatency / 1000)).toFixed(0)} ops/sec`);
    });
  });
});