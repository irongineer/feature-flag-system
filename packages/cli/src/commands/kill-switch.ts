import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient, ApiClient } from '../utils/api-client';

export interface KillSwitchOptions {
  key?: string;
  activate?: boolean;
  deactivate?: boolean;
  reason?: string;
  user?: string;
}

export interface KillSwitchDependencies {
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
  Date?: DateConstructor;
}

const defaultDependencies: Required<KillSwitchDependencies> = {
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
  Date: Date,
};

export async function killSwitch(options: KillSwitchOptions, deps?: KillSwitchDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.red('🚨 Kill-Switch Management'));

  try {
    // 操作の確認
    if (!options.activate && !options.deactivate) {
      const { action } = await resolvedDeps.inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Select action:',
          choices: [
            { name: 'Activate Kill-Switch', value: 'activate' },
            { name: 'Deactivate Kill-Switch', value: 'deactivate' },
          ],
        },
      ]);
      options.activate = action === 'activate';
      options.deactivate = action === 'deactivate';
    }

    // 対話式で不足している情報を取得
    const answers = await resolvedDeps.inquirer.prompt([
      {
        type: 'list',
        name: 'scope',
        message: 'Select scope:',
        choices: [
          { name: 'Global (all flags)', value: 'global' },
          { name: 'Specific flag', value: 'flag' },
        ],
        when: !options.key,
      },
      {
        type: 'list',
        name: 'key',
        message: 'Select flag:',
        choices: Object.entries(FEATURE_FLAGS).map(([name, value]) => ({
          name: `${name} (${value})`,
          value: value,
        })),
        when: answers => answers.scope === 'flag' && !options.key,
      },
      {
        type: 'input',
        name: 'reason',
        message: 'Enter reason:',
        validate: input => input.length > 0 || 'Reason is required',
        when: !options.reason,
      },
      {
        type: 'input',
        name: 'user',
        message: 'Enter your username:',
        validate: input => input.length > 0 || 'Username is required',
        when: !options.user,
      },
    ]);

    const flagKey = options.key || answers.key;
    const reason = options.reason || answers.reason;
    const user = options.user || answers.user;
    const isGlobal = !flagKey;

    // 確認プロンプト
    const action = options.activate ? 'ACTIVATE' : 'DEACTIVATE';
    const scope = isGlobal ? 'GLOBAL' : `flag: ${flagKey}`;

    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('⚠️  Kill-Switch Operation Summary:'));
    resolvedDeps.console.log(`  Action: ${chalk.red(action)}`);
    resolvedDeps.console.log(`  Scope: ${chalk.yellow(scope)}`);
    resolvedDeps.console.log(`  Reason: ${reason}`);
    resolvedDeps.console.log(`  User: ${user}`);
    resolvedDeps.console.log('');

    if (options.activate) {
      resolvedDeps.console.log(
        chalk.red('⚠️  WARNING: This will immediately disable the feature(s) for all users!')
      );
    }

    const { confirm } = await resolvedDeps.inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to ${action.toLowerCase()} the kill-switch?`,
        default: false,
      },
    ]);

    if (!confirm) {
      resolvedDeps.console.log(chalk.yellow('Operation cancelled'));
      return;
    }

    // API呼び出し
    const spinnerMessage = options.activate ? 'Activating kill-switch...' : 'Deactivating kill-switch...';
    const spinner = resolvedDeps.ora(spinnerMessage).start();
    const apiClient = deps?.apiClient || resolvedDeps.apiClient;

    if (options.activate) {
      await apiClient.activateKillSwitch(flagKey, reason, user);
    } else {
      await apiClient.deactivateKillSwitch(flagKey, user);
    }

    spinner.succeed(chalk.green(`✅ Kill-switch ${action.toLowerCase()}d successfully`));

    // 結果の表示
    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('Operation completed:'));
    resolvedDeps.console.log(
      `  Status: ${action === 'ACTIVATE' ? chalk.red('ACTIVE') : chalk.green('INACTIVE')}`
    );
    resolvedDeps.console.log(`  Scope: ${scope}`);
    resolvedDeps.console.log(`  Timestamp: ${new resolvedDeps.Date().toISOString()}`);

    if (options.activate) {
      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.red('🚨 Kill-switch is now ACTIVE'));
      resolvedDeps.console.log(chalk.yellow('Features will be disabled until the kill-switch is deactivated'));
    } else {
      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.green('✅ Kill-switch is now INACTIVE'));
      resolvedDeps.console.log(chalk.green('Features will resume normal operation'));
    }
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Kill-switch operation failed'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
