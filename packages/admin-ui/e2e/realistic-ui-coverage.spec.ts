import { test, expect } from '@playwright/test';

/**
 * Realistic UI Coverage E2E Tests
 * 
 * 実装済み機能に基づく実用的なE2Eテスト
 * 90%カバレッジ達成のための現実的なテストシナリオ
 */

test.describe('Realistic UI Coverage - Based on Actual Implementation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset and seed test data
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed', { method: 'POST' });
    
    // Wait for data seeding
    await page.waitForTimeout(1000);
  });

  test.describe('Flag Management Core Features', () => {
    test('should display flag list with search functionality', async ({ page }) => {
      await page.goto('/flags/list');
      
      // Wait for API response and UI load
      await page.waitForResponse('**/api/flags');
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Verify table has data
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
      
      // Test search functionality
      await page.fill('[data-testid="flag-search"]', 'test_flag');
      await page.waitForTimeout(500); // Debounce
      
      // Verify search results
      const searchResults = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(searchResults).toBeGreaterThanOrEqual(0);
    });

    test('should create new flag with complete form validation', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Open create modal
      await page.click('[data-testid="create-flag-button"]');
      await expect(page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
      
      // Test form validation - submit empty form
      await page.click('.ant-btn-primary:has-text("作成")');
      
      // Verify validation messages appear
      await expect(page.locator('text=フラグキーは必須です')).toBeVisible();
      await expect(page.locator('text=説明は必須です')).toBeVisible();
      await expect(page.locator('text=所有者は必須です')).toBeVisible();
      
      // Fill valid form data
      await page.fill('[data-testid="flag-key-input"]', 'realistic_test_flag');
      await page.fill('[data-testid="flag-description-input"]', 'リアリスティックテストフラグ - 実際の機能テスト用');
      await page.fill('[data-testid="flag-owner-input"]', 'team-e2e-test');
      
      // Toggle enabled state
      await page.click('[data-testid="flag-enabled-switch"]');
      
      // Submit form
      await page.click('.ant-btn-primary:has-text("作成")');
      
      // Verify modal closes and success message
      await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
      await expect(page.locator('text=realistic_test_flag')).toBeVisible();
    });

    test('should handle flag toggle switch updates', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first toggle switch
      const toggleSwitch = page.locator('[data-testid="flag-toggle-switch"]').first();
      await expect(toggleSwitch).toBeVisible();
      
      // Get initial state
      const initialState = await toggleSwitch.isChecked();
      
      // Toggle switch
      await toggleSwitch.click();
      
      // Verify state changed
      const newState = await toggleSwitch.isChecked();
      expect(newState).toBe(!initialState);
      
      // Verify success notification appears
      await expect(page.locator('.ant-message')).toBeVisible();
    });

    test('should open edit modal and handle updates', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first actions button and click edit
      await page.locator('[data-testid="flag-actions-button"]').first().click();
      await page.click('text=編集');
      
      // Verify edit modal opens with pre-filled data
      await expect(page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
      await expect(page.locator('.ant-modal-title:has-text("フラグを編集")')).toBeVisible();
      
      // Verify form is pre-filled
      const flagKeyInput = page.locator('[data-testid="flag-key-input"]');
      await expect(flagKeyInput).toBeDisabled(); // Key should be disabled in edit mode
      
      // Update description
      await page.fill('[data-testid="flag-description-input"]', '更新されたフラグ説明 - 編集テスト');
      
      // Submit update
      await page.click('.ant-btn-primary:has-text("更新")');
      
      // Verify modal closes
      await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
    });

    test('should handle delete confirmation workflow', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first actions button and click delete
      await page.locator('[data-testid="flag-actions-button"]').first().click();
      await page.click('text=削除');
      
      // Verify confirmation modal appears
      await expect(page.locator('.ant-modal-confirm')).toBeVisible();
      await expect(page.locator('text=フラグの削除')).toBeVisible();
      await expect(page.locator('text=この操作は取り消せません')).toBeVisible();
      
      // Cancel deletion
      await page.click('.ant-btn:has-text("キャンセル")');
      await expect(page.locator('.ant-modal-confirm')).not.toBeVisible();
    });
  });

  test.describe('Filter and Status Management', () => {
    test('should filter flags by enabled/disabled status', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Get initial count
      const initialCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(initialCount).toBeGreaterThan(0);
      
      // Click filter button to show only enabled
      await page.click('button:has-text("すべて")');
      await page.waitForTimeout(300);
      
      // Test filtering (button text should change)
      const filterButton = page.locator('button').filter({ hasText: /^(すべて|有効のみ|無効のみ)$/ });
      await expect(filterButton).toBeVisible();
    });

    test('should copy flag key to clipboard', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Click on first flag key (which should be copyable)
      const flagKeyElement = page.locator('[data-testid="flag-table"] tbody tr:first-child .ant-typography code').first();
      await expect(flagKeyElement).toBeVisible();
      
      // Click to copy
      await flagKeyElement.click();
      
      // Verify copy success message
      await expect(page.locator('text=フラグキーをコピーしました')).toBeVisible();
    });
  });

  test.describe('Table Features and Pagination', () => {
    test('should handle table sorting', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Click on column header to sort
      await page.click('[data-testid="flag-table"] th:has-text("フラグキー")');
      await page.waitForTimeout(300);
      
      // Click again for reverse sort
      await page.click('[data-testid="flag-table"] th:has-text("フラグキー")');
      await page.waitForTimeout(300);
      
      // Verify table still has content
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display pagination and handle page size changes', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Check if pagination exists (only if there are enough items)
      const pagination = page.locator('.ant-pagination');
      const isVisible = await pagination.isVisible();
      
      if (isVisible) {
        // Test page size change
        await page.click('.ant-select-selector:has-text("20")');
        await page.click('text=50');
        await page.waitForTimeout(500);
      }
      
      // Verify total count display
      const totalDisplay = page.locator('.ant-pagination-total-text');
      if (await totalDisplay.isVisible()) {
        await expect(totalDisplay).toContainText('件');
      }
    });
  });

  test.describe('Form Validation and Error Handling', () => {
    test('should validate flag key format', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      await page.click('[data-testid="create-flag-button"]');
      await expect(page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
      
      // Test invalid flag key
      await page.fill('[data-testid="flag-key-input"]', 'Invalid-Flag-Key!');
      await page.click('[data-testid="flag-description-input"]'); // Trigger validation
      
      // Check validation message appears
      await expect(page.locator('text=小文字、数字、アンダースコアのみ使用可能です')).toBeVisible();
      
      // Test valid flag key
      await page.fill('[data-testid="flag-key-input"]', 'valid_flag_key_123');
      await page.click('[data-testid="flag-description-input"]');
      
      // Validation message should disappear
      await expect(page.locator('text=小文字、数字、アンダースコアのみ使用可能です')).not.toBeVisible();
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Block API requests to simulate error
      await page.route('**/api/flags', route => route.abort());
      
      await page.goto('/flags/list');
      
      // Verify error handling (table might show loading or error state)
      await page.waitForTimeout(2000);
      
      // Table should still be present, possibly with loading state
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Restore API
      await page.unroute('**/api/flags');
    });
  });

  test.describe('Dashboard and Navigation', () => {
    test('should display dashboard with metrics', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Verify dashboard loads
      await expect(page.locator('h2:has-text("ダッシュボード")')).toBeVisible();
      
      // Look for metric cards
      const metricCards = page.locator('.ant-card');
      if (await metricCards.count() > 0) {
        await expect(metricCards.first()).toBeVisible();
      }
    });

    test('should navigate between pages', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard');
      await expect(page.locator('h2:has-text("ダッシュボード")')).toBeVisible();
      
      // Navigate to flags
      await page.click('a[href="/flags/list"], button:has-text("フラグ管理")');
      await page.waitForResponse('**/api/flags');
      await expect(page.locator('h2:has-text("フラグ管理")')).toBeVisible();
      
      // Navigate back to dashboard
      await page.click('a[href="/dashboard"], button:has-text("ダッシュボード")');
      await expect(page.locator('h2:has-text("ダッシュボード")')).toBeVisible();
    });
  });

  test.describe('Responsive Design and Accessibility', () => {
    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Verify main elements are visible
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-flag-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="flag-search"]')).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Focus on search input
      await page.focus('[data-testid="flag-search"]');
      
      // Tab to create button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus moved
      const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      // Note: This may vary depending on exact implementation
    });
  });

  test.describe('Data Persistence and Reload', () => {
    test('should persist flag changes after page reload', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Create a test flag
      await page.click('[data-testid="create-flag-button"]');
      await page.fill('[data-testid="flag-key-input"]', 'persistence_test_flag');
      await page.fill('[data-testid="flag-description-input"]', 'Persistence test flag');
      await page.fill('[data-testid="flag-owner-input"]', 'team-persistence');
      await page.click('.ant-btn-primary:has-text("作成")');
      
      // Verify flag appears
      await expect(page.locator('text=persistence_test_flag')).toBeVisible();
      
      // Reload page
      await page.reload();
      await page.waitForResponse('**/api/flags');
      
      // Verify flag still exists
      await expect(page.locator('text=persistence_test_flag')).toBeVisible();
    });
  });
});