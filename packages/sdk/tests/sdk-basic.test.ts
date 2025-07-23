import { describe, it, expect, vi } from 'vitest';
import { FeatureFlagClient, getFeatureFlagClient, isFeatureEnabled } from '../src/index';

/**
 * SDK Basic Functionality Tests
 * 
 * 1Issue1PR原則に従った基本機能テスト
 * - モジュールの基本構造確認
 * - エクスポート関数の動作確認
 * - 基本的なエラーハンドリング
 */

describe('SDK Basic Functionality', () => {
  describe('Module Structure', () => {
    describe('GIVEN SDK module', () => {
      describe('WHEN checking exports', () => {
        it('THEN exports required functions and classes', () => {
          // Given: SDK module is loaded
          // When: Checking exported items
          // Then: All required exports are available
          expect(FeatureFlagClient).toBeDefined();
          expect(getFeatureFlagClient).toBeDefined();
          expect(isFeatureEnabled).toBeDefined();
        });

        it('THEN FeatureFlagClient can be instantiated', () => {
          // Given: FeatureFlagClient class
          // When: Creating new instance
          // Then: Should instantiate without errors
          expect(() => new FeatureFlagClient()).not.toThrow();
        });
      });
    });
  });

  describe('Global Client Function', () => {
    describe('GIVEN getFeatureFlagClient function', () => {
      describe('WHEN calling global client getter', () => {
        it('THEN returns evaluator instance', () => {
          // Given: Global client function
          // When: Getting feature flag client
          const client = getFeatureFlagClient();
          
          // Then: Should return valid evaluator
          expect(client).toBeDefined();
          expect(typeof client.isEnabled).toBe('function');
        });

        it('THEN returns same instance on multiple calls', () => {
          // Given: Global client function
          // When: Getting client multiple times
          const client1 = getFeatureFlagClient();
          const client2 = getFeatureFlagClient();
          
          // Then: Should return same instance (singleton pattern)
          expect(client1).toBe(client2);
        });
      });
    });
  });

  describe('Package Configuration', () => {
    describe('GIVEN SDK package', () => {
      describe('WHEN checking package structure', () => {
        it('THEN has proper package.json configuration', () => {
          // Given: SDK package configuration
          const packageJson = require('../package.json');
          
          // When: Checking package details
          // Then: Should have correct configuration
          expect(packageJson.name).toBe('@feature-flag/sdk');
          expect(packageJson.license).toBe('MIT');
          expect(packageJson.scripts.test).toBe('vitest run');
        });
      });
    });
  });
});