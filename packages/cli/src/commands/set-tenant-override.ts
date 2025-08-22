import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient } from '../utils/api-client';

interface SetTenantOverrideOptions {
  tenant?: string;
  key?: string;
  enabled?: string;
  user?: string;
}

export async function setTenantOverride(options: SetTenantOverrideOptions) {
  console.log(chalk.blue('🎯 Setting tenant override'));

  try {
    // 対話式で不足している情報を取得
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'tenant',
        message: 'Enter tenant ID:',
        validate: input => input.length > 0 || 'Tenant ID is required',
        when: !options.tenant,
      },
      {
        type: 'list',
        name: 'key',
        message: 'Select flag:',
        choices: Object.entries(FEATURE_FLAGS).map(([name, value]) => ({
          name: `${name} (${value})`,
          value: value,
        })),
        when: !options.key,
      },
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable for this tenant:',
        when: !options.enabled,
      },
      {
        type: 'input',
        name: 'user',
        message: 'Enter your username:',
        validate: input => input.length > 0 || 'Username is required',
        when: !options.user,
      },
    ]);

    const tenantId = options.tenant || answers.tenant;
    const flagKey = options.key || answers.key;
    const enabled = options.enabled === 'true' || answers.enabled;
    const user = options.user || answers.user;

    // API呼び出し
    const spinner = ora('Setting tenant override...').start();
    const apiClient = getApiClient();

    await apiClient.setTenantOverride(tenantId, flagKey, enabled, user);

    spinner.succeed(chalk.green('✅ Tenant override set successfully'));

    // 結果の表示
    console.log('');
    console.log(chalk.bold('Tenant override set:'));
    console.log(`  Tenant: ${chalk.cyan(tenantId)}`);
    console.log(`  Flag: ${chalk.cyan(flagKey)}`);
    console.log(`  Enabled: ${enabled ? chalk.green('true') : chalk.red('false')}`);
    console.log(`  Updated by: ${user}`);
    console.log(`  Timestamp: ${new Date().toISOString()}`);
  } catch (error) {
    console.error(chalk.red('❌ Failed to set tenant override'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
