import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { evaluate } from '../../src/commands/evaluate';
import { getApiClient } from '../../src/utils/api-client';

// Mock all external dependencies
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((str) => str),
    green: vi.fn((str) => str),
    red: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
    gray: vi.fn((str) => str),
    bold: vi.fn((str) => str),
  },
}));
vi.mock('ora');
vi.mock('inquirer');
vi.mock('@feature-flag/core', () => ({
  FEATURE_FLAGS: {
    BILLING_V2: 'billing_v2_enable',
    NEW_DASHBOARD: 'new_dashboard_enable',
    TEST_FEATURE: 'test_flag',
  },
}));
vi.mock('../../src/utils/api-client');

// TDD Phase 1: RED - Tests will fail initially
describe('Evaluate Command TDD Tests', () => {
  let mockSpinner: any;
  let mockApiClient: any;
  let mockPrompt: Mock;
  let mockConsoleLog: Mock;
  let mockConsoleError: Mock;
  let mockProcessExit: Mock;
  let testDeps: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock external dependencies
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn(),
      fail: vi.fn(),
    };

    // Mock API client
    mockApiClient = {
      evaluateFlag: vi.fn(),
    };

    // Mock inquirer
    mockPrompt = vi.fn();

    // Mock console methods
    mockConsoleLog = vi.fn();
    mockConsoleError = vi.fn();
    mockProcessExit = vi.fn().mockImplementation(() => {
      throw new Error('process.exit() called');
    });

    // Create test dependencies
    testDeps = {
      console: { log: mockConsoleLog, error: mockConsoleError },
      inquirer: { prompt: mockPrompt },
      ora: vi.fn().mockReturnValue(mockSpinner),
      process: { exit: mockProcessExit },
      apiClient: mockApiClient,
      Date: vi.fn().mockImplementation(() => ({ toISOString: () => '2024-01-01T12:00:00.000Z' })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input validation and prompting', () => {
    it('should prompt for missing tenant ID', async () => {
      const options = { key: 'test_flag', user: 'user1', environment: 'development' };
      
      mockPrompt.mockResolvedValue({ tenant: 'tenant-123' });
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'tenant',
          message: 'Enter tenant ID:',
          when: true, // options.tenant is undefined
        }),
        expect.objectContaining({
          when: false, // options.key is provided
        }),
        expect.objectContaining({
          when: false, // options.user is provided
        }),
        expect.objectContaining({
          when: false, // options.environment is provided
        }),
      ]);
    });

    it('should prompt for missing flag key with FEATURE_FLAGS choices', async () => {
      const options = { tenant: 'tenant-123', user: 'user1', environment: 'development' };
      
      mockPrompt.mockResolvedValue({ key: 'billing_v2_enable' });
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: false, reason: 'Tenant override' });

      await evaluate(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'key',
            message: 'Select flag to evaluate:',
            choices: expect.arrayContaining([
              expect.objectContaining({
                name: expect.stringContaining('('),
                value: expect.any(String),
              }),
            ]),
            when: true,
          }),
        ])
      );
    });

    it('should validate tenant ID input', async () => {
      const options = {};
      
      mockPrompt.mockResolvedValue({
        tenant: 'tenant-123',
        key: 'test_flag',
        user: '',
        environment: 'development',
      });
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      const promptCall = mockPrompt.mock.calls[0][0];
      const tenantPrompt = promptCall.find((q: any) => q.name === 'tenant');
      
      expect(tenantPrompt.validate('')).toBe('Tenant ID is required');
      expect(tenantPrompt.validate('valid-tenant')).toBe(true);
    });

    it('should provide environment choices', async () => {
      const options = { tenant: 'tenant-123', key: 'test_flag', user: 'user1' };
      
      mockPrompt.mockResolvedValue({ environment: 'production' });
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      const promptCall = mockPrompt.mock.calls[0][0];
      const envPrompt = promptCall.find((q: any) => q.name === 'environment');
      
      expect(envPrompt.choices).toEqual(['development', 'staging', 'production']);
      expect(envPrompt.default).toBe('development');
    });

    it('should not prompt when all options are provided', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        user: 'user1',
        environment: 'production',
      };
      
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      // Should call prompt with all when: false
      const promptCall = mockPrompt.mock.calls[0][0];
      expect(promptCall.every((q: any) => q.when === false)).toBe(true);
    });
  });

  describe('API client integration', () => {
    it('should call evaluateFlag with correct parameters', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        user: 'user1',
        environment: 'production',
      };
      
      mockApiClient.evaluateFlag.mockResolvedValue({
        enabled: true,
        reason: 'Tenant override',
      });

      await evaluate(options, testDeps);

      expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith('tenant-123', 'billing_v2_enable');
    });

    it('should start and succeed spinner during API call', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'user1',
        environment: 'development',
      };
      
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: false, reason: 'Kill-switch active' });

      await evaluate(options, testDeps);

      expect(testDeps.ora).toHaveBeenCalledWith('Evaluating flag...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Flag evaluated successfully'));
    });
  });

  describe('Results display', () => {
    it('should display evaluation results for enabled flag', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        user: 'user1',
        environment: 'production',
      };
      
      const mockResult = {
        enabled: true,
        reason: 'Tenant override',
      };
      mockApiClient.evaluateFlag.mockResolvedValue(mockResult);

      await evaluate(options, testDeps);

      // Check that results are logged
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.bold('Evaluation Result:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Tenant: ${chalk.cyan('tenant-123')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Flag: ${chalk.cyan('billing_v2_enable')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  User: user1`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Environment: production`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Result: ${chalk.green('ENABLED')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Reason: ${chalk.yellow('Tenant override')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.green('🎉 Feature is enabled for this tenant'));
    });

    it('should display evaluation results for disabled flag', async () => {
      const options = {
        tenant: 'tenant-456',
        key: 'test_flag',
        user: 'user2',
        environment: 'development',
      };
      
      const mockResult = {
        enabled: false,
        reason: 'Kill-switch active',
      };
      mockApiClient.evaluateFlag.mockResolvedValue(mockResult);

      await evaluate(options, testDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith(`  Result: ${chalk.red('DISABLED')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Reason: ${chalk.yellow('Kill-switch active')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.red('🚫 Feature is disabled for this tenant'));
    });

    it('should handle optional user display', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        environment: 'development',
        // user is not provided
      };
      
      mockPrompt.mockResolvedValue({ user: '' }); // Empty user input
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith(`  User: ${chalk.gray('(not specified)')}`);
    });

    it('should display current timestamp', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'user1',
        environment: 'development',
      };
      
      const mockDate = new Date('2024-01-01T12:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      mockApiClient.evaluateFlag.mockResolvedValue({ enabled: true, reason: 'Default value' });

      await evaluate(options, testDeps);

      expect(mockConsoleLog).toHaveBeenCalledWith(`  Evaluated at: 2024-01-01T12:00:00.000Z`);
    });
  });

  describe('Error handling', () => {
    it('should handle API client errors gracefully', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'user1',
        environment: 'development',
      };
      
      const apiError = new Error('DynamoDB connection failed');
      mockApiClient.evaluateFlag.mockRejectedValue(apiError);

      await expect(evaluate(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('❌ Failed to evaluate flag'));
      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('DynamoDB connection failed'));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'user1',
        environment: 'development',
      };
      
      mockApiClient.evaluateFlag.mockRejectedValue('Unknown error string');

      await expect(evaluate(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('❌ Failed to evaluate flag'));
      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('Unknown error'));
    });

    it('should handle inquirer prompt errors', async () => {
      const options = {};
      
      const promptError = new Error('User cancelled prompt');
      mockPrompt.mockRejectedValue(promptError);

      await expect(evaluate(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('❌ Failed to evaluate flag'));
      expect(mockConsoleError).toHaveBeenCalledWith(chalk.red('User cancelled prompt'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete evaluation flow with prompts', async () => {
      const options = {}; // No options provided
      
      mockPrompt.mockResolvedValue({
        tenant: 'tenant-789',
        key: 'billing_v2_enable',
        user: 'test-user',
        environment: 'staging',
      });
      
      mockApiClient.evaluateFlag.mockResolvedValue({
        enabled: true,
        reason: 'Default value',
      });

      await evaluate(options, testDeps);

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith('tenant-789', 'billing_v2_enable');
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Tenant: ${chalk.cyan('tenant-789')}`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Environment: staging`);
    });

    it('should handle mixed provided and prompted options', async () => {
      const options = {
        tenant: 'tenant-123',
        environment: 'production',
        // key and user will be prompted
      };
      
      mockPrompt.mockResolvedValue({
        key: 'test_flag',
        user: 'prompted-user',
      });
      
      mockApiClient.evaluateFlag.mockResolvedValue({
        enabled: false,
        reason: 'Kill-switch active',
      });

      await evaluate(options, testDeps);

      expect(mockApiClient.evaluateFlag).toHaveBeenCalledWith('tenant-123', 'test_flag');
      expect(mockConsoleLog).toHaveBeenCalledWith(`  User: prompted-user`);
      expect(mockConsoleLog).toHaveBeenCalledWith(`  Environment: production`);
    });
  });
});