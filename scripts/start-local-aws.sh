#!/bin/bash

# AWS SAM Local + DynamoDB Local 統合テスト環境起動スクリプト
# フィーチャーフラグシステム

set -e

echo "🚀 AWS SAM Local + DynamoDB Local 統合テスト環境を起動中..."
echo "================================================================"

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件チェック中..."
    
    # AWS SAM CLI
    if ! command -v sam &> /dev/null; then
        log_error "AWS SAM CLI が見つかりません"
        log_info "インストール: brew install aws-sam-cli"
        exit 1
    fi
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker が見つかりません"
        log_info "インストール: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Docker Daemon チェック
    if ! docker info &> /dev/null; then
        log_error "Docker Daemon が起動していません"
        log_info "Docker Desktop を起動してください"
        exit 1
    fi
    
    # Node.js & npm
    if ! command -v node &> /dev/null; then
        log_error "Node.js が見つかりません"
        exit 1
    fi
    
    log_info "✅ 前提条件チェック完了"
}

# DynamoDB Local起動
start_dynamodb_local() {
    log_info "DynamoDB Local を起動中..."
    
    # 既存のDynamoDB Localコンテナをクリーンアップ
    if docker ps -a | grep -q dynamodb-local; then
        log_warn "既存のDynamoDB Localコンテナを停止・削除中..."
        docker stop dynamodb-local 2>/dev/null || true
        docker rm dynamodb-local 2>/dev/null || true
    fi
    
    # DynamoDB Local起動（バックグラウンド）
    docker run -d \
        --name dynamodb-local \
        -p 8000:8000 \
        amazon/dynamodb-local:latest \
        -jar DynamoDBLocal.jar \
        -sharedDb \
        -inMemory
    
    # 起動待機
    log_info "DynamoDB Local の起動を待機中..."
    for i in {1..30}; do
        if curl -s http://localhost:8000 > /dev/null 2>&1; then
            log_info "✅ DynamoDB Local が起動しました (http://localhost:8000)"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            log_error "DynamoDB Local の起動がタイムアウトしました"
            exit 1
        fi
    done
}

# DynamoDBテーブル作成
create_tables() {
    log_info "DynamoDB テーブルを作成中..."
    
    # AWS CLI設定（ローカル用）
    export AWS_ACCESS_KEY_ID=dummy
    export AWS_SECRET_ACCESS_KEY=dummy
    export AWS_DEFAULT_REGION=ap-northeast-1
    
    # テーブル作成関数
    create_table() {
        local table_name=$1
        local key_schema=$2
        local attribute_definitions=$3
        local global_secondary_indexes=$4
        
        log_info "テーブル作成: $table_name"
        
        local cmd="aws dynamodb create-table \
            --endpoint-url http://localhost:8000 \
            --table-name $table_name \
            --billing-mode PAY_PER_REQUEST \
            --key-schema $key_schema \
            --attribute-definitions $attribute_definitions"
        
        if [ -n "$global_secondary_indexes" ]; then
            cmd="$cmd --global-secondary-indexes $global_secondary_indexes"
        fi
        
        eval $cmd > /dev/null 2>&1 || true
    }
    
    # FeatureFlags テーブル
    create_table "FeatureFlags" \
        "AttributeName=flagKey,KeyType=HASH" \
        "AttributeName=flagKey,AttributeType=S AttributeName=expiresAt,AttributeType=S" \
        "IndexName=ExpiresAtIndex,KeySchema=[{AttributeName=expiresAt,KeyType=HASH}],Projection={ProjectionType=ALL}"
    
    # TenantOverrides テーブル
    create_table "TenantOverrides" \
        "AttributeName=tenantId,KeyType=HASH AttributeName=flagKey,KeyType=RANGE" \
        "AttributeName=tenantId,AttributeType=S AttributeName=flagKey,AttributeType=S" \
        "IndexName=FlagKeyIndex,KeySchema=[{AttributeName=flagKey,KeyType=HASH},{AttributeName=tenantId,KeyType=RANGE}],Projection={ProjectionType=ALL}"
    
    # EmergencyControl テーブル
    create_table "EmergencyControl" \
        "AttributeName=controlType,KeyType=HASH AttributeName=flagKey,KeyType=RANGE" \
        "AttributeName=controlType,AttributeType=S AttributeName=flagKey,AttributeType=S"
    
    log_info "✅ DynamoDB テーブル作成完了"
}

# テストデータ投入
seed_test_data() {
    log_info "テストデータを投入中..."
    
    # FeatureFlags テーブルにサンプルデータ
    aws dynamodb put-item \
        --endpoint-url http://localhost:8000 \
        --table-name FeatureFlags \
        --item '{
            "flagKey": {"S": "billing_v2_enable"},
            "description": {"S": "新しい請求システム"},
            "defaultEnabled": {"BOOL": true},
            "owner": {"S": "engineering-team"},
            "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
        }' > /dev/null
    
    aws dynamodb put-item \
        --endpoint-url http://localhost:8000 \
        --table-name FeatureFlags \
        --item '{
            "flagKey": {"S": "new_dashboard_enable"},
            "description": {"S": "新しいダッシュボード"},
            "defaultEnabled": {"BOOL": false},
            "owner": {"S": "product-team"},
            "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
        }' > /dev/null
    
    # TenantOverrides テーブルにサンプルデータ
    aws dynamodb put-item \
        --endpoint-url http://localhost:8000 \
        --table-name TenantOverrides \
        --item '{
            "tenantId": {"S": "tenant-001"},
            "flagKey": {"S": "billing_v2_enable"},
            "enabled": {"BOOL": false},
            "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
            "updatedBy": {"S": "admin@example.com"}
        }' > /dev/null
    
    aws dynamodb put-item \
        --endpoint-url http://localhost:8000 \
        --table-name TenantOverrides \
        --item '{
            "tenantId": {"S": "tenant-002"},
            "flagKey": {"S": "new_dashboard_enable"},
            "enabled": {"BOOL": true},
            "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
            "updatedBy": {"S": "admin@example.com"}
        }' > /dev/null
    
    log_info "✅ テストデータ投入完了"
}

# プロジェクトビルド
build_project() {
    log_info "プロジェクトをビルド中..."
    
    # Core packageビルド
    cd packages/core
    npm run build
    cd ../..
    
    log_info "✅ プロジェクトビルド完了"
}

# 統合テスト環境確認
verify_environment() {
    log_info "統合テスト環境を確認中..."
    
    # DynamoDB接続テスト
    local table_count=$(aws dynamodb list-tables \
        --endpoint-url http://localhost:8000 \
        --query 'length(TableNames)' \
        --output text)
    
    if [ "$table_count" -eq 3 ]; then
        log_info "✅ DynamoDB テーブル確認完了 ($table_count tables)"
    else
        log_error "DynamoDB テーブル数が不正です (expected: 3, actual: $table_count)"
        exit 1
    fi
    
    # テストデータ確認
    local flag_count=$(aws dynamodb scan \
        --endpoint-url http://localhost:8000 \
        --table-name FeatureFlags \
        --select COUNT \
        --query 'Count' \
        --output text)
    
    log_info "✅ フィーチャーフラグ確認完了 ($flag_count flags)"
    log_info "✅ 統合テスト環境準備完了"
}

# クリーンアップ関数
cleanup() {
    log_warn "環境をクリーンアップ中..."
    
    # DynamoDB Local停止
    if docker ps | grep -q dynamodb-local; then
        docker stop dynamodb-local > /dev/null 2>&1
    fi
    
    if docker ps -a | grep -q dynamodb-local; then
        docker rm dynamodb-local > /dev/null 2>&1
    fi
    
    log_info "✅ クリーンアップ完了"
}

# シグナルハンドラー設定
trap cleanup EXIT INT TERM

# メイン処理
main() {
    echo "フィーチャーフラグシステム - ローカル統合テスト環境"
    echo "実行時刻: $(date)"
    echo
    
    check_prerequisites
    start_dynamodb_local
    create_tables
    seed_test_data
    build_project
    verify_environment
    
    echo
    echo "================================================================"
    log_info "🎉 AWS SAM Local + DynamoDB Local 環境起動完了！"
    echo
    echo "📊 環境情報:"
    echo "   DynamoDB Local: http://localhost:8000"
    echo "   AWS Region: ap-northeast-1"
    echo
    echo "🔧 利用可能なテーブル:"
    echo "   - FeatureFlags"
    echo "   - TenantOverrides" 
    echo "   - EmergencyControl"
    echo
    echo "🧪 テスト実行:"
    echo "   npm run test:integration"
    echo
    echo "🛑 環境停止:"
    echo "   Ctrl+C または scripts/stop-local-aws.sh"
    echo "================================================================"
    
    # 環境を維持（バックグラウンドで実行し続ける）
    log_info "環境を維持中... (Ctrl+C で停止)"
    while true; do
        sleep 5
        # ヘルスチェック
        if ! docker ps | grep -q dynamodb-local; then
            log_error "DynamoDB Local が停止しました"
            exit 1
        fi
    done
}

# 引数チェック
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [--cleanup]"
    echo
    echo "AWS SAM Local + DynamoDB Local 統合テスト環境を起動します"
    echo
    echo "Options:"
    echo "  --cleanup    既存環境をクリーンアップして終了"
    echo "  --help       このヘルプを表示"
    exit 0
fi

if [ "$1" = "--cleanup" ]; then
    cleanup
    exit 0
fi

# メイン処理実行
main