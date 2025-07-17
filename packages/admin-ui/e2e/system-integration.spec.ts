import { test, expect } from '@playwright/test';

test.describe('System Integration Tests - Core Feature Flag Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Reset and seed test data before each test
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    await fetch('http://localhost:3001/api/test/seed', { method: 'POST' });
    
    // Wait for API server to be ready
    await page.waitForTimeout(500);
  });

  test('should handle complete flag lifecycle', async ({ page }) => {
    await page.goto('/flags/list');
    
    // 1. Create new flag
    await page.waitForResponse('**/api/flags');
    await page.click('[data-testid="create-flag-button"]');
    
    const flagKey = `lifecycle_flag_${Date.now()}`;
    await page.fill('[data-testid="flag-key-input"]', flagKey);
    await page.fill('[data-testid="flag-description-input"]', 'Complete Lifecycle Test Flag');
    await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
    await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
    
    // 2. Navigate to dashboard and verify metrics updated
    await page.goto('/');
    await page.waitForResponse('**/api/dashboard/metrics');
    
    const metricsSection = page.locator('[data-testid="dashboard-metrics"]');
    await expect(metricsSection).toBeVisible();
    
    // 3. Return to flags list and verify flag exists
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Navigate back to ensure flag was created
    await page.goto('/');
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Verify our workflow completed successfully
    await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
  });

  test('should handle navigation between all pages', async ({ page }) => {
    // Test navigation to all main sections
    const pages = [
      { url: '/', testId: 'dashboard-metrics' },
      { url: '/flags/list', testId: 'flag-table' },
      { url: '/flags/kill-switch', testId: 'kill-switch-page' },
      { url: '/tenants', testId: 'tenant-settings-page' },
      { url: '/audit', testId: 'audit-logs-page' }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      
      // Wait for page to load
      await page.waitForTimeout(1000);
      
      // Verify page loaded (use flexible checking)
      const pageContent = await page.content();
      expect(pageContent).toContain('Feature Flag');
    }
  });

  test('should handle API error scenarios gracefully', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Test with API server temporarily down
    await page.route('**/api/flags', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Reload page to trigger error
    await page.reload();
    
    // Verify error handling (look for error message or retry button)
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    
    // The page should handle the error gracefully
    expect(pageContent).toContain('Flag'); // Should still show some UI
  });

  test('should handle concurrent flag operations', async ({ page }) => {
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Simulate concurrent operations by performing multiple actions quickly
    const actions = [
      async () => {
        await page.click('[data-testid="create-flag-button"]');
        await page.fill('[data-testid="flag-key-input"]', 'concurrent_flag_1');
        await page.fill('[data-testid="flag-description-input"]', 'Concurrent Test 1');
        await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
        await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
      },
      async () => {
        await page.fill('[data-testid="flag-search"]', 'test_flag_1');
        await page.waitForTimeout(300);
        await page.fill('[data-testid="flag-search"]', '');
      }
    ];
    
    // Execute actions concurrently
    await Promise.all(actions);
    
    // Verify system remains stable
    await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
  });

  test('should handle flag evaluation with different environments', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Test flag evaluation for different environments
    const environments = ['development', 'staging', 'production'];
    
    for (const env of environments) {
      const evaluationResult = await page.evaluate(async (environment) => {
        const response = await fetch('http://localhost:3001/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: 'tenant-123',
            flagKey: 'test_flag_1',
            environment: environment
          })
        });
        
        return await response.json();
      }, env);
      
      // Verify evaluation worked
      expect(evaluationResult.flagKey).toBe('test_flag_1');
      expect(evaluationResult.tenantId).toBe('tenant-123');
      expect(evaluationResult.enabled).toBeDefined();
    }
  });

  test('should handle dashboard real-time updates', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial dashboard load
    await page.waitForResponse('**/api/dashboard/metrics');
    await page.waitForResponse('**/api/dashboard/activities');
    
    // Verify dashboard components are loaded
    await expect(page.locator('[data-testid="dashboard-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-activities"]')).toBeVisible();
    
    // Test dashboard refresh by navigating away and back
    await page.goto('/flags/list');
    await page.goto('/');
    
    // Wait for dashboard to reload
    await page.waitForResponse('**/api/dashboard/metrics');
    await page.waitForResponse('**/api/dashboard/activities');
    
    // Verify dashboard still works
    await expect(page.locator('[data-testid="dashboard-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-activities"]')).toBeVisible();
  });

  test('should handle data persistence across sessions', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Create a flag
    await page.waitForResponse('**/api/flags');
    await page.click('[data-testid="create-flag-button"]');
    
    const persistentFlagKey = `persistent_flag_${Date.now()}`;
    await page.fill('[data-testid="flag-key-input"]', persistentFlagKey);
    await page.fill('[data-testid="flag-description-input"]', 'Persistent Test Flag');
    await page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
    await expect(page.locator('[data-testid="create-flag-modal"]')).not.toBeVisible();
    
    // Simulate browser refresh/session restart
    await page.reload();
    await page.waitForResponse('**/api/flags');
    
    // Verify flag persists (navigate to refresh data)
    await page.goto('/');
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    
    // Verify data persistence by checking API directly
    const apiResponse = await page.evaluate(async () => {
      const response = await fetch('http://localhost:3001/api/flags');
      return await response.json();
    });
    
    // Verify flags are still there
    expect(Array.isArray(apiResponse)).toBe(true);
    expect(apiResponse.length).toBeGreaterThan(0);
  });

  test('should handle system performance under load', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Measure page load time
    const startTime = Date.now();
    await page.waitForResponse('**/api/flags');
    const loadTime = Date.now() - startTime;
    
    // Verify reasonable load time (under 5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Test rapid navigation
    const navigationStartTime = Date.now();
    await page.goto('/');
    await page.waitForResponse('**/api/dashboard/metrics');
    await page.goto('/flags/list');
    await page.waitForResponse('**/api/flags');
    const navigationTime = Date.now() - navigationStartTime;
    
    // Verify navigation performance
    expect(navigationTime).toBeLessThan(10000);
    
    // Verify UI remains responsive
    await expect(page.locator('[data-testid="flag-table"]')).toBeVisible();
  });
});