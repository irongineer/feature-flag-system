import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { listFlags } from '../../src/commands/list-flags';
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
vi.mock('table');
vi.mock('../../src/utils/api-client');

// TDD Phase 1: RED - Tests with dependency injection
describe('ListFlags Command TDD Tests', () => {
  let mockSpinner: any;
  let mockApiClient: any;
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
      listFlags: vi.fn(),
      listTenantOverrides: vi.fn(),
    };

    // Mock console methods
    mockConsoleLog = vi.fn();
    mockConsoleError = vi.fn();
    mockProcessExit = vi.fn().mockImplementation(() => {
      throw new Error('process.exit() called');
    });

    // Mock table function
    vi.mocked(table).mockReturnValue('mocked-table-output');

    // Create test dependencies
    testDeps = {
      console: { log: mockConsoleLog, error: mockConsoleError },
      ora: vi.fn().mockReturnValue(mockSpinner),
      process: { exit: mockProcessExit },
      apiClient: mockApiClient,
      table: vi.mocked(table),
      Date: vi.fn().mockImplementation(() => ({ 
        toLocaleDateString: () => '1/1/2024' 
      })),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic flag listing', () => {
    it('should list flags in table format by default', async () => {
      const options = {};
      const mockFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'New billing system',
          defaultEnabled: true,
          owner: 'admin',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          flagKey: 'feature_x',
          description: 'Feature X implementation',
          defaultEnabled: false,
          owner: 'dev-team',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);

      await listFlags(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('📋 Listing feature flags'));
      expect(testDeps.ora).toHaveBeenCalledWith('Fetching flags...');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockApiClient.listFlags).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Found 2 flags'));
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Feature Flags:'));
      expect(testDeps.table).toHaveBeenCalled();
    });

    it('should list flags in JSON format when requested', async () => {
      const options = { format: 'json' as const };
      const mockFlags = [
        {
          flagKey: 'test_flag',
          description: 'Test flag',
          defaultEnabled: true,
          owner: 'admin',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);

      await listFlags(options, testDeps);

      expect(mockApiClient.listFlags).toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(
        JSON.stringify({ flags: mockFlags, tenantOverrides: [] }, null, 2)
      );
      // Should not call table function in JSON mode
      expect(testDeps.table).not.toHaveBeenCalled();
    });

    it('should handle empty flags list', async () => {
      const options = {};
      mockApiClient.listFlags.mockResolvedValue([]);

      await listFlags(options, testDeps);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(chalk.green('✅ Found 0 flags'));
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.yellow('No flags found'));
      expect(testDeps.table).not.toHaveBeenCalled();
    });
  });

  describe('Tenant override functionality', () => {
    it('should fetch and display tenant overrides when tenant is specified', async () => {
      const options = { tenant: 'tenant-123' };
      const mockFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'New billing system',
          defaultEnabled: false,
          owner: 'admin',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      const mockOverrides = [
        {
          SK: 'FLAG#billing_v2_enable',
          enabled: true,
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);
      mockApiClient.listTenantOverrides.mockResolvedValue(mockOverrides);

      await listFlags(options, testDeps);

      expect(mockApiClient.listTenantOverrides).toHaveBeenCalledWith('tenant-123');
      expect(testDeps.console.log).toHaveBeenCalledWith(
        chalk.gray('Showing overrides for tenant: tenant-123')
      );
    });

    it('should display tenant override in JSON format', async () => {
      const options = { tenant: 'tenant-123', format: 'json' as const };
      const mockFlags = [{ flagKey: 'test_flag' }];
      const mockOverrides = [{ SK: 'FLAG#test_flag', enabled: true }];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);
      mockApiClient.listTenantOverrides.mockResolvedValue(mockOverrides);

      await listFlags(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(
        JSON.stringify({ flags: mockFlags, tenantOverrides: mockOverrides }, null, 2)
      );
    });

    it('should handle tenant overrides in table format', async () => {
      const options = { tenant: 'tenant-123' };
      const mockFlags = [
        {
          flagKey: 'billing_v2_enable',
          description: 'New billing system',
          defaultEnabled: false,
          owner: 'admin',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          flagKey: 'feature_x',
          description: 'Feature X',
          defaultEnabled: true,
          owner: 'dev',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];
      const mockOverrides = [
        {
          SK: 'FLAG#billing_v2_enable',
          enabled: true,
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);
      mockApiClient.listTenantOverrides.mockResolvedValue(mockOverrides);

      await listFlags(options, testDeps);

      // Check that table is called with headers including tenant override column
      const tableCall = testDeps.table.mock.calls[0][0];
      const headers = tableCall[0];
      expect(headers).toContain('Tenant Override');
    });
  });

  describe('Table formatting', () => {
    it('should format flags data correctly for table display', async () => {
      const options = {};
      const mockFlags = [
        {
          flagKey: 'very_long_flag_key_name',
          description: 'This is a very long description that should be truncated for table display',
          defaultEnabled: true,
          owner: 'admin-team',
          createdAt: '2024-01-01T12:00:00.000Z',
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);

      await listFlags(options, testDeps);

      const tableCall = testDeps.table.mock.calls[0][0];
      const dataRow = tableCall[1]; // First data row after headers

      expect(dataRow[0]).toBe(chalk.cyan('very_long_flag_key_name'));
      expect(dataRow[1]).toContain('...');  // Description should be truncated
      expect(dataRow[2]).toBe(chalk.green('ON'));
      expect(dataRow[3]).toBe('admin-team');
      expect(dataRow[4]).toBe('1/1/2024');
    });

    it('should not truncate short descriptions', async () => {
      const options = {};
      const mockFlags = [
        {
          flagKey: 'short_flag',
          description: 'Short desc',
          defaultEnabled: false,
          owner: 'dev',
          createdAt: '2024-01-01T12:00:00.000Z',
        },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);

      await listFlags(options, testDeps);

      const tableCall = testDeps.table.mock.calls[0][0];
      const dataRow = tableCall[1];

      expect(dataRow[1]).toBe('Short desc');
      expect(dataRow[2]).toBe(chalk.red('OFF'));
    });

    it('should apply correct table border configuration', async () => {
      const options = {};
      mockApiClient.listFlags.mockResolvedValue([
        {
          flagKey: 'test',
          description: 'test',
          defaultEnabled: true,
          owner: 'admin',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ]);

      await listFlags(options, testDeps);

      const tableOptions = testDeps.table.mock.calls[0][1];
      expect(tableOptions.border.topBody).toBe('─');
      expect(tableOptions.border.topLeft).toBe('┌');
      expect(tableOptions.border.bodyLeft).toBe('│');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const options = {};
      const apiError = new Error('DynamoDB connection failed');
      mockApiClient.listFlags.mockRejectedValue(apiError);

      await expect(listFlags(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to list flags'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('DynamoDB connection failed'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle unknown errors', async () => {
      const options = {};
      mockApiClient.listFlags.mockRejectedValue('Unknown error string');

      await expect(listFlags(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to list flags'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Unknown error'));
    });

    it('should handle tenant override API errors', async () => {
      const options = { tenant: 'tenant-123' };
      mockApiClient.listFlags.mockResolvedValue([{ flagKey: 'test' }]);
      mockApiClient.listTenantOverrides.mockRejectedValue(new Error('Tenant API failed'));

      await expect(listFlags(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Failed to list flags'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Tenant API failed'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete flow with multiple flags and tenant overrides', async () => {
      const options = { tenant: 'tenant-456', format: 'table' as const };
      const mockFlags = [
        {
          flagKey: 'flag_a',
          description: 'Flag A description',
          defaultEnabled: true,
          owner: 'team-a',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          flagKey: 'flag_b',
          description: 'Flag B description',
          defaultEnabled: false,
          owner: 'team-b',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];
      const mockOverrides = [
        { SK: 'FLAG#flag_a', enabled: false },
      ];

      mockApiClient.listFlags.mockResolvedValue(mockFlags);
      mockApiClient.listTenantOverrides.mockResolvedValue(mockOverrides);

      await listFlags(options, testDeps);

      expect(mockApiClient.listFlags).toHaveBeenCalled();
      expect(mockApiClient.listTenantOverrides).toHaveBeenCalledWith('tenant-456');
      expect(testDeps.table).toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(
        chalk.gray('Showing overrides for tenant: tenant-456')
      );
    });
  });
});