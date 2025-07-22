import { describe, it, expect, vi } from 'vitest';

/**
 * CLI Entry Point Basic Tests
 * 
 * 1Issue1PR原則に従った基本的な動作確認テスト
 * 小さな改善として、CLIの基本構造テストのみ実装
 */

// Mock inquirer to prevent interactive prompts during testing
vi.mock('inquirer', () => ({
  prompt: vi.fn().mockResolvedValue({}),
}));

// Mock API client to prevent network calls
vi.mock('../src/utils/api-client', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    evaluateFlag: vi.fn().mockResolvedValue({ enabled: false }),
    listFlags: vi.fn().mockResolvedValue([]),
    createFlag: vi.fn().mockResolvedValue({}),
    updateFlag: vi.fn().mockResolvedValue({}),
    deleteFlag: vi.fn().mockResolvedValue({}),
  })),
}));

describe('CLI Entry Point', () => {
  describe('Basic Module Structure', () => {
    describe('GIVEN CLI package structure', () => {
      describe('WHEN checking module availability', () => {
        it('THEN has basic CLI package structure', () => {
          // Given: CLI package is properly structured
          // When: Checking package configuration
          // Then: Should have valid package.json
          const packageJson = require('../package.json');
          expect(packageJson.name).toBe('@feature-flag/cli');
          expect(packageJson.scripts).toBeDefined();
          expect(packageJson.scripts.test).toBe('vitest run');
        });

        it('THEN has proper TypeScript configuration', () => {
          // Given: TypeScript project setup
          // When: Checking configuration files
          // Then: Should have tsconfig and package.json
          expect(() => require('../package.json')).not.toThrow();
          expect(() => require('../tsconfig.json')).not.toThrow();
        });
      });
    });
  });
});