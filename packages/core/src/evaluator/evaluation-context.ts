/**
 * TDD Refactoring: 評価コンテキストの責務分離
 * Step 1: GREEN - 新しいEvaluationContext型を定義
 */

import { Environment, FeatureFlagKey, FeatureFlagContext } from '../models';

export interface EvaluationContext {
  tenantId: string;
  flagKey: FeatureFlagKey;
  environment: Environment;
}

/**
 * 責務: 入力パラメータの正規化とバリデーション
 * Single Responsibility Principle適用
 */
export class EvaluationContextBuilder {
  constructor(private readonly evaluatorEnvironment: Environment) {}

  /**
   * TDD実装: パラメータ正規化の責務を分離
   * @param contextOrTenantId オーバーロード対応の入力
   * @param flagKey フラグキー
   * @returns 正規化されたEvaluationContext
   */
  build(
    contextOrTenantId: FeatureFlagContext | string,
    flagKey: FeatureFlagKey | string
  ): EvaluationContext {
    // パラメータの正規化
    const context = this.normalizeParameters(contextOrTenantId, flagKey);
    
    // 環境の整合性チェック
    this.validateEnvironmentConsistency(context.environment);
    
    return context;
  }

  private normalizeParameters(
    contextOrTenantId: FeatureFlagContext | string,
    flagKey: FeatureFlagKey | string
  ): EvaluationContext {
    let tenantId: string;
    let environment: Environment;

    if (typeof contextOrTenantId === 'string') {
      tenantId = contextOrTenantId;
      environment = this.evaluatorEnvironment;
    } else {
      tenantId = contextOrTenantId.tenantId;
      environment = contextOrTenantId.environment || this.evaluatorEnvironment;
    }

    return {
      tenantId,
      environment,
      flagKey: flagKey as FeatureFlagKey,
    };
  }

  private validateEnvironmentConsistency(environment: Environment): void {
    if (environment !== this.evaluatorEnvironment) {
      throw new Error(
        `Environment mismatch: evaluator is configured for ${this.evaluatorEnvironment}, but context specifies ${environment}`
      );
    }
  }
}