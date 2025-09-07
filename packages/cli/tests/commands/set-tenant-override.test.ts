import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { setTenantOverride } from '../../src/commands/set-tenant-override';
import { getApiClient } from '../../src/utils/api-client';

// Mock all external dependencies
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((str) => str),
    green: vi.fn((str) => str),
    red: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
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

// TDD Phase 1: RED - Tests with dependency injection
describe('SetTenantOverride Command TDD Tests', () => {
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
      setTenantOverride: vi.fn(),
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

    // Setup standard mock responses
    mockApiClient.setTenantOverride.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should set tenant override with all options provided', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('🎯 Setting tenant override'));
      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'billing_v2_enable', true, 'admin');
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Tenant override set successfully'));
    });

    it('should handle enabled=false correctly', async () => {
      const options = {
        tenant: 'tenant-456',
        key: 'test_flag',
        enabled: 'false',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-456', 'test_flag', false, 'admin');
    });

    it('should handle boolean enabled values from prompts', async () => {
      const options = {
        tenant: 'tenant-789',
        key: 'test_flag',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({
        enabled: true  // boolean from confirm prompt
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-789', 'test_flag', true, 'admin');
    });

    it('should prompt for all missing required fields', async () => {
      const options = {};

      mockPrompt.mockResolvedValue({
        tenant: 'tenant-abc',
        key: 'billing_v2_enable',
        enabled: false,
        user: 'test-user'
      });

      await setTenantOverride(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'tenant',
          message: 'Enter tenant ID:',
          when: true,
        }),
        expect.objectContaining({
          type: 'list',
          name: 'key',
          message: 'Select flag:',
          choices: [
            { name: 'BILLING_V2 (billing_v2_enable)', value: 'billing_v2_enable' },
            { name: 'NEW_DASHBOARD (new_dashboard_enable)', value: 'new_dashboard_enable' },
            { name: 'TEST_FEATURE (test_flag)', value: 'test_flag' },
          ],
          when: true,
        }),
        expect.objectContaining({
          type: 'confirm',
          name: 'enabled',
          message: 'Enable for this tenant:',
          when: true,
        }),
        expect.objectContaining({
          type: 'input',
          name: 'user',
          message: 'Enter your username:',
          when: true,
        }),
      ]);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-abc', 'billing_v2_enable', false, 'test-user');
    });
  });

  describe('Input validation', () => {
    it('should validate tenant ID input', async () => {
      const options = {
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({
        tenant: 'valid-tenant-id'
      });

      await setTenantOverride(options, testDeps);

      const tenantPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'tenant');
      expect(tenantPrompt.validate('')).toBe('Tenant ID is required');
      expect(tenantPrompt.validate('valid-tenant')).toBe(true);
    });

    it('should validate username input', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true'
      };

      mockPrompt.mockResolvedValue({
        user: 'valid-username'
      });

      await setTenantOverride(options, testDeps);

      const userPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'user');
      expect(userPrompt.validate('')).toBe('Username is required');
      expect(userPrompt.validate('valid-user')).toBe(true);
    });

    it('should skip prompts for provided options', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      const promptCall = mockPrompt.mock.calls[0][0];
      expect(promptCall.every((q: any) => q.when === false)).toBe(true);
    });

    it('should show flag choices when key is not provided', async () => {
      const options = {
        tenant: 'tenant-123',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({
        key: 'new_dashboard_enable'
      });

      await setTenantOverride(options, testDeps);

      const flagPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'key');
      expect(flagPrompt.choices).toEqual([
        { name: 'BILLING_V2 (billing_v2_enable)', value: 'billing_v2_enable' },
        { name: 'NEW_DASHBOARD (new_dashboard_enable)', value: 'new_dashboard_enable' },
        { name: 'TEST_FEATURE (test_flag)', value: 'test_flag' },
      ]);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'new_dashboard_enable', true, 'admin');
    });
  });

  describe('Results display', () => {
    it('should display tenant override information for enabled state', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        enabled: 'true',
        user: 'admin-user'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Tenant override set:'));
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Tenant: ${chalk.cyan('tenant-123')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Flag: ${chalk.cyan('billing_v2_enable')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Enabled: ${chalk.green('true')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Updated by: admin-user`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Timestamp: 2024-01-01T12:00:00.000Z`);
    });

    it('should display tenant override information for disabled state', async () => {
      const options = {
        tenant: 'tenant-456',
        key: 'test_flag',
        enabled: 'false',
        user: 'dev-user'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Enabled: ${chalk.red('false')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Updated by: dev-user`);
    });

    it('should show spinner during API operation', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(testDeps.ora).toHaveBeenCalledWith('Setting tenant override...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Tenant override set successfully'));
    });
  });

  describe('Enabled value handling', () => {
    it('should handle string "true" as boolean true', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'test_flag', true, 'admin');
    });

    it('should handle string "false" as boolean false', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'false',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'test_flag', false, 'admin');
    });

    it('should handle boolean true from prompt', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({
        enabled: true
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'test_flag', true, 'admin');
    });

    it('should handle boolean false from prompt', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({
        enabled: false
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'test_flag', false, 'admin');
    });

    it('should handle mixed options and prompts correctly', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'billing_v2_enable',
        // enabled and user will be prompted
      };

      mockPrompt.mockResolvedValue({
        enabled: false,
        user: 'prompted-user'
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('tenant-123', 'billing_v2_enable', false, 'prompted-user');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});
      mockApiClient.setTenantOverride.mockRejectedValue(new Error('API connection failed'));

      await expect(setTenantOverride(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to set tenant override'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('API connection failed'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});
      mockApiClient.setTenantOverride.mockRejectedValue('Unknown error string');

      await expect(setTenantOverride(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to set tenant override'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Unknown error'));
    });

    it('should handle prompt errors', async () => {
      const options = {};

      mockPrompt.mockRejectedValue(new Error('User cancelled prompt'));

      await expect(setTenantOverride(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to set tenant override'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('User cancelled prompt'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow with all prompts', async () => {
      const options = {};

      mockPrompt.mockResolvedValue({
        tenant: 'integration-tenant',
        key: 'new_dashboard_enable',
        enabled: true,
        user: 'integration-user'
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('integration-tenant', 'new_dashboard_enable', true, 'integration-user');

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Tenant: ${chalk.cyan('integration-tenant')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Flag: ${chalk.cyan('new_dashboard_enable')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Enabled: ${chalk.green('true')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Updated by: integration-user`);
    });

    it('should handle partial options scenario', async () => {
      const options = {
        tenant: 'partial-tenant',
        enabled: 'false'
        // key and user will be prompted
      };

      mockPrompt.mockResolvedValue({
        key: 'test_flag',
        user: 'partial-user'
      });

      await setTenantOverride(options, testDeps);

      expect(mockApiClient.setTenantOverride).toHaveBeenCalledWith('partial-tenant', 'test_flag', false, 'partial-user');

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Tenant: ${chalk.cyan('partial-tenant')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Flag: ${chalk.cyan('test_flag')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Enabled: ${chalk.red('false')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Updated by: partial-user`);
    });

    it('should display correct timestamp', async () => {
      const options = {
        tenant: 'tenant-123',
        key: 'test_flag',
        enabled: 'true',
        user: 'admin'
      };

      mockPrompt.mockResolvedValue({});

      await setTenantOverride(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Timestamp: 2024-01-01T12:00:00.000Z`);
    });
  });
});