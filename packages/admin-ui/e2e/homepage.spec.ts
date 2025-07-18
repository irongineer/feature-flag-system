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
    await page.waitForTimeout(3000);
    
    // Check that the page loaded successfully first
    await expect(page.locator('#root')).toBeVisible();
    
    // Look for any navigation elements that might be present
    const hasNavigation = await page.locator('nav').count() > 0;
    const hasMenu = await page.locator('[role="menu"]').count() > 0;
    const hasProLayout = await page.locator('.ant-pro-layout').count() > 0;
    
    // At least one navigation structure should exist
    expect(hasNavigation || hasMenu || hasProLayout).toBeTruthy();
    
    // Check for key navigation text (more flexible)
    const pageContent = await page.content();
    const hasExpectedText = pageContent.includes('ダッシュボード') || 
                           pageContent.includes('フラグ管理') || 
                           pageContent.includes('Feature Flag Admin');
    
    expect(hasExpectedText).toBeTruthy();
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