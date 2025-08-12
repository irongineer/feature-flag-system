import { test, expect } from '@playwright/test';

test.describe('Console Error Debug', () => {
  
  test('should capture console errors and warnings', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errors: string[] = [];
    
    // Capture console logs
    page.on('console', (msg) => {
      const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(text);
      
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Capture page errors  
    page.on('pageerror', (error) => {
      const errorText = `[PAGE ERROR] ${error.message}`;
      errors.push(errorText);
      console.log(errorText);
    });
    
    // Navigate and wait
    await page.goto('/');
    await page.waitForTimeout(8000); // Give it plenty of time
    
    // Log what we found
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => console.log(msg));
    
    console.log('\n=== ERRORS ===');
    errors.forEach(err => console.log(err));
    
    // Check if any critical errors occurred
    const hasCriticalErrors = errors.some(err => 
      err.toLowerCase().includes('failed') ||
      err.toLowerCase().includes('cannot read') ||
      err.toLowerCase().includes('undefined') ||
      err.toLowerCase().includes('syntax')
    );
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${errors.length}`);
    console.log(`Has critical errors: ${hasCriticalErrors}`);
    
    // Take screenshot for visual debugging
    await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
    
    // Check DOM state
    const pageTitle = await page.title();
    const rootExists = await page.locator('#root').count() > 0;
    const rootHasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML.length > 0 : false;
    });
    
    console.log(`Page title: "${pageTitle}"`);
    console.log(`Root div exists: ${rootExists}`);
    console.log(`Root has content: ${rootHasContent}`);
    
    // If no critical errors, the issue might be elsewhere
    if (!hasCriticalErrors && errors.length === 0) {
      console.log('No JavaScript errors found. Issue may be in component mounting or routing.');
    }
  });
  
});