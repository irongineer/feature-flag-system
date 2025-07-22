import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient } from '../utils/api-client';

interface UpdateFlagOptions {
  key?: string;
  description?: string;
  enabled?: string;
  owner?: string;
}

export async function updateFlag(options: UpdateFlagOptions) {
  console.log(chalk.blue('🔄 Updating feature flag'));
  
  try {
    // 対話式で不足している情報を取得
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: 'Select flag to update:',
        choices: Object.entries(FEATURE_FLAGS).map(([name, value]) => ({
          name: `${name} (${value})`,
          value: value,
        })),
        when: !options.key,
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter new description (leave empty to skip):',
        when: !options.description,
      },
      {
        type: 'confirm',
        name: 'enabled',
        message: 'New default enabled state:',
        when: options.enabled === undefined,
      },
      {
        type: 'input',
        name: 'owner',
        message: 'Enter new owner (leave empty to skip):',
        when: !options.owner,
      },
    ]);
    
    const flagKey = options.key || answers.key;
    const updates: any = {};
    
    if (options.description || answers.description) {
      updates.description = options.description || answers.description;
    }
    
    if (options.enabled !== undefined || answers.enabled !== undefined) {
      updates.defaultEnabled = options.enabled === 'true' || answers.enabled;
    }
    
    if (options.owner || answers.owner) {
      updates.owner = options.owner || answers.owner;
    }
    
    if (Object.keys(updates).length === 0) {
      console.log(chalk.yellow('No updates specified'));
      return;
    }
    
    // API呼び出し
    const spinner = ora('Updating flag...').start();
    const apiClient = getApiClient();
    
    await apiClient.updateFlag(flagKey, updates);
    
    spinner.succeed(chalk.green('✅ Flag updated successfully'));
    
    // 結果の表示
    console.log('');
    console.log(chalk.bold('Updated flag:'));
    console.log(`  Key: ${chalk.cyan(flagKey)}`);
    Object.entries(updates).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to update flag'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}