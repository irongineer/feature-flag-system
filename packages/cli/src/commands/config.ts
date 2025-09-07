import chalk from 'chalk';
import { table } from 'table';
import { getConfig, setConfig, resetConfig } from '../utils/config';

interface ConfigOptions {
  set?: string;
  get?: string;
  list?: boolean;
  reset?: boolean;
}

export interface ConfigDependencies {
  console?: {
    log: typeof console.log;
    error: typeof console.error;
  };
  process?: {
    exit: typeof process.exit;
  };
  getConfig?: typeof getConfig;
  setConfig?: typeof setConfig;
  resetConfig?: typeof resetConfig;
  table?: typeof table;
  config?: typeof config;
}

const defaultDependencies: Required<Omit<ConfigDependencies, 'config'>> = {
  console: {
    log: console.log,
    error: console.error,
  },
  process: {
    exit: process.exit,
  },
  getConfig: getConfig,
  setConfig: setConfig,
  resetConfig: resetConfig,
  table: table,
};

export async function config(options: ConfigOptions, deps?: ConfigDependencies) {
  const resolvedDeps = { ...defaultDependencies, ...deps };
  
  resolvedDeps.console.log(chalk.blue('⚙️  Configuration Management'));

  try {
    if (options.reset) {
      resolvedDeps.resetConfig();
      resolvedDeps.console.log(chalk.green('✅ Configuration reset to defaults'));
      return;
    }

    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || !value) {
        resolvedDeps.console.error(chalk.red('❌ Invalid format. Use: --set key=value'));
        resolvedDeps.process.exit(1);
      }

      resolvedDeps.setConfig(key, value);
      resolvedDeps.console.log(chalk.green(`✅ Set ${key} = ${value}`));
      return;
    }

    const currentConfig = resolvedDeps.getConfig();

    if (options.get) {
      const keys = options.get.split('.');
      let value = currentConfig as any;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
          if (value === null || value === undefined) {
            resolvedDeps.console.error(chalk.red(`❌ Configuration key not found: ${options.get}`));
            resolvedDeps.process.exit(1);
          }
        } else {
          resolvedDeps.console.error(chalk.red(`❌ Configuration key not found: ${options.get}`));
          resolvedDeps.process.exit(1);
        }
      }

      resolvedDeps.console.log(chalk.green(`${options.get} = ${value}`));
      return;
    }

    if (options.list) {
      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.bold('Current Configuration:'));

      const configEntries = Object.entries(currentConfig);
      const tableData = [
        ['Key', 'Value'],
        ...configEntries.map(([key, value]) => [
          chalk.cyan(key),
          value ? String(value) : chalk.gray('(not set)'),
        ]),
      ];

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

      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.bold('Available Configuration Keys:'));
      resolvedDeps.console.log('  region       - AWS region (default: ap-northeast-1)');
      resolvedDeps.console.log('  tableName    - DynamoDB table name (default: feature-flags)');
      resolvedDeps.console.log('  endpoint     - Custom endpoint for local development');
      resolvedDeps.console.log('  profile      - AWS profile name (default: default)');

      resolvedDeps.console.log('');
      resolvedDeps.console.log(chalk.bold('Examples:'));
      resolvedDeps.console.log('  feature-flag config --set region=us-east-1');
      resolvedDeps.console.log('  feature-flag config --set endpoint=http://localhost:8000');
      resolvedDeps.console.log('  feature-flag config --get region');
      resolvedDeps.console.log('  feature-flag config --reset');

      return;
    }

    // デフォルト: 設定一覧を表示
    await (resolvedDeps.config || config)({ list: true }, resolvedDeps);
  } catch (error) {
    resolvedDeps.console.error(chalk.red('❌ Configuration error'));
    resolvedDeps.console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    resolvedDeps.process.exit(1);
  }
}
