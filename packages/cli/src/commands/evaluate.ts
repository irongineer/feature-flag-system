import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient, ApiClient } from '../utils/api-client';

export interface EvaluateOptions {
  tenant?: string;
  key?: string;
  user?: string;
  environment?: string;
}

export interface EvaluateDependencies {
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

const defaultDependencies: Required<EvaluateDependencies> = {
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

export async function evaluate(options: EvaluateOptions, deps?: EvaluateDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.blue('🔍 Evaluating feature flag'));

  try {
    // 対話式で不足している情報を取得
    const answers = await resolvedDeps.inquirer.prompt([
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
    const spinner = resolvedDeps.ora('Evaluating flag...').start();
    const apiClient = deps?.apiClient || resolvedDeps.apiClient;

    const result = await apiClient.evaluateFlag(tenantId, flagKey);

    spinner.succeed(chalk.green('✅ Flag evaluated successfully'));

    // 結果の表示
    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('Evaluation Result:'));
    resolvedDeps.console.log(`  Tenant: ${chalk.cyan(tenantId)}`);
    resolvedDeps.console.log(`  Flag: ${chalk.cyan(flagKey)}`);
    resolvedDeps.console.log(`  User: ${userId || chalk.gray('(not specified)')}`);
    resolvedDeps.console.log(`  Environment: ${environment}`);
    resolvedDeps.console.log(`  Result: ${result.enabled ? chalk.green('ENABLED') : chalk.red('DISABLED')}`);
    resolvedDeps.console.log(`  Reason: ${chalk.yellow(result.reason)}`);
    resolvedDeps.console.log(`  Evaluated at: ${new resolvedDeps.Date().toISOString()}`);

    // 結果に応じたメッセージ
    if (result.enabled) {
      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.green('🎉 Feature is enabled for this tenant'));
    } else {
      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.red('🚫 Feature is disabled for this tenant'));
    }
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Failed to evaluate flag'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
