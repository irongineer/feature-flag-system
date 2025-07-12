#!/bin/bash

# GitHub Issues Creation Script for Feature Flag System
# フィーチャーフラグシステムのGitHub Issue作成スクリプト

echo "🚀 Creating GitHub Issues for Feature Flag System..."

# Check if GitHub CLI is authenticated
if ! gh auth status > /dev/null 2>&1; then
    echo "❌ Please authenticate with GitHub CLI first:"
    echo "   gh auth login"
    exit 1
fi

# Function to create issue from markdown file
create_issue_from_file() {
    local file_path=$1
    local title=$(head -1 "$file_path" | sed 's/^# //')
    local labels=$(grep "^**Labels:**" "$file_path" | sed 's/^**Labels:** //' | sed 's/`//g')
    local body=$(tail -n +3 "$file_path")
    
    echo "Creating issue: $title"
    gh issue create \
        --title "$title" \
        --body "$body" \
        --label "$labels"
}

echo "📋 Creating completed implementation issues..."

# Completed implementation issues
create_issue_from_file "scripts/issues/01-core-evaluator.md"
create_issue_from_file "scripts/issues/02-cache-system.md"  
create_issue_from_file "scripts/issues/03-test-suite.md"
create_issue_from_file "scripts/issues/04-aws-architecture.md"
create_issue_from_file "scripts/issues/05-adr-documentation.md"
create_issue_from_file "scripts/issues/06-openapi-spec.md"
create_issue_from_file "scripts/issues/07-cicd-pipeline.md"
create_issue_from_file "scripts/issues/08-technical-debt.md"

echo "✨ Creating story-type issues for planned features..."

# Story-type issues for planned features
create_issue_from_file "scripts/issues/09-web-management-ui.md"
create_issue_from_file "scripts/issues/10-cli-tool.md"
create_issue_from_file "scripts/issues/11-rollout-strategies.md"
create_issue_from_file "scripts/issues/12-monitoring-analytics.md"
create_issue_from_file "scripts/issues/13-multi-language-sdk.md"

echo "🔧 Creating technical debt issues..."

# Technical debt issues
create_issue_from_file "scripts/issues/14-cache-ttl-tests.md"
create_issue_from_file "scripts/issues/15-dynamodb-pooling.md"
create_issue_from_file "scripts/issues/16-error-handling.md"

echo "✅ All GitHub Issues created successfully!"
echo ""
echo "📊 Summary:"
echo "   - Completed Implementation: 8 issues"
echo "   - Planned Features (Stories): 5 issues"  
echo "   - Technical Debt: 3 issues"
echo "   - Total: 16 issues"
echo ""
echo "🔗 View all issues: gh issue list"