import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { FEATURE_FLAGS } from '@feature-flag/core';
import { getApiClient, ApiClient } from '../utils/api-client';

export interface SetTenantOverrideOptions {
  tenant?: string;
  key?: string;
  enabled?: string;
  user?: string;
}

export interface SetTenantOverrideDependencies {
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

const defaultDependencies: Required<SetTenantOverrideDependencies> = {
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

export async function setTenantOverride(options: SetTenantOverrideOptions, deps?: SetTenantOverrideDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.blue('🎯 Setting tenant override'));

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
    
    // Handle enabled value - prioritize options over answers
    let enabled: boolean;
    if (options.enabled !== undefined) {
      enabled = options.enabled === 'true';
    } else {
      enabled = answers.enabled;
    }
    
    const user = options.user || answers.user;

    // API呼び出し
    const spinner = resolvedDeps.ora('Setting tenant override...').start();
    const apiClient = deps?.apiClient || resolvedDeps.apiClient;

    await apiClient.setTenantOverride(tenantId, flagKey, enabled, user);

    spinner.succeed(chalk.green('✅ Tenant override set successfully'));

    // 結果の表示
    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('Tenant override set:'));
    resolvedDeps.console.log(`  Tenant: ${chalk.cyan(tenantId)}`);
    resolvedDeps.console.log(`  Flag: ${chalk.cyan(flagKey)}`);
    resolvedDeps.console.log(`  Enabled: ${enabled ? chalk.green('true') : chalk.red('false')}`);
    resolvedDeps.console.log(`  Updated by: ${user}`);
    resolvedDeps.console.log(`  Timestamp: ${new resolvedDeps.Date().toISOString()}`);
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Failed to set tenant override'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
