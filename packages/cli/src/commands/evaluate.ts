import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient } from '../utils/api-client';

interface EvaluateOptions {
  tenant?: string;
  key?: string;
  user?: string;
  environment?: string;
}

export async function evaluate(options: EvaluateOptions) {
  console.log(chalk.blue('🔍 Evaluating feature flag'));

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
        message: 'Select flag to evaluate:',
        choices: Object.entries(FEATURE_FLAGS).map(([name, value]) => ({
          name: `${name} (${value})`,
          value: value,
        })),
        when: !options.key,
      },
      {
        type: 'input',
        name: 'user',
        message: 'Enter user ID (optional):',
        when: !options.user,
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: ['development', 'staging', 'production'],
        default: 'development',
        when: !options.environment,
      },
    ]);

    const tenantId = options.tenant || answers.tenant;
    const flagKey = options.key || answers.key;
    const userId = options.user || answers.user;
    const environment = options.environment || answers.environment;

    // API呼び出し
    const spinner = ora('Evaluating flag...').start();
    const apiClient = getApiClient();

    const result = await apiClient.evaluateFlag(tenantId, flagKey);

    spinner.succeed(chalk.green('✅ Flag evaluated successfully'));

    // 結果の表示
    console.log('');
    console.log(chalk.bold('Evaluation Result:'));
    console.log(`  Tenant: ${chalk.cyan(tenantId)}`);
    console.log(`  Flag: ${chalk.cyan(flagKey)}`);
    console.log(`  User: ${userId || chalk.gray('(not specified)')}`);
    console.log(`  Environment: ${environment}`);
    console.log(`  Result: ${result.enabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`);
    console.log(`  Reason: ${chalk.yellow(result.reason)}`);
    console.log(`  Evaluated at: ${new Date().toISOString()}`);

    // 結果に応じたメッセージ
    if (result.enabled) {
      console.log('');
      console.log(chalk.green('🎉 Feature is enabled for this tenant'));
    } else {
      console.log('');
      console.log(chalk.red('🚫 Feature is disabled for this tenant'));
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to evaluate flag'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
