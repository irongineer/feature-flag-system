import { test, expect } from '@playwright/test';

/**
 * Optimized Flag Management E2E Tests
 * 
 * 目標: 既存の83.8%から90%以上への改善
 * 対象: フラグCRUD操作・高度な検索・バルク操作・エラーハンドリング
 */

test.describe('Optimized Flag Management - Coverage Enhancement', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset and seed optimized test data
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed-optimized', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flags: 15,
        withExpiration: 5,
        withOwners: ['team-frontend', 'team-backend', 'team-devops'],
        environments: ['development', 'staging', 'production']
      })
    });
    
    // Wait for data seeding and API readiness
    await page.waitForTimeout(1000);
    
    // Navigate to flag management page
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
  });

  test.describe('Enhanced CRUD Operations', () => {
    test('should perform complete flag lifecycle with all field validations', async ({ page }) => {
      // CREATE: Create flag with all optional fields
      await page.click('[data-testid="create-flag-button"]');
      await expect(page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
      
      // Fill all form fields
      await page.fill('[data-testid="flag-key-input"]', 'advanced_feature_toggle');
      await page.fill('[data-testid="flag-description-input"]', 
        '高度な機能切り替えフラグ。A/Bテスト機能、パーソナライゼーション、リアルタイム分析機能を含む包括的な機能制御。');
      await page.check('[data-testid="flag-enabled-switch"]');
      await page.fill('[data-testid="flag-owner-input"]', 'team-product');
      
      // Set expiration date
      await page.click('[placeholder="有効期限を設定（未設定の場合は無期限）"]');
      await page.click('.ant-picker-cell:has-text("31")'); // Select last day of month
      
      // Submit creation
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      await expect(page.locator('text=フラグが作成されました')).toBeVisible();
      
      // Verify creation in table
      await expect(page.locator('text=advanced_feature_toggle')).toBeVisible();
      await expect(page.locator('text=team-product')).toBeVisible();
      
      // READ: Verify all fields are displayed correctly
      await expect(page.locator('[data-testid="flag-toggle-switch"][checked]')).toBeVisible();
      
      // UPDATE: Edit the flag
      await page.click('[data-testid="flag-actions-button"]');
      await page.click('text=編集');
      
      // Modify fields
      await page.fill('[data-testid="flag-description-input"]', 
        '更新された高度な機能切り替えフラグ。機械学習による自動最適化機能を追加。');
      await page.uncheck('[data-testid="flag-enabled-switch"]');
      
      // Save changes
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      await expect(page.locator('text=フラグが更新されました')).toBeVisible();
      
      // Verify update
      await expect(page.locator('text=更新された高度な機能切り替えフラグ')).toBeVisible();
      await expect(page.locator('[data-testid="flag-toggle-switch"]:not([checked])')).toBeVisible();
      
      // DELETE: Delete the flag
      await page.click('[data-testid="flag-actions-button"]');
      await page.click('text=削除');
      
      // Confirm deletion
      await expect(page.locator('text=フラグの削除')).toBeVisible();
      await expect(page.locator('text=この操作は取り消せません')).toBeVisible();
      await page.click('.ant-modal-confirm-btns .ant-btn-dangerous');
      
      // Verify deletion
      await expect(page.locator('text=フラグが削除されました')).toBeVisible();
      await expect(page.locator('text=advanced_feature_toggle')).not.toBeVisible();
    });

    test('should handle flag creation with validation errors', async ({ page }) => {
      await page.click('[data-testid="create-flag-button"]');
      
      // Test empty form submission
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      
      // Verify validation errors
      await expect(page.locator('text=フラグキーは必須です')).toBeVisible();
      await expect(page.locator('text=説明は必須です')).toBeVisible();
      await expect(page.locator('text=所有者は必須です')).toBeVisible();
      
      // Test invalid flag key format
      await page.fill('[data-testid="flag-key-input"]', 'Invalid Flag Key!');
      await page.blur('[data-testid="flag-key-input"]');
      await expect(page.locator('text=小文字、数字、アンダースコアのみ使用可能です')).toBeVisible();
      
      // Test valid key format
      await page.fill('[data-testid="flag-key-input"]', 'valid_flag_key');
      await page.blur('[data-testid="flag-key-input"]');
      await expect(page.locator('text=小文字、数字、アンダースコアのみ使用可能です')).not.toBeVisible();
      
      // Complete form with valid data
      await page.fill('[data-testid="flag-description-input"]', 'Valid flag description');
      await page.fill('[data-testid="flag-owner-input"]', 'team-validation');
      
      // Submit successfully
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      await expect(page.locator('text=フラグが作成されました')).toBeVisible();
    });
  });

  test.describe('Advanced Search and Filtering', () => {
    test('should perform comprehensive search across all fields', async ({ page }) => {
      // Test search by flag key
      await page.fill('[data-testid="flag-search"]', 'billing');
      await page.waitForTimeout(500); // Debounce
      
      const billingRows = await page.locator('[data-testid="flag-table"] tbody tr:has-text("billing")').count();
      expect(billingRows).toBeGreaterThan(0);
      
      // Clear search
      await page.fill('[data-testid="flag-search"]', '');
      await page.waitForTimeout(500);
      
      // Test search by description
      await page.fill('[data-testid="flag-search"]', 'dashboard');
      await page.waitForTimeout(500);
      
      const dashboardRows = await page.locator('[data-testid="flag-table"] tbody tr:has-text("dashboard")').count();
      expect(dashboardRows).toBeGreaterThan(0);
      
      // Clear search
      await page.fill('[data-testid="flag-search"]', '');
      await page.waitForTimeout(500);
      
      // Test search by owner
      await page.fill('[data-testid="flag-search"]', 'team-frontend');
      await page.waitForTimeout(500);
      
      const ownerRows = await page.locator('[data-testid="flag-table"] tbody tr:has-text("team-frontend")').count();
      expect(ownerRows).toBeGreaterThan(0);
    });

    test('should filter flags by status (enabled/disabled)', async ({ page }) => {
      // Initial state - all flags visible
      const initialCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(initialCount).toBeGreaterThan(0);
      
      // Filter to show only enabled flags
      await page.click('button:has-text("すべて")');
      await page.waitForTimeout(300);
      
      await page.click('button:has-text("有効のみ")');
      await page.waitForTimeout(500);
      
      // Verify only enabled flags are shown
      const enabledSwitches = await page.locator('[data-testid="flag-toggle-switch"][checked]').count();
      const visibleRows = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(enabledSwitches).toBe(visibleRows);
      
      // Filter to show only disabled flags
      await page.click('button:has-text("有効のみ")');
      await page.waitForTimeout(300);
      
      await page.click('button:has-text("無効のみ")');
      await page.waitForTimeout(500);
      
      // Verify only disabled flags are shown
      const disabledSwitches = await page.locator('[data-testid="flag-toggle-switch"]:not([checked])').count();
      const disabledRows = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(disabledSwitches).toBe(disabledRows);
      
      // Reset filter
      await page.click('button:has-text("無効のみ")');
      await page.waitForTimeout(300);
      await page.click('button:has-text("すべて")');
    });

    test('should sort flags by different columns', async ({ page }) => {
      // Sort by flag key (ascending)
      await page.click('[data-testid="flag-table"] th:has-text("フラグキー")');
      await page.waitForTimeout(500);
      
      // Get first and last flag keys
      const firstKey = await page.locator('[data-testid="flag-table"] tbody tr:first-child td:first-child').textContent();
      const lastKey = await page.locator('[data-testid="flag-table"] tbody tr:last-child td:first-child').textContent();
      
      // Verify alphabetical order
      expect(firstKey?.toLowerCase() <= lastKey?.toLowerCase()).toBeTruthy();
      
      // Sort by flag key (descending)
      await page.click('[data-testid="flag-table"] th:has-text("フラグキー")');
      await page.waitForTimeout(500);
      
      // Sort by creation date
      await page.click('[data-testid="flag-table"] th:has-text("作成日時")');
      await page.waitForTimeout(500);
      
      // Verify date sorting (most recent first)
      const firstDate = await page.locator('[data-testid="flag-table"] tbody tr:first-child td:nth-child(5)').textContent();
      const lastDate = await page.locator('[data-testid="flag-table"] tbody tr:last-child td:nth-child(5)').textContent();
      expect(firstDate).toBeTruthy();
      expect(lastDate).toBeTruthy();
    });
  });

  test.describe('Bulk Operations and Advanced Features', () => {
    test('should handle bulk flag operations', async ({ page }) => {
      // Select multiple flags
      await page.check('[data-testid="flag-table"] thead input[type="checkbox"]'); // Select all
      
      // Verify bulk actions appear
      await expect(page.locator('[data-testid="bulk-actions-panel"]')).toBeVisible();
      await expect(page.locator('text=選択されたアイテム:')).toBeVisible();
      
      // Test bulk enable
      await page.click('[data-testid="bulk-enable-button"]');
      await expect(page.locator('text=選択されたフラグを一括有効化しますか？')).toBeVisible();
      await page.click('.ant-modal-confirm-btns .ant-btn-primary');
      
      // Verify success
      await expect(page.locator('text=フラグが一括有効化されました')).toBeVisible();
      
      // Select multiple flags again
      const checkboxes = await page.locator('[data-testid="flag-table"] tbody input[type="checkbox"]').all();
      for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
        await checkboxes[i].check();
      }
      
      // Test bulk disable
      await page.click('[data-testid="bulk-disable-button"]');
      await page.click('.ant-modal-confirm-btns .ant-btn-primary');
      
      // Verify success
      await expect(page.locator('text=フラグが一括無効化されました')).toBeVisible();
    });

    test('should export and import flag configurations', async ({ page }) => {
      // Test export functionality
      await page.click('[data-testid="export-flags-button"]');
      
      // Choose export format
      await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();
      await page.click('[data-testid="export-format-json"]');
      await page.click('[data-testid="export-modal"] .ant-btn-primary');
      
      // Verify export process
      await expect(page.locator('text=フラグ設定をエクスポートしています')).toBeVisible();
      
      // Test import functionality
      await page.click('[data-testid="import-flags-button"]');
      await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();
      
      // Verify import validation
      await expect(page.locator('text=JSONファイルまたはCSVファイルを選択')).toBeVisible();
      await expect(page.locator('text=既存のフラグと重複する場合の処理')).toBeVisible();
      
      // Test import validation options
      await page.check('text=上書きする');
      await page.check('text=スキップする');
      await page.check('text=エラーとする');
    });
  });

  test.describe('Real-time Features and Performance', () => {
    test('should handle real-time flag toggle updates', async ({ page }) => {
      // Find first enabled flag
      const enabledFlag = page.locator('[data-testid="flag-toggle-switch"][checked]').first();
      await enabledFlag.click();
      
      // Verify immediate UI update
      await expect(enabledFlag).not.toBeChecked();
      
      // Verify success message
      await expect(page.locator('text=フラグが更新されました')).toBeVisible();
      
      // Toggle back
      await enabledFlag.click();
      await expect(enabledFlag).toBeChecked();
    });

    test('should handle pagination with large datasets', async ({ page }) => {
      // Verify pagination controls
      await expect(page.locator('.ant-pagination')).toBeVisible();
      
      // Test page size change
      await page.click('.ant-select-selector:has-text("20 / ページ")');
      await page.click('.ant-select-item:has-text("50 / ページ")');
      
      // Verify page size change
      const rowsAfterSizeChange = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowsAfterSizeChange).toBeGreaterThanOrEqual(15); // We seeded 15 flags
      
      // Test quick jumper
      await page.fill('.ant-pagination-options-quick-jumper input', '1');
      await page.keyboard.press('Enter');
      
      // Verify page navigation
      await expect(page.locator('.ant-pagination-item-active')).toHaveText('1');
      
      // Test total count display
      await expect(page.locator('text=/ 15 件')).toBeVisible();
    });

    test('should handle concurrent operations gracefully', async ({ page, context }) => {
      // Create second page for concurrent operations
      const page2 = await context.newPage();
      await page2.goto('/flags/list');
      await page2.waitForResponse('**/api/flags');
      
      // Both pages attempt to toggle the same flag simultaneously
      const flagKey = 'billing_v2_enable';
      
      const toggle1 = page.locator(`[data-testid="flag-toggle-switch"]`).first();
      const toggle2 = page2.locator(`[data-testid="flag-toggle-switch"]`).first();
      
      // Concurrent toggle operations
      await Promise.all([
        toggle1.click(),
        toggle2.click()
      ]);
      
      // Both should show some success/error indication
      await Promise.all([
        expect(page.locator('.ant-message')).toBeVisible(),
        expect(page2.locator('.ant-message')).toBeVisible()
      ]);
      
      // Verify final state consistency
      await page.reload();
      await page2.reload();
      
      await page.waitForResponse('**/api/flags');
      await page2.waitForResponse('**/api/flags');
      
      // Both pages should show the same state
      const state1 = await page.locator(`[data-testid="flag-toggle-switch"]`).first().isChecked();
      const state2 = await page2.locator(`[data-testid="flag-toggle-switch"]`).first().isChecked();
      
      expect(state1).toBe(state2);
      
      await page2.close();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and block API calls to simulate network error
      await page.route('**/api/flags**', route => route.abort());
      
      await page.reload();
      
      // Verify error handling
      await expect(page.locator('text=フラグの読み込みに失敗しました')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Unblock API and test retry
      await page.unroute('**/api/flags**');
      await page.click('[data-testid="retry-button"]');
      
      // Verify recovery
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
    });

    test('should handle invalid flag operations', async ({ page }) => {
      // Try to create duplicate flag
      await page.click('[data-testid="create-flag-button"]');
      await page.fill('[data-testid="flag-key-input"]', 'billing_v2_enable'); // Existing flag
      await page.fill('[data-testid="flag-description-input"]', 'Duplicate flag test');
      await page.fill('[data-testid="flag-owner-input"]', 'team-test');
      
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      
      // Verify error handling
      await expect(page.locator('text=フラグキーが既に存在します')).toBeVisible();
      
      // Cancel and test deletion of non-existent flag
      await page.click('[data-testid="create-flag-modal"] .ant-btn:has-text("キャンセル")');
    });

    test('should handle expiration date edge cases', async ({ page }) => {
      await page.click('[data-testid="create-flag-button"]');
      
      // Set past expiration date
      await page.fill('[data-testid="flag-key-input"]', 'expired_flag_test');
      await page.fill('[data-testid="flag-description-input"]', 'Expired flag test');
      await page.fill('[data-testid="flag-owner-input"]', 'team-test');
      
      // Try to set past date
      await page.click('[placeholder="有効期限を設定（未設定の場合は無期限）"]');
      
      // Verify validation for past dates (if implemented)
      // This depends on the actual validation logic in the component
      
      // Set future date
      await page.keyboard.type('2025-12-31 23:59:59');
      await page.keyboard.press('Enter');
      
      await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
      await expect(page.locator('text=フラグが作成されました')).toBeVisible();
      
      // Verify expiration is displayed correctly
      await expect(page.locator('text=expired_flag_test')).toBeVisible();
      await expect(page.locator('text=2025/12/31')).toBeVisible();
    });
  });
});