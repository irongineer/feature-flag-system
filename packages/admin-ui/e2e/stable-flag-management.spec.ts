import { test, expect } from '@playwright/test';

/**
 * 安定化されたE2Eテスト
 * - 完全モック化戦略
 * - フレーキーテスト根絶
 * - 高速実行
 */

test.describe('Flag Management - Stable Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 全APIを完全モック化 - 外部依存排除
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      
      // Dashboard API
      if (url.includes('/api/dashboard/metrics')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalFlags: 15,
            activeFlags: 12,
            killSwitchesActive: 0,
            tenantsWithOverrides: 23,
            flagUsageStats: [
              { flagKey: 'billing_v2', evaluations: 1250, lastAccessed: '2025-07-17T01:00:00Z' },
              { flagKey: 'new_dashboard', evaluations: 890, lastAccessed: '2025-07-17T00:30:00Z' }
            ]
          })
        });
      }
      
      // Dashboard Activities API
      else if (url.includes('/api/dashboard/activities')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '1',
              timestamp: '2025-07-17T01:00:00Z',
              type: 'flag_created',
              message: 'フラグ "test_flag" を作成しました',
              user: 'admin@example.com'
            },
            {
              id: '2', 
              timestamp: '2025-07-17T00:45:00Z',
              type: 'flag_updated',
              message: 'フラグ "billing_v2" を更新しました',
              user: 'developer@example.com'
            }
          ])
        });
      }
      
      // Flags API
      else if (url.includes('/api/flags')) {
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                flagKey: 'test_flag_1',
                description: 'Test Flag 1 - for E2E testing',
                defaultEnabled: true,
                owner: 'test-team@example.com',
                createdAt: '2025-01-01T00:00:00Z'
              },
              {
                flagKey: 'billing_v2_enable',
                description: 'New billing system feature flag',
                defaultEnabled: false,
                owner: 'billing-team@example.com',
                createdAt: '2025-01-02T00:00:00Z'
              }
            ])
          });
        } else if (method === 'POST') {
          // Flag creation
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              flagKey: 'new_test_flag',
              description: 'Newly created flag',
              defaultEnabled: false,
              owner: 'test@example.com',
              createdAt: new Date().toISOString()
            })
          });
        }
      }
      
      // Default fallback
      else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not found' })
        });
      }
    });
  });

  test('should display dashboard with metrics reliably', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React app to mount
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Check dashboard title
    await expect(page.locator('h2:has-text("ダッシュボード")')).toBeVisible({ timeout: 5000 });
    
    // Wait for metrics to render
    await page.waitForSelector('[data-testid="dashboard-metrics"]', { timeout: 5000 });
    
    // Verify metric cards
    const metricCards = page.locator('[data-testid="dashboard-metrics"] .ant-card');
    await expect(metricCards).toHaveCount(4);
    
    // Verify specific metrics
    await expect(page.locator('text=15')).toBeVisible(); // Total flags
    await expect(page.locator('text=12')).toBeVisible(); // Active flags
  });

  test('should display recent activities reliably', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React app
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Check activities section
    await expect(page.locator('text=最近のアクティビティ')).toBeVisible({ timeout: 5000 });
    
    // Wait for activities list
    await page.waitForSelector('[data-testid="recent-activities"]', { timeout: 5000 });
    
    // Verify activity items
    await expect(page.locator('text=フラグ "test_flag" を作成しました')).toBeVisible();
    await expect(page.locator('text=admin@example.com')).toBeVisible();
  });

  test('should handle flag creation workflow reliably', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for flag list page
    await page.waitForSelector('[data-testid="flag-table"]', { timeout: 10000 });
    
    // Verify initial flags
    await expect(page.locator('text=test_flag_1')).toBeVisible();
    await expect(page.locator('text=billing_v2_enable')).toBeVisible();
    
    // Open create modal
    await page.click('[data-testid="create-flag-button"]');
    
    // Wait for modal
    await page.waitForSelector('.ant-modal:visible', { timeout: 5000 });
    await expect(page.locator('.ant-modal-title:has-text("フラグを作成")')).toBeVisible();
    
    // Fill form
    await page.fill('[data-testid="flag-key-input"]', 'new_test_flag');
    await page.fill('[data-testid="flag-description-input"]', 'New test flag description');
    await page.fill('[data-testid="flag-owner-input"]', 'test@example.com');
    
    // Submit
    await page.click('.ant-modal-footer .ant-btn-primary');
    
    // Modal should close
    await expect(page.locator('.ant-modal:visible')).toHaveCount(0, { timeout: 5000 });
  });

  test('should handle navigation reliably', async ({ page }) => {
    await page.goto('/');
    
    // Wait for layout
    await page.waitForSelector('.ant-pro-layout', { timeout: 10000 });
    
    // Check main navigation items exist
    await expect(page.locator('[role="menuitem"]:has-text("ダッシュボード")')).toBeVisible();
    await expect(page.locator('.ant-menu-item-group').filter({ hasText: 'フラグ管理' })).toBeVisible();
  });

  test('should filter flags reliably', async ({ page }) => {
    await page.goto('/flags/list');
    
    // Wait for page load
    await page.waitForSelector('[data-testid="flag-table"]', { timeout: 10000 });
    
    // Use search
    await page.fill('[data-testid="flag-search"]', 'billing');
    
    // Should show filtered results
    await expect(page.locator('text=billing_v2_enable')).toBeVisible();
    await expect(page.locator('text=test_flag_1')).not.toBeVisible();
    
    // Clear search
    await page.fill('[data-testid="flag-search"]', '');
    
    // Should show all results again
    await expect(page.locator('text=test_flag_1')).toBeVisible();
    await expect(page.locator('text=billing_v2_enable')).toBeVisible();
  });
});