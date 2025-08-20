import * as path from 'path';
import * as fs from 'fs';

export interface ApiEnvironmentConfig {
  name: string;
  api: {
    baseUrl: string;
    evaluateEndpoint: string;
    timeout: number;
  };
  database: {
    type: 'local' | 'dynamodb';
    dynamodb: {
      endpoint?: string;
      region: string;
      tableName: string;
    };
  };
  useInMemoryFlags: boolean;
  cors: {
    origins: string[];
  };
}

export type ApiEnvironment = 'local' | 'dev' | 'prod';

/**
 * 現在の環境を取得
 */
export function getCurrentEnvironment(): ApiEnvironment {
  const env = process.env.NODE_ENV || 'local';
  const stage = process.env.STAGE || env;

  // 環境の正規化
  switch (stage.toLowerCase()) {
    case 'development':
    case 'local':
      return 'local';
    case 'staging':
    case 'dev':
      return 'dev';
    case 'production':
    case 'prod':
      return 'prod';
    default:
      console.warn(`Unknown environment: ${stage}, defaulting to local`);
      return 'local';
  }
}

/**
 * 環境設定を読み込み
 */
export function loadEnvironmentConfig(environment?: ApiEnvironment): ApiEnvironmentConfig {
  const env = environment || getCurrentEnvironment();

  try {
    // プロジェクトルートのconfigディレクトリを探す
    const possiblePaths = [
      path.join(__dirname, '../../../config/environments.json'),
      path.join(process.cwd(), 'config/environments.json'),
      path.join(__dirname, '../../../../../config/environments.json'),
      path.join(__dirname, '../../../../config/environments.json'),
      // npm workspaceを考慮したパス
      path.join(process.cwd(), '../../../config/environments.json'),
      path.join(process.cwd(), '../../config/environments.json'),
    ];

    let configPath = '';
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        configPath = possiblePath;
        break;
      }
    }

    if (!configPath) {
      throw new Error(`Configuration file not found. Searched: ${possiblePaths.join(', ')}`);
    }

    console.log(`📄 Loading config from: ${configPath}`);
    const configData = fs.readFileSync(configPath, 'utf-8');
    const allConfigs = JSON.parse(configData);

    const config = allConfigs[env];
    if (!config) {
      throw new Error(`Configuration not found for environment: ${env}`);
    }

    // 環境変数でオーバーライド
    return applyEnvironmentOverrides(config, env);
  } catch (error) {
    console.error(`Failed to load config for environment ${env}:`, error);
    throw error;
  }
}

/**
 * 環境変数でオーバーライド
 */
function applyEnvironmentOverrides(
  config: ApiEnvironmentConfig,
  env: ApiEnvironment
): ApiEnvironmentConfig {
  const overrideConfig = { ...config };

  // API設定のオーバーライド
  if (process.env.API_BASE_URL) {
    overrideConfig.api.baseUrl = process.env.API_BASE_URL;
  }

  if (process.env.API_EVALUATE_ENDPOINT) {
    overrideConfig.api.evaluateEndpoint = process.env.API_EVALUATE_ENDPOINT;
  }

  // データベース設定のオーバーライド
  if (process.env.DYNAMODB_ENDPOINT) {
    overrideConfig.database.dynamodb.endpoint = process.env.DYNAMODB_ENDPOINT;
  }

  if (process.env.DYNAMODB_REGION) {
    overrideConfig.database.dynamodb.region = process.env.DYNAMODB_REGION;
  }

  if (process.env.FEATURE_FLAGS_TABLE_NAME) {
    overrideConfig.database.dynamodb.tableName = process.env.FEATURE_FLAGS_TABLE_NAME;
  }

  // インメモリフラグの使用設定
  if (process.env.USE_IN_MEMORY_FLAGS !== undefined) {
    overrideConfig.useInMemoryFlags = process.env.USE_IN_MEMORY_FLAGS === 'true';
  }

  console.log(`🔧 Loaded config for environment: ${env}`, {
    api: overrideConfig.api.baseUrl,
    database: overrideConfig.database.type,
    useInMemoryFlags: overrideConfig.useInMemoryFlags,
  });

  return overrideConfig;
}

/**
 * クライアント用の設定（sensitive情報を除く）
 */
export function getClientConfig(
  environment?: ApiEnvironment
): Pick<ApiEnvironmentConfig, 'name' | 'api'> {
  const config = loadEnvironmentConfig(environment);
  return {
    name: config.name,
    api: config.api,
  };
}

/**
 * 環境判定ユーティリティ
 */
export const isLocal = () => getCurrentEnvironment() === 'local';
export const isDev = () => getCurrentEnvironment() === 'dev';
export const isProd = () => getCurrentEnvironment() === 'prod';

export default {
  getCurrentEnvironment,
  loadEnvironmentConfig,
  getClientConfig,
  isLocal,
  isDev,
  isProd,
};
