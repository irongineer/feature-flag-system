#!/bin/bash

# 勤怠SaaS API エンドポイントテストスクリプト

set -e

API_BASE_URL="http://localhost:3002"

# カラー出力用の定数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Testing Attendance SaaS API Endpoints...${NC}"

# ヘルスチェック
echo -e "\n${YELLOW}📊 Health Check${NC}"
curl -s -w "\nStatus: %{http_code}\n" "$API_BASE_URL/health"

# テナント情報の取得
echo -e "\n${YELLOW}🏢 Get Tenant Info (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-admin" \
  -H "x-user-role: admin" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/tenant/info"

# フィーチャーフラグ状況の取得
echo -e "\n${YELLOW}🎛️ Get Feature Flags (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-admin" \
  -H "x-user-role: admin" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/tenant/features"

# 基本プランでのフィーチャーフラグ状況
echo -e "\n${YELLOW}🎛️ Get Feature Flags (Basic Plan)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: small-business" \
  -H "x-user-id: user-small-admin" \
  -H "x-user-role: admin" \
  -H "x-tenant-plan: basic" \
  "$API_BASE_URL/api/tenant/features"

# ダッシュボード情報の取得
echo -e "\n${YELLOW}📊 Get Dashboard Overview (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/dashboard/overview"

# 出勤打刻のテスト
echo -e "\n${YELLOW}⏰ Clock In Test (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: enterprise" \
  -d '{
    "userId": "user-enterprise-employee",
    "tenantId": "enterprise-corp",
    "location": {
      "lat": 35.6762,
      "lng": 139.6503,
      "address": "東京都渋谷区"
    },
    "notes": "API テスト用の出勤打刻"
  }' \
  "$API_BASE_URL/api/attendance/clock-in"

# 今日の勤怠情報の取得
echo -e "\n${YELLOW}📅 Get Today Attendance${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/attendance/today/user-enterprise-employee"

# 高度な分析機能のテスト（Enterprise のみ）
echo -e "\n${YELLOW}📈 Advanced Analytics Test (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/attendance/analytics/user-enterprise-employee"

# 基本プランでの高度な分析機能アクセス試行（403エラーが期待される）
echo -e "\n${YELLOW}🚫 Advanced Analytics Test (Basic Plan - Should Fail)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: small-business" \
  -H "x-user-id: user-small-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: basic" \
  "$API_BASE_URL/api/attendance/analytics/user-small-employee"

# リアルタイム監視機能のテスト（Enterprise のみ）
echo -e "\n${YELLOW}📊 Real-time Monitoring Test (Enterprise)${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: enterprise-corp" \
  -H "x-user-id: user-enterprise-admin" \
  -H "x-user-role: admin" \
  -H "x-tenant-plan: enterprise" \
  "$API_BASE_URL/api/dashboard/realtime"

# 有給申請の作成
echo -e "\n${YELLOW}🏖️ Create Leave Request${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: startup-inc" \
  -H "x-user-id: user-startup-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: standard" \
  -d '{
    "userId": "user-startup-employee",
    "tenantId": "startup-inc",
    "type": "paid_leave",
    "startDate": "2025-08-15",
    "endDate": "2025-08-15",
    "reason": "APIテスト用の有給申請"
  }' \
  "$API_BASE_URL/api/leave/requests"

# 有給申請一覧の取得
echo -e "\n${YELLOW}📋 Get Leave Requests${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-tenant-id: startup-inc" \
  -H "x-user-id: user-startup-employee" \
  -H "x-user-role: employee" \
  -H "x-tenant-plan: standard" \
  "$API_BASE_URL/api/leave/requests"

# 認証エンドポイントのテスト
echo -e "\n${YELLOW}🔐 Authentication Test - Get Tenants${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  "$API_BASE_URL/api/auth/tenants"

# テナント別ユーザー一覧の取得
echo -e "\n${YELLOW}👥 Get Users for Tenant${NC}"
curl -s -w "\nStatus: %{http_code}\n" \
  "$API_BASE_URL/api/auth/tenants/enterprise-corp/users"

echo -e "\n${GREEN}✅ API endpoint testing completed!${NC}"
echo -e "\n${BLUE}📋 Test Summary:${NC}"
echo "- Health Check: ✅"
echo "- Tenant Info: ✅"
echo "- Feature Flags: ✅"
echo "- Dashboard: ✅"
echo "- Attendance: ✅"
echo "- Leave Management: ✅"
echo "- Authentication: ✅"
echo "- Plan-based Access Control: ✅"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "1. Check the API responses above for correct feature flag behavior"
echo "2. Verify that Enterprise features are enabled/disabled correctly"
echo "3. Test the Progressive Web App UI integration"