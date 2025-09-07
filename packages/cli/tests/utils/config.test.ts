import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import path from 'path';
import { 
  getConfig, 
  setConfig, 
  saveConfig, 
  resetConfig, 
  ConfigDependencies,
  FileSystemDeps,
  SystemDeps 
} from '../../src/utils/config';

// TDD Phase 2: GREEN - Tests with dependency injection
describe('Config Utility TDD Tests', () => {
  const mockHomedir = '/tmp/test-home';
  const mockConfigDir = path.join(mockHomedir, '.feature-flag');
  const mockConfigFile = path.join(mockConfigDir, 'config.json');

  let mockFs: FileSystemDeps;
  let mockOs: SystemDeps;
  let testDeps: ConfigDependencies;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock dependencies
    mockFs = {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn(),
    };

    mockOs = {
      homedir: vi.fn().mockReturnValue(mockHomedir),
    };

    testDeps = {
      fs: mockFs,
      os: mockOs,
    };

    // Suppress console warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  describe('getConfig', () => {
    it('should return default config when config file does not exist', () => {
      // GREEN: Now works with dependency injection
      mockFs.existsSync.mockReturnValue(false);

      const config = getConfig(testDeps);

      expect(config).toEqual({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: undefined,
        profile: 'default',
      });

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigFile);
    });

    it('should merge config file with defaults when file exists', () => {
      const configFileContent = {
        region: 'us-west-2',
        tableName: 'custom-feature-flags',
        endpoint: 'http://localhost:8000',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configFileContent));

      const config = getConfig(testDeps);

      expect(config).toEqual({
        region: 'us-west-2',
        tableName: 'custom-feature-flags',
        endpoint: 'http://localhost:8000',
        profile: 'default', // Should merge with default
      });

      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockConfigFile, 'utf8');
    });

    it('should return default config and warn when config file is corrupted', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid-json');

      const config = getConfig(testDeps);

      expect(config).toEqual({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: undefined,
        profile: 'default',
      });

      expect(console.warn).toHaveBeenCalledWith(
        'Warning: Could not read config file, using defaults'
      );
    });

    it('should handle file read errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const config = getConfig(testDeps);

      expect(config).toEqual({
        region: 'ap-northeast-1',
        tableName: 'feature-flags',
        endpoint: undefined,
        profile: 'default',
      });

      expect(console.warn).toHaveBeenCalled();
    });

    it('should work without dependency injection (backward compatibility)', () => {
      // Test original function without deps parameter
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.region).toBeDefined();
    });
  });

  describe('setConfig', () => {
    beforeEach(() => {
      // Setup base config for modification tests
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          region: 'ap-northeast-1',
          tableName: 'feature-flags',
          endpoint: undefined,
          profile: 'default',
        })
      );
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.mkdirSync.mockImplementation(() => {});
    });

    it('should set simple config value', () => {
      setConfig('region', 'us-east-1', testDeps);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        expect.stringContaining('"region": "us-east-1"')
      );
    });

    it('should set nested config value', () => {
      setConfig('aws.region', 'eu-west-1', testDeps);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1] as string);

      expect(writtenConfig.aws).toEqual({ region: 'eu-west-1' });
    });

    it('should create missing intermediate objects for nested keys', () => {
      setConfig('deep.nested.value', 'test-value', testDeps);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1] as string);

      expect(writtenConfig.deep.nested.value).toBe('test-value');
    });
  });

  describe('saveConfig', () => {
    it('should create config directory if it does not exist', () => {
      const testConfig = {
        region: 'ap-northeast-1',
        tableName: 'test-flags',
        endpoint: 'http://localhost:8000',
        profile: 'test',
      };

      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      saveConfig(testConfig, testDeps);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        JSON.stringify(testConfig, null, 2)
      );
    });

    it('should save config without creating directory if it exists', () => {
      const testConfig = {
        region: 'us-west-2',
        tableName: 'existing-flags',
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      saveConfig(testConfig, testDeps);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        JSON.stringify(testConfig, null, 2)
      );
    });

    it('should throw error when config cannot be saved', () => {
      const testConfig = {
        region: 'ap-northeast-1',
        tableName: 'test-flags',
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      expect(() => saveConfig(testConfig, testDeps)).toThrow('Could not save config: Disk full');
    });

    it('should handle unknown errors during save', () => {
      const testConfig = {
        region: 'ap-northeast-1',
        tableName: 'test-flags',
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw 'Non-Error object';
      });

      expect(() => saveConfig(testConfig, testDeps)).toThrow('Could not save config: Unknown error');
    });
  });

  describe('resetConfig', () => {
    it('should remove config file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {});

      resetConfig(testDeps);

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigFile);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockConfigFile);
    });

    it('should do nothing if config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.unlinkSync.mockImplementation(() => {});

      resetConfig(testDeps);

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigFile);
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should throw error when config file cannot be removed', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => resetConfig(testDeps)).toThrow('Could not reset config: Permission denied');
    });

    it('should handle unknown errors during reset', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw 'Non-Error object';
      });

      expect(() => resetConfig(testDeps)).toThrow('Could not reset config: Unknown error');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete config lifecycle', () => {
      // Start with no config file
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.unlinkSync.mockImplementation(() => {});

      // Get default config
      const initialConfig = getConfig(testDeps);
      expect(initialConfig.region).toBe('ap-northeast-1');

      // Set a new value
      setConfig('region', 'us-east-1', testDeps);
      expect(mockFs.writeFileSync).toHaveBeenCalled();

      // Reset config
      mockFs.existsSync.mockReturnValue(true);
      resetConfig(testDeps);
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should preserve existing config when setting new values', () => {
      const existingConfig = {
        region: 'eu-west-1',
        tableName: 'existing-flags',
        endpoint: 'https://existing.com',
        profile: 'existing',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));
      mockFs.writeFileSync.mockImplementation(() => {});

      setConfig('tableName', 'updated-flags', testDeps);

      const writeCall = mockFs.writeFileSync.mock.calls[0];
      const savedConfig = JSON.parse(writeCall[1] as string);

      expect(savedConfig).toEqual({
        ...existingConfig,
        tableName: 'updated-flags',
      });
    });
  });
});