# フィーチャーフラグシステム - シーケンス図

> **注意**: このドキュメントは技術的な詳細を含んでいます。一部の参照リンクは準備中です。

## 1. フラグ評価フロー（基本）

```mermaid
sequenceDiagram
    participant Client as Lambda Function
    participant SDK as FeatureFlag SDK
    participant Evaluator as FeatureFlagEvaluator
    participant Cache as FeatureFlagCache
    participant KillSwitch as Kill Switch Check
    participant DynamoDB as DynamoDB

    Client->>SDK: isFeatureEnabled(tenantId, flagKey)
    SDK->>Evaluator: isEnabled(context, flagKey)
    
    Note over Evaluator: フラグ評価開始
    
    %% 1. Kill-Switch チェック
    Evaluator->>KillSwitch: checkKillSwitch(flagKey)
    KillSwitch->>DynamoDB: getKillSwitch() [Global]
    DynamoDB-->>KillSwitch: killSwitchStatus
    
    alt Global Kill-Switch Enabled
        KillSwitch-->>Evaluator: true (disabled)
        Evaluator-->>SDK: false
        SDK-->>Client: false
        Note right of Client: 即座にfalseを返却
    else Global Kill-Switch Disabled
        KillSwitch->>DynamoDB: getKillSwitch(flagKey) [Flag-specific]
        DynamoDB-->>KillSwitch: flagKillSwitchStatus
        
        alt Flag Kill-Switch Enabled
            KillSwitch-->>Evaluator: true (disabled)
            Evaluator-->>SDK: false
            SDK-->>Client: false
        else Kill-Switch OK
            KillSwitch-->>Evaluator: false (enabled)
            
            %% 2. キャッシュチェック
            Evaluator->>Cache: get(tenantId, flagKey)
            Cache-->>Evaluator: cachedValue | undefined
            
            alt Cache Hit
                Note over Cache: TTL内の有効なキャッシュ
                Evaluator-->>SDK: cachedValue
                SDK-->>Client: cachedValue
            else Cache Miss
                %% 3. テナント別オーバーライドチェック
                Evaluator->>DynamoDB: getTenantOverride(tenantId, flagKey)
                DynamoDB-->>Evaluator: tenantOverride | undefined
                
                alt Tenant Override Exists
                    Evaluator->>Cache: set(tenantId, flagKey, overrideValue)
                    Evaluator-->>SDK: overrideValue
                    SDK-->>Client: overrideValue
                else No Tenant Override
                    %% 4. デフォルト値取得
                    Evaluator->>DynamoDB: getFlag(flagKey)
                    DynamoDB-->>Evaluator: flagConfig
                    Evaluator->>Cache: set(tenantId, flagKey, defaultValue)
                    Evaluator-->>SDK: defaultValue
                    SDK-->>Client: defaultValue
                end
            end
        end
    end
```

## 2. Kill-Switch 緊急停止フロー

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant UI as 管理画面
    participant API as Management API
    participant DynamoDB as DynamoDB
    participant Cache as 分散キャッシュ
    participant Lambda as Lambda Functions

    Admin->>UI: 緊急停止ボタンクリック
    UI->>Admin: 確認ダイアログ表示
    Admin->>UI: 理由を入力して確認
    
    UI->>API: POST /emergency/kill-switch
    Note over API: 認証・認可チェック
    
    API->>DynamoDB: setKillSwitch(enabled: true, reason, user)
    DynamoDB-->>API: 成功
    
    %% キャッシュ無効化
    API->>Cache: invalidateAll()
    Cache-->>API: キャッシュクリア完了
    
    %% 監視・アラート
    API->>API: CloudWatch メトリクス送信
    API->>API: SNS 緊急アラート送信
    
    API-->>UI: 成功レスポンス
    UI-->>Admin: 緊急停止完了通知
    
    Note over Lambda: 以降のフラグ評価は全てfalseを返却
    
    %% 次回のフラグ評価時
    Lambda->>DynamoDB: フラグ評価リクエスト
    Note over DynamoDB: Kill-Switch チェックで即座にfalse
    DynamoDB-->>Lambda: false (Kill-Switch有効)
```

## 3. テナント別オーバーライド設定フロー

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant UI as 管理画面
    participant API as Management API
    participant Validator as Input Validator
    participant DynamoDB as DynamoDB
    participant Cache as FeatureFlagCache
    participant AuditLog as 監査ログ

    Admin->>UI: テナント別設定画面を開く
    UI->>API: GET /flags/{flagKey}/tenants
    API->>DynamoDB: listTenantOverrides(flagKey)
    DynamoDB-->>API: 既存オーバーライド一覧
    API-->>UI: オーバーライド一覧表示
    
    Admin->>UI: 新しいオーバーライド設定
    UI->>API: PUT /flags/{flagKey}/tenants/{tenantId}
    
    API->>Validator: validateTenantOverrideRequest()
    Validator-->>API: バリデーション結果
    
    alt バリデーション成功
        API->>DynamoDB: setTenantOverride(tenantId, flagKey, enabled)
        DynamoDB-->>API: 設定完了
        
        %% キャッシュ無効化
        API->>Cache: invalidate(tenantId, flagKey)
        Cache-->>API: キャッシュ削除完了
        
        %% 監査ログ記録
        API->>AuditLog: recordOverrideChange(user, tenantId, flagKey, oldValue, newValue)
        
        API-->>UI: 成功レスポンス
        UI-->>Admin: 設定完了通知
        
        Note over Admin: 次回のフラグ評価から新しい値が適用
    else バリデーション失敗
        API-->>UI: エラーレスポンス
        UI-->>Admin: エラー表示
    end
```

## 4. フラグ作成・更新フロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant CLI as CLI Tool
    participant API as Management API
    participant Validator as Input Validator
    participant DynamoDB as DynamoDB
    participant Cache as グローバルキャッシュ
    participant Notification as 通知システム

    Dev->>CLI: feature-flag create --key "new_feature" --description "新機能"
    CLI->>API: POST /flags
    
    API->>Validator: validateFeatureFlagRequest()
    Validator->>Validator: フラグキー重複チェック
    Validator->>Validator: 命名規則チェック
    Validator-->>API: バリデーション結果
    
    alt バリデーション成功
        API->>DynamoDB: createFeatureFlag(flagKey, config)
        DynamoDB-->>API: 作成完了
        
        %% メタデータ設定
        API->>DynamoDB: setFlagMetadata(flagKey, owner, description, defaultEnabled)
        
        %% 関連チームへの通知
        API->>Notification: notifyFlagCreated(flagKey, owner, teams)
        
        API-->>CLI: 成功レスポンス
        CLI-->>Dev: フラグ作成完了
        
        Note over Dev: 新しいフラグが利用可能
    else バリデーション失敗
        API-->>CLI: エラーレスポンス
        CLI-->>Dev: エラー表示
    end
    
    %% フラグ更新の場合
    Dev->>CLI: feature-flag update --key "new_feature" --default-enabled true
    CLI->>API: PUT /flags/{flagKey}
    
    API->>DynamoDB: updateFeatureFlag(flagKey, updates)
    DynamoDB-->>API: 更新完了
    
    %% 全キャッシュ無効化（デフォルト値変更のため）
    API->>Cache: invalidateAllForFlag(flagKey)
    Cache-->>API: キャッシュクリア完了
    
    API-->>CLI: 成功レスポンス
    CLI-->>Dev: フラグ更新完了
```

## 5. エラーハンドリング・フォールバックフロー

```mermaid
sequenceDiagram
    participant Client as Lambda Function
    participant SDK as FeatureFlag SDK
    participant Evaluator as FeatureFlagEvaluator
    participant Cache as FeatureFlagCache
    participant DynamoDB as DynamoDB
    participant Monitoring as CloudWatch

    Client->>SDK: isFeatureEnabled(tenantId, flagKey)
    SDK->>Evaluator: isEnabled(context, flagKey)
    
    %% DynamoDB障害シナリオ
    Evaluator->>DynamoDB: getKillSwitch()
    DynamoDB-->>Evaluator: TimeoutException
    
    Note over Evaluator: DynamoDB接続エラー検出
    
    Evaluator->>Monitoring: logError("DynamoDB timeout", error)
    Evaluator->>Cache: get(tenantId, flagKey)
    
    alt キャッシュにデータあり
        Cache-->>Evaluator: cachedValue
        Note over Evaluator: キャッシュから値を返却
        Evaluator-->>SDK: cachedValue
        SDK-->>Client: cachedValue
        
        Client->>Monitoring: logWarning("Used cached value due to DynamoDB error")
    else キャッシュにデータなし
        Note over Evaluator: フォールバック値を使用
        Evaluator->>Evaluator: getFallbackValue(flagKey)
        Note over Evaluator: 安全側に倒す (false)
        
        Evaluator-->>SDK: false (fallback)
        SDK-->>Client: false
        
        Client->>Monitoring: logError("Used fallback value due to system error")
    end
    
    %% アラート送信
    Monitoring->>Monitoring: checkErrorThreshold()
    alt エラー率が閾値超過
        Monitoring->>Monitoring: sendAlert("FeatureFlag system degraded")
    end
```

## 6. 高負荷時のキャッシュ戦略

```mermaid
sequenceDiagram
    participant LB as Load Balancer
    participant Lambda1 as Lambda Instance 1
    participant Lambda2 as Lambda Instance 2
    participant Cache1 as Local Cache 1
    participant Cache2 as Local Cache 2
    participant DynamoDB as DynamoDB

    Note over LB: 高負荷トラフィック

    %% 最初のLambdaインスタンス
    LB->>Lambda1: リクエスト1
    Lambda1->>Cache1: get(tenant-A, billing_v2)
    Cache1-->>Lambda1: undefined (cache miss)
    Lambda1->>DynamoDB: getTenantOverride(tenant-A, billing_v2)
    DynamoDB-->>Lambda1: overrideValue
    Lambda1->>Cache1: set(tenant-A, billing_v2, true, ttl: 300s)
    Lambda1-->>LB: true

    %% 2番目のLambdaインスタンス（同じテナント）
    LB->>Lambda2: リクエスト2
    Lambda2->>Cache2: get(tenant-A, billing_v2)
    Cache2-->>Lambda2: undefined (cache miss)
    Lambda2->>DynamoDB: getTenantOverride(tenant-A, billing_v2)
    Note over DynamoDB: 同じデータへの並行アクセス
    DynamoDB-->>Lambda2: overrideValue
    Lambda2->>Cache2: set(tenant-A, billing_v2, true, ttl: 300s)
    Lambda2-->>LB: true

    %% 後続リクエスト（キャッシュヒット）
    LB->>Lambda1: リクエスト3
    Lambda1->>Cache1: get(tenant-A, billing_v2)
    Cache1-->>Lambda1: true (cache hit)
    Lambda1-->>LB: true

    LB->>Lambda2: リクエスト4
    Lambda2->>Cache2: get(tenant-A, billing_v2)
    Cache2-->>Lambda2: true (cache hit)
    Lambda2-->>LB: true

    Note over Lambda1,Lambda2: DynamoDBへの負荷軽減
    Note over Cache1,Cache2: TTL期限まで高速レスポンス
```

## 7. 監査ログ・トレーサビリティフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant API as Management API
    participant Auth as 認証システム
    participant DynamoDB as DynamoDB
    participant Streams as DynamoDB Streams
    participant AuditLog as 監査ログ
    participant CloudWatch as CloudWatch

    User->>API: フラグ設定変更リクエスト
    API->>Auth: validateUser(token)
    Auth-->>API: userInfo
    
    API->>DynamoDB: updateFeatureFlag(flagKey, changes)
    Note over DynamoDB: 変更をコミット
    
    %% DynamoDB Streamsによる変更検出
    DynamoDB->>Streams: 変更イベント発火
    Streams->>AuditLog: processChangeEvent(oldValue, newValue, timestamp)
    
    AuditLog->>AuditLog: createAuditRecord(
        action: "UPDATE_FLAG",
        user: userInfo,
        resource: flagKey,
        oldValue: oldValue,
        newValue: newValue,
        timestamp: timestamp,
        requestId: requestId
    )
    
    %% 監査ログをCloudWatchへ送信
    AuditLog->>CloudWatch: putLogEvent(auditRecord)
    
    %% 重要な変更の場合はアラート
    alt 本番環境での変更
        AuditLog->>CloudWatch: putMetric("ProductionFlagChange")
        CloudWatch->>CloudWatch: triggerAlert("Production flag modified")
    end
    
    API-->>User: 変更完了レスポンス
    
    Note over CloudWatch: 変更履歴は完全に追跡可能
    Note over AuditLog: 規制遵守・セキュリティ監査対応
```

## まとめ

これらのシーケンス図は以下の重要な要素をカバーしています：

1. **基本フロー**: 通常のフラグ評価処理
2. **緊急時対応**: Kill-Switch による即座の機能停止
3. **運用管理**: テナント別設定とフラグ管理
4. **障害対応**: エラー時のフォールバック戦略
5. **性能最適化**: キャッシュ戦略と負荷分散
6. **ガバナンス**: 監査ログとトレーサビリティ

各フローは実際の実装と整合性を保ち、運用時の様々なシナリオに対応できる設計となっています。