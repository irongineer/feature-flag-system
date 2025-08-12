import { test, expect } from '@playwright/test';

test.describe('Simple UI Verification', () => {
  
  test('should load and display basic UI elements', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
    
    // Wait longer for the page to fully load
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see what's actually rendered
    await page.screenshot({ path: 'test-results/homepage-debug.png' });
    
    // Check for basic HTML structure
    const html = await page.content();
    console.log('Page title:', await page.title());
    console.log('HTML contains root div:', html.includes('id="root"'));
    
    // Try different selectors to find React content
    const bodyContent = await page.locator('body').textContent();
    console.log('Body text content:', bodyContent?.substring(0, 200));
    
    // Check if any React components rendered
    const hasReactContent = await page.locator('[class*="ant-"]').count() > 0;
    console.log('Has Ant Design components:', hasReactContent);
    
    // More flexible check - look for any content in root
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Root div innerHTML:', rootContent.substring(0, 200));
    
    // Basic assertion - page should at least load
    await expect(page).toHaveTitle(/Feature Flag Admin|ダッシュボード/);
  });

  test('should verify API connectivity', async ({ page }) => {
    // Check if we can make API calls
    const response = await page.request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();
    
    const flagsResponse = await page.request.get('http://localhost:3001/api/flags');
    expect(flagsResponse.ok()).toBeTruthy();
    
    console.log('API Health:', await response.json());
    console.log('Flags API:', await flagsResponse.json());
  });

  test('should wait for React app initialization', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Vite to inject scripts
    await page.waitForFunction(() => window.$RefreshReg$ !== undefined, { timeout: 10000 });
    
    // Wait for React to mount
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });
    
    // Now check if the app rendered
    const rootHasChildren = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.children.length > 0 : false;
    });
    
    console.log('Root has children:', rootHasChildren);
    
    if (rootHasChildren) {
      await expect(page.locator('#root > *')).toBeVisible();
    }
  });
  
});