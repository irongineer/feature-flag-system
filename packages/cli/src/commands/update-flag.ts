import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient, ApiClient } from '../utils/api-client';

export interface UpdateFlagOptions {
  key?: string;
  description?: string;
  enabled?: string;
  owner?: string;
}

export interface UpdateFlagDependencies {
  console?: {
    log: typeof console.log;
    error: typeof console.error;
  };
  inquirer?: {
    prompt: typeof inquirer.prompt;
  };
  ora?: typeof ora;
  process?: {
    exit: typeof process.exit;
  };
  apiClient?: ApiClient;
}

const defaultDependencies: Required<UpdateFlagDependencies> = {
  console: {
    log: console.log,
    error: console.error,
  },
  inquirer: {
    prompt: inquirer.prompt,
  },
  ora: ora,
  process: {
    exit: process.exit,
  },
  apiClient: getApiClient(),
};

export async function updateFlag(options: UpdateFlagOptions, deps?: UpdateFlagDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.blue('🔄 Updating feature flag'));

  try {
    // 対話式で不足している情報を取得
    const answers = await resolvedDeps.inquirer.prompt([
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
        when: !options.enabled,
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
      const enabledValue = options.enabled !== undefined ? options.enabled : answers.enabled;
      if (typeof enabledValue === 'string') {
        updates.defaultEnabled = enabledValue === 'true';
      } else if (typeof enabledValue === 'boolean') {
        updates.defaultEnabled = enabledValue;
      }
    }

    if (options.owner || answers.owner) {
      updates.owner = options.owner || answers.owner;
    }

    if (Object.keys(updates).length === 0) {
      resolvedDeps.console.log(chalk.yellow('No updates specified'));
      return;
    }

    // API呼び出し
    const spinner = resolvedDeps.ora('Updating flag...').start();
    const apiClient = deps?.apiClient || resolvedDeps.apiClient;

    await apiClient.updateFlag(flagKey, updates);

    spinner.succeed(chalk.green('✅ Flag updated successfully'));

    // 結果の表示
    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('Updated flag:'));
    resolvedDeps.console.log(`  Key: ${chalk.cyan(flagKey)}`);
    Object.entries(updates).forEach(([key, value]) => {
      resolvedDeps.console.log(`  ${key}: ${value}`);
    });
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Failed to update flag'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
