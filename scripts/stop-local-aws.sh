#!/bin/bash

# AWS SAM Local + DynamoDB Local 統合テスト環境停止スクリプト
# フィーチャーフラグシステム

set -e

echo "🛑 AWS SAM Local + DynamoDB Local 統合テスト環境を停止中..."
echo "================================================================"

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

# DynamoDB Local停止
stop_dynamodb_local() {
    log_info "DynamoDB Local を停止中..."
    
    if docker ps | grep -q dynamodb-local; then
        docker stop dynamodb-local > /dev/null 2>&1
        log_info "✅ DynamoDB Local コンテナを停止しました"
    else
        log_warn "DynamoDB Local コンテナは既に停止しています"
    fi
    
    if docker ps -a | grep -q dynamodb-local; then
        docker rm dynamodb-local > /dev/null 2>&1
        log_info "✅ DynamoDB Local コンテナを削除しました"
    fi
}

# SAM Local プロセス停止
stop_sam_local() {
    log_info "SAM Local プロセスを停止中..."
    
    # sam local のプロセスを検索・停止
    pids=$(pgrep -f "sam local" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # 強制終了が必要な場合
        pids=$(pgrep -f "sam local" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -KILL 2>/dev/null || true
        fi
        
        log_info "✅ SAM Local プロセスを停止しました"
    else
        log_warn "SAM Local プロセスは見つかりませんでした"
    fi
}

# 一時ファイルクリーンアップ
cleanup_temp_files() {
    log_info "一時ファイルをクリーンアップ中..."
    
    # SAMの一時ファイル
    if [ -d ".aws-sam" ]; then
        rm -rf .aws-sam
        log_info "✅ .aws-sam ディレクトリを削除しました"
    fi
    
    # DynamoDB Localの一時ファイル
    if [ -f "shared-local-instance.db" ]; then
        rm -f shared-local-instance.db
        log_info "✅ DynamoDB Local データベースファイルを削除しました"
    fi
}

# ポート使用状況確認
check_ports() {
    log_info "ポート使用状況を確認中..."
    
    ports=(3000 8000)
    for port in "${ports[@]}"; do
        if lsof -i :$port > /dev/null 2>&1; then
            log_warn "ポート $port がまだ使用されています"
            lsof -i :$port
        else
            log_info "✅ ポート $port は解放されています"
        fi
    done
}

# メイン処理
main() {
    echo "フィーチャーフラグシステム - ローカル統合テスト環境停止"
    echo "実行時刻: $(date)"
    echo
    
    stop_dynamodb_local
    stop_sam_local
    cleanup_temp_files
    check_ports
    
    echo
    echo "================================================================"
    log_info "🎉 統合テスト環境の停止が完了しました"
    echo
    echo "📊 停止された環境:"
    echo "   ✅ DynamoDB Local (port 8000)"
    echo "   ✅ SAM Local API Gateway (port 3000)"
    echo "   ✅ 一時ファイル削除完了"
    echo
    echo "🚀 再起動:"
    echo "   scripts/start-local-aws.sh"
    echo "================================================================"
}

# 引数チェック
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0"
    echo
    echo "AWS SAM Local + DynamoDB Local 統合テスト環境を停止します"
    echo
    echo "Options:"
    echo "  --help       このヘルプを表示"
    exit 0
fi

# メイン処理実行
main