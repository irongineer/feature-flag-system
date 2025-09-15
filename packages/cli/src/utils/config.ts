import fs from 'fs';
import path from 'path';
import os from 'os';

interface Config {
  region: string;
  tableName: string;
  endpoint?: string;
  profile?: string;
}

export interface FileSystemDeps {
  existsSync: typeof fs.existsSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  mkdirSync: typeof fs.mkdirSync;
  unlinkSync: typeof fs.unlinkSync;
}

export interface SystemDeps {
  homedir: typeof os.homedir;
}

export interface ConfigDependencies {
  fs?: FileSystemDeps;
  os?: SystemDeps;
  configDir?: string;
  configFile?: string;
}

const DEFAULT_CONFIG: Config = {
  region: 'ap-northeast-1',
  tableName: 'feature-flags',
  endpoint: undefined,
  profile: 'default',
};

// Default dependencies
const defaultDeps: Required<ConfigDependencies> = {
  fs: {
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    writeFileSync: fs.writeFileSync,
    mkdirSync: fs.mkdirSync,
    unlinkSync: fs.unlinkSync,
  },
  os: {
    homedir: os.homedir,
  },
  configDir: '',
  configFile: '',
};

function getConfigPaths(deps: Required<ConfigDependencies>) {
  const configDir = deps.configDir || path.join(deps.os.homedir(), '.feature-flag');
  const configFile = deps.configFile || path.join(configDir, 'config.json');
  return { configDir, configFile };
}

export function getConfig(deps?: ConfigDependencies): Config {
  const resolvedDeps = { ...defaultDeps, ...deps };
  const { configFile } = getConfigPaths(resolvedDeps);

  try {
    if (resolvedDeps.fs.existsSync(configFile)) {
      const configData = resolvedDeps.fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(configData);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.warn('Warning: Could not read config file, using defaults');
  }

  return DEFAULT_CONFIG;
}

export function setConfig(key: string, value: string, deps?: ConfigDependencies) {
  const config = getConfig(deps);

  // ネストされたキーをサポート
  const keys = key.split('.');
  let current = config as any;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;

  saveConfig(config, deps);
}

export function saveConfig(config: Config, deps?: ConfigDependencies) {
  const resolvedDeps = { ...defaultDeps, ...deps };
  const { configDir, configFile } = getConfigPaths(resolvedDeps);

  try {
    // 設定ディレクトリが存在しない場合は作成
    if (!resolvedDeps.fs.existsSync(configDir)) {
      resolvedDeps.fs.mkdirSync(configDir, { recursive: true });
    }

    resolvedDeps.fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(
      `Could not save config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function resetConfig(deps?: ConfigDependencies) {
  const resolvedDeps = { ...defaultDeps, ...deps };
  const { configFile } = getConfigPaths(resolvedDeps);

  try {
    if (resolvedDeps.fs.existsSync(configFile)) {
      resolvedDeps.fs.unlinkSync(configFile);
    }
  } catch (error) {
    throw new Error(
      `Could not reset config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
