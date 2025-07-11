import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.feature-flag');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  region: string;
  tableName: string;
  endpoint?: string;
  profile?: string;
}

const DEFAULT_CONFIG: Config = {
  region: 'ap-northeast-1',
  tableName: 'feature-flags',
  endpoint: undefined,
  profile: 'default',
};

export function getConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(configData);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.warn('Warning: Could not read config file, using defaults');
  }
  
  return DEFAULT_CONFIG;
}

export function setConfig(key: string, value: string) {
  const config = getConfig();
  
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
  
  saveConfig(config);
}

export function saveConfig(config: Config) {
  try {
    // 設定ディレクトリが存在しない場合は作成
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`Could not save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function resetConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch (error) {
    throw new Error(`Could not reset config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}