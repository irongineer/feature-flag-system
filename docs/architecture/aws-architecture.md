# AWSシステム構成図 - フィーチャーフラグシステム

## 全体アーキテクチャ概要

```mermaid
graph TB
    %% External Users
    User[管理者/開発者] 
    App[アプリケーション<br/>Lambda Functions]
    
    %% Edge & Security
    CloudFront[CloudFront<br/>CDN]
    WAF[AWS WAF<br/>Web Application Firewall]
    
    %% API Gateway
    APIGW[API Gateway<br/>REST API<br/>管理API]
    
    %% Compute
    ManagementLambda[Management API<br/>Lambda Functions]
    EvaluationLayer[Evaluation Layer<br/>Lambda Layer]
    
    %% Storage
    DynamoDB[(DynamoDB<br/>Feature Flags<br/>Tenant Overrides<br/>Emergency Controls)]
    S3[S3 Bucket<br/>Static Assets<br/>管理画面]
    
    %% Authentication & Authorization
    Cognito[AWS Cognito<br/>User Pool<br/>認証・認可]
    IAM[AWS IAM<br/>Role-based Access]
    
    %% Monitoring & Logging
    CloudWatch[CloudWatch<br/>Logs & Metrics]
    XRay[AWS X-Ray<br/>Distributed Tracing]
    SNS[Amazon SNS<br/>アラート通知]
    
    %% Development & Deployment
    CodeCommit[AWS CodeCommit<br/>Git Repository]
    CodeBuild[AWS CodeBuild<br/>CI/CD Pipeline]
    CDK[AWS CDK<br/>Infrastructure as Code]
    
    %% Data Flow - Management
    User --> CloudFront
    CloudFront --> WAF
    WAF --> APIGW
    APIGW --> Cognito
    APIGW --> ManagementLambda
    ManagementLambda --> DynamoDB
    ManagementLambda --> CloudWatch
    ManagementLambda --> XRay
    
    %% Data Flow - Feature Flag Evaluation
    App --> EvaluationLayer
    EvaluationLayer --> DynamoDB
    EvaluationLayer --> CloudWatch
    
    %% Management UI
    CloudFront --> S3
    
    %% Monitoring & Alerting
    CloudWatch --> SNS
    DynamoDB --> CloudWatch
    
    %% Deployment
    CodeCommit --> CodeBuild
    CodeBuild --> CDK
    CDK --> DynamoDB
    CDK --> ManagementLambda
    CDK --> APIGW

    %% Styling
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef storage fill:#3F48CC,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef compute fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef monitoring fill:#FF4B4B,stroke:#232F3E,stroke-width:2px,color:#fff
    classDef security fill:#4B9900,stroke:#232F3E,stroke-width:2px,color:#fff
    
    class DynamoDB,S3 storage
    class ManagementLambda,EvaluationLayer,APIGW compute
    class CloudWatch,XRay,SNS monitoring
    class Cognito,IAM,WAF security
```

## 詳細コンポーネント構成

### 1. フロントエンド層

```mermaid
graph LR
    subgraph "Frontend Layer"
        AdminUI[管理画面<br/>React + Vite]
        CLI[CLI Tool<br/>Node.js]
        SDK[Feature Flag SDK<br/>TypeScript]
    end
    
    subgraph "Edge & CDN"
        CloudFront[CloudFront<br/>Global CDN]
        S3Web[S3 Static Hosting<br/>管理画面Assets]
        WAF[AWS WAF<br/>DDoS Protection]
    end
    
    AdminUI --> CloudFront
    CloudFront --> S3Web
    CloudFront --> WAF
    CLI --> APIGW[API Gateway]
    SDK --> Lambda[Lambda Functions]
    WAF --> APIGW
    
    classDef frontend fill:#61DAFB,stroke:#000,stroke-width:2px,color:#000
    classDef edge fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#fff
    
    class AdminUI,CLI,SDK frontend
    class CloudFront,S3Web,WAF edge
```

### 2. API Gateway 構成

```mermaid
graph TB
    subgraph "API Gateway"
        APIGW[REST API Gateway]
        
        subgraph "Resources"
            FlagsResource[/flags]
            TenantsResource[/flags/{flagKey}/tenants]
            EmergencyResource[/emergency/kill-switch]
            HealthResource[/health]
        end
        
        subgraph "Security"
            Authorizer[Cognito Authorizer]
            ThrottlingPolicy[Throttling Policy<br/>1000 req/sec]
            CORS[CORS Configuration]
        end
    end
    
    subgraph "Backend Integration"
        ManagementLambda[Management Lambda<br/>CRUD Operations]
        EvaluationLambda[Evaluation Lambda<br/>Flag Resolution]
    end
    
    APIGW --> FlagsResource
    APIGW --> TenantsResource
    APIGW --> EmergencyResource
    APIGW --> HealthResource
    
    FlagsResource --> ManagementLambda
    TenantsResource --> ManagementLambda
    EmergencyResource --> ManagementLambda
    HealthResource --> EvaluationLambda
    
    APIGW --> Authorizer
    APIGW --> ThrottlingPolicy
    APIGW --> CORS
```

### 3. Lambda アーキテクチャ

```mermaid
graph TB
    subgraph "Lambda Functions"
        subgraph "Management API Layer"
            CreateFlag[Create Flag Handler]
            UpdateFlag[Update Flag Handler]
            GetFlag[Get Flag Handler]
            DeleteFlag[Delete Flag Handler]
            SetOverride[Set Tenant Override]
            KillSwitch[Kill Switch Handler]
        end
        
        subgraph "Evaluation Layer"
            EvaluateFlag[Flag Evaluation Handler]
            CacheLayer[Feature Flag Cache<br/>Lambda Layer]
        end
        
        subgraph "Shared Components"
            CoreLayer[Core Business Logic<br/>Lambda Layer]
            ValidationLayer[Input Validation<br/>Lambda Layer]
            ObservabilityLayer[Observability<br/>Lambda Layer]
        end
    end
    
    subgraph "External Services"
        DynamoDB[(DynamoDB)]
        CloudWatch[CloudWatch]
        XRay[X-Ray]
    end
    
    CreateFlag --> CoreLayer
    UpdateFlag --> CoreLayer
    GetFlag --> CoreLayer
    DeleteFlag --> CoreLayer
    SetOverride --> CoreLayer
    KillSwitch --> CoreLayer
    
    EvaluateFlag --> CacheLayer
    CacheLayer --> CoreLayer
    
    CoreLayer --> DynamoDB
    CoreLayer --> CloudWatch
    CoreLayer --> XRay
    
    CoreLayer --> ValidationLayer
    CoreLayer --> ObservabilityLayer
```

### 4. DynamoDB テーブル設計

```mermaid
erDiagram
    FeatureFlags {
        string PK "FLAG#flagKey"
        string SK "METADATA" 
        string flagKey
        string description
        boolean defaultEnabled
        string owner
        datetime createdAt
        datetime expiresAt
        string GSI1PK "EXPIRES"
        datetime GSI1SK "expiresAt"
    }
    
    TenantOverrides {
        string PK "TENANT#tenantId"
        string SK "FLAG#flagKey"
        boolean enabled
        datetime updatedAt
        string updatedBy
        string GSI1PK "FLAG#flagKey"
        string GSI1SK "TENANT#tenantId"
    }
    
    EmergencyControls {
        string PK "EMERGENCY"
        string SK "GLOBAL | FLAG#flagKey"
        boolean enabled
        string reason
        datetime activatedAt
        string activatedBy
    }
    
    AuditLogs {
        string PK "AUDIT#YYYY-MM-DD"
        string SK "timestamp#requestId"
        string action
        string resource
        string userId
        object oldValue
        object newValue
        datetime timestamp
    }
    
    FeatureFlags ||--o{ TenantOverrides : "has overrides"
    FeatureFlags ||--o{ EmergencyControls : "has kill switches"
    FeatureFlags ||--o{ AuditLogs : "generates audit trail"
```

### 5. セキュリティ & 認証

```mermaid
graph TB
    subgraph "Security Layer"
        subgraph "Authentication"
            CognitoUserPool[Cognito User Pool<br/>ユーザー認証]
            CognitoIdentity[Cognito Identity Pool<br/>一時認証情報]
            JWT[JWT Token<br/>API認証]
        end
        
        subgraph "Authorization"
            IAMRoles[IAM Roles<br/>Role-based Access]
            AdminRole[Admin Role<br/>Full Access]
            DevRole[Developer Role<br/>Read + Limited Write]
            ViewerRole[Viewer Role<br/>Read Only]
        end
        
        subgraph "Network Security"
            VPC[VPC<br/>Private Network]
            SecurityGroups[Security Groups<br/>Traffic Control]
            WAF[AWS WAF<br/>Application Layer]
        end
    end
    
    subgraph "Resource Access"
        APIGW[API Gateway]
        Lambda[Lambda Functions]
        DynamoDB[(DynamoDB)]
    end
    
    CognitoUserPool --> JWT
    JWT --> APIGW
    APIGW --> Lambda
    
    CognitoIdentity --> IAMRoles
    IAMRoles --> AdminRole
    IAMRoles --> DevRole
    IAMRoles --> ViewerRole
    
    AdminRole --> Lambda
    DevRole --> Lambda
    ViewerRole --> Lambda
    
    Lambda --> DynamoDB
    
    WAF --> APIGW
    VPC --> Lambda
    SecurityGroups --> Lambda
```

### 6. 監視 & ログ

```mermaid
graph TB
    subgraph "Observability Stack"
        subgraph "Logs"
            CloudWatchLogs[CloudWatch Logs<br/>Structured Logging]
            LogGroups[Log Groups<br/>Per Service]
            LogStreams[Log Streams<br/>Per Instance]
        end
        
        subgraph "Metrics"
            CloudWatchMetrics[CloudWatch Metrics<br/>Performance Monitoring]
            CustomMetrics[Custom Metrics<br/>Business KPIs]
            Dashboards[CloudWatch Dashboards<br/>Real-time Visualization]
        end
        
        subgraph "Tracing"
            XRay[AWS X-Ray<br/>Distributed Tracing]
            ServiceMap[Service Map<br/>Request Flow]
            TraceAnalysis[Trace Analysis<br/>Performance Insights]
        end
        
        subgraph "Alerting"
            CloudWatchAlarms[CloudWatch Alarms<br/>Threshold Monitoring]
            SNS[Amazon SNS<br/>Notification Service]
            EmailAlerts[Email Notifications]
            SlackAlerts[Slack Integration]
        end
    end
    
    subgraph "Data Sources"
        Lambda[Lambda Functions]
        APIGW[API Gateway]
        DynamoDB[(DynamoDB)]
    end
    
    Lambda --> CloudWatchLogs
    Lambda --> CloudWatchMetrics
    Lambda --> XRay
    
    APIGW --> CloudWatchLogs
    APIGW --> CloudWatchMetrics
    
    DynamoDB --> CloudWatchMetrics
    
    CloudWatchMetrics --> CloudWatchAlarms
    CloudWatchAlarms --> SNS
    SNS --> EmailAlerts
    SNS --> SlackAlerts
    
    CloudWatchMetrics --> Dashboards
    XRay --> ServiceMap
    XRay --> TraceAnalysis
```

### 7. CI/CD パイプライン

```mermaid
graph TB
    subgraph "Source Control"
        GitHub[GitHub Repository<br/>Source Code]
        GitHubActions[GitHub Actions<br/>CI/CD Workflows]
    end
    
    subgraph "Build & Test"
        BuildStage[Build Stage<br/>TypeScript Compilation]
        TestStage[Test Stage<br/>Unit + Integration Tests]
        SecurityScan[Security Scan<br/>SAST + Dependency Check]
        QualityGate[Quality Gate<br/>Code Coverage + Linting]
    end
    
    subgraph "Deployment Pipeline"
        CDKSynth[CDK Synth<br/>Infrastructure Template]
        DevDeploy[Development Deploy<br/>Auto Deployment]
        StagingDeploy[Staging Deploy<br/>Manual Approval]
        ProdDeploy[Production Deploy<br/>Blue-Green Strategy]
    end
    
    subgraph "AWS Resources"
        DevEnvironment[Development<br/>AWS Account]
        StagingEnvironment[Staging<br/>AWS Account]
        ProductionEnvironment[Production<br/>AWS Account]
    end
    
    GitHub --> GitHubActions
    GitHubActions --> BuildStage
    BuildStage --> TestStage
    TestStage --> SecurityScan
    SecurityScan --> QualityGate
    
    QualityGate --> CDKSynth
    CDKSynth --> DevDeploy
    DevDeploy --> StagingDeploy
    StagingDeploy --> ProdDeploy
    
    DevDeploy --> DevEnvironment
    StagingDeploy --> StagingEnvironment
    ProdDeploy --> ProductionEnvironment
```

## 環境別構成

### Development Environment

```mermaid
graph TB
    subgraph "Development (dev-account)"
        DevAPI[API Gateway<br/>dev-feature-flags-api]
        DevLambda[Lambda Functions<br/>Shared Resources]
        DevDynamoDB[(DynamoDB<br/>Small Capacity)]
        DevCloudWatch[CloudWatch<br/>Basic Monitoring]
    end
    
    DevAPI --> DevLambda
    DevLambda --> DevDynamoDB
    DevLambda --> DevCloudWatch
    
    classDef dev fill:#90EE90,stroke:#000,stroke-width:2px,color:#000
    class DevAPI,DevLambda,DevDynamoDB,DevCloudWatch dev
```

### Staging Environment

```mermaid
graph TB
    subgraph "Staging (staging-account)"
        StagingAPI[API Gateway<br/>staging-feature-flags-api]
        StagingLambda[Lambda Functions<br/>Production Configuration]
        StagingDynamoDB[(DynamoDB<br/>Production-like Capacity)]
        StagingCloudWatch[CloudWatch<br/>Full Monitoring]
        StagingXRay[X-Ray<br/>Distributed Tracing]
    end
    
    StagingAPI --> StagingLambda
    StagingLambda --> StagingDynamoDB
    StagingLambda --> StagingCloudWatch
    StagingLambda --> StagingXRay
    
    classDef staging fill:#FFD700,stroke:#000,stroke-width:2px,color:#000
    class StagingAPI,StagingLambda,StagingDynamoDB,StagingCloudWatch,StagingXRay staging
```

### Production Environment

```mermaid
graph TB
    subgraph "Production (prod-account)"
        ProdCloudFront[CloudFront<br/>Global CDN]
        ProdWAF[AWS WAF<br/>DDoS Protection]
        ProdAPI[API Gateway<br/>production-feature-flags-api]
        
        subgraph "High Availability"
            ProdLambda1[Lambda Functions<br/>us-east-1]
            ProdLambda2[Lambda Functions<br/>us-west-2]
        end
        
        subgraph "Data Layer"
            ProdDynamoDB[(DynamoDB<br/>Multi-AZ)]
            ProdBackup[DynamoDB Backup<br/>Point-in-time Recovery]
        end
        
        subgraph "Monitoring"
            ProdCloudWatch[CloudWatch<br/>Full Monitoring]
            ProdXRay[X-Ray<br/>Performance Tracing]
            ProdSNS[SNS<br/>Critical Alerts]
        end
    end
    
    ProdCloudFront --> ProdWAF
    ProdWAF --> ProdAPI
    ProdAPI --> ProdLambda1
    ProdAPI --> ProdLambda2
    ProdLambda1 --> ProdDynamoDB
    ProdLambda2 --> ProdDynamoDB
    ProdDynamoDB --> ProdBackup
    ProdLambda1 --> ProdCloudWatch
    ProdLambda1 --> ProdXRay
    ProdCloudWatch --> ProdSNS
    
    classDef prod fill:#FF6B6B,stroke:#000,stroke-width:2px,color:#fff
    class ProdCloudFront,ProdWAF,ProdAPI,ProdLambda1,ProdLambda2,ProdDynamoDB,ProdBackup,ProdCloudWatch,ProdXRay,ProdSNS prod
```

## コスト最適化戦略

### Lambda 最適化

- **Provisioned Concurrency**: 高頻度APIのみ適用
- **Memory Optimization**: 実測値に基づく最適化
- **Layer Strategy**: 共通ライブラリの効率的共有

### DynamoDB 最適化

- **On-Demand**: 開発・ステージング環境
- **Provisioned**: 本番環境（予測可能な負荷）
- **Auto Scaling**: トラフィック変動への自動対応

### 監視コスト最適化

- **Log Retention**: 環境別の適切な保持期間設定
- **Metric Filtering**: 重要メトリクスのみ長期保存
- **Alarm Optimization**: 適切な閾値設定でノイズ削減

## セキュリティ考慮事項

### データ保護

- **Encryption at Rest**: DynamoDB暗号化
- **Encryption in Transit**: TLS 1.2+
- **Key Management**: AWS KMS統合

### アクセス制御

- **Principle of Least Privilege**: 最小権限の原則
- **Role Separation**: 環境別IAMロール分離
- **MFA Enforcement**: 管理者アクセスでのMFA必須

### 監査・コンプライアンス

- **CloudTrail**: API呼び出しの完全ログ
- **Config Rules**: リソース設定の継続監視
- **GuardDuty**: 異常検知とセキュリティ監視

この構成図は、スケーラビリティ、可用性、セキュリティ、コスト効率性を考慮したエンタープライズグレードのフィーチャーフラグシステムを表現しています。