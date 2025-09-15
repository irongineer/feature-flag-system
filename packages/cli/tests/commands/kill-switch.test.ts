import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { killSwitch } from '../../src/commands/kill-switch';
import { getApiClient } from '../../src/utils/api-client';

// Mock all external dependencies
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str) => str),
    green: vi.fn((str) => str),
    yellow: vi.fn((str) => str),
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
describe('KillSwitch Command TDD Tests', () => {
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
      activateKillSwitch: vi.fn(),
      deactivateKillSwitch: vi.fn(),
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
    mockApiClient.activateKillSwitch.mockResolvedValue({});
    mockApiClient.deactivateKillSwitch.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should activate kill-switch with all options provided', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test reason',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})  // other prompts (empty since all provided)
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.red('🚨 Kill-Switch Management'));
      expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith('test_flag', 'Test reason', 'admin');
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Kill-switch activated successfully'));
    });

    it('should deactivate kill-switch with all options provided', async () => {
      const options = {
        deactivate: true,
        key: 'test_flag',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})  // other prompts (empty since all provided)
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(mockApiClient.deactivateKillSwitch).toHaveBeenCalledWith('test_flag', 'admin');
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Kill-switch deactivated successfully'));
    });

    it('should prompt for action when neither activate nor deactivate is provided', async () => {
      const options = { key: 'test_flag', reason: 'Test reason', user: 'admin' };
      
      mockPrompt
        .mockResolvedValueOnce({ action: 'activate' })  // action selection
        .mockResolvedValueOnce({})  // other prompts (empty)
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'action',
          message: 'Select action:',
          choices: [
            { name: 'Activate Kill-Switch', value: 'activate' },
            { name: 'Deactivate Kill-Switch', value: 'deactivate' },
          ],
        }),
      ]);
      expect(mockApiClient.activateKillSwitch).toHaveBeenCalled();
    });

    it('should handle global scope when no key is provided', async () => {
      const options = {
        activate: true,
        reason: 'Test reason',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({ scope: 'global' })  // scope selection
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(undefined, 'Test reason', 'admin');
    });

    it('should handle specific flag scope', async () => {
      const options = {
        activate: true,
        reason: 'Test reason',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({ scope: 'flag', key: 'billing_v2_enable' })  // scope and flag
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith('billing_v2_enable', 'Test reason', 'admin');
    });
  });

  describe('Validation and prompting', () => {
    it('should validate required reason field', async () => {
      const options = { activate: true };
      
      mockPrompt
        .mockResolvedValueOnce({ 
          scope: 'global',
          reason: 'Emergency fix',
          user: 'emergency-admin'
        })
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      const reasonPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'reason');
      expect(reasonPrompt.validate('')).toBe('Reason is required');
      expect(reasonPrompt.validate('Valid reason')).toBe(true);
    });

    it('should validate required user field', async () => {
      const options = { activate: true };
      
      mockPrompt
        .mockResolvedValueOnce({ 
          scope: 'global',
          reason: 'Emergency fix',
          user: 'emergency-admin'
        })
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      const userPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'user');
      expect(userPrompt.validate('')).toBe('Username is required');
      expect(userPrompt.validate('valid-user')).toBe(true);
    });

    it('should show flag choices when scope is flag', async () => {
      const options = { activate: true, reason: 'Test reason', user: 'admin' };
      
      mockPrompt
        .mockResolvedValueOnce({ scope: 'flag', key: 'billing_v2_enable' })
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      const flagPrompt = mockPrompt.mock.calls[0][0].find((q: any) => q.name === 'key');
      expect(flagPrompt.choices).toEqual([
        { name: 'BILLING_V2 (billing_v2_enable)', value: 'billing_v2_enable' },
        { name: 'NEW_DASHBOARD (new_dashboard_enable)', value: 'new_dashboard_enable' },
        { name: 'TEST_FEATURE (test_flag)', value: 'test_flag' },
      ]);
    });
  });

  describe('Confirmation and execution', () => {
    it('should display operation summary before confirmation', async () => {
      const options = {
        activate: true,
        key: 'billing_v2_enable',
        reason: 'Security incident',
        user: 'security-team'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})  // other prompts (empty)
        .mockResolvedValueOnce({ confirm: true });  // confirmation

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('⚠️  Kill-Switch Operation Summary:'));
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Action: ${chalk.red('ACTIVATE')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Scope: ${chalk.yellow('flag: billing_v2_enable')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Reason: Security incident`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  User: security-team`);
    });

    it('should show warning for activate operations', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(
        chalk.red('⚠️  WARNING: This will immediately disable the feature(s) for all users!')
      );
    });

    it('should cancel operation when user declines confirmation', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: false });

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.yellow('Operation cancelled'));
      expect(mockApiClient.activateKillSwitch).not.toHaveBeenCalled();
      expect(mockApiClient.deactivateKillSwitch).not.toHaveBeenCalled();
    });

    it('should execute operation when confirmed', async () => {
      const options = {
        activate: true,
        key: 'billing_v2_enable',
        reason: 'Critical bug',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(testDeps.ora).toHaveBeenCalledWith('Activating kill-switch...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith('billing_v2_enable', 'Critical bug', 'admin');
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Kill-switch activated successfully'));
    });
  });

  describe('Results display', () => {
    it('should display activation results correctly', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Operation completed:'));
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Status: ${chalk.red('ACTIVE')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Scope: flag: test_flag`);
      expect(testDeps.console.log).toHaveBeenCalledWith('  Timestamp: 2024-01-01T12:00:00.000Z');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.red('🚨 Kill-switch is now ACTIVE'));
      expect(testDeps.console.log).toHaveBeenCalledWith(
        chalk.yellow('Features will be disabled until the kill-switch is deactivated')
      );
    });

    it('should display deactivation results correctly', async () => {
      const options = {
        deactivate: true,
        user: 'admin'  // Global deactivation
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Status: ${chalk.green('INACTIVE')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Scope: GLOBAL`);
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Kill-switch is now INACTIVE'));
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('Features will resume normal operation'));
    });
  });

  describe('Error handling', () => {
    it('should handle API errors during activation', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });
      mockApiClient.activateKillSwitch.mockRejectedValue(new Error('API connection failed'));

      await expect(killSwitch(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Kill-switch operation failed'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('API connection failed'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', async () => {
      const options = {
        activate: true,
        key: 'test_flag',
        reason: 'Test',
        user: 'admin'
      };
      
      mockPrompt
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ confirm: true });
      mockApiClient.activateKillSwitch.mockRejectedValue('Unknown error string');

      await expect(killSwitch(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Kill-switch operation failed'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Unknown error'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete flow with prompts and global activation', async () => {
      const options = {};
      
      mockPrompt
        .mockResolvedValueOnce({ action: 'activate' })
        .mockResolvedValueOnce({
          scope: 'global',
          reason: 'System maintenance',
          user: 'ops-team'
        })
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(mockApiClient.activateKillSwitch).toHaveBeenCalledWith(undefined, 'System maintenance', 'ops-team');
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Scope: ${chalk.yellow('GLOBAL')}`);
    });

    it('should handle complete flow with specific flag deactivation', async () => {
      const options = {};
      
      mockPrompt
        .mockResolvedValueOnce({ action: 'deactivate' })
        .mockResolvedValueOnce({
          scope: 'flag',
          key: 'billing_v2_enable',
          user: 'admin'
        })
        .mockResolvedValueOnce({ confirm: true });

      await killSwitch(options, testDeps);

      expect(mockApiClient.deactivateKillSwitch).toHaveBeenCalledWith('billing_v2_enable', 'admin');
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Scope: ${chalk.yellow('flag: billing_v2_enable')}`);
    });
  });
});