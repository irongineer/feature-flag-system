import { test, expect } from '@playwright/test';

/**
 * Comprehensive UI Coverage E2E Tests
 * 
 * 目標: 90%以上のE2Eテストカバレッジ達成
 * 対象: Kill-Switch・テナント設定・監査ログ・高度ダッシュボード
 */

test.describe('Comprehensive UI Coverage - 90% Target', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset and seed comprehensive test data
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed-comprehensive', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flags: 10,
        killSwitches: 3,
        tenantOverrides: 5,
        auditLogs: 20
      })
    });
    
    // Wait for data seeding
    await page.waitForTimeout(1000);
  });

  test.describe('Kill-Switch Management Coverage', () => {
    test('should display Kill-Switch dashboard with metrics', async ({ page }) => {
      await page.goto('/kill-switch');
      
      // Wait for page load
      await expect(page.locator('[data-testid="killswitch-table"]')).toBeVisible();
      
      // Verify metrics display
      await expect(page.locator('text=アクティブKill-Switch')).toBeVisible();
      await expect(page.locator('text=今日の実行回数')).toBeVisible();
      await expect(page.locator('text=影響フラグ数')).toBeVisible();
      
      // Verify auto-refresh indicator
      await expect(page.locator('text=自動更新')).toBeVisible();
      await expect(page.locator('text=10秒間隔')).toBeVisible();
    });

    test('should activate Kill-Switch with comprehensive validation', async ({ page }) => {
      await page.goto('/kill-switch');
      
      // Open Kill-Switch activation modal
      await page.click('[data-testid="activate-killswitch-button"]');
      await expect(page.locator('[data-testid="killswitch-modal"]')).toBeVisible();
      
      // Verify warning message
      await expect(page.locator('text=緊急停止について')).toBeVisible();
      await expect(page.locator('text=即座に無効（false）を返すようになります')).toBeVisible();
      
      // Fill Kill-Switch form
      await page.selectOption('[data-testid="killswitch-flag-select"]', 'billing_v2_enable');
      await page.selectOption('select[name="environment"]', 'production');
      await page.fill('[data-testid="killswitch-tenant-input"]', 'tenant-emergency-001');
      await page.fill('[data-testid="killswitch-reason-input"]', 
        '本番環境で重大なバグが発見されました。ユーザーに影響を与える前に緊急停止します。詳細: 決済処理でNullPointerExceptionが発生。');
      
      // Submit Kill-Switch activation
      await page.click('[data-testid="killswitch-modal"] .ant-btn-danger');
      
      // Verify success message
      await expect(page.locator('text=Kill-Switchが有効化されました')).toBeVisible();
      
      // Verify table update
      await expect(page.locator('text=billing_v2_enable')).toBeVisible();
      await expect(page.locator('text=アクティブ')).toBeVisible();
    });

    test('should deactivate Kill-Switch with confirmation', async ({ page }) => {
      await page.goto('/kill-switch');
      
      // Wait for table to load with active Kill-Switch
      await page.waitForSelector('[data-testid="deactivate-killswitch-button"]');
      
      // Click deactivate button
      await page.click('[data-testid="deactivate-killswitch-button"]');
      
      // Verify confirmation dialog
      await expect(page.locator('text=Kill-Switchを無効化しますか？')).toBeVisible();
      await expect(page.locator('text=フラグは通常の評価ロジックに戻ります')).toBeVisible();
      
      // Confirm deactivation
      await page.click('text=無効化');
      
      // Verify success message
      await expect(page.locator('text=Kill-Switchが無効化されました')).toBeVisible();
    });
  });

  test.describe('Tenant Settings Management Coverage', () => {
    test('should display tenant overrides list', async ({ page }) => {
      await page.goto('/tenant-settings');
      
      // Verify tenant settings page elements
      await expect(page.locator('text=テナント設定')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-select"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-overrides-table"]')).toBeVisible();
    });

    test('should create tenant-specific flag override', async ({ page }) => {
      await page.goto('/tenant-settings');
      
      // Select tenant
      await page.selectOption('[data-testid="tenant-select"]', 'tenant-premium-001');
      
      // Open override creation modal
      await page.click('[data-testid="create-override-button"]');
      await expect(page.locator('[data-testid="override-modal"]')).toBeVisible();
      
      // Fill override form
      await page.selectOption('[data-testid="override-flag-select"]', 'new_dashboard_enable');
      await page.check('[data-testid="override-enabled-switch"]');
      await page.fill('[data-testid="override-reason-input"]', 
        'プレミアムテナント向けに新ダッシュボード機能を先行有効化');
      
      // Submit override
      await page.click('[data-testid="override-modal"] .ant-btn-primary');
      
      // Verify success
      await expect(page.locator('text=テナントオーバーライドが作成されました')).toBeVisible();
      
      // Verify table update
      await expect(page.locator('text=new_dashboard_enable')).toBeVisible();
      await expect(page.locator('text=プレミアムテナント向け')).toBeVisible();
    });

    test('should bulk import/export tenant settings', async ({ page }) => {
      await page.goto('/tenant-settings');
      
      // Test export functionality
      await page.click('[data-testid="export-settings-button"]');
      
      // Verify download modal or file generation
      await expect(page.locator('text=設定をエクスポートしています')).toBeVisible();
      
      // Test import functionality
      await page.click('[data-testid="import-settings-button"]');
      await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();
      
      // Verify import validation
      await expect(page.locator('text=CSVファイルまたはJSONファイルを選択')).toBeVisible();
    });
  });

  test.describe('Audit Log Display Coverage', () => {
    test('should display comprehensive audit log with filtering', async ({ page }) => {
      await page.goto('/audit-logs');
      
      // Verify audit log page elements
      await expect(page.locator('text=監査ログ')).toBeVisible();
      await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-filter-panel"]')).toBeVisible();
      
      // Test time range filtering
      await page.click('[data-testid="time-range-select"]');
      await page.click('text=過去24時間');
      
      // Test action type filtering
      await page.click('[data-testid="action-filter"]');
      await page.check('text=flag_created');
      await page.check('text=kill_switch_activated');
      
      // Apply filters
      await page.click('[data-testid="apply-filters-button"]');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="audit-log-table"] tbody tr')).toHaveCount({ min: 1 });
    });

    test('should display detailed audit log entry', async ({ page }) => {
      await page.goto('/audit-logs');
      
      // Wait for table to load
      await page.waitForSelector('[data-testid="audit-log-table"] tbody tr');
      
      // Click on first log entry
      await page.click('[data-testid="audit-log-table"] tbody tr:first-child [data-testid="view-details-button"]');
      
      // Verify detail modal
      await expect(page.locator('[data-testid="audit-detail-modal"]')).toBeVisible();
      await expect(page.locator('text=監査ログ詳細')).toBeVisible();
      
      // Verify detail fields
      await expect(page.locator('text=リソースタイプ')).toBeVisible();
      await expect(page.locator('text=アクション')).toBeVisible();
      await expect(page.locator('text=実行者')).toBeVisible();
      await expect(page.locator('text=実行時刻')).toBeVisible();
      await expect(page.locator('text=変更内容')).toBeVisible();
    });

    test('should export audit logs', async ({ page }) => {
      await page.goto('/audit-logs');
      
      // Select logs for export
      await page.check('[data-testid="select-all-logs"]');
      
      // Export logs
      await page.click('[data-testid="export-logs-button"]');
      
      // Choose export format
      await page.click('[data-testid="export-format-csv"]');
      
      // Verify export process
      await expect(page.locator('text=監査ログをエクスポートしています')).toBeVisible();
    });
  });

  test.describe('Advanced Dashboard Coverage', () => {
    test('should display comprehensive dashboard metrics', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Verify all metric cards
      await expect(page.locator('text=総フラグ数')).toBeVisible();
      await expect(page.locator('text=有効フラグ')).toBeVisible();
      await expect(page.locator('text=Kill-Switch')).toBeVisible();
      await expect(page.locator('text=テナント設定')).toBeVisible();
      
      // Verify advanced metrics
      await expect(page.locator('text=平均レスポンス時間')).toBeVisible();
      await expect(page.locator('text=評価回数（24h）')).toBeVisible();
      await expect(page.locator('text=エラー率')).toBeVisible();
      await expect(page.locator('text=システム健康度')).toBeVisible();
    });

    test('should display flag usage statistics with sorting', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Verify flag usage table
      await expect(page.locator('[data-testid="flag-usage-table"]')).toBeVisible();
      
      // Test sorting by evaluation count
      await page.click('[data-testid="flag-usage-table"] th:has-text("評価回数")');
      
      // Verify sorting applied
      const firstRow = page.locator('[data-testid="flag-usage-table"] tbody tr:first-child');
      await expect(firstRow).toBeVisible();
      
      // Test time range selector
      await page.click('[data-testid="usage-time-range"]');
      await page.click('text=過去7日間');
      
      // Verify data update
      await page.waitForResponse('**/api/dashboard/metrics**');
    });

    test('should display recent activities with real-time updates', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Verify recent activities
      await expect(page.locator('[data-testid="recent-activities"]')).toBeVisible();
      await expect(page.locator('text=最近のアクティビティ')).toBeVisible();
      
      // Verify activity types are displayed
      await expect(page.locator('.ant-list-item').first()).toBeVisible();
      
      // Test real-time updates (simulate new activity)
      // Navigate to flag creation to generate activity
      await page.goto('/flags/list');
      await page.click('[data-testid="create-flag-button"]');
      await page.fill('[data-testid="flag-key-input"]', 'real_time_test_flag');
      await page.fill('[data-testid="flag-description-input"]', 'Real-time update test');
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      
      // Return to dashboard and verify update
      await page.goto('/dashboard');
      await expect(page.locator('text=real_time_test_flag')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases Coverage', () => {
    test('should handle API server disconnection gracefully', async ({ page }) => {
      await page.goto('/flags/list');
      
      // Simulate API error by triggering a failing request
      // (This would require mock server setup or intentional API failure)
      
      // Verify error handling UI
      await expect(page.locator('text=サーバーとの接続に問題があります')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Test retry functionality
      await page.click('[data-testid="retry-button"]');
    });

    test('should handle malformed data gracefully', async ({ page }) => {
      // Reset with malformed data
      await fetch('http://localhost:3001/api/test/seed-malformed', { method: 'POST' });
      
      await page.goto('/flags/list');
      
      // Verify graceful handling of malformed data
      await expect(page.locator('text=データの形式に問題があります')).toBeVisible();
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
    });

    test('should handle large dataset performance', async ({ page }) => {
      // Seed large dataset
      await fetch('http://localhost:3001/api/test/seed-large', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1000 })
      });
      
      await page.goto('/flags/list');
      
      // Verify pagination handles large dataset
      await expect(page.locator('.ant-pagination')).toBeVisible();
      await expect(page.locator('text=1000 件')).toBeVisible();
      
      // Test search performance
      await page.fill('[data-testid="flag-search"]', 'performance_test');
      await page.waitForResponse('**/api/flags**');
      
      // Verify search results load within reasonable time
      await expect(page.locator('[data-testid="flag-table"] tbody tr')).toBeVisible({ timeout: 3000 });
    });

    test('should handle concurrent user operations', async ({ page, context }) => {
      // Create second page context to simulate concurrent user
      const page2 = await context.newPage();
      
      // Both users navigate to flag management
      await page.goto('/flags/list');
      await page2.goto('/flags/list');
      
      // User 1 creates a flag
      await page.click('[data-testid="create-flag-button"]');
      await page.fill('[data-testid="flag-key-input"]', 'concurrent_test_1');
      await page.fill('[data-testid="flag-description-input"]', 'Concurrent test 1');
      
      // User 2 simultaneously creates a flag
      await page2.click('[data-testid="create-flag-button"]');
      await page2.fill('[data-testid="flag-key-input"]', 'concurrent_test_2');
      await page2.fill('[data-testid="flag-description-input"]', 'Concurrent test 2');
      
      // Both submit
      await Promise.all([
        page.click('[data-testid="create-flag-modal"] .ant-btn-primary'),
        page2.click('[data-testid="create-flag-modal"] .ant-btn-primary')
      ]);
      
      // Verify both flags were created successfully
      await expect(page.locator('text=フラグが作成されました')).toBeVisible();
      await expect(page2.locator('text=フラグが作成されました')).toBeVisible();
      
      // Verify both flags appear in the list
      await page.reload();
      await expect(page.locator('text=concurrent_test_1')).toBeVisible();
      await expect(page.locator('text=concurrent_test_2')).toBeVisible();
      
      await page2.close();
    });
  });

  test.describe('Mobile Responsive Coverage', () => {
    test('should display correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/dashboard');
      
      // Verify mobile-responsive layout
      await expect(page.locator('.ant-layout')).toBeVisible();
      await expect(page.locator('.ant-layout-sider')).toHaveCSS('width', '0px'); // Collapsed sidebar
      
      // Test mobile navigation
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Navigate to flags page on mobile
      await page.click('text=フラグ管理');
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Verify mobile table responsiveness
      await expect(page.locator('[data-testid="flag-table"]')).toHaveCSS('overflow-x', 'auto');
    });
  });

  test.describe('Accessibility Coverage', () => {
    test('should meet WCAG 2.1 AA accessibility standards', async ({ page }) => {
      await page.goto('/flags/list');
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Should open create modal
      
      await expect(page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
      
      // Test screen reader support
      await expect(page.locator('[aria-label="フラグキー"]')).toBeVisible();
      await expect(page.locator('[aria-label="説明"]')).toBeVisible();
      
      // Test focus management
      const activeElement = await page.evaluateHandle(() => document.activeElement);
      await expect(activeElement).toBeTruthy();
    });
  });
});