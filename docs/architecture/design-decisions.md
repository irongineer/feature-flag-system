# フィーチャーフラグシステム設計決定記録 (ADR)

> **注意**: このドキュメントは専門的な設計判断を記録したものです。一部の参照リンクは準備中です。

## フェーズ2: 設計・準備 - エキスパート議論録

### 参加者ペルソナ
- **Martin Fowler**: アーキテクチャ設計、エンタープライズパターン
- **Kent Beck**: TDD、シンプル設計、XP プラクティス
- **Robert C. Martin (Uncle Bob)**: クリーンアーキテクチャ、SOLID原則
- **Eric Evans**: ドメイン駆動設計 (DDD)
- **Michael Feathers**: レガシーコード改善、テスト戦略
- **Jeff Sutherland**: スクラム、アジャイル開発
- **和田卓人**: TDD、テスト設計、継続的改善

---

## 議論1: アーキテクチャパターンの選択

### 🎯 論点: レイヤードアーキテクチャ vs ヘキサゴナルアーキテクチャ

**Robert C. Martin**: 
> フィーチャーフラグシステムは明確にビジネスルールが存在する。フラグ評価ロジック、テナント管理、Kill-Switch機能は外部依存から独立すべきだ。ヘキサゴナルアーキテクチャで依存関係逆転を適用し、DynamoDBやキャッシュは外部ポートとして扱うべき。

**Eric Evans**:
> 同意見だ。ただし、フィーチャーフラグ自体がドメインの中核概念なのか検討が必要。私の見解では、これは技術的な横断的関心事（Cross-cutting Concern）であり、純粋なドメインモデルよりもサービス層の設計が重要だろう。

**Martin Fowler**:
> 興味深い点だ。しかし、テナント別の複雑なルール（A/Bテスト、段階的ロールアウト）を考慮すると、これは単なる設定以上のドメインロジックを持つ。私はレイヤードアーキテクチャでシンプルに始めて、必要に応じてヘキサゴナルに進化させることを提案する。

**Kent Beck**:
> YAGNI原則からすると、MVPフェーズでは最もシンプルな構造から始めるべき。現在のフラグ評価要件（ON/OFF + Kill-Switch）なら、過度なアーキテクチャは不要だ。

### 💡 決定: **段階的アーキテクチャ進化**

```typescript
// Phase 1: シンプルレイヤード (MVP)
interface FeatureFlagEvaluator {
  isEnabled(context: Context, flagKey: string): Promise<boolean>
}

// Phase 2: ヘキサゴナル進化 (将来)
interface FeatureFlagRepository {
  findFlag(flagKey: string): Promise<FeatureFlag>
  findTenantOverride(tenantId: string, flagKey: string): Promise<Override>
}
```

**根拠**: 
- MVPは最小複雑度で価値提供
- 将来の拡張性は保持
- テスタビリティは現設計でも確保

---

## 議論2: エラーハンドリング戦略

### 🎯 論点: Fail-Fast vs Graceful Degradation

**Michael Feathers**:
> フィーチャーフラグシステムの障害は、アプリケーション全体を停止させるべきではない。Graceful Degradationで、エラー時はデフォルト値（通常はfalse）を返すべきだ。

**Robert C. Martin**:
> 同意するが、エラーは適切にログ記録し、監視システムに通知されるべき。Silent Failureは絶対に避けるべきだ。

**和田卓人**:
> テスト観点から、エラー状態のテストケースが重要。モックを使って各種障害シナリオをテストできる設計にすべき。また、Circuit Breaker パターンの検討も必要では？

**Kent Beck**:
> 最初はシンプルなRetry + Fallbackから始めよう。Circuit Breakerは運用経験を積んでから追加する。

### 💡 決定: **Safe Fallback + Comprehensive Logging**

```typescript
class FeatureFlagEvaluator {
  async isEnabled(context: Context, flagKey: string): Promise<boolean> {
    try {
      return await this.evaluateFlag(context, flagKey);
    } catch (error) {
      // Critical: 必ずログ記録
      this.logger.error('FeatureFlag evaluation failed', { 
        flagKey, 
        tenantId: context.tenantId, 
        error 
      });
      
      // Safe: デフォルト値で安全側に
      return this.getDefaultValue(flagKey);
    }
  }
}
```

**根拠**:
- システム全体の可用性を優先
- 観測可能性（Observability）を確保
- 段階的な耐障害性向上

---

## 議論3: キャッシュ戦略

### 🎯 論点: Local Cache vs Distributed Cache vs Hybrid

**Martin Fowler**:
> Lambda環境では、コンテナ再利用によるLocal Cacheが効果的。ただし、TTL管理と一貫性が課題になる。

**Robert C. Martin**:
> キャッシュは外部依存として抽象化すべき。LocalCache実装から始めて、後でRedisなどの分散キャッシュに置き換え可能な設計にする。

**Michael Feathers**:
> キャッシュのテストが複雑になりがち。TTL関連のテストは時間依存になるため、Time Providerパターンでテスタブルにする必要がある。

**Kent Beck**:
> Red-Green-Refactor サイクルで、まずはシンプルなMap-based cacheから始める。TTLテストはモックタイマーで実装。

### 💡 決定: **Local Cache with Interface Abstraction**

```typescript
interface CacheProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidateAll(): Promise<void>;
}

// Phase 1: Lambda Local Cache
class MemoryCacheProvider implements CacheProvider {
  // 実装
}

// Phase 2: 分散キャッシュ (将来)
class RedisCacheProvider implements CacheProvider {
  // 実装
}
```

**根拠**:
- Lambda環境に最適化
- 将来の分散キャッシュ移行を考慮
- テスタブルな設計

---

## 議論4: テスト戦略

### 🎯 論点: テストピラミッド構成とTDD適用

**Kent Beck**:
> フィーチャーフラグ評価は純粋関数に近い。TDDで単体テストから始め、各種条件（Kill-Switch、Override、Default）を網羅的にテストする。

**和田卓人**:
> 同感。ただし、DynamoDB依存のテストをどう扱うかが重要。実際のAWSサービスではなく、LocalStackやモックを使うべき。

**Michael Feathers**:
> レガシー化を防ぐため、外部依存は全てinterface化する。これにより、モックを使った高速な単体テストが可能になる。

**Martin Fowler**:
> 統合テストも重要だが、比率は単体:統合:E2E = 70:20:10程度にする。フィーチャーフラグシステムはAPIが中心なので、Contract Testingも検討価値がある。

### 💡 決定: **TDD + Test Double Strategy**

```typescript
// テスト構成例
describe('FeatureFlagEvaluator', () => {
  // 1. Pure logic (Fast)
  it('should return false when kill-switch is active');
  it('should return tenant override when exists');
  
  // 2. With mocks (Fast) 
  it('should handle DynamoDB errors gracefully');
  
  // 3. Integration (Slower)
  it('should work with local DynamoDB');
});
```

**テストピラミッド**:
- 単体テスト (Vitest): 70% - ロジック + モック
- 統合テスト (Vitest): 20% - LocalStack DynamoDB
- E2E テスト (Playwright): 10% - 実環境API

**根拠**:
- 高速フィードバックサイクル
- 回帰テストの信頼性
- CI/CD効率性

---

## 議論5: 観測可能性 (Observability)

### 🎯 論点: ログ、メトリクス、トレーシング戦略

**Martin Fowler**:
> フィーチャーフラグの状態変更は、ビジネス上重要な情報だ。単なる技術ログではなく、ビジネスイベントとして記録すべき。

**Robert C. Martin**:
> ログは構造化し、機械可読性を重視する。また、個人情報を含む可能性があるため、ログレベルでのフィルタリングが必要。

**Jeff Sutherland**:
> プロダクトオーナーやステークホルダーが、フィーチャーフラグの影響を理解できるメトリクスが必要。ダッシュボードで可視化すべき。

**和田卓人**:
> テスト環境での観測可能性も重要。テスト実行時のフラグ状態が、後から追跡可能であるべき。

### 💡 決定: **Structured Logging + Business Metrics**

```typescript
interface ObservabilityService {
  // 技術メトリクス
  recordEvaluationLatency(duration: number, flagKey: string): void;
  recordCacheHitRate(hitRate: number): void;
  
  // ビジネスメトリクス  
  recordFlagEvaluation(flagKey: string, result: boolean, reason: string): void;
  recordFlagToggle(flagKey: string, oldState: boolean, newState: boolean, user: string): void;
  
  // エラー追跡
  recordError(error: Error, context: any): void;
}
```

**ログレベル定義**:
- ERROR: システム障害、要immediate対応
- WARN: 期待しない状態、monitoring必要
- INFO: ビジネスイベント、監査要
- DEBUG: 技術詳細、開発/障害調査用

**根拠**:
- ビジネス価値とtech metricsの両立
- 規制対応（監査ログ）
- 運用効率性

---

## 議論6: デプロイメント戦略

### 🎯 論点: Blue-Green vs Canary vs Rolling Deployment

**Jeff Sutherland**:
> フィーチャーフラグシステム自体が、アプリケーションの重要なインフラ。段階的なリスク軽減が必要。Canary Deploymentを推奨する。

**Martin Fowler**:
> 同意見だが、フィーチャーフラグシステムが自分自身をフラグで制御するという興味深い再帰性がある。これをどう扱うかは重要な設計判断だ。

**Robert C. Martin**:
> デプロイメント戦略は、アーキテクチャの関心事ではない。ただし、Immutable Infrastructureの原則は守るべき。

**Kent Beck**:
> 最初はシンプルなBlue-Greenから始めて、運用経験を積んでからCanaryに進化させる。

### 💡 決定: **Evolutionary Deployment Strategy**

**Phase 1**: Blue-Green Deployment (MVP)
- Lambda Aliasを使用した瞬時切り替え
- 1分以内のrollback capability

**Phase 2**: Canary Deployment (将来)
- Weighted routing (10% → 50% → 100%)
- 自動rollback triggers

**特別考慮**:
```typescript
// フィーチャーフラグシステム自体のフラグ
const SYSTEM_FLAGS = {
  NEW_EVALUATION_ENGINE: 'system_new_engine_enable',
  ENHANCED_CACHE: 'system_enhanced_cache_enable'
} as const;
```

**根拠**:
- システム信頼性の段階的向上
- 運用チームの学習曲線考慮
- Cost vs Risk のバランス

---

## 最終決定サマリー

### 🏗️ アーキテクチャ原則

1. **Progressive Architecture**: シンプル → 複雑さを段階的に
2. **Dependency Inversion**: 外部依存の抽象化
3. **Fail-Safe Design**: エラー時は安全側に倒す
4. **Observable by Design**: 観測可能性を設計段階から
5. **Test-Driven Evolution**: テストによる品質保証

### 📐 設計パターン適用

- **Strategy Pattern**: キャッシュ実装の切り替え
- **Template Method**: フラグ評価アルゴリズム
- **Circuit Breaker**: 将来の耐障害性向上
- **Observer Pattern**: フラグ変更通知

### 🎯 品質属性優先順位

1. **可用性** (Availability): 99.9%+
2. **性能** (Performance): <10ms response time
3. **保守性** (Maintainability): テスト容易性
4. **セキュリティ** (Security): 監査ログ、認可
5. **スケーラビリティ** (Scalability): 将来拡張性

---

## 実装への落とし込み

この議論結果は、以下の実装決定に反映されました：

1. **packages/core/**: ドメインロジックの分離
2. **モック戦略**: テスタビリティ重視の設計
3. **エラーハンドリング**: Graceful degradation実装
4. **キャッシュ**: Local cache + interface抽象化
5. **観測可能性**: 構造化ログ + メトリクス

### 🔄 継続的改善

この設計決定は、実装経験と運用フィードバックに基づいて継続的に見直されます。
特に以下の指標を注視：

- フラグ評価レイテンシ
- キャッシュヒット率
- エラー率とMTTR
- 開発チームの生産性指標

---

*この議論録は、Martin Fowler、Kent Beck、Robert C. Martin、Eric Evans、Michael Feathers、Jeff Sutherland、和田卓人の各氏の公開された見解と実践に基づいて構成されています。*