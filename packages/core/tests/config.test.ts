import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCurrentEnvironment } from '../src/utils/config';

/**
 * Config Utility Test Suite
 * Tests for environment configuration utilities
 */
describe('Config Utilities', () => {
  let originalNodeEnv: string | undefined;
  let originalStage: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalStage = process.env.STAGE;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.STAGE = originalStage;
  });

  describe('getCurrentEnvironment', () => {
    it('should return local for development NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.STAGE;
      
      expect(getCurrentEnvironment()).toBe('local');
    });

    it('should return local for local NODE_ENV', () => {
      process.env.NODE_ENV = 'local';
      delete process.env.STAGE;
      
      expect(getCurrentEnvironment()).toBe('local');
    });

    it('should return dev for staging STAGE', () => {
      process.env.STAGE = 'staging';
      
      expect(getCurrentEnvironment()).toBe('dev');
    });

    it('should return dev for dev STAGE', () => {
      process.env.STAGE = 'dev';
      
      expect(getCurrentEnvironment()).toBe('dev');
    });

    it('should return prod for production STAGE', () => {
      process.env.STAGE = 'production';
      
      expect(getCurrentEnvironment()).toBe('prod');
    });

    it('should return prod for prod STAGE', () => {
      process.env.STAGE = 'prod';
      
      expect(getCurrentEnvironment()).toBe('prod');
    });

    it('should return local for unknown environment', () => {
      process.env.STAGE = 'unknown';
      
      expect(getCurrentEnvironment()).toBe('local');
    });

    it('should return local when no environment variables are set', () => {
      delete process.env.NODE_ENV;
      delete process.env.STAGE;
      
      expect(getCurrentEnvironment()).toBe('local');
    });

    it('should prioritize STAGE over NODE_ENV', () => {
      process.env.NODE_ENV = 'development';
      process.env.STAGE = 'prod';
      
      expect(getCurrentEnvironment()).toBe('prod');
    });
  });
});