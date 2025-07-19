# 📈 データサイエンティスト向けドキュメント

> **注意**: このドキュメントは段階的に作成中です。多くのリンク先ファイルが **(準備中)** 状態です。

## 📋 概要

このセクションでは、フィーチャーフラグシステムで収集されるデータを分析し、A/Bテストの効果測定や機能の改善提案を行うデータサイエンティスト向けの情報を提供します。

## 🎯 データサイエンティストの責務

### データ分析
- ✅ A/Bテスト結果の統計分析
- ✅ ユーザー行動分析
- ✅ 機能効果測定
- ✅ 予測分析・機械学習

### 効果測定
- ✅ KPI設定・追跡
- ✅ 統計的有意性検定
- ✅ 効果サイズ計算
- ✅ ROI分析

### 洞察提供
- ✅ データドリブンな意思決定支援
- ✅ ユーザーセグメンテーション
- ✅ 機能改善提案
- ✅ 予測モデル構築

## 🚀 クイックスタート

### 💡 最初にやること
1. [データソースの理解](#データソース)
2. [分析環境の構築](#分析環境)
3. [A/Bテスト分析の基本](#ABテスト分析)
4. [統計的手法の適用](#統計手法)

### 📊 データソース
```sql
-- フィーチャーフラグ関連のデータテーブル
-- 1. フラグ評価ログ
CREATE TABLE flag_evaluations (
    id SERIAL PRIMARY KEY,
    flag_key VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255),
    enabled BOOLEAN NOT NULL,
    variation VARCHAR(100),
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ユーザー行動イベント
CREATE TABLE user_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ビジネスメトリクス
CREATE TABLE business_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    currency VARCHAR(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📚 分析ガイド

### 📖 基本分析（推定時間: 4-5時間）
1. [データ探索分析](./exploratory-data-analysis.md)
2. [記述統計](./descriptive-statistics.md)
3. [データ可視化](./data-visualization.md)
4. [データ品質評価](./data-quality-assessment.md)

### 🧪 A/Bテスト分析（推定時間: 6-8時間）
1. [A/Bテスト設計](./ab-test-design.md)
2. [サンプルサイズ計算](./sample-size-calculation.md)
3. [統計的検定](./statistical-testing.md)
4. [効果サイズ計算](./effect-size-calculation.md)

### 📊 高度な分析（推定時間: 8-10時間）
1. [多変量解析](./multivariate-analysis.md)
2. [機械学習応用](./machine-learning-applications.md)
3. [予測モデリング](./predictive-modeling.md)
4. [因果推論](./causal-inference.md)

### 🎯 ビジネス分析（推定時間: 4-6時間）
1. [ROI分析](./roi-analysis.md)
2. [ユーザーセグメンテーション](./user-segmentation.md)
3. [コホート分析](./cohort-analysis.md)
4. [LTV分析](./ltv-analysis.md)

## 🧪 A/Bテスト分析

### 📊 実験設計
#### A/Bテスト設計フレームワーク
```python
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

class ABTestDesigner:
    def __init__(self):
        self.alpha = 0.05  # 有意水準
        self.power = 0.8   # 検出力
        
    def calculate_sample_size(self, baseline_rate, minimum_detectable_effect):
        """
        サンプルサイズ計算
        """
        effect_size = minimum_detectable_effect / baseline_rate
        z_alpha = stats.norm.ppf(1 - self.alpha/2)
        z_beta = stats.norm.ppf(self.power)
        
        # 比率の差の検定用サンプルサイズ
        p1 = baseline_rate
        p2 = baseline_rate * (1 + effect_size)
        p_pooled = (p1 + p2) / 2
        
        sample_size = ((z_alpha * np.sqrt(2 * p_pooled * (1 - p_pooled)) + 
                       z_beta * np.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) / 
                      (p2 - p1)) ** 2
        
        return int(np.ceil(sample_size))
    
    def design_experiment(self, metric_name, baseline_rate, 
                         minimum_detectable_effect, duration_days):
        """
        実験設計
        """
        sample_size = self.calculate_sample_size(baseline_rate, minimum_detectable_effect)
        
        design = {
            'metric': metric_name,
            'baseline_rate': baseline_rate,
            'minimum_detectable_effect': minimum_detectable_effect,
            'sample_size_per_group': sample_size,
            'total_sample_size': sample_size * 2,
            'duration_days': duration_days,
            'daily_sample_requirement': int(sample_size * 2 / duration_days),
            'alpha': self.alpha,
            'power': self.power
        }
        
        return design
```

### 📈 結果分析
#### 統計的検定と効果測定
```python
class ABTestAnalyzer:
    def __init__(self):
        self.alpha = 0.05
        
    def analyze_proportions(self, control_successes, control_total, 
                           treatment_successes, treatment_total):
        """
        比率の比較（コンバージョン率など）
        """
        # 基本統計
        control_rate = control_successes / control_total
        treatment_rate = treatment_successes / treatment_total
        
        # 統計的検定
        z_stat, p_value = stats.proportions_ztest(
            [control_successes, treatment_successes],
            [control_total, treatment_total]
        )
        
        # 効果サイズ
        effect_size = (treatment_rate - control_rate) / control_rate
        
        # 信頼区間
        diff = treatment_rate - control_rate
        se_diff = np.sqrt(
            control_rate * (1 - control_rate) / control_total +
            treatment_rate * (1 - treatment_rate) / treatment_total
        )
        ci_lower = diff - 1.96 * se_diff
        ci_upper = diff + 1.96 * se_diff
        
        return {
            'control_rate': control_rate,
            'treatment_rate': treatment_rate,
            'absolute_difference': diff,
            'relative_difference': effect_size,
            'z_statistic': z_stat,
            'p_value': p_value,
            'is_significant': p_value < self.alpha,
            'confidence_interval': (ci_lower, ci_upper)
        }
    
    def analyze_means(self, control_values, treatment_values):
        """
        平均値の比較（売上、滞在時間など）
        """
        # 基本統計
        control_mean = np.mean(control_values)
        treatment_mean = np.mean(treatment_values)
        control_std = np.std(control_values, ddof=1)
        treatment_std = np.std(treatment_values, ddof=1)
        
        # t検定
        t_stat, p_value = stats.ttest_ind(treatment_values, control_values)
        
        # 効果サイズ (Cohen's d)
        pooled_std = np.sqrt(((len(control_values) - 1) * control_std**2 + 
                            (len(treatment_values) - 1) * treatment_std**2) / 
                           (len(control_values) + len(treatment_values) - 2))
        cohens_d = (treatment_mean - control_mean) / pooled_std
        
        return {
            'control_mean': control_mean,
            'treatment_mean': treatment_mean,
            'difference': treatment_mean - control_mean,
            'relative_difference': (treatment_mean - control_mean) / control_mean,
            't_statistic': t_stat,
            'p_value': p_value,
            'is_significant': p_value < self.alpha,
            'cohens_d': cohens_d
        }
    
    def multiple_testing_correction(self, p_values, method='bonferroni'):
        """
        多重検定補正
        """
        from statsmodels.stats.multitest import multipletests
        
        rejected, corrected_p_values, alpha_sidak, alpha_bonf = multipletests(
            p_values, alpha=self.alpha, method=method
        )
        
        return {
            'original_p_values': p_values,
            'corrected_p_values': corrected_p_values,
            'rejected': rejected,
            'corrected_alpha': alpha_bonf if method == 'bonferroni' else alpha_sidak
        }
```

## 📊 データ可視化

### 📈 A/Bテスト結果の可視化
```python
class ABTestVisualizer:
    def __init__(self):
        plt.style.use('seaborn-v0_8')
        
    def plot_conversion_rates(self, results_df):
        """
        コンバージョン率の比較
        """
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # バープロット
        groups = results_df['group'].unique()
        rates = results_df.groupby('group')['converted'].mean()
        
        ax1.bar(groups, rates, color=['#3498db', '#e74c3c'])
        ax1.set_title('Conversion Rates by Group')
        ax1.set_ylabel('Conversion Rate')
        ax1.set_ylim(0, max(rates) * 1.2)
        
        # 信頼区間付きバープロット
        ci_lower = []
        ci_upper = []
        for group in groups:
            group_data = results_df[results_df['group'] == group]
            rate = group_data['converted'].mean()
            n = len(group_data)
            se = np.sqrt(rate * (1 - rate) / n)
            ci_lower.append(rate - 1.96 * se)
            ci_upper.append(rate + 1.96 * se)
        
        ax2.bar(groups, rates, color=['#3498db', '#e74c3c'], alpha=0.7)
        ax2.errorbar(groups, rates, yerr=[np.array(rates) - np.array(ci_lower),
                                         np.array(ci_upper) - np.array(rates)], 
                    fmt='none', color='black', capsize=5)
        ax2.set_title('Conversion Rates with 95% Confidence Intervals')
        ax2.set_ylabel('Conversion Rate')
        
        plt.tight_layout()
        plt.show()
    
    def plot_time_series(self, results_df):
        """
        時系列での結果推移
        """
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # 日別コンバージョン率
        daily_rates = results_df.groupby(['date', 'group'])['converted'].mean().unstack()
        
        daily_rates.plot(ax=ax, marker='o', linewidth=2)
        ax.set_title('Daily Conversion Rates')
        ax.set_xlabel('Date')
        ax.set_ylabel('Conversion Rate')
        ax.legend(title='Group')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
    
    def plot_statistical_power(self, effect_sizes, sample_sizes):
        """
        統計的検出力の可視化
        """
        fig, ax = plt.subplots(figsize=(10, 6))
        
        for effect_size in effect_sizes:
            powers = []
            for n in sample_sizes:
                # 検出力計算
                z_beta = stats.norm.ppf(0.8)  # 80%検出力
                z_alpha = stats.norm.ppf(0.975)  # 両側5%
                
                # 簡略化された検出力計算
                delta = effect_size
                power = 1 - stats.norm.cdf(z_alpha - delta * np.sqrt(n/2))
                powers.append(power)
            
            ax.plot(sample_sizes, powers, label=f'Effect Size: {effect_size:.1%}')
        
        ax.axhline(y=0.8, color='red', linestyle='--', label='80% Power')
        ax.set_xlabel('Sample Size per Group')
        ax.set_ylabel('Statistical Power')
        ax.set_title('Statistical Power vs Sample Size')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
```

## 🎯 ユーザーセグメンテーション

### 👥 セグメンテーション分析
```python
class UserSegmentAnalyzer:
    def __init__(self):
        pass
    
    def rfm_analysis(self, user_data):
        """
        RFM分析（Recency, Frequency, Monetary）
        """
        # 最新の購入日からの日数
        user_data['recency'] = (user_data['analysis_date'] - 
                               user_data['last_purchase_date']).dt.days
        
        # 購入頻度
        user_data['frequency'] = user_data['purchase_count']
        
        # 購入金額
        user_data['monetary'] = user_data['total_spent']
        
        # 五分位数でスコア化
        user_data['r_score'] = pd.qcut(user_data['recency'], 5, 
                                      labels=[5,4,3,2,1]).astype(int)
        user_data['f_score'] = pd.qcut(user_data['frequency'].rank(method='first'), 5, 
                                      labels=[1,2,3,4,5]).astype(int)
        user_data['m_score'] = pd.qcut(user_data['monetary'], 5, 
                                      labels=[1,2,3,4,5]).astype(int)
        
        # RFMスコア
        user_data['rfm_score'] = (user_data['r_score'].astype(str) + 
                                 user_data['f_score'].astype(str) + 
                                 user_data['m_score'].astype(str))
        
        # セグメント分類
        def classify_segment(row):
            if row['rfm_score'] in ['555', '554', '544', '545', '454', '455', '445']:
                return 'Champions'
            elif row['rfm_score'] in ['543', '444', '435', '355', '354', '345', '344', '335']:
                return 'Loyal Customers'
            elif row['rfm_score'] in ['553', '551', '552', '541', '542', '533', '532', '531', '452', '451']:
                return 'Potential Loyalists'
            elif row['rfm_score'] in ['512', '511', '422', '421', '412', '411', '311']:
                return 'New Customers'
            elif row['rfm_score'] in ['155', '154', '144', '214', '215', '115', '114']:
                return 'At Risk'
            else:
                return 'Others'
        
        user_data['segment'] = user_data.apply(classify_segment, axis=1)
        
        return user_data
    
    def behavioral_segmentation(self, user_events):
        """
        行動ベースセグメンテーション
        """
        # 行動指標の計算
        user_behavior = user_events.groupby('user_id').agg({
            'session_id': 'nunique',  # セッション数
            'page_views': 'sum',      # ページビュー数
            'time_spent': 'sum',      # 滞在時間
            'feature_usage': 'sum'    # 機能使用回数
        }).reset_index()
        
        # 正規化
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(user_behavior.iloc[:, 1:])
        
        # クラスタリング
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=5, random_state=42)
        clusters = kmeans.fit_predict(scaled_features)
        
        user_behavior['cluster'] = clusters
        
        return user_behavior
```

## 📊 ROI分析

### 💰 投資対効果分析
```python
class ROIAnalyzer:
    def __init__(self):
        pass
    
    def calculate_feature_roi(self, development_cost, maintenance_cost, 
                            revenue_impact, user_impact, time_period_months):
        """
        機能のROI計算
        """
        # 総コスト
        total_cost = development_cost + (maintenance_cost * time_period_months)
        
        # 総収益
        total_revenue = revenue_impact * time_period_months
        
        # ROI計算
        roi = (total_revenue - total_cost) / total_cost * 100
        
        # 投資回収期間
        payback_period = total_cost / (revenue_impact if revenue_impact > 0 else 1)
        
        return {
            'total_cost': total_cost,
            'total_revenue': total_revenue,
            'net_profit': total_revenue - total_cost,
            'roi_percentage': roi,
            'payback_period_months': payback_period
        }
    
    def ab_test_roi_analysis(self, control_metrics, treatment_metrics, 
                            traffic_percentage, implementation_cost):
        """
        A/Bテストの投資対効果分析
        """
        # 効果計算
        revenue_per_user_control = control_metrics['revenue_per_user']
        revenue_per_user_treatment = treatment_metrics['revenue_per_user']
        
        # 年間売上への影響
        annual_users = control_metrics['annual_users']
        annual_revenue_impact = (revenue_per_user_treatment - revenue_per_user_control) * \
                              annual_users * traffic_percentage
        
        # ROI計算
        roi = (annual_revenue_impact - implementation_cost) / implementation_cost * 100
        
        return {
            'annual_revenue_impact': annual_revenue_impact,
            'implementation_cost': implementation_cost,
            'roi_percentage': roi,
            'break_even_point': implementation_cost / annual_revenue_impact * 365 if annual_revenue_impact > 0 else float('inf')
        }
```

## 🤖 機械学習応用

### 📊 予測モデリング
```python
class FeatureFlagPredictor:
    def __init__(self):
        self.models = {}
    
    def predict_conversion_probability(self, user_features, flag_features):
        """
        フィーチャーフラグ有効化による効果予測
        """
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import roc_auc_score, classification_report
        
        # 特徴量エンジニアリング
        X = self.create_features(user_features, flag_features)
        y = user_features['converted']
        
        # 訓練・テスト分割
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # モデル訓練
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        # 予測
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        
        # 評価
        auc_score = roc_auc_score(y_test, y_pred_proba)
        classification_rep = classification_report(y_test, y_pred)
        
        self.models['conversion_predictor'] = model
        
        return {
            'model': model,
            'auc_score': auc_score,
            'classification_report': classification_rep,
            'feature_importance': dict(zip(X.columns, model.feature_importances_))
        }
    
    def create_features(self, user_features, flag_features):
        """
        特徴量作成
        """
        # ユーザー特徴量
        features = pd.DataFrame({
            'user_age': user_features['age'],
            'user_tenure': user_features['tenure_days'],
            'user_activity_score': user_features['activity_score'],
            'user_segment': pd.Categorical(user_features['segment']).codes,
            'flag_enabled': flag_features['enabled'].astype(int),
            'flag_duration': flag_features['duration_days']
        })
        
        # 交互作用項
        features['age_x_flag'] = features['user_age'] * features['flag_enabled']
        features['tenure_x_flag'] = features['user_tenure'] * features['flag_enabled']
        
        return features
    
    def uplift_modeling(self, user_data):
        """
        アップリフトモデリング
        """
        from sklearn.ensemble import GradientBoostingClassifier
        
        # 処理群と対照群のデータ
        treatment_data = user_data[user_data['treatment'] == 1]
        control_data = user_data[user_data['treatment'] == 0]
        
        # 各群でのモデル訓練
        features = ['age', 'tenure', 'activity_score', 'segment']
        
        # 処理群モデル
        treatment_model = GradientBoostingClassifier(random_state=42)
        treatment_model.fit(treatment_data[features], treatment_data['converted'])
        
        # 対照群モデル
        control_model = GradientBoostingClassifier(random_state=42)
        control_model.fit(control_data[features], control_data['converted'])
        
        # アップリフト予測
        def predict_uplift(user_features):
            treatment_prob = treatment_model.predict_proba(user_features)[:, 1]
            control_prob = control_model.predict_proba(user_features)[:, 1]
            return treatment_prob - control_prob
        
        return {
            'treatment_model': treatment_model,
            'control_model': control_model,
            'uplift_predictor': predict_uplift
        }
```

## 📋 レポート作成

### 📊 分析レポートテンプレート
```python
class AnalysisReporter:
    def __init__(self):
        pass
    
    def generate_ab_test_report(self, test_results, business_impact):
        """
        A/Bテストレポート生成
        """
        report = {
            'executive_summary': {
                'test_name': test_results['test_name'],
                'duration': test_results['duration'],
                'sample_size': test_results['sample_size'],
                'primary_metric': test_results['primary_metric'],
                'result': 'Significant' if test_results['is_significant'] else 'Not Significant',
                'recommendation': self.generate_recommendation(test_results, business_impact)
            },
            
            'statistical_results': {
                'p_value': test_results['p_value'],
                'confidence_interval': test_results['confidence_interval'],
                'effect_size': test_results['effect_size'],
                'statistical_power': test_results['statistical_power']
            },
            
            'business_impact': {
                'revenue_impact': business_impact['revenue_impact'],
                'user_impact': business_impact['user_impact'],
                'roi': business_impact['roi'],
                'implementation_cost': business_impact['implementation_cost']
            },
            
            'risks_and_considerations': {
                'technical_risks': business_impact['technical_risks'],
                'user_experience_impact': business_impact['ux_impact'],
                'long_term_considerations': business_impact['long_term_considerations']
            }
        }
        
        return report
    
    def generate_recommendation(self, test_results, business_impact):
        """
        推奨事項の生成
        """
        if test_results['is_significant'] and business_impact['roi'] > 150:
            return "Implement: 統計的に有意で、ROIが十分に高い"
        elif test_results['is_significant'] and business_impact['roi'] > 0:
            return "Consider: 統計的に有意だが、ROIを慎重に検討"
        elif not test_results['is_significant']:
            return "Do not implement: 統計的に有意でない"
        else:
            return "Further analysis needed: 追加分析が必要"
```

## 🔧 ツール・リソース

### 分析ツール
- [Python](https://www.python.org/) - データ分析プログラミング
- [R](https://www.r-project.org/) - 統計解析
- [Jupyter Notebook](https://jupyter.org/) - 分析環境
- [Tableau](https://www.tableau.com/) - データ可視化

### 統計ライブラリ
- [SciPy](https://scipy.org/) - 統計関数
- [scikit-learn](https://scikit-learn.org/) - 機械学習
- [statsmodels](https://www.statsmodels.org/) - 統計モデル
- [pandas](https://pandas.pydata.org/) - データ処理

### 可視化ツール
- [Matplotlib](https://matplotlib.org/) - 基本的な可視化
- [Seaborn](https://seaborn.pydata.org/) - 統計可視化
- [Plotly](https://plotly.com/) - インタラクティブ可視化
- [Grafana](https://grafana.com/) - ダッシュボード

### 連絡先
- データサイエンスチームリーダー: ds-lead@your-company.com
- 統計専門家: stats@your-company.com
- プロダクトマネージャー: pm@your-company.com

## 📚 学習リソース

### 🎓 トレーニング
- [統計学基礎](./training/statistics-fundamentals.md)
- [A/Bテスト分析](./training/ab-test-analysis.md)
- [機械学習応用](./training/machine-learning-applications.md)

### 📖 参考資料
- [統計手法ガイド](./guides/statistical-methods.md)
- [A/Bテストベストプラクティス](./guides/ab-test-best-practices.md)
- [因果推論入門](./guides/causal-inference-guide.md)

---

## 🎯 分析の成功指標

### 📊 分析品質指標
- **統計的検出力**: 80%以上
- **効果サイズ検出**: 実用的な効果サイズの検出
- **分析精度**: 予測モデルのAUC 0.7以上
- **レポート品質**: ステークホルダー満足度90%以上

### 📈 継続的改善
- 週次での分析結果レビュー
- 月次での手法改善
- 四半期での分析戦略見直し

**次のステップ**: [A/Bテスト設計](./ab-test-design.md)から始めましょう！