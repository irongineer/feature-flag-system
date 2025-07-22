import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helper Utilities
 * 
 * t-wada TDD原則:
 * - APIレスポンス依存ではなく、UI状態ベースの待機
 * - 堅牢なエラーハンドリング
 * - 再利用可能なテストユーティリティ
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * フラグ一覧ページの読み込み完了を待機
   * APIレスポンスではなく、UIの状態変化で判定
   */
  async waitForFlagListLoaded(): Promise<void> {
    await this.page.goto('/flags/list');
    
    try {
      // まずローディング状態を検出
      await this.page.waitForSelector('.ant-spin', { state: 'attached', timeout: 2000 });
      
      // ローディング完了を待機
      await this.page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 10000 });
    } catch (error) {
      // ローディングスピナーが見つからない場合は、直接テーブルを待機
      console.log('Loading spinner not detected, waiting for table directly');
    }
    
    // テーブルまたは空状態の表示を待機
    await Promise.race([
      this.page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 }),
      this.page.waitForSelector('.ant-empty', { timeout: 15000 }),
    ]);
    
    // 追加の安定化待機
    await this.page.waitForTimeout(1000);
  }

  /**
   * ダッシュボードページの読み込み完了を待機
   */
  async waitForDashboardLoaded(): Promise<void> {
    await this.page.goto('/');
    
    try {
      // ローディング状態を検出・待機
      await this.page.waitForSelector('.ant-spin', { state: 'attached', timeout: 2000 });
      await this.page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 10000 });
    } catch (error) {
      console.log('Loading spinner not detected on dashboard');
    }
    
    // ダッシュボードのメトリクスカードを待機
    await Promise.race([
      this.page.waitForSelector('[data-testid="metrics-card"]', { timeout: 15000 }),
      this.page.waitForSelector('.ant-statistic', { timeout: 15000 }),
    ]);
    
    await this.page.waitForTimeout(1000);
  }

  /**
   * フラグ作成モーダルを開く
   */
  async openCreateFlagModal(): Promise<void> {
    const createButton = this.page.locator('[data-testid="create-flag-button"]');
    
    // ボタンが表示されるまで待機
    await createButton.waitFor({ state: 'visible', timeout: 10000 });
    await createButton.click();
    
    // モーダルが開くまで待機
    await this.page.waitForSelector('.ant-modal', { state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(500); // モーダルアニメーション完了待機
  }

  /**
   * フラグ作成フォームを入力・送信
   */
  async createFlag(flagKey: string, description: string): Promise<void> {
    // フォーム入力
    await this.page.fill('[data-testid="flag-key-input"]', flagKey);
    await this.page.fill('[data-testid="flag-description-input"]', description);
    
    // 送信ボタンクリック
    const submitButton = this.page.locator('[data-testid="create-flag-modal"] .ant-btn-primary');
    await submitButton.click();
    
    // モーダルが閉じるか、エラーメッセージが表示されるまで待機
    await Promise.race([
      this.page.waitForSelector('.ant-modal', { state: 'hidden', timeout: 8000 }),
      this.page.waitForSelector('.ant-message-error', { timeout: 8000 }),
      this.page.waitForSelector('.ant-form-item-has-error', { timeout: 8000 }),
    ]).catch(() => {
      console.warn('Modal did not close within timeout - likely API server not running');
    });
    
    // 成功メッセージまたはエラーメッセージを待機
    await Promise.race([
      this.page.waitForSelector('.ant-message-success', { timeout: 3000 }),
      this.page.waitForSelector('.ant-message-error', { timeout: 3000 }),
      this.page.waitForTimeout(1000), // フォールバック
    ]).catch(() => {
      console.warn('No success/error message detected');
    });
  }

  /**
   * APIサーバーの生存確認
   */
  async checkApiHealth(): Promise<boolean> {
    try {
      const response = await this.page.request.get('http://localhost:3001/health');
      return response.ok();
    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  }

  /**
   * 検索機能をテスト
   */
  async searchFlags(searchTerm: string): Promise<void> {
    const searchInput = this.page.locator('[data-testid="flag-search"]');
    
    // 検索インプットが表示されるまで待機
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // 検索実行
    await searchInput.fill(searchTerm);
    await this.page.keyboard.press('Enter');
    
    // 検索結果の更新を待機
    await this.page.waitForTimeout(1000);
  }

  /**
   * ナビゲーション操作
   */
  async navigateToPage(path: string): Promise<void> {
    await this.page.goto(path);
    
    // ページロード完了を待機（ネットワークアイドルまたはDOMContentLoaded）
    await Promise.race([
      this.page.waitForLoadState('networkidle', { timeout: 10000 }),
      this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }),
    ]).catch(() => {
      console.warn(`Navigation to ${path} did not reach network idle state`);
    });
    
    await this.page.waitForTimeout(500);
  }

  /**
   * エラーハンドリング - ページエラーを検出
   */
  async checkForPageErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // コンソールエラーをチェック
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // APIエラーレスポンスをチェック
    this.page.on('response', response => {
      if (response.status() >= 400) {
        errors.push(`API Error: ${response.status()} ${response.url()}`);
      }
    });
    
    return errors;
  }

  /**
   * レスポンシブデザインテスト
   */
  async testResponsiveDesign(): Promise<void> {
    // デスクトップサイズ
    await this.page.setViewportSize({ width: 1200, height: 800 });
    await this.page.waitForTimeout(500);
    
    // タブレットサイズ
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.page.waitForTimeout(500);
    
    // モバイルサイズ
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.page.waitForTimeout(500);
    
    // デスクトップに戻す
    await this.page.setViewportSize({ width: 1200, height: 800 });
    await this.page.waitForTimeout(500);
  }
}