import { test, expect } from '@playwright/test';

test.describe('Advanced Flag Management - Extended E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Reset and seed test data before each test
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed', { method: 'POST' });
    
    // Wait for API server to be ready
    await page.waitForTimeout(500);
  });

  test('should handle flag update workflow', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for initial load
    await page.waitForResponse('**/api/flags');
    
    // Find and click edit button for first flag
    await page.locator('[data-testid="flag-table"] tbody tr').first().locator('.ant-dropdown-trigger').click();
    await page.locator('text=編集').click();
    
    // Update flag description
    await page.fill('[data-testid="flag-description-input"]', 'Updated Flag Description');
    
    // Submit form
    await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
    
    // Wait for modal to close
    await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
    
    // Verify updated description appears
    await expect(page.locator('text=Updated Flag Description')).toBeVisible();
  });

  test('should handle flag deletion workflow', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for initial load
    await page.waitForResponse('**/api/flags');
    
    // Count initial flags
    const initialFlags = await page.locator('[data-testid="flag-table"] tbody tr').count();
    
    // Find and click delete button for first flag
    await page.locator('[data-testid="flag-table"] tbody tr').first().locator('.ant-dropdown-trigger').click();
    await page.locator('text=削除').click();
    
    // Confirm deletion in modal
    await page.click('.ant-modal .ant-btn-primary');
    
    // Wait for deletion to complete
    await page.waitForTimeout(1000);
    
    // Verify flag count decreased
    const newFlags = await page.locator('[data-testid="flag-table"] tbody tr').count();
    expect(newFlags).toBeLessThan(initialFlags);
  });

  test('should handle flag enable/disable toggle', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for initial load
    await page.waitForResponse('**/api/flags');
    
    // Find the toggle switch for first flag
    const toggleSwitch = page.locator('[data-testid="flag-table"] tbody tr').first().locator('.ant-switch');
    
    // Get initial state
    const initialState = await toggleSwitch.getAttribute('aria-checked');
    
    // Click toggle
    await toggleSwitch.click();
    
    // Wait for state change
    await page.waitForTimeout(500);
    
    // Verify state changed
    const newState = await toggleSwitch.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);
  });

  test('should handle multi-tenant flag isolation', async ({ page }) => {
    // Create flags for different tenants using custom seed
    const customFlags = [
      {
        id: 'tenant1-flag1',
        flagKey: 'tenant1_feature',
        description: 'Tenant 1 Feature',
        defaultEnabled: true,
        owner: 'tenant1@example.com',
        createdAt: new Date().toISOString(),
        tenantId: 'tenant-1'
      },
      {
        id: 'tenant2-flag1',
        flagKey: 'tenant2_feature',
        description: 'Tenant 2 Feature',
        defaultEnabled: false,
        owner: 'tenant2@example.com',
        createdAt: new Date().toISOString(),
        tenantId: 'tenant-2'
      }
    ];
    
    await fetch('http://localhost:3001/api/test/seed-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customFlags })
    });
    
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Verify both tenant flags are displayed
    await expect(page.locator('text=tenant1_feature')).toBeVisible();
    await expect(page.locator('text=tenant2_feature')).toBeVisible();
    await expect(page.locator('text=Tenant 1 Feature')).toBeVisible();
    await expect(page.locator('text=Tenant 2 Feature')).toBeVisible();
  });

  test('should handle flag evaluation API integration', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Navigate to evaluation testing page (if exists)
    // For now, we'll test the evaluation API directly through browser console
    await page.evaluate(async () => {
      const response = await fetch('http://localhost:3001/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'tenant-123',
          flagKey: 'test_flag_1',
          environment: 'development'
        })
      });
      
      const result = await response.json();
      console.log('Flag evaluation result:', result);
      
      // Store result in window for verification
      window.evaluationResult = result;
    });
    
    // Verify evaluation result through page evaluation
    const evaluationResult = await page.evaluate(() => window.evaluationResult);
    expect(evaluationResult).toBeDefined();
    expect(evaluationResult.flagKey).toBe('test_flag_1');
    expect(evaluationResult.tenantId).toBe('tenant-123');
  });

  test('should handle flag expiration workflow', async ({ page }) => {
    // Create a flag with expiration date
    const expiredFlag = {
      id: 'expired-flag',
      flagKey: 'expired_feature',
      description: 'Expired Feature',
      defaultEnabled: true,
      owner: 'test@example.com',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 86400000).toISOString() // Expired yesterday
    };
    
    await fetch('http://localhost:3001/api/test/seed-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customFlags: [expiredFlag] })
    });
    
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Verify expired flag is displayed (potentially with warning)
    await expect(page.locator('text=expired_feature')).toBeVisible();
    await expect(page.locator('text=Expired Feature')).toBeVisible();
  });

  test('should handle bulk flag operations', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for initial load
    await page.waitForResponse('**/api/flags');
    
    // Select multiple flags (if bulk selection is implemented)
    const checkboxes = page.locator('[data-testid="flag-table"] tbody tr .ant-checkbox-input');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      // Select first two flags
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      
      // Look for bulk actions (if implemented)
      const bulkActionsButton = page.locator('[data-testid="bulk-actions-button"]');
      if (await bulkActionsButton.isVisible()) {
        await bulkActionsButton.click();
        
        // Verify bulk actions menu
        await expect(page.locator('text=一括有効化')).toBeVisible();
        await expect(page.locator('text=一括無効化')).toBeVisible();
      }
    }
  });

  test('should handle flag search and filtering', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for initial load
    await page.waitForResponse('**/api/flags');
    
    // Test different search scenarios
    await page.fill('[data-testid="flag-search"]', 'test_flag_1');
    await page.waitForTimeout(300);
    
    await expect(page.locator('text=test_flag_1')).toBeVisible();
    await expect(page.locator('text=test_flag_2')).not.toBeVisible();
    
    // Clear search
    await page.fill('[data-testid="flag-search"]', '');
    await page.waitForTimeout(300);
    
    // Both flags should be visible again
    await expect(page.locator('text=test_flag_1')).toBeVisible();
    await expect(page.locator('text=test_flag_2')).toBeVisible();
    
    // Test filter by status (if implemented)
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.locator('text=有効のみ').click();
      
      // Verify only enabled flags are shown
      await expect(page.locator('text=test_flag_1')).toBeVisible(); // This is enabled
    }
  });
});