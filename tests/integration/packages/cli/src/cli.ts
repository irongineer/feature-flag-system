#\!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { createCommand } from './commands/create';
import { listCommand } from './commands/list';
import { updateCommand } from './commands/update';
import { deleteCommand } from './commands/delete';
import { killCommand } from './commands/kill';
import { restoreCommand } from './commands/restore';
import { tenantCommand } from './commands/tenant';
import { importCommand } from './commands/import';
import { exportCommand } from './commands/export';
import { statusCommand } from './commands/status';
import { configureCommand } from './commands/configure';

// 環境変数を読み込み
config();

const program = new Command();

// CLIメタデータ
program
  .name('ff')
  .description('Feature Flag CLI - Manage feature flags from command line')
  .version('1.0.0')
  .option('-v, --verbose', 'Verbose output')
  .option('--api-url <url>', 'API base URL', process.env.FF_API_URL || 'http://localhost:3000/local')
  .option('--api-key <key>', 'API key for authentication', process.env.FF_API_KEY);

// グローバルエラーハンドリング
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red(`❌ Error: ${err.message}`));
  process.exit(1);
});

// コマンド登録
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(updateCommand);
program.addCommand(deleteCommand);
program.addCommand(killCommand);
program.addCommand(restoreCommand);
program.addCommand(tenantCommand);
program.addCommand(importCommand);
program.addCommand(exportCommand);
program.addCommand(statusCommand);
program.addCommand(configureCommand);

// デフォルトヘルプ表示
if (process.argv.length <= 2) {
  program.help();
}

// CLI実行
program.parse();
EOF < /dev/null