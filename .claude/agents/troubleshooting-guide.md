# Sub Agent エコシステム トラブルシューティングガイド

## 🚨 よくある問題と解決策

### 1. エージェント応答問題

#### 問題: エージェントが応答しない
```bash
# 症状確認
claude-code --agent ddd-reviewer "テスト"
# → タイムアウトまたは無応答
```

**原因と解決策**:

##### 原因A: 設定ファイルの問題
```bash
# 確認方法
ls -la .claude/agents/expert-review/ddd-reviewer.md
cat .claude/agents/expert-review/ddd-reviewer.md | head -5

# 解決策: YAML Front Matter修正
---
name: ddd-reviewer
description: DDD専門家として...
tools: Read, Edit, Bash, Grep
---
```

##### 原因B: Claude Code バージョン不適合
```bash
# 確認方法
claude-code --version

# 解決策: 最新版更新
npm update -g @anthropic/claude-code
# または
brew upgrade claude-code
```

##### 原因C: ネットワーク・認証問題
```bash
# 確認方法
claude-code --help | grep auth

# 解決策: 認証再設定
claude-code auth login
```

#### 問題: エージェント応答が遅い（30秒以上）

**段階的解決アプローチ**:

```bash
# Step 1: キャッシュクリア
rm -rf ~/.claude/cache/
claude-code --clear-cache

# Step 2: リクエスト簡素化
claude-code --agent performance-auditor "現在の状況を1行で要約して"

# Step 3: 並列実行制限
export CLAUDE_MAX_PARALLEL_AGENTS=2
claude-code --agent ddd-reviewer "簡単なテスト"

# Step 4: デバッグモード確認
claude-code --debug --agent tdd-quality-checker "デバッグ実行"
```

### 2. 品質・精度問題

#### 問題: エージェントの提案品質が低い

**原因分析フレームワーク**:

```bash
#!/bin/bash
# scripts/diagnose-agent-quality.sh

AGENT_NAME=$1
TEST_REQUEST=$2

echo "🔍 エージェント品質診断: $AGENT_NAME"

# コンテキスト不足チェック
echo "=== コンテキスト不足の確認 ==="
claude-code --agent $AGENT_NAME \
  "現在のプロジェクト状況を分析してから、$TEST_REQUEST"

# 具体性不足チェック  
echo "=== 具体性向上テスト ==="
claude-code --agent $AGENT_NAME \
  "フィーチャーフラグシステムにおいて、$TEST_REQUEST。具体的なコード例とステップを含めて回答"

# 専門性活用チェック
echo "=== 専門性活用確認 ==="
claude-code --agent $AGENT_NAME \
  "あなたの専門分野の観点から、$TEST_REQUEST。ベストプラクティスと注意点を含めて"
```

**品質改善テクニック**:

```bash
# ❌ 悪い例: 曖昧なリクエスト
claude-code --agent ddd-reviewer "コードをレビューして"

# ✅ 良い例: 具体的なリクエスト  
claude-code --agent ddd-reviewer \
  "src/domain/tenant.ts のドメインモデル設計を、境界コンテキストの適切性とエンティティ関係の観点からレビュー。具体的な改善提案も含めて"

# ✅ さらに良い例: コンテキスト付きリクエスト
claude-code --agent ddd-reviewer \
  "マルチテナント SaaS のフィーチャーフラグシステムにおいて、src/domain/tenant.ts のテナント管理ドメインモデルを DDD 観点でレビュー。特に境界コンテキストの分離とアグリゲート設計の適切性を評価し、スケーラビリティを考慮した具体的改善案を提案して"
```

#### 問題: 一貫性のない回答

**一貫性確保メソッド**:

```bash
#!/bin/bash
# scripts/ensure-consistency.sh

TOPIC=$1

echo "🎯 一貫性確保テスト: $TOPIC"

# 複数エージェントの見解収集
claude-code --agent ddd-reviewer "$TOPIC をDDD観点で分析" > temp_ddd.txt
claude-code --agent architecture-reviewer "$TOPIC をアーキテクチャ観点で分析" > temp_arch.txt
claude-code --agent feature-flag-architect "$TOPIC をフラグ設計観点で分析" > temp_flag.txt

# 一貫性チェック・統合
claude-code --agent architecture-reviewer \
  "以下の3つの分析結果の一貫性をチェックし、統合見解を提示:
  DDD観点: $(cat temp_ddd.txt)
  アーキテクチャ観点: $(cat temp_arch.txt)  
  フラグ設計観点: $(cat temp_flag.txt)"

# クリーンアップ
rm temp_*.txt
```

### 3. パフォーマンス問題

#### 問題: 複数エージェント並列実行でのリソース不足

**リソース最適化戦略**:

```bash
#!/bin/bash
# scripts/optimize-parallel-execution.sh

echo "⚡ エージェント並列実行最適化"

# システムリソース確認
echo "=== 現在のリソース使用状況 ==="
echo "CPU: $(top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%')"
echo "Memory: $(ps aux | grep claude | awk '{sum+=$4} END {print sum}')%"

# 適応的並列度設定
AVAILABLE_CORES=$(sysctl -n hw.ncpu)
OPTIMAL_PARALLEL=$((AVAILABLE_CORES / 2))

echo "=== 最適化された並列実行 ==="
echo "利用可能コア数: $AVAILABLE_CORES"
echo "最適並列度: $OPTIMAL_PARALLEL"

# バッチ処理での実行
AGENTS=("ddd-reviewer" "architecture-reviewer" "tdd-quality-checker" "performance-auditor")
BATCH_SIZE=$OPTIMAL_PARALLEL

for ((i=0; i<${#AGENTS[@]}; i+=BATCH_SIZE)); do
  batch=("${AGENTS[@]:i:BATCH_SIZE}")
  echo "バッチ$((i/BATCH_SIZE + 1)): ${batch[*]}"
  
  for agent in "${batch[@]}"; do
    claude-code --agent "$agent" "システム状況確認" &
  done
  
  wait  # バッチ完了待機
  sleep 2  # リソース回復待機
done
```

#### 問題: エージェント実行時のメモリリーク

**メモリ管理最適化**:

```bash
#!/bin/bash
# scripts/memory-optimization.sh

echo "🧠 メモリ使用量最適化"

# メモリ使用量監視
monitor_memory() {
  while true; do
    MEMORY_USAGE=$(ps aux | grep claude | awk '{sum+=$6} END {print sum/1024}')
    echo "$(date): Claude プロセス メモリ使用量: ${MEMORY_USAGE}MB"
    
    # 閾値チェック (1GB超過時)
    if (( $(echo "$MEMORY_USAGE > 1024" | bc -l) )); then
      echo "⚠️ メモリ使用量警告: ${MEMORY_USAGE}MB"
      # プロセス再起動
      pkill claude-code
      sleep 5
    fi
    
    sleep 30
  done
}

# バックグラウンド監視開始
monitor_memory &
MONITOR_PID=$!

# エージェント実行
claude-code --agent performance-auditor "メモリ効率的な監査実行"

# 監視停止
kill $MONITOR_PID
```

### 4. 統合・自動化問題

#### 問題: GitHub Actions統合でのエラー

**CI/CD統合診断**:

```bash
#!/bin/bash
# scripts/diagnose-cicd-integration.sh

echo "🔧 CI/CD統合診断"

# GitHub Actions環境確認
echo "=== GitHub Actions 環境確認 ==="
if [[ -z "$GITHUB_ACTIONS" ]]; then
  echo "⚠️ ローカル環境での実行"
  echo "GitHub Actions固有の環境変数が設定されていません"
else
  echo "✅ GitHub Actions環境"
  echo "Runner: $RUNNER_OS"
  echo "Workflow: $GITHUB_WORKFLOW"
fi

# Claude Code設定確認
echo "=== Claude Code設定確認 ==="
if claude-code --version &>/dev/null; then
  echo "✅ Claude Code利用可能"
  echo "Version: $(claude-code --version)"
else
  echo "❌ Claude Code不利用可能"
  echo "インストール・設定を確認してください"
fi

# エージェント設定確認
echo "=== エージェント設定確認 ==="
if [[ -d ".claude/agents" ]]; then
  AGENT_COUNT=$(find .claude/agents -name "*.md" | wc -l)
  echo "✅ エージェント設定: ${AGENT_COUNT}個"
else
  echo "❌ エージェント設定なし"
  echo ".claude/agents ディレクトリが見つかりません"
fi

# ネットワーク接続確認
echo "=== ネットワーク接続確認 ==="
if curl -s https://api.anthropic.com &>/dev/null; then
  echo "✅ Anthropic API接続可能"
else
  echo "❌ Anthropic API接続不可"
  echo "ネットワーク設定・認証を確認してください"
fi
```

**GitHub Actions修正例**:

```yaml
# .github/workflows/fixed-expert-review.yml
name: Fixed Expert Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  expert-review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Claude Code
        run: |
          npm install -g @anthropic/claude-code
          echo "${{ secrets.CLAUDE_API_KEY }}" | claude-code auth login --stdin
          
      - name: Verify Agent Configuration
        run: |
          ls -la .claude/agents/
          find .claude/agents -name "*.md" | head -5
          
      - name: Expert Review with Error Handling
        run: |
          set +e  # エラーでも継続
          
          # タイムアウト付きで実行
          timeout 300 claude-code --agent ddd-reviewer \
            "PR#${{ github.event.number }} の変更をDDD観点でレビュー" || echo "DDD review timeout"
            
          timeout 300 claude-code --agent architecture-reviewer \
            "PR#${{ github.event.number }} の変更をアーキテクチャ観点でレビュー" || echo "Architecture review timeout"
            
          set -e  # エラーハンドリング復活
```

### 5. エージェント間連携問題

#### 問題: Expert Review結果の不整合

**連携問題診断・修正**:

```bash
#!/bin/bash
# scripts/fix-agent-collaboration.sh

PR_NUMBER=$1

echo "🤝 エージェント連携修正: PR#$PR_NUMBER"

# 共通コンテキスト作成
CONTEXT="フィーチャーフラグシステムのPR#$PR_NUMBER。マルチテナントSaaS、DynamoDB使用、TypeScript実装。"

# 段階的レビュー実行
echo "=== Stage 1: 基盤分析 ==="
DDD_RESULT=$(claude-code --agent ddd-reviewer \
  "$CONTEXT ドメインモデル観点での分析を実行")

echo "=== Stage 2: アーキテクチャ分析 ==="
ARCH_RESULT=$(claude-code --agent architecture-reviewer \
  "$CONTEXT アーキテクチャ観点での分析。DDD分析結果: $DDD_RESULT")

echo "=== Stage 3: 品質統合評価 ==="
QUALITY_RESULT=$(claude-code --agent tdd-quality-checker \
  "$CONTEXT 品質観点での統合評価。
  DDD分析: $DDD_RESULT
  アーキテクチャ分析: $ARCH_RESULT")

echo "=== Stage 4: 統合レビュー結果 ==="
cat > "reviews/PR-$PR_NUMBER-integrated.md" << EOF
# PR#$PR_NUMBER 統合Expert Review

## 🏛️ DDD観点
$DDD_RESULT

## 🏗️ アーキテクチャ観点
$ARCH_RESULT

## 🏆 品質観点
$QUALITY_RESULT

## 📋 統合判定
$(echo "$QUALITY_RESULT" | grep -E "判定|総合|結論" | head -3)
EOF

echo "✅ 統合レビュー完了: reviews/PR-$PR_NUMBER-integrated.md"
```

### 6. 設定・管理問題

#### 問題: エージェント設定の管理が困難

**設定管理自動化**:

```bash
#!/bin/bash
# scripts/agent-configuration-manager.sh

ACTION=$1  # validate, backup, restore, update

case $ACTION in
  "validate")
    echo "🔍 エージェント設定検証"
    
    for agent_file in .claude/agents/**/*.md; do
      echo "検証中: $agent_file"
      
      # YAML Front Matter確認
      if ! head -10 "$agent_file" | grep -q "^---$"; then
        echo "❌ $agent_file: YAML Front Matter不正"
      else
        echo "✅ $agent_file: YAML Front Matter正常"
      fi
      
      # 必須フィールド確認
      if ! grep -q "^name:" "$agent_file"; then
        echo "❌ $agent_file: name フィールド不足"
      fi
      
      if ! grep -q "^description:" "$agent_file"; then
        echo "❌ $agent_file: description フィールド不足"
      fi
    done
    ;;
    
  "backup")
    echo "💾 エージェント設定バックアップ"
    BACKUP_DIR="backups/agents-$(date '+%Y%m%d-%H%M%S')"
    mkdir -p "$BACKUP_DIR"
    cp -r .claude/agents/* "$BACKUP_DIR/"
    echo "✅ バックアップ完了: $BACKUP_DIR"
    ;;
    
  "restore")
    BACKUP_PATH=$2
    echo "🔄 エージェント設定復元: $BACKUP_PATH"
    if [[ -d "$BACKUP_PATH" ]]; then
      cp -r "$BACKUP_PATH"/* .claude/agents/
      echo "✅ 復元完了"
    else
      echo "❌ バックアップパスが見つかりません: $BACKUP_PATH"
    fi
    ;;
    
  "update")
    echo "🔄 エージェント設定一括更新"
    
    # 全エージェントのツール設定統一
    for agent_file in .claude/agents/**/*.md; do
      # tools行の統一
      sed -i.bak 's/^tools: .*/tools: Read, Edit, Bash, Grep, Glob, mcp__serena__find_symbol, mcp__serena__get_symbols_overview/' "$agent_file"
      echo "更新: $agent_file"
    done
    
    echo "✅ 一括更新完了"
    ;;
    
  *)
    echo "Usage: $0 {validate|backup|restore <path>|update}"
    ;;
esac
```

## 🆘 緊急時対応手順

### Critical Issue Response
```bash
#!/bin/bash
# scripts/emergency-response.sh

ISSUE_TYPE=$1

echo "🚨 緊急対応開始: $ISSUE_TYPE"

case $ISSUE_TYPE in
  "all-agents-down")
    echo "全エージェント停止対応"
    
    # 1. 設定復旧
    git checkout HEAD -- .claude/agents/
    
    # 2. Claude Code再起動
    pkill claude-code
    sleep 5
    claude-code --version
    
    # 3. 基本テスト
    claude-code --agent tdd-quality-checker "緊急テスト"
    ;;
    
  "performance-critical")
    echo "パフォーマンス問題緊急対応"
    
    # リソース使用量確認
    ps aux | grep claude
    
    # 重いプロセス停止
    pkill -f "claude-code.*performance-auditor"
    
    # 軽量エージェントのみ有効化
    export CLAUDE_LIGHTWEIGHT_MODE=true
    ;;
    
  "quality-regression")
    echo "品質回帰緊急対応"
    
    # 最後の正常な設定に復旧
    git log --oneline .claude/agents/ | head -5
    echo "復旧したい設定のコミットIDを指定してください"
    ;;
esac
```

---

**トラブルシューティングの原則**:
1. **症状の正確な把握** - ログ・メトリクス確認
2. **段階的アプローチ** - 簡単な解決策から順次適用  
3. **設定の保全** - 変更前のバックアップ必須
4. **改善の文書化** - 同様問題の予防

問題解決後は必ず根本原因分析を実施し、予防策を講じましょう！ 🛠️