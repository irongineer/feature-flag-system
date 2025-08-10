/**
 * Multi-Environment Configuration Management
 *
 * マルチ環境サポートのための設定管理
 */
import { Environment, EnvironmentConfig } from '../models';
/**
 * 環境固有設定を取得
 */
export declare function getEnvironmentConfig(environment: Environment): EnvironmentConfig;
/**
 * 現在の環境を判定
 */
export declare function getCurrentEnvironment(): Environment;
/**
 * 環境別のテーブル名生成
 */
export declare function getTableName(environment: Environment): string;
/**
 * 環境別のキープレフィックス生成
 */
export declare function getEnvironmentKeyPrefix(environment: Environment): string;
/**
 * DynamoDBキーに環境プレフィックスを追加
 */
export declare function addEnvironmentToKey(baseKey: string, environment: Environment): string;
/**
 * 環境設定の検証
 */
export declare function validateEnvironmentConfig(config: EnvironmentConfig): boolean;
/**
 * 環境固有のデバッグログ出力
 */
export declare function debugLog(environment: Environment, message: string, data?: any): void;
/**
 * 全環境の設定を取得（管理用）
 */
export declare function getAllEnvironmentConfigs(): Record<Environment, EnvironmentConfig>;
/**
 * 環境間でのフラグ設定同期チェック
 */
export interface EnvironmentSyncStatus {
    flagKey: string;
    environments: {
        development?: boolean;
        staging?: boolean;
        production?: boolean;
    };
    isConsistent: boolean;
    recommendations: string[];
}
/**
 * 環境固有の機能フラグ評価ポリシー
 */
export interface EnvironmentPolicy {
    environment: Environment;
    allowOverrides: boolean;
    requireApproval: boolean;
    maxCacheTtl: number;
    auditLevel: 'basic' | 'detailed' | 'comprehensive';
}
export declare const ENVIRONMENT_POLICIES: Record<Environment, EnvironmentPolicy>;
//# sourceMappingURL=environment.d.ts.map