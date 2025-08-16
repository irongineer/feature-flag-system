# 🏢 勤怠管理アプリでのフィーチャーフラグ活用ガイド

## 概要

勤怠管理SaaSアプリケーションでフィーチャーフラグを効果的に活用する方法を、具体的な実装例とともに説明します。

## 🎯 勤怠管理アプリでの活用シナリオ

### 1. 新機能の段階的ロールアウト
- **有給申請ワークフロー改善**
- **勤務時間自動計算機能**  
- **モバイルアプリ対応**
- **多言語対応**

### 2. A/Bテスト
- **UI/UX改善テスト**
- **通知タイミング最適化**
- **レポート表示形式**

### 3. 緊急時対応
- **障害時の機能無効化**
- **負荷軽減のための機能制限**
- **メンテナンス時の部分機能停止**

## 🔧 実装例

### 基本実装（勤怠アプリ）

```html
<!-- packages/admin-ui/attendance-saas/attendance-app.html -->
<!DOCTYPE html>
<html>
<head>
    <title>勤怠管理システム</title>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
    <div id="app">
        <h1>勤怠管理システム</h1>
        
        <!-- フィーチャーフラグで制御される要素 -->
        <div id="new-timecard" style="display: none;">
            <h2>新しいタイムカード機能</h2>
            <button onclick="startWork()">出勤</button>
            <button onclick="endWork()">退勤</button>
        </div>
        
        <div id="legacy-timecard">
            <h2>従来のタイムカード</h2>
            <button onclick="legacyStartWork()">出勤記録</button>
            <button onclick="legacyEndWork()">退勤記録</button>
        </div>
        
        <div id="overtime-calculator" style="display: none;">
            <h2>残業時間自動計算</h2>
            <p>本日の残業時間: <span id="overtime-hours">0</span>時間</p>
        </div>
        
        <div id="mobile-app-notice" style="display: none;">
            <div class="notice">
                📱 新しいモバイルアプリがリリースされました！
                <a href="/mobile-app-download">ダウンロード</a>
            </div>
        </div>
    </div>
    
    <script>
        // フィーチャーフラグクライアント設定
        class AttendanceFeatureFlags {
            constructor() {
                // 環境自動検出
                this.environment = this.detectEnvironment();
                this.apiEndpoint = this.getApiEndpoint();
                this.tenantId = this.getTenantId();
            }
            
            detectEnvironment() {
                const hostname = window.location.hostname;
                if (hostname.includes('localhost')) return 'local';
                if (hostname.includes('dev-') || hostname.includes('-dev')) return 'dev';
                return 'prod';
            }
            
            getApiEndpoint() {
                const endpoints = {
                    local: 'http://localhost:3001/api',
                    dev: 'https://dev-api.feature-flags.example.com/api',
                    prod: 'https://api.feature-flags.example.com/api'
                };
                return endpoints[this.environment];
            }
            
            getTenantId() {
                // 実際のアプリでは認証情報から取得
                return 'attendance-company-123';
            }
            
            async evaluateFlag(flagKey) {
                try {
                    const response = await axios.post(`${this.apiEndpoint}/evaluate`, {
                        tenantId: this.tenantId,
                        flagKey: flagKey,
                        environment: this.environment,
                        metadata: {
                            appVersion: '2.1.0',
                            userAgent: navigator.userAgent,
                            clientType: 'web'
                        }
                    });
                    
                    console.log(`Flag ${flagKey} evaluation:`, response.data);
                    return response.data.enabled;
                } catch (error) {
                    console.error(`Flag evaluation failed for ${flagKey}:`, error);
                    // フェイルセーフ: 新機能は保守的にfalse
                    return this.getFailsafeValue(flagKey);
                }
            }
            
            getFailsafeValue(flagKey) {
                // 勤怠管理アプリ固有のフェイルセーフ値
                const conservativeFlags = {
                    'new_timecard_ui': false,      // 新UI: 保守的にfalse
                    'overtime_calculator': false,  // 計算機能: false
                    'mobile_app_promotion': false, // プロモーション: false
                    'maintenance_mode': true       // メンテナンス: 安全側でtrue
                };
                
                return conservativeFlags[flagKey] || false;
            }
        }
        
        // アプリ初期化
        const featureFlags = new AttendanceFeatureFlags();
        
        async function initializeApp() {
            console.log(`勤怠管理アプリを${featureFlags.environment}環境で初期化中...`);
            
            // 各フィーチャーフラグの評価と表示制御
            await Promise.all([
                toggleNewTimecardUI(),
                toggleOvertimeCalculator(), 
                toggleMobileAppPromotion(),
                checkMaintenanceMode()
            ]);
            
            console.log('アプリ初期化完了');
        }
        
        async function toggleNewTimecardUI() {
            const enabled = await featureFlags.evaluateFlag('new_timecard_ui');
            
            if (enabled) {
                document.getElementById('new-timecard').style.display = 'block';
                document.getElementById('legacy-timecard').style.display = 'none';
                console.log('✅ 新しいタイムカードUIを表示');
            } else {
                document.getElementById('new-timecard').style.display = 'none';
                document.getElementById('legacy-timecard').style.display = 'block';
                console.log('📋 従来のタイムカードUIを表示');
            }
        }
        
        async function toggleOvertimeCalculator() {
            const enabled = await featureFlags.evaluateFlag('overtime_calculator');
            
            document.getElementById('overtime-calculator').style.display = 
                enabled ? 'block' : 'none';
                
            if (enabled) {
                console.log('🧮 残業時間自動計算機能を有効化');
                calculateOvertimeHours();
            }
        }
        
        async function toggleMobileAppPromotion() {
            const enabled = await featureFlags.evaluateFlag('mobile_app_promotion');
            
            document.getElementById('mobile-app-notice').style.display = 
                enabled ? 'block' : 'none';
                
            if (enabled) {
                console.log('📱 モバイルアプリプロモーションを表示');
            }
        }
        
        async function checkMaintenanceMode() {
            const inMaintenance = await featureFlags.evaluateFlag('maintenance_mode');
            
            if (inMaintenance) {
                document.body.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <h1>🔧 メンテナンス中</h1>
                        <p>システムメンテナンスのため、一時的にサービスを停止しています。</p>
                        <p>ご迷惑をおかけして申し訳ございません。</p>
                    </div>
                `;
                console.log('🔧 メンテナンスモードが有効');
            }
        }
        
        // 勤怠管理機能の実装
        function startWork() {
            console.log('新UI: 出勤記録を開始');
            alert('出勤時刻を記録しました (新UI)');
        }
        
        function endWork() {
            console.log('新UI: 退勤記録を開始');
            alert('退勤時刻を記録しました (新UI)');
        }
        
        function legacyStartWork() {
            console.log('従来UI: 出勤記録');
            alert('出勤記録完了 (従来UI)');
        }
        
        function legacyEndWork() {
            console.log('従来UI: 退勤記録');
            alert('退勤記録完了 (従来UI)');
        }
        
        function calculateOvertimeHours() {
            // 残業時間計算のサンプル実装
            const currentHour = new Date().getHours();
            const overtimeHours = Math.max(0, currentHour - 18); // 18時以降を残業
            document.getElementById('overtime-hours').textContent = overtimeHours;
        }
        
        // フラグ状態を手動で最新化する機能
        async function refreshFeatureFlags() {
            console.log('🔄 フィーチャーフラグ状態を更新中...');
            await initializeApp();
            alert('フィーチャーフラグの状態を更新しました');
        }
        
        // アプリ初期化実行
        window.addEventListener('load', initializeApp);
    </script>
    
    <!-- 開発・テスト用のコントロールパネル -->
    <div id="dev-controls" style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; background: #f9f9f9;">
        <h3>🔧 開発・テスト用コントロール</h3>
        <p>現在の環境: <strong id="current-env"></strong></p>
        <p>API エンドポイント: <strong id="current-api"></strong></p>
        <p>テナントID: <strong id="current-tenant"></strong></p>
        <button onclick="refreshFeatureFlags()">🔄 フラグ状態更新</button>
        <button onclick="showFlagStatus()">📊 フラグ状態表示</button>
    </div>
    
    <script>
        // 開発情報の表示
        document.getElementById('current-env').textContent = featureFlags.environment;
        document.getElementById('current-api').textContent = featureFlags.apiEndpoint;
        document.getElementById('current-tenant').textContent = featureFlags.tenantId;
        
        async function showFlagStatus() {
            const flags = ['new_timecard_ui', 'overtime_calculator', 'mobile_app_promotion', 'maintenance_mode'];
            const statuses = {};
            
            for (const flag of flags) {
                statuses[flag] = await featureFlags.evaluateFlag(flag);
            }
            
            const statusText = Object.entries(statuses)
                .map(([flag, enabled]) => `${flag}: ${enabled ? '✅' : '❌'}`)
                .join('\n');
                
            alert(`フラグ状態:\n\n${statusText}`);
        }
    </script>
</body>
</html>
```

## 🎯 勤怠管理固有のフラグ戦略

### 1. 段階的ロールアウト戦略

```typescript
// 勤怠管理アプリでの段階的展開例
const rolloutStrategy = {
  phase1: {
    target: "内部テスト部門",
    percentage: 5,
    flags: ["new_timecard_ui"],
    metrics: ["ユーザー満足度", "エラー率", "使用率"]
  },
  phase2: {
    target: "ベータユーザー企業", 
    percentage: 25,
    flags: ["new_timecard_ui", "overtime_calculator"],
    metrics: ["業務効率", "機能使用率", "サポート問い合わせ"]
  },
  phase3: {
    target: "スタンダードプラン",
    percentage: 50, 
    flags: ["new_timecard_ui", "overtime_calculator", "mobile_app_promotion"],
    metrics: ["解約率", "アップグレード率", "NPS"]
  },
  phase4: {
    target: "全ユーザー",
    percentage: 100,
    flags: ["new_timecard_ui", "overtime_calculator", "mobile_app_promotion"],
    metrics: ["総合満足度", "機能普及率", "ビジネス成果"]
  }
};
```

### 2. A/Bテスト設計例

```typescript
// 勤怠管理でのA/Bテスト例
const abTestScenarios = {
  // 出退勤ボタンのデザインテスト
  timecard_button_design: {
    variantA: "従来の角丸ボタン",
    variantB: "フラットデザインボタン", 
    variantC: "アイコン付きボタン",
    metrics: ["クリック率", "誤操作率", "ユーザー満足度"],
    duration: "2週間",
    sampleSize: "最低1000ユーザー"
  },
  
  // 残業アラートのタイミングテスト
  overtime_alert_timing: {
    variantA: "18:00に1回アラート",
    variantB: "18:00, 19:00, 20:00に段階的アラート",
    variantC: "個人設定時間でアラート",
    metrics: ["残業時間削減率", "アラート反応率", "設定完了率"],
    duration: "1ヶ月",
    sampleSize: "最低500ユーザー"
  }
};
```

### 3. 緊急時対応シナリオ

```typescript
// 勤怠管理での緊急フラグ設計
const emergencyFlags = {
  // システム負荷軽減
  reduce_system_load: {
    description: "高負荷時に重い機能を無効化",
    affects: ["自動計算機能", "リアルタイム更新", "詳細レポート"],
    trigger: "CPU使用率 > 80% が5分継続",
    action: "軽量版UIに切り替え"
  },
  
  // データ不整合発生時
  data_inconsistency_mode: {
    description: "データ不整合検出時の安全モード",
    affects: ["自動計算", "一括更新", "データ同期"],
    trigger: "整合性チェックエラー",
    action: "手動確認モードに切り替え"
  },
  
  // 法改正対応
  labor_law_compliance: {
    description: "労働基準法改正対応",
    affects: ["残業時間計算", "有給日数計算", "労働時間制限"],
    trigger: "法改正施行日",
    action: "新しい計算ロジックを適用"
  }
};
```

## 📊 勤怠管理アプリでの効果測定

### KPI例

```typescript
// 勤怠管理アプリでの成功指標
const attendanceAppKPIs = {
  // ユーザビリティ指標
  usability: {
    task_completion_rate: "タスク完了率 > 95%",
    error_rate: "操作エラー率 < 2%", 
    user_satisfaction: "満足度スコア > 4.0/5.0",
    feature_adoption: "新機能採用率 > 60%"
  },
  
  // ビジネス指標
  business: {
    time_saved: "入力時間短縮 > 30%",
    accuracy_improvement: "データ精度向上 > 10%",
    support_ticket_reduction: "問い合わせ削減 > 20%",
    user_retention: "継続利用率 > 90%"
  },
  
  // 技術指標
  technical: {
    response_time: "画面表示速度 < 2秒",
    availability: "稼働率 > 99.5%",
    mobile_compatibility: "モバイル対応率 100%",
    api_success_rate: "API成功率 > 99%"
  }
};
```

### 効果測定の実装

```typescript
// 勤怠管理アプリでの効果測定実装例
class AttendanceAnalytics {
  constructor(featureFlags) {
    this.featureFlags = featureFlags;
    this.analytics = new Analytics();
  }
  
  async trackFeatureUsage(feature, action, metadata = {}) {
    const flagEnabled = await this.featureFlags.evaluateFlag(feature);
    
    this.analytics.track('feature_usage', {
      feature: feature,
      action: action,
      flag_enabled: flagEnabled,
      environment: this.featureFlags.environment,
      tenant_id: this.featureFlags.tenantId,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
  
  async trackTimecardAction(action, method) {
    await this.trackFeatureUsage('timecard', action, {
      method: method, // 'new_ui' or 'legacy_ui'
      timestamp: new Date().toISOString()
    });
  }
  
  async trackOvertimeCalculation(hours, accuracy) {
    await this.trackFeatureUsage('overtime_calculator', 'calculate', {
      calculated_hours: hours,
      accuracy_score: accuracy,
      calculation_time: Date.now()
    });
  }
}

// 使用例
const analytics = new AttendanceAnalytics(featureFlags);

// タイムカード操作の追跡
function startWork() {
    analytics.trackTimecardAction('start_work', 'new_ui');
    // 実際の出勤処理...
}

function calculateOvertimeHours() {
    const hours = performOvertimeCalculation();
    analytics.trackOvertimeCalculation(hours, 0.98);
    // 表示更新...
}
```

## 🚨 勤怠管理アプリでのフェイルセーフ

### 重要な考慮事項

```typescript
// 勤怠管理アプリ固有のフェイルセーフ設計
const attendanceFailsafes = {
  // 勤怠データの保護
  timecard_data_protection: {
    rule: "勤怠データは絶対に失われてはならない",
    implementation: "フラグ無効時も基本記録機能は維持",
    fallback: "最小限のタイムカード機能を保証"
  },
  
  // 法的コンプライアンス
  legal_compliance: {
    rule: "労働基準法に違反する状態は避ける",
    implementation: "計算エラー時は安全側（従業員有利）に",
    fallback: "手動確認を促すメッセージ表示"
  },
  
  // 給与計算への影響
  payroll_calculation: {
    rule: "給与計算に影響する機能は慎重に",
    implementation: "計算機能エラー時は管理者に通知",
    fallback: "従来の確実な計算方式に切り替え"
  }
};
```

## 関連ドキュメント

- [開発者向け環境切り替えガイド](../developers/environment-switching.md)
- [運用者向けフラグ管理ガイド](../operators/README.md)
- [環境設定詳細](../environments/README.md)
- [API仕様書](../api/openapi.yaml)