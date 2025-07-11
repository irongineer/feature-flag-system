#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createFlag } from './commands/create-flag';
import { listFlags } from './commands/list-flags';
import { updateFlag } from './commands/update-flag';
import { setTenantOverride } from './commands/set-tenant-override';
import { killSwitch } from './commands/kill-switch';
import { evaluate } from './commands/evaluate';
import { config } from './commands/config';

const program = new Command();

program
  .name('feature-flag')
  .description('Feature Flag Management CLI')
  .version('1.0.0');

// フラグ作成コマンド
program
  .command('create')
  .description('Create a new feature flag')
  .option('-k, --key <key>', 'Flag key')
  .option('-d, --description <description>', 'Flag description')
  .option('-e, --enabled', 'Default enabled state', false)
  .option('-o, --owner <owner>', 'Flag owner')
  .option('--expires <date>', 'Expiration date (ISO format)')
  .action(createFlag);

// フラグ一覧コマンド
program
  .command('list')
  .description('List all feature flags')
  .option('-t, --tenant <tenantId>', 'Show tenant-specific overrides')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(listFlags);

// フラグ更新コマンド
program
  .command('update')
  .description('Update a feature flag')
  .option('-k, --key <key>', 'Flag key')
  .option('-d, --description <description>', 'Flag description')
  .option('-e, --enabled <enabled>', 'Default enabled state')
  .option('-o, --owner <owner>', 'Flag owner')
  .action(updateFlag);

// テナントオーバーライドコマンド
program
  .command('set-tenant')
  .description('Set tenant-specific flag override')
  .option('-t, --tenant <tenantId>', 'Tenant ID')
  .option('-k, --key <key>', 'Flag key')
  .option('-e, --enabled <enabled>', 'Enabled state')
  .option('-u, --user <user>', 'User setting the override')
  .action(setTenantOverride);

// Kill-Switchコマンド
program
  .command('kill-switch')
  .description('Manage kill-switch (emergency controls)')
  .option('-k, --key <key>', 'Flag key (optional for global kill-switch)')
  .option('-a, --activate', 'Activate kill-switch')
  .option('-d, --deactivate', 'Deactivate kill-switch')
  .option('-r, --reason <reason>', 'Reason for activation/deactivation')
  .option('-u, --user <user>', 'User performing the action')
  .action(killSwitch);

// フラグ評価コマンド
program
  .command('evaluate')
  .description('Evaluate a feature flag')
  .option('-t, --tenant <tenantId>', 'Tenant ID')
  .option('-k, --key <key>', 'Flag key')
  .option('-u, --user <userId>', 'User ID')
  .option('-e, --environment <env>', 'Environment')
  .action(evaluate);

// 設定コマンド
program
  .command('config')
  .description('Manage CLI configuration')
  .option('-s, --set <key=value>', 'Set configuration value')
  .option('-g, --get <key>', 'Get configuration value')
  .option('-l, --list', 'List all configuration')
  .option('--reset', 'Reset configuration to defaults')
  .action(config);

// エラーハンドリング
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// ヘルプの改善
program.on('--help', () => {
  console.log('');
  console.log(chalk.bold('Examples:'));
  console.log('  $ feature-flag create -k billing_v2_enable -d "New billing system"');
  console.log('  $ feature-flag list');
  console.log('  $ feature-flag set-tenant -t tenant-123 -k billing_v2_enable -e true -u admin');
  console.log('  $ feature-flag kill-switch -a -r "Critical bug found" -u admin');
  console.log('  $ feature-flag evaluate -t tenant-123 -k billing_v2_enable');
  console.log('');
  console.log(chalk.bold('Configuration:'));
  console.log('  $ feature-flag config --set endpoint=https://api.example.com');
  console.log('  $ feature-flag config --set region=ap-northeast-1');
  console.log('');
});

// バージョン情報の改善
program.on('--version', () => {
  console.log(chalk.green('Feature Flag CLI v1.0.0'));
  console.log(chalk.gray('Multi-tenant SaaS Feature Flag System'));
});

// 実行
if (require.main === module) {
  program.parse(process.argv);
  
  // コマンドが指定されていない場合はヘルプを表示
  if (process.argv.length <= 2) {
    program.outputHelp();
  }
}