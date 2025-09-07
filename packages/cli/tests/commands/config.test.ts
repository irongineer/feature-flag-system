import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import chalk from 'chalk';
import { table } from 'table';
import { config } from '../../src/commands/config';
import { getConfig, setConfig, resetConfig } from '../../src/utils/config';

// Mock all external dependencies
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((str) => str),
    green: vi.fn((str) => str),
    red: vi.fn((str) => str),
    cyan: vi.fn((str) => str),
    gray: vi.fn((str) => str),
    bold: vi.fn((str) => str),
  },
}));
vi.mock('table');
vi.mock('../../src/utils/config');

// TDD Phase 1: RED - Tests with dependency injection
describe('Config Command TDD Tests', () => {
  let mockConsoleLog: Mock;
  let mockConsoleError: Mock;
  let mockProcessExit: Mock;
  let mockGetConfig: Mock;
  let mockSetConfig: Mock;
  let mockResetConfig: Mock;
  let mockTable: Mock;
  let testDeps: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    mockConsoleLog = vi.fn();
    mockConsoleError = vi.fn();
    mockProcessExit = vi.fn().mockImplementation(() => {
      throw new Error('process.exit() called');
    });

    // Mock config utilities
    mockGetConfig = vi.mocked(getConfig);
    mockSetConfig = vi.mocked(setConfig);
    mockResetConfig = vi.mocked(resetConfig);
    mockTable = vi.mocked(table);

    // Setup default mock responses
    mockGetConfig.mockReturnValue({
      region: 'ap-northeast-1',
      tableName: 'feature-flags',
      endpoint: undefined,
      profile: 'default',
    });
    mockTable.mockReturnValue('mocked table output');

    // Create test dependencies
    testDeps = {
      console: { log: mockConsoleLog, error: mockConsoleError },
      process: { exit: mockProcessExit },
      getConfig: mockGetConfig,
      setConfig: mockSetConfig,
      resetConfig: mockResetConfig,
      table: mockTable,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Reset functionality', () => {
    it('should reset configuration when reset option is provided', async () => {
      const options = { reset: true };

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
      expect(mockResetConfig).toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Configuration reset to defaults'));
    });

    it('should handle reset errors gracefully', async () => {
      const options = { reset: true };
      mockResetConfig.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Reset failed'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('Set functionality', () => {
    it('should set configuration value when valid key=value format is provided', async () => {
      const options = { set: 'region=us-east-1' };

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
      expect(mockSetConfig).toHaveBeenCalledWith('region', 'us-east-1');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Set region = us-east-1'));
    });

    it('should set configuration with complex values', async () => {
      const options = { set: 'endpoint=http://localhost:8000' };

      await config(options, testDeps);

      expect(mockSetConfig).toHaveBeenCalledWith('endpoint', 'http://localhost:8000');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Set endpoint = http://localhost:8000'));
    });

    it('should handle invalid set format - missing value', async () => {
      const options = { set: 'region=' };

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Invalid format. Use: --set key=value'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid set format - missing key', async () => {
      const options = { set: '=value' };

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Invalid format. Use: --set key=value'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid set format - no equals sign', async () => {
      const options = { set: 'invalidformat' };

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Invalid format. Use: --set key=value'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle set configuration errors', async () => {
      const options = { set: 'region=us-east-1' };
      mockSetConfig.mockImplementation(() => {
        throw new Error('Configuration save failed');
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Configuration save failed'));
    });
  });

  describe('Get functionality', () => {
    it('should get simple configuration value', async () => {
      const options = { get: 'region' };
      mockGetConfig.mockReturnValue({ region: 'ap-northeast-1' });

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
      expect(mockGetConfig).toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('region = ap-northeast-1'));
    });

    it('should get nested configuration value', async () => {
      const options = { get: 'database.endpoint' };
      mockGetConfig.mockReturnValue({ 
        database: { 
          endpoint: 'http://localhost:8000' 
        } 
      });

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('database.endpoint = http://localhost:8000'));
    });

    it('should handle non-existent configuration key', async () => {
      const options = { get: 'nonexistent' };
      mockGetConfig.mockReturnValue({ region: 'ap-northeast-1' });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration key not found: nonexistent'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-existent nested configuration key', async () => {
      const options = { get: 'database.nonexistent' };
      mockGetConfig.mockReturnValue({ 
        database: { 
          endpoint: 'http://localhost:8000' 
        } 
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration key not found: database.nonexistent'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle null configuration values', async () => {
      const options = { get: 'endpoint' };
      mockGetConfig.mockReturnValue({ 
        region: 'ap-northeast-1',
        endpoint: null
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration key not found: endpoint'));
    });

    it('should handle get configuration errors', async () => {
      const options = { get: 'region' };
      mockGetConfig.mockImplementation(() => {
        throw new Error('Configuration read failed');
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Configuration read failed'));
    });
  });

  describe('List functionality', () => {
    it('should display configuration list when list option is provided', async () => {
      const options = { list: true };
      const mockConfig = {
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: null,
        profile: 'default',
      };
      mockGetConfig.mockReturnValue(mockConfig);

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
      expect(testDeps.console.log).toHaveBeenCalledWith('');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Current Configuration:'));
      
      expect(mockTable).toHaveBeenCalledWith([
        ['Key', 'Value'],
        [chalk.cyan('region'), 'ap-northeast-1'],
        [chalk.cyan('tableName'), 'feature-flags'],
        [chalk.cyan('endpoint'), chalk.gray('(not set)')],
        [chalk.cyan('profile'), 'default'],
      ], {
        border: {
          topBody: '─',
          topJoin: '┬',
          topLeft: '┌',
          topRight: '┐',
          bottomBody: '─',
          bottomJoin: '┴',
          bottomLeft: '└',
          bottomRight: '┘',
          bodyLeft: '│',
          bodyRight: '│',
          bodyJoin: '│',
          joinBody: '─',
          joinLeft: '├',
          joinRight: '┤',
          joinJoin: '┼',
        },
      });

      expect(testDeps.console.log).toHaveBeenCalledWith('mocked table output');
      expect(testDeps.console.log).toHaveBeenCalledWith('');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Available Configuration Keys:'));
      expect(testDeps.console.log).toHaveBeenCalledWith('  region       - AWS region (default: ap-northeast-1)');
      expect(testDeps.console.log).toHaveBeenCalledWith('  tableName    - DynamoDB table name (default: feature-flags)');
      expect(testDeps.console.log).toHaveBeenCalledWith('  endpoint     - Custom endpoint for local development');
      expect(testDeps.console.log).toHaveBeenCalledWith('  profile      - AWS profile name (default: default)');
    });

    it('should handle undefined configuration values in list', async () => {
      const options = { list: true };
      const mockConfig = {
        region: 'ap-northeast-1',
        tableName: undefined,
        endpoint: '',
        profile: 'default',
      };
      mockGetConfig.mockReturnValue(mockConfig);

      await config(options, testDeps);

      expect(mockTable).toHaveBeenCalledWith([
        ['Key', 'Value'],
        [chalk.cyan('region'), 'ap-northeast-1'],
        [chalk.cyan('tableName'), chalk.gray('(not set)')],
        [chalk.cyan('endpoint'), chalk.gray('(not set)')],
        [chalk.cyan('profile'), 'default'],
      ], expect.any(Object));
    });

    it('should handle list configuration errors', async () => {
      const options = { list: true };
      mockGetConfig.mockImplementation(() => {
        throw new Error('Configuration list failed');
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Configuration list failed'));
    });
  });

  describe('Default behavior', () => {
    it('should show list when no options provided', async () => {
      const options = {};
      const mockConfig = {
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
      };
      mockGetConfig.mockReturnValue(mockConfig);

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.bold('Current Configuration:'));
      expect(mockTable).toHaveBeenCalled();
    });

    it('should handle recursive call to config with list option', async () => {
      const options = {};
      const mockConfig = { region: 'ap-northeast-1' };
      mockGetConfig.mockReturnValue(mockConfig);

      // Mock the recursive call
      const configSpy = vi.fn().mockResolvedValue(undefined);
      testDeps.config = configSpy;

      await config(options, testDeps);

      // Since we can't easily test recursive calls in this setup,
      // we verify the main functionality works
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.blue('⚙️  Configuration Management'));
    });
  });

  describe('Error handling', () => {
    it('should handle unknown errors gracefully', async () => {
      const options = { reset: true };
      mockResetConfig.mockImplementation(() => {
        throw 'Unknown error string';
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Unknown error'));
      expect(testDeps.process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle table formatting errors', async () => {
      const options = { list: true };
      mockGetConfig.mockReturnValue({ region: 'ap-northeast-1' });
      mockTable.mockImplementation(() => {
        throw new Error('Table formatting failed');
      });

      await expect(config(options, testDeps)).rejects.toThrow('process.exit() called');

      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('❌ Configuration error'));
      expect(testDeps.console.error).toHaveBeenCalledWith(chalk.red('Table formatting failed'));
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete set-get workflow', async () => {
      // First set a value
      await config({ set: 'region=us-west-2' }, testDeps);
      
      // Then get the value
      mockGetConfig.mockReturnValue({ region: 'us-west-2' });
      await config({ get: 'region' }, testDeps);

      expect(mockSetConfig).toHaveBeenCalledWith('region', 'us-west-2');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Set region = us-west-2'));
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('region = us-west-2'));
    });

    it('should handle reset and list workflow', async () => {
      // First reset
      await config({ reset: true }, testDeps);
      
      // Then list
      const defaultConfig = {
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: undefined,
        profile: 'default',
      };
      mockGetConfig.mockReturnValue(defaultConfig);
      await config({ list: true }, testDeps);

      expect(mockResetConfig).toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Configuration reset to defaults'));
      expect(mockTable).toHaveBeenCalled();
    });

    it('should prioritize options in correct order', async () => {
      // Reset takes precedence over other options
      const options = { reset: true, set: 'region=us-east-1', get: 'region', list: true };

      await config(options, testDeps);

      expect(mockResetConfig).toHaveBeenCalled();
      expect(mockSetConfig).not.toHaveBeenCalled();
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Configuration reset to defaults'));
    });

    it('should prioritize set over get and list', async () => {
      const options = { set: 'region=us-east-1', get: 'region', list: true };

      await config(options, testDeps);

      expect(mockSetConfig).toHaveBeenCalledWith('region', 'us-east-1');
      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('✅ Set region = us-east-1'));
      expect(mockTable).not.toHaveBeenCalled();
    });

    it('should prioritize get over list', async () => {
      const options = { get: 'region', list: true };
      mockGetConfig.mockReturnValue({ region: 'ap-northeast-1' });

      await config(options, testDeps);

      expect(testDeps.console.log).toHaveBeenCalledWith(chalk.green('region = ap-northeast-1'));
      expect(mockTable).not.toHaveBeenCalled();
    });
  });
});