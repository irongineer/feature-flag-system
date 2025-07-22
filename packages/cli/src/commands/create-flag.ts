import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient } from '../utils/api-client';
import { getConfig } from '../utils/config';

interface CreateFlagOptions {
  key?: string;
  description?: string;
  enabled?: boolean;
  owner?: string;
  expires?: string;
}

export async function createFlag(options: CreateFlagOptions) {
  console.log(chalk.blue('🚀 Creating new feature flag'));
  
  try {
    // 設定の取得
    const config = getConfig();
    
    // 対話式で不足している情報を取得
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: 'Select flag key:',
        choices: Object.entries(FEATURE_FLAGS).map(([name, value]) => ({
          name: `${name} (${value})`,
          value: value,
        })),
        when: !options.key,
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter flag description:',
        validate: (input) => input.length > 0 || 'Description is required',
        when: !options.description,
      },
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Default enabled state:',
        default: false,
        when: options.enabled === undefined,
      },
      {
        type: 'input',
        name: 'owner',
        message: 'Enter flag owner:',
        default: 'system',
        when: !options.owner,
      },
      {
        type: 'input',
        name: 'expires',
        message: 'Enter expiration date (ISO format, optional):',
        validate: (input) => {
          if (!input) return true;
          const date = new Date(input);
          if (isNaN(date.getTime())) {
            return 'Please enter a valid ISO date format';
          }
          return true;
        },
        when: !options.expires,
      },
    ]);
    
    // オプションとプロンプトの回答をマージ
    const flagData = {
      flagKey: options.key || answers.key,
      description: options.description || answers.description,
      defaultEnabled: options.enabled ?? answers.enabled,
      owner: options.owner || answers.owner,
      expiresAt: options.expires || answers.expires || undefined,
    };
    
    // API呼び出し
    const spinner = ora('Creating flag...').start();
    const apiClient = getApiClient();
    
    await apiClient.createFlag(flagData);
    
    spinner.succeed(chalk.green('✅ Flag created successfully'));
    
    // 結果の表示
    console.log('');
    console.log(chalk.bold('Created flag:'));
    console.log(`  Key: ${chalk.cyan(flagData.flagKey)}`);
    console.log(`  Description: ${flagData.description}`);
    console.log(`  Default Enabled: ${flagData.defaultEnabled ? chalk.green('true') : chalk.red('false')}`);
    console.log(`  Owner: ${flagData.owner}`);
    if (flagData.expiresAt) {
      console.log(`  Expires: ${chalk.yellow(flagData.expiresAt)}`);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to create flag'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}