import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { updateFlag } from '../../src/commands/update-flag';
import { getApiClient } from '../../src/utils/api-client';

// Mock all external dependencies
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((str) => str),
    green: vi.fn((str) => str),
    red: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
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
describe('UpdateFlag Command TDD Tests', () => {
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
      updateFlag: vi.fn(),
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
    };

    // Setup standard mock responses
    mockApiClient.updateFlag.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic functionality', () => {
    it('should update flag with all options provided', async () => {
      const options = {
        key: 'test_flag',
        description: 'Updated description',
        enabled: 'true',
        owner: 'new-owner'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('🔄 Updating feature flag'));
      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        description: 'Updated description',
        defaultEnabled: true,
        owner: 'new-owner',
      });
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Flag updated successfully'));
    });

    it('should update flag with partial options', async () => {
      const options = {
        key: 'test_flag',
        description: 'New description only'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        description: 'New description only',
      });
    });

    it('should handle enabled=false correctly', async () => {
      const options = {
        key: 'test_flag',
        enabled: 'false'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        defaultEnabled: false,
      });
    });

    it('should prompt for flag key when not provided', async () => {
      const options = {
        description: 'Updated description'
      };

      mockPrompt.mockResolvedValue({
        key: 'billing_v2_enable'
      });

      await updateFlag(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'key',
          message: 'Select flag to update:',
          choices: [
            { name: 'BILLING_V2 (billing_v2_enable)', value: 'billing_v2_enable' },
            { name: 'NEW_DASHBOARD (new_dashboard_enable)', value: 'new_dashboard_enable' },
            { name: 'TEST_FEATURE (test_flag)', value: 'test_flag' },
          ],
          when: true,
        }),
        expect.objectContaining({
          when: false, // description is provided
        }),
        expect.objectContaining({
          when: true, // enabled is not provided
        }),
        expect.objectContaining({
          when: true, // owner is not provided
        }),
      ]);
      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('billing_v2_enable', {
        description: 'Updated description',
      });
    });
  });

  describe('Interactive prompts', () => {
    it('should prompt for all missing fields', async () => {
      const options = {};

      mockPrompt.mockResolvedValue({
        key: 'test_flag',
        description: 'Prompted description',
        enabled: true,
        owner: 'prompted-owner'
      });

      await updateFlag(options, testDeps);

      expect(mockPrompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'key',
          when: true,
        }),
        expect.objectContaining({
          type: 'input',
          name: 'description',
          message: 'Enter new description (leave empty to skip):',
          when: true,
        }),
        expect.objectContaining({
          type: 'confirm',
          name: 'enabled',
          message: 'New default enabled state:',
          when: true,
        }),
        expect.objectContaining({
          type: 'input',
          name: 'owner',
          message: 'Enter new owner (leave empty to skip):',
          when: true,
        }),
      ]);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        description: 'Prompted description',
        defaultEnabled: true,
        owner: 'prompted-owner',
      });
    });

    it('should skip prompts for provided options', async () => {
      const options = {
        key: 'test_flag',
        description: 'Provided description',
        enabled: 'true',
        owner: 'provided-owner'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      const promptCall = mockPrompt.mock.calls[0][0];
      expect(promptCall.every((q: any) => q.when === false)).toBe(true);
    });

    it('should handle empty prompt responses gracefully', async () => {
      const options = {
        key: 'test_flag'
      };

      mockPrompt.mockResolvedValue({
        description: '', // empty description
        enabled: undefined, // no enabled state
        owner: '', // empty owner
      });

      await updateFlag(options, testDeps);

      // Should not call updateFlag with empty updates
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.yellow('No updates specified'));
      expect(mockApiClient.updateFlag).not.toHaveBeenCalled();
    });

    it('should handle mixed provided and prompted values', async () => {
      const options = {
        key: 'test_flag',
        description: 'Provided description',
        // enabled and owner will be prompted
      };

      mockPrompt.mockResolvedValue({
        enabled: false,
        owner: 'prompted-owner'
      });

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        description: 'Provided description',
        defaultEnabled: false,
        owner: 'prompted-owner',
      });
    });
  });

  describe('Update logic', () => {
    it('should only include non-empty updates', async () => {
      const options = {
        key: 'test_flag',
        description: 'Valid description',
        // enabled not provided
        owner: '', // empty owner should be ignored
      };

      mockPrompt.mockResolvedValue({
        enabled: undefined, // undefined enabled should be ignored
      });

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        description: 'Valid description',
        // owner and defaultEnabled should not be included
      });
    });

    it('should handle boolean enabled values correctly', async () => {
      const options = {
        key: 'test_flag',
      };

      mockPrompt.mockResolvedValue({
        enabled: true, // boolean true
      });

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        defaultEnabled: true,
      });
    });

    it('should handle string enabled values correctly', async () => {
      const options = {
        key: 'test_flag',
        enabled: 'false', // string 'false'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        defaultEnabled: false,
      });
    });

    it('should skip update when no changes are specified', async () => {
      const options = {
        key: 'test_flag',
      };

      mockPrompt.mockResolvedValue({
        description: '',
        enabled: undefined,
        owner: '',
      });

      await updateFlag(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.yellow('No updates specified'));
      expect(mockApiClient.updateFlag).not.toHaveBeenCalled();
      expect(mockSpinner.start).not.toHaveBeenCalled();
    });
  });

  describe('Results display', () => {
    it('should display updated flag information', async () => {
      const options = {
        key: 'billing_v2_enable',
        description: 'New billing system v2',
        enabled: 'true',
        owner: 'billing-team'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Updated flag:'));
      expect(testDeps.console.log).toHaveBeenCalledWith(`  Key: ${chalk.cyan('billing_v2_enable')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  description: New billing system v2`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  defaultEnabled: true`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  owner: billing-team`);
    });

    it('should only display updated fields', async () => {
      const options = {
        key: 'test_flag',
        description: 'Only description updated'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(`  description: Only description updated`);
      // Should not log other fields
      const logCalls = testDeps.console.log.mock.calls.map((call: any[]) => call[0]);
      expect(logCalls.some((call: string) => call.includes('defaultEnabled'))).toBe(false);
      expect(logCalls.some((call: string) => call.includes('owner'))).toBe(false);
    });

    it('should show spinner during update operation', async () => {
      const options = {
        key: 'test_flag',
        description: 'Test description'
      };

      mockPrompt.mockResolvedValue({});

      await updateFlag(options, testDeps);

      expect(testDeps.ora).toHaveBeenCalledWith('Updating flag...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Flag updated successfully'));
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const options = {
        key: 'test_flag',
        description: 'Test description'
      };

      mockPrompt.mockResolvedValue({});
      mockApiClient.updateFlag.mockRejectedValue(new Error('API connection failed'));

      await expect(updateFlag(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to update flag'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('API connection failed'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', async () => {
      const options = {
        key: 'test_flag',
        description: 'Test description'
      };

      mockPrompt.mockResolvedValue({});
      mockApiClient.updateFlag.mockRejectedValue('Unknown error string');

      await expect(updateFlag(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to update flag'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Unknown error'));
    });

    it('should handle prompt errors', async () => {
      const options = {};

      mockPrompt.mockRejectedValue(new Error('User cancelled prompt'));

      await expect(updateFlag(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to update flag'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('User cancelled prompt'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow with all prompts', async () => {
      const options = {};

      mockPrompt.mockResolvedValue({
        key: 'billing_v2_enable',
        description: 'Updated billing system',
        enabled: false,
        owner: 'new-billing-team'
      });

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('billing_v2_enable', {
        description: 'Updated billing system',
        defaultEnabled: false,
        owner: 'new-billing-team',
      });

      expect(testDeps.console.log).toHaveBeenCalledWith(`  Key: ${chalk.cyan('billing_v2_enable')}`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  description: Updated billing system`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  defaultEnabled: false`);
      expect(testDeps.console.log).toHaveBeenCalledWith(`  owner: new-billing-team`);
    });

    it('should handle partial update scenario', async () => {
      const options = {
        key: 'test_flag',
        enabled: 'true' // Only updating enabled state
      };

      mockPrompt.mockResolvedValue({
        description: '', // User chooses to skip description
        owner: '', // User chooses to skip owner
      });

      await updateFlag(options, testDeps);

      expect(mockApiClient.updateFlag).toHaveBeenCalledWith('test_flag', {
        defaultEnabled: true,
      });

      expect(testDeps.console.log).toHaveBeenCalledWith(`  defaultEnabled: true`);
      // Should not display empty fields
      const logCalls = testDeps.console.log.mock.calls.map((call: any[]) => call[0]);
      expect(logCalls.some((call: string) => call.includes('description:'))).toBe(false);
      expect(logCalls.some((call: string) => call.includes('owner:'))).toBe(false);
    });
  });
});