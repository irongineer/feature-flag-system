import chalk from 'chalk';
import { table } from 'table';
import { getConfig, setConfig, resetConfig } from '../utils/config';

interface ConfigOptions {
  set?: string;
  get?: string;
  list?: boolean;
  reset?: boolean;
}

export async function config(options: ConfigOptions) {
  console.log(chalk.blue('⚙️  Configuration Management'));
  
  try {
    if (options.reset) {
      resetConfig();
      console.log(chalk.green('✅ Configuration reset to defaults'));
      return;
    }
    
    if (options.set) {
      const [key, value] = options.set.split('=');
      if (!key || !value) {
        console.error(chalk.red('❌ Invalid format. Use: --set key=value'));
        process.exit(1);
      }
      
      setConfig(key, value);
      console.log(chalk.green(`✅ Set ${key} = ${value}`));
      return;
    }
    
    const currentConfig = getConfig();
    
    if (options.get) {
      const keys = options.get.split('.');
      let value = currentConfig as any;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          console.error(chalk.red(`❌ Configuration key not found: ${options.get}`));
          process.exit(1);
        }
      }
      
      console.log(chalk.green(`${options.get} = ${value}`));
      return;
    }
    
    if (options.list) {
      console.log('');
      console.log(chalk.bold('Current Configuration:'));
      
      const configEntries = Object.entries(currentConfig);
      const tableData = [
        ['Key', 'Value'],
        ...configEntries.map(([key, value]) => [
          chalk.cyan(key),
          value ? String(value) : chalk.gray('(not set)'),
        ]),
      ];
      
      console.log(table(tableData, {
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
      }));
      
      console.log('');
      console.log(chalk.bold('Available Configuration Keys:'));
      console.log('  region       - AWS region (default: ap-northeast-1)');
      console.log('  tableName    - DynamoDB table name (default: feature-flags)');
      console.log('  endpoint     - Custom endpoint for local development');
      console.log('  profile      - AWS profile name (default: default)');
      
      console.log('');
      console.log(chalk.bold('Examples:'));
      console.log('  feature-flag config --set region=us-east-1');
      console.log('  feature-flag config --set endpoint=http://localhost:8000');
      console.log('  feature-flag config --get region');
      console.log('  feature-flag config --reset');
      
      return;
    }
    
    // デフォルト: 設定一覧を表示
    await config({ list: true });
    
  } catch (error) {
    console.error(chalk.red('❌ Configuration error'));
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}