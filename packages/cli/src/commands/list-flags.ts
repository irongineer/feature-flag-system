import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { getApiClient } from '../utils/api-client';

interface ListFlagsOptions {
  tenant?: string;
  format?: 'table' | 'json';
}

export async function listFlags(options: ListFlagsOptions) {
  console.log(chalk.blue('📋 Listing feature flags'));

  try {
    const spinner = ora('Fetching flags...').start();
    const apiClient = getApiClient();

    const flags = await apiClient.listFlags();

    let tenantOverrides: any[] = [];
    if (options.tenant) {
      tenantOverrides = await apiClient.listTenantOverrides(options.tenant);
    }

    spinner.succeed(chalk.green(`✅ Found ${flags.length} flags`));

    if (options.format === 'json') {
      console.log(JSON.stringify({ flags, tenantOverrides }, null, 2));
      return;
    }

    // テーブル形式での表示
    console.log('');
    console.log(chalk.bold('Feature Flags:'));

    if (flags.length === 0) {
      console.log(chalk.yellow('No flags found'));
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
        new Date(flag.createdAt).toLocaleDateString(),
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

    console.log(
      table(tableData, {
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
      console.log(chalk.gray(`Showing overrides for tenant: ${options.tenant}`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to list flags'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
