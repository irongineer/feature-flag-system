import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Create Flag Command Simple Tests
 * 
 * create-flagコマンドの基本機能テスト
 * 段階的にテストを構築してモック問題を解決
 */

// Mock all dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

const mockCreateFlag = vi.fn();

vi.mock('../../src/utils/api-client', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    createFlag: mockCreateFlag,
  })),
  getApiClient: vi.fn(() => ({
    createFlag: mockCreateFlag,
  })),
}));

vi.mock('../../src/utils/config', () => ({
  getConfig: vi.fn(() => ({
    region: 'ap-northeast-1',
    tableName: 'feature-flags',
    endpoint: 'http://localhost:3001',
  })),
}));

// Mock DynamoDbClient from core package
vi.mock('@feature-flag/core', async () => {
  const actual = await vi.importActual('@feature-flag/core');
  return {
    ...actual,
    DynamoDbClient: vi.fn().mockImplementation(() => ({
      createFlag: mockCreateFlag,
    })),
  };
});

import { createFlag } from '../../src/commands/create-flag';
import inquirer from 'inquirer';
import { getApiClient } from '../../src/utils/api-client';

describe('Create Flag Command Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFlag.mockReset();
    
    // Spy on console to avoid noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Basic Functionality', () => {
    it('should handle complete options without prompting', async () => {
      // Given: 完全なオプション
      const options = {
        key: 'test_flag',
        description: 'Test description',
        enabled: true,
        owner: 'test-owner',
        expires: '2025-12-31T23:59:59.000Z'
      };

      // Mock inquirer to return empty object (no prompts needed)
      vi.mocked(inquirer.prompt).mockResolvedValue({});

      // Mock API client
      mockCreateFlag.mockResolvedValue({});

      // When: 完全オプションでコマンド実行
      await createFlag(options);

      // Then: プロンプトは呼ばれるが空の回答
      expect(inquirer.prompt).toHaveBeenCalled();
      
      // Then: API呼び出しが実行される
      expect(mockCreateFlag).toHaveBeenCalledWith({
        flagKey: 'test_flag',
        description: 'Test description',
        defaultEnabled: true,
        owner: 'test-owner',
        expiresAt: '2025-12-31T23:59:59.000Z',
      });
    });

    it('should handle API errors gracefully', async () => {
      // Given: API エラー設定
      const options = {
        key: 'test_flag',
        description: 'Test description',
        enabled: true,
        owner: 'test-owner'
      };

      mockCreateFlag.mockRejectedValue(new Error('API Error'));

      // Mock inquirer for the error case
      vi.mocked(inquirer.prompt).mockResolvedValue({});

      // Mock process.exit to avoid actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // When: API エラーでコマンド実行
      await expect(createFlag(options)).rejects.toThrow('process.exit called');

      // Then: エラーログ出力
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to create flag')
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });
  });

  describe('Prompt Handling', () => {
    it('should prompt for missing fields', async () => {
      // Given: 不完全なオプション
      const options = {
        key: 'test_flag'
      };

      // Mock inquirer prompt
      vi.mocked(inquirer.prompt).mockResolvedValue({
        description: 'Prompted description',
        enabled: false,
        owner: 'prompted-owner'
      });

      // Mock API client
      mockCreateFlag.mockResolvedValue({});

      // When: 不完全オプションでコマンド実行
      await createFlag(options);

      // Then: 不足フィールドのプロンプト実行
      expect(inquirer.prompt).toHaveBeenCalled();

      // Then: プロンプト結果とオプションがマージされる
      expect(mockCreateFlag).toHaveBeenCalledWith({
        flagKey: 'test_flag',
        description: 'Prompted description',
        defaultEnabled: false,
        owner: 'prompted-owner',
        expiresAt: undefined,
      });
    });

    it('should handle expiration date in prompts', async () => {
      // Given: 有効期限のみ指定
      const options = {
        key: 'test_flag',
        description: 'Test description',
        enabled: true,
        owner: 'test-owner'
      };

      // Mock inquirer with expiration date
      vi.mocked(inquirer.prompt).mockResolvedValue({
        expires: '2025-12-31T23:59:59.000Z'
      });

      mockCreateFlag.mockResolvedValue({});

      // When: 有効期限プロンプト付きでコマンド実行
      await createFlag(options);

      // Then: 有効期限が設定される
      expect(mockCreateFlag).toHaveBeenCalledWith({
        flagKey: 'test_flag',
        description: 'Test description',
        defaultEnabled: true,
        owner: 'test-owner',
        expiresAt: '2025-12-31T23:59:59.000Z',
      });
    });

    it('should handle optional expiration date', async () => {
      // Given: 有効期限なしオプション
      const options = {
        key: 'test_flag',
        description: 'Test description',
        enabled: true,
        owner: 'test-owner'
      };

      // Mock inquirer with empty expiration
      vi.mocked(inquirer.prompt).mockResolvedValue({
        expires: ''
      });

      mockCreateFlag.mockResolvedValue({});

      // When: 有効期限なしでコマンド実行
      await createFlag(options);

      // Then: 有効期限はundefined
      expect(mockCreateFlag).toHaveBeenCalledWith({
        flagKey: 'test_flag',
        description: 'Test description',
        defaultEnabled: true,
        owner: 'test-owner',
        expiresAt: undefined,
      });
    });
  });
});