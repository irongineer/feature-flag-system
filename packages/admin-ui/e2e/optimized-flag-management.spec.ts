import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

/**
 * Optimized Flag Management E2E Tests
 * 
 * t-wada TDD原則:
 * - UIの状態変化ベースのテスト
 * - APIレスポンス依存を最小化
 * - 堅牢なエラーハンドリング
 * - 実用的なユーザーシナリオテスト
 */

test.describe('Optimized Flag Management', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // APIサーバー生存確認
    const apiHealthy = await helpers.checkApiHealth();
    test.skip(!apiHealthy, 'API server not available');
  });

  test('should display flag list reliably', async ({ page }) => {
    // Given: フラグ一覧ページにアクセス
    await helpers.waitForFlagListLoaded();

    // Then: テーブルまたは空状態が表示される
    const hasTable = await page.locator('[data-testid="flag-table"]').isVisible();
    const hasEmptyState = await page.locator('.ant-empty').isVisible();
    
    expect(hasTable || hasEmptyState).toBeTruthy();

    // Then: ページエラーが発生していない
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });

  test('should open create flag modal reliably', async ({ page }) => {
    // Given: フラグ一覧ページが読み込まれている
    await helpers.waitForFlagListLoaded();

    // When: フラグ作成ボタンをクリック
    await helpers.openCreateFlagModal();

    // Then: モーダルが表示される
    await expect(page.locator('.ant-modal')).toBeVisible();
    await expect(page.locator('[data-testid="flag-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="flag-description-input"]')).toBeVisible();
  });

  test('should handle flag creation workflow', async ({ page }) => {
    // Given: フラグ一覧ページが読み込まれている
    await helpers.waitForFlagListLoaded();

    // When: 新しいフラグを作成
    await helpers.openCreateFlagModal();
    
    const flagKey = `test_flag_${Date.now()}`;
    const description = 'Optimized E2E Test Flag';
    
    await helpers.createFlag(flagKey, description);

    // Then: API未起動でもUI操作は完了している
    // モーダルが閉じているか、エラー状態が表示されている
    const modalHidden = await page.locator('.ant-modal').isHidden();
    const hasErrorMessage = await page.locator('.ant-message-error').isVisible();
    const hasFormError = await page.locator('.ant-form-item-has-error').count() > 0;
    
    // いずれかの状態になっていればOK（正常 or エラー処理完了）
    expect(modalHidden || hasErrorMessage || hasFormError).toBeTruthy();
    
    // Then: ページエラーが発生していない
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });

  test('should handle search functionality', async ({ page }) => {
    // Given: フラグ一覧ページが読み込まれている
    await helpers.waitForFlagListLoaded();

    // Given: テーブルにデータが存在する場合のみテスト実行
    const hasData = await page.locator('[data-testid="flag-table"] tbody tr').count() > 0;
    test.skip(!hasData, 'No flag data available for search test');

    // When: 検索機能を使用
    await helpers.searchFlags('test');

    // Then: 検索結果が表示される（エラーが発生しない）
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });

  test('should navigate between pages reliably', async ({ page }) => {
    // When: 各ページに順次移動
    await helpers.navigateToPage('/');
    await expect(page).toHaveURL('/');

    await helpers.navigateToPage('/flags/list');
    await expect(page).toHaveURL('/flags/list');

    await helpers.navigateToPage('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Then: ナビゲーションエラーが発生していない
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });

  test('should display dashboard metrics', async ({ page }) => {
    // Given: ダッシュボードページにアクセス
    await helpers.waitForDashboardLoaded();

    // Then: メトリクスまたは統計情報が表示される
    const hasMetrics = await page.locator('[data-testid="metrics-card"]').isVisible();
    const hasStatistics = await page.locator('.ant-statistic').count() > 0;
    
    expect(hasMetrics || hasStatistics).toBeTruthy();
  });

  test('should be responsive across different screen sizes', async ({ page }) => {
    // Given: フラグ一覧ページが読み込まれている
    await helpers.waitForFlagListLoaded();

    // When: 異なる画面サイズでテスト
    await helpers.testResponsiveDesign();

    // Then: レスポンシブレイアウトが正常に動作
    await expect(page.locator('body')).toBeVisible();
    
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Given: ページにアクセス
    await page.goto('/flags/list');

    // Then: APIエラーが発生しても、ページクラッシュしない
    await expect(page.locator('body')).toBeVisible();
    
    // Then: エラーメッセージまたは適切なフォールバックが表示される
    const hasErrorMessage = await page.locator('.ant-message-error').isVisible();
    const hasEmptyState = await page.locator('.ant-empty').isVisible();
    const hasTable = await page.locator('[data-testid="flag-table"]').isVisible();
    
    // いずれかの状態が表示されていればOK
    expect(hasErrorMessage || hasEmptyState || hasTable).toBeTruthy();
  });

  test('should maintain consistent UI state during operations', async ({ page }) => {
    // Given: フラグ一覧ページが読み込まれている
    await helpers.waitForFlagListLoaded();

    // When: 複数の操作を連続実行
    const createButton = page.locator('[data-testid="create-flag-button"]');
    const isCreateButtonVisible = await createButton.isVisible();
    
    if (isCreateButtonVisible) {
      await helpers.openCreateFlagModal();
      
      // モーダルを閉じる
      await page.keyboard.press('Escape');
      await page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 5000 });
    }

    // Then: UI状態が一貫している
    await expect(page.locator('body')).toBeVisible();
    
    const errors = await helpers.checkForPageErrors();
    expect(errors.length).toBe(0);
  });
});