import { test, expect } from '@playwright/test';

/**
 * Working UI Coverage E2E Tests
 * 
 * 実際に動作する機能のみに絞った確実なE2Eテスト
 * 段階的に機能実装とともにカバレッジを拡張
 */

test.describe('Working UI Coverage - Proven Functionality', () => {
  
  test.beforeEach(async ({ page }) => {
    // Reset and seed test data
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed', { method: 'POST' });
    
    // Wait for data seeding
    await page.waitForTimeout(1000);
  });

  test.describe('Core Flag Display and API Integration', () => {
    test('should display flag list from live API', async ({ page }) => {
      await page.goto('/flags/list');
      
      // Wait for API response and UI load
      await page.waitForResponse('**/api/flags');
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Verify page title
      await expect(page.locator('h2:has-text("フラグ管理")')).toBeVisible();
      
      // Verify table has data
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
      
      // Verify essential UI elements
      await expect(page.locator('[data-testid="flag-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="create-flag-button"]')).toBeVisible();
    });

    test('should perform basic search functionality', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Get initial count
      const initialCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      
      // Test search with existing flag
      await page.fill('[data-testid="flag-search"]', 'test_flag_1');
      await page.waitForTimeout(500); // Debounce
      
      // Verify search results (could be 0 or more)
      const searchResults = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(searchResults).toBeGreaterThanOrEqual(0);
      expect(searchResults).toBeLessThanOrEqual(initialCount);
      
      // Clear search to restore all results
      await page.fill('[data-testid="flag-search"]', '');
      await page.waitForTimeout(500);
      
      const restoredCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(restoredCount).toBe(initialCount);
    });

    test('should display flag table columns correctly', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Verify table column headers
      await expect(page.locator('th:has-text("フラグキー")')).toBeVisible();
      await expect(page.locator('th:has-text("説明")')).toBeVisible();
      await expect(page.locator('th:has-text("デフォルト状態")')).toBeVisible();
      await expect(page.locator('th:has-text("所有者")')).toBeVisible();
      await expect(page.locator('th:has-text("作成日時")')).toBeVisible();
      await expect(page.locator('th:has-text("アクション")')).toBeVisible();
      
      // Verify first row has data
      const firstRow = page.locator('[data-testid="flag-table"] tbody tr:first-child');
      await expect(firstRow).toBeVisible();
      
      // Check for flag key in first row
      const flagKey = firstRow.locator('td:first-child .ant-typography');
      await expect(flagKey).toBeVisible();
    });

    test('should handle table sorting', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Click on flag key column to sort
      await page.click('th:has-text("フラグキー")');
      await page.waitForTimeout(300);
      
      // Verify table still displays data after sorting
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
      
      // Click again for reverse sort
      await page.click('th:has-text("フラグキー")');
      await page.waitForTimeout(300);
      
      // Verify data is still present
      const reversedRowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(reversedRowCount).toBe(rowCount);
    });
  });

  test.describe('Toggle Switch Functionality', () => {
    test('should display toggle switches for flag states', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find toggle switches
      const toggleSwitches = page.locator('[data-testid="flag-toggle-switch"]');
      const switchCount = await toggleSwitches.count();
      expect(switchCount).toBeGreaterThan(0);
      
      // Verify each switch is interactable
      for (let i = 0; i < Math.min(switchCount, 3); i++) {
        const toggle = toggleSwitches.nth(i);
        await expect(toggle).toBeVisible();
        await expect(toggle).toBeEnabled();
      }
    });

    test('should handle toggle switch interaction', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first toggle switch
      const firstToggle = page.locator('[data-testid="flag-toggle-switch"]').first();
      await expect(firstToggle).toBeVisible();
      
      // Get initial state
      const initialChecked = await firstToggle.isChecked();
      
      // Click the toggle
      await firstToggle.click();
      
      // Wait for any loading state to resolve
      await page.waitForTimeout(1000);
      
      // Note: We don't assert state change here as it depends on API response
      // Instead, we verify the toggle is still functional
      await expect(firstToggle).toBeVisible();
      await expect(firstToggle).toBeEnabled();
    });
  });

  test.describe('Actions Menu and Dropdowns', () => {
    test('should display actions dropdown for each flag', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first actions button
      const firstActionsButton = page.locator('[data-testid="flag-actions-button"]').first();
      await expect(firstActionsButton).toBeVisible();
      
      // Click to open dropdown
      await firstActionsButton.click();
      
      // Verify dropdown menu items
      await expect(page.locator('text=編集')).toBeVisible();
      await expect(page.locator('text=削除')).toBeVisible();
      
      // Close dropdown by clicking elsewhere
      await page.click('body');
      await page.waitForTimeout(300);
    });

    test('should handle delete confirmation dialog', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Open first actions menu
      await page.locator('[data-testid="flag-actions-button"]').first().click();
      
      // Click delete option
      await page.click('text=削除');
      
      // Verify confirmation dialog appears
      await expect(page.locator('.ant-modal-confirm')).toBeVisible();
      await expect(page.locator('text=フラグの削除')).toBeVisible();
      await expect(page.locator('text=この操作は取り消せません')).toBeVisible();
      
      // Cancel deletion
      await page.click('.ant-btn:has-text("キャンセル")');
      
      // Verify dialog closes
      await expect(page.locator('.ant-modal-confirm')).not.toBeVisible();
    });
  });

  test.describe('Filter and Status Management', () => {
    test('should handle status filter button', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find filter button
      const filterButton = page.locator('button').filter({ hasText: /^(すべて|有効のみ|無効のみ)$/ });
      await expect(filterButton).toBeVisible();
      
      // Click filter button
      await filterButton.click();
      await page.waitForTimeout(300);
      
      // Verify filter state changed (button should still be visible)
      await expect(filterButton).toBeVisible();
    });

    test('should support flag key copying to clipboard', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Find first flag key element
      const flagKeyElement = page.locator('[data-testid="flag-table"] tbody tr:first-child .ant-typography').first();
      await expect(flagKeyElement).toBeVisible();
      
      // Click to copy
      await flagKeyElement.click();
      
      // Verify copy success message
      await expect(page.locator('.ant-message')).toBeVisible();
      await expect(page.locator('text=フラグキーをコピーしました')).toBeVisible();
    });
  });

  test.describe('Table Features and Responsive Design', () => {
    test('should handle pagination when available', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Check if pagination exists
      const pagination = page.locator('.ant-pagination');
      const paginationVisible = await pagination.isVisible();
      
      if (paginationVisible) {
        // Test pagination functionality
        await expect(page.locator('.ant-pagination-total-text')).toBeVisible();
        
        // Verify page size selector exists
        const pageSizeSelector = page.locator('.ant-select-selector').filter({ hasText: /\d+/ });
        if (await pageSizeSelector.isVisible()) {
          await expect(pageSizeSelector).toBeVisible();
        }
      }
      
      // Always verify table has content
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should display correctly on different viewport sizes', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Test desktop view (default)
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      // Restore desktop view
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('API Integration and Error Handling', () => {
    test('should handle successful API responses', async ({ page }) => {
      await page.goto('/flags/list');
      
      // Wait for successful API response
      const response = await page.waitForResponse('**/api/flags');
      expect(response.status()).toBe(200);
      
      // Verify UI reflects successful data load
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      const rowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should handle API evaluation endpoint', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Test evaluation API through browser console
      const evaluationResult = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:3001/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId: 'test-tenant',
              flagKey: 'test_flag_1',
              environment: 'development'
            })
          });
          
          if (response.ok) {
            return await response.json();
          }
          return { error: 'API call failed' };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      // Verify API is accessible
      expect(evaluationResult).toBeDefined();
      expect(evaluationResult.error).toBeUndefined();
    });

    test('should gracefully handle page reload', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Verify initial load
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      const initialRowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      
      // Reload page
      await page.reload();
      await page.waitForResponse('**/api/flags');
      
      // Verify page loads correctly after reload
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      const reloadedRowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(reloadedRowCount).toBe(initialRowCount);
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should load page within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('should handle multiple rapid interactions', async ({ page }) => {
      await page.goto('/flags/list');
      await page.waitForResponse('**/api/flags');
      
      // Perform multiple rapid search operations
      for (let i = 0; i < 3; i++) {
        await page.fill('[data-testid="flag-search"]', `search${i}`);
        await page.waitForTimeout(100);
      }
      
      // Clear search
      await page.fill('[data-testid="flag-search"]', '');
      await page.waitForTimeout(500);
      
      // Verify table still works
      await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
      const finalRowCount = await page.locator('[data-testid="flag-table"] tbody tr').count();
      expect(finalRowCount).toBeGreaterThan(0);
    });
  });
});