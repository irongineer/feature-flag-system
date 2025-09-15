import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getApiClient, ApiClient } from '../utils/api-client';

export interface ListFlagsOptions {
  tenant?: string;
  format?: 'table' | 'json';
}

export interface ListFlagsDependencies {
  console?: {
    log: typeof console.log;
    error: typeof console.error;
  };
  ora?: typeof ora;
  process?: {
    exit: typeof process.exit;
  };
  apiClient?: ApiClient;
  table?: typeof table;
  Date?: DateConstructor;
}

const defaultDependencies: Required<ListFlagsDependencies> = {
  console: {
    log: console.log,
    error: console.error,
  },
  ora: ora,
  process: {
    exit: process.exit,
  },
  apiClient: getApiClient(),
  table: table,
  Date: Date,
};

export async function listFlags(options: ListFlagsOptions, deps?: ListFlagsDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.blue('📋 Listing feature flags'));

  try {
    const spinner = resolvedDeps.ora('Fetching flags...').start();
    const apiClient = deps?.apiClient || resolvedDeps.apiClient;

    const flags = await apiClient.listFlags();

    let tenantOverrides: any[] = [];
    if (options.tenant) {
      tenantOverrides = await apiClient.listTenantOverrides(options.tenant);
    }

    spinner.succeed(chalk.green(`✅ Found ${flags.length} flags`));

    if (options.format === 'json') {
      resolvedDeps.console.log(JSON.stringify({ flags, tenantOverrides }, null, 2));
      return;
    }

    // テーブル形式での表示
    resolvedDeps.console.log('');
    resolvedDeps.console.log(chalk.bold('Feature Flags:'));

    if (flags.length === 0) {
      resolvedDeps.console.log(chalk.yellow('No flags found'));
      return;
    }

    // テーブルヘッダー
    const headers = ['Flag Key', 'Description', 'Default', 'Owner', 'Created'];
    if (options.tenant) {
      headers.push('Tenant Override');
    }

    // テーブルデータ
    const tableData = [headers];

    flags.forEach(flag => {
      const row = [
        chalk.cyan(flag.flagKey),
        flag.description.length > 40 ? flag.description.substring(0, 37) + '...' : flag.description,
        flag.defaultEnabled ? chalk.green('ON') : chalk.red('OFF'),
        flag.owner,
        new resolvedDeps.Date(flag.createdAt).toLocaleDateString(),
      ];

      if (options.tenant) {
        const override = tenantOverrides.find(o => o.SK === `FLAG#${flag.flagKey}`);
        if (override) {
          row.push(override.enabled ? chalk.green('ON') : chalk.red('OFF'));
        } else {
          row.push(chalk.gray('Default'));
        }
      }

      tableData.push(row);
    });

    resolvedDeps.console.log(
      resolvedDeps.table(tableData, {
        border: {
          topBody: '─',
          topJoin: '┬',
          topLeft: '┌',
          topRight: '┐',
          bottomBody: '─',
          bottomJoin: '┴',
          bottomLeft: '└',
          bottomRight: '┘',
          bodyLeft: '│',
          bodyRight: '│',
          bodyJoin: '│',
          joinBody: '─',
          joinLeft: '├',
          joinRight: '┤',
          joinJoin: '┼',
        },
      })
    );

    if (options.tenant) {
      resolvedDeps.console.log(chalk.gray(`Showing overrides for tenant: ${options.tenant}`));
    }
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Failed to list flags'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
