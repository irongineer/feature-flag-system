import { test, expect } from '@playwright/test';

test.describe('Admin UI Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads successfully
    await expect(page).toHaveTitle(/Feature Flag Admin/);
    
    // Check that React app renders
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should display navigation menu', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React app to load
    await page.waitForTimeout(2000);
    
    // Wait for Pro Layout to load
    await page.waitForSelector('.ant-pro-layout', { timeout: 10000 });
    
    // Check navigation items (use more specific selectors)
    await expect(page.locator('.ant-menu-item').filter({ hasText: 'ダッシュボード' })).toBeVisible();
    await expect(page.locator('.ant-menu-submenu').filter({ hasText: 'フラグ管理' })).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return errors
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/');
    
    // Should still load the UI structure even with API errors
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should still be functional on mobile
    await expect(page.locator('#root')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('#root')).toBeVisible();
  });
});