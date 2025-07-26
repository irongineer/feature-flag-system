import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helper Functions
 * 
 * 90%カバレッジ達成のための共通ヘルパー関数集
 * テストの安定性・再利用性・保守性向上
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * API Server Setup and Data Management
   */
  static async resetAndSeedData(options: {
    flags?: number;
    killSwitches?: number;
    tenantOverrides?: number;
    auditLogs?: number;
    large?: boolean;
    malformed?: boolean;
  } = {}) {
    // Reset all data
    await fetch('http://localhost:3001/api/test/reset', { method: 'POST' });
    
    if (options.large) {
      // Seed large dataset for performance testing
      await fetch('http://localhost:3001/api/test/seed-large', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1000 })
      });
    } else if (options.malformed) {
      // Seed malformed data for error handling testing
      await fetch('http://localhost:3001/api/test/seed-malformed', { method: 'POST' });
    } else {
      // Standard seeding
      await fetch('http://localhost:3001/api/test/seed-comprehensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flags: options.flags || 10,
          killSwitches: options.killSwitches || 3,
          tenantOverrides: options.tenantOverrides || 5,
          auditLogs: options.auditLogs || 20
        })
      });
    }
  }

  /**
   * Wait for API responses and loading states
   */
  async waitForApiAndUI(apiPattern: string, uiSelector: string, timeout: number = 10000) {
    await Promise.all([
      this.page.waitForResponse(apiPattern, { timeout }),
      this.page.waitForSelector(uiSelector, { timeout })
    ]);
  }

  /**
   * Navigate and wait for page ready state
   */
  async navigateAndWait(path: string, apiPattern: string, uiSelector: string) {
    await this.page.goto(path);
    await this.waitForApiAndUI(apiPattern, uiSelector);
  }

  /**
   * Flag Management Helpers
   */
  async createFlag(data: {
    key: string;
    description: string;
    enabled?: boolean;
    owner: string;
    expirationDate?: string;
  }) {
    await this.page.click('[data-testid="create-flag-button"]');
    await expect(this.page.locator('[data-testid="create-flag-modal"]')).toBeVisible();
    
    await this.page.fill('[data-testid="flag-key-input"]', data.key);
    await this.page.fill('[data-testid="flag-description-input"]', data.description);
    await this.page.fill('[data-testid="flag-owner-input"]', data.owner);
    
    if (data.enabled !== undefined) {
      if (data.enabled) {
        await this.page.check('[data-testid="flag-enabled-switch"]');
      } else {
        await this.page.uncheck('[data-testid="flag-enabled-switch"]');
      }
    }
    
    if (data.expirationDate) {
      await this.page.click('[placeholder="有効期限を設定（未設定の場合は無期限）"]');
      await this.page.keyboard.type(data.expirationDate);
      await this.page.keyboard.press('Enter');
    }
    
    await this.page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
    await expect(this.page.locator('text=フラグが作成されました')).toBeVisible();
  }

  async editFlag(flagKey: string, updates: {
    description?: string;
    enabled?: boolean;
    owner?: string;
  }) {
    // Find flag row and open edit
    await this.page.locator(`tr:has-text("${flagKey}") [data-testid="flag-actions-button"]`).click();
    await this.page.click('text=編集');
    
    if (updates.description) {
      await this.page.fill('[data-testid="flag-description-input"]', updates.description);
    }
    
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        await this.page.check('[data-testid="flag-enabled-switch"]');
      } else {
        await this.page.uncheck('[data-testid="flag-enabled-switch"]');
      }
    }
    
    if (updates.owner) {
      await this.page.fill('[data-testid="flag-owner-input"]', updates.owner);
    }
    
    await this.page.click('[data-testid="create-flag-modal"] .ant-btn-primary');
    await expect(this.page.locator('text=フラグが更新されました')).toBeVisible();
  }

  async deleteFlag(flagKey: string) {
    await this.page.locator(`tr:has-text("${flagKey}") [data-testid="flag-actions-button"]`).click();
    await this.page.click('text=削除');
    
    await expect(this.page.locator('text=フラグの削除')).toBeVisible();
    await this.page.click('.ant-modal-confirm-btns .ant-btn-dangerous');
    await expect(this.page.locator('text=フラグが削除されました')).toBeVisible();
  }

  async toggleFlag(flagKey: string) {
    const toggle = this.page.locator(`tr:has-text("${flagKey}") [data-testid="flag-toggle-switch"]`);
    await toggle.click();
    await expect(this.page.locator('text=フラグが更新されました')).toBeVisible();
  }

  /**
   * Kill-Switch Management Helpers
   */
  async activateKillSwitch(data: {
    flagKey: string;
    environment: string;
    tenant?: string;
    reason: string;
  }) {
    await this.page.click('[data-testid="activate-killswitch-button"]');
    await expect(this.page.locator('[data-testid="killswitch-modal"]')).toBeVisible();
    
    await this.page.selectOption('[data-testid="killswitch-flag-select"]', data.flagKey);
    await this.page.selectOption('select[name="environment"]', data.environment);
    
    if (data.tenant) {
      await this.page.fill('[data-testid="killswitch-tenant-input"]', data.tenant);
    }
    
    await this.page.fill('[data-testid="killswitch-reason-input"]', data.reason);
    
    await this.page.click('[data-testid="killswitch-modal"] .ant-btn-danger');
    await expect(this.page.locator('text=Kill-Switchが有効化されました')).toBeVisible();
  }

  async deactivateKillSwitch(flagKey: string) {
    await this.page.locator(`tr:has-text("${flagKey}") [data-testid="deactivate-killswitch-button"]`).click();
    await this.page.click('text=無効化');
    await expect(this.page.locator('text=Kill-Switchが無効化されました')).toBeVisible();
  }

  /**
   * Search and Filter Helpers
   */
  async searchFlags(query: string, expectedCount?: number) {
    await this.page.fill('[data-testid="flag-search"]', query);
    await this.page.waitForTimeout(500); // Debounce
    
    if (expectedCount !== undefined) {
      await expect(this.page.locator('[data-testid="flag-table"] tbody tr')).toHaveCount(expectedCount);
    }
  }

  async filterFlagsByStatus(status: 'all' | 'enabled' | 'disabled') {
    const buttonText = status === 'all' ? 'すべて' : status === 'enabled' ? '有効のみ' : '無効のみ';
    await this.page.click(`button:has-text("${buttonText}")`);
    await this.page.waitForTimeout(500);
  }

  async sortTableBy(columnName: string, direction: 'asc' | 'desc' = 'asc') {
    const column = this.page.locator(`[data-testid="flag-table"] th:has-text("${columnName}")`);
    await column.click();
    
    if (direction === 'desc') {
      await column.click(); // Click again for descending
    }
    
    await this.page.waitForTimeout(500);
  }

  /**
   * Bulk Operations Helpers
   */
  async selectAllFlags() {
    await this.page.check('[data-testid="flag-table"] thead input[type="checkbox"]');
    await expect(this.page.locator('[data-testid="bulk-actions-panel"]')).toBeVisible();
  }

  async selectFlagsBy(selector: string, count: number = 3) {
    const checkboxes = await this.page.locator(selector).all();
    for (let i = 0; i < Math.min(count, checkboxes.length); i++) {
      await checkboxes[i].check();
    }
  }

  async bulkEnable() {
    await this.page.click('[data-testid="bulk-enable-button"]');
    await this.page.click('.ant-modal-confirm-btns .ant-btn-primary');
    await expect(this.page.locator('text=フラグが一括有効化されました')).toBeVisible();
  }

  async bulkDisable() {
    await this.page.click('[data-testid="bulk-disable-button"]');
    await this.page.click('.ant-modal-confirm-btns .ant-btn-primary');
    await expect(this.page.locator('text=フラグが一括無効化されました')).toBeVisible();
  }

  /**
   * Tenant Management Helpers
   */
  async createTenantOverride(data: {
    tenantId: string;
    flagKey: string;
    enabled: boolean;
    reason: string;
  }) {
    await this.page.selectOption('[data-testid="tenant-select"]', data.tenantId);
    await this.page.click('[data-testid="create-override-button"]');
    
    await this.page.selectOption('[data-testid="override-flag-select"]', data.flagKey);
    
    if (data.enabled) {
      await this.page.check('[data-testid="override-enabled-switch"]');
    }
    
    await this.page.fill('[data-testid="override-reason-input"]', data.reason);
    await this.page.click('[data-testid="override-modal"] .ant-btn-primary');
    
    await expect(this.page.locator('text=テナントオーバーライドが作成されました')).toBeVisible();
  }

  /**
   * Dashboard Helpers
   */
  async verifyDashboardMetrics(expectedMetrics: {
    totalFlags?: number;
    activeFlags?: number;
    killSwitches?: number;
    tenantOverrides?: number;
  }) {
    if (expectedMetrics.totalFlags !== undefined) {
      await expect(this.page.locator('text=総フラグ数').locator('..').locator('.ant-statistic-content-value'))
        .toHaveText(expectedMetrics.totalFlags.toString());
    }
    
    if (expectedMetrics.activeFlags !== undefined) {
      await expect(this.page.locator('text=有効フラグ').locator('..').locator('.ant-statistic-content-value'))
        .toHaveText(expectedMetrics.activeFlags.toString());
    }
    
    if (expectedMetrics.killSwitches !== undefined) {
      await expect(this.page.locator('text=Kill-Switch').locator('..').locator('.ant-statistic-content-value'))
        .toHaveText(expectedMetrics.killSwitches.toString());
    }
    
    if (expectedMetrics.tenantOverrides !== undefined) {
      await expect(this.page.locator('text=テナント設定').locator('..').locator('.ant-statistic-content-value'))
        .toHaveText(expectedMetrics.tenantOverrides.toString());
    }
  }

  /**
   * Error Handling Helpers
   */
  async simulateNetworkError(apiPattern: string) {
    await this.page.route(apiPattern, route => route.abort());
  }

  async restoreNetworkConnection(apiPattern: string) {
    await this.page.unroute(apiPattern);
  }

  async verifyErrorState(errorMessage: string) {
    await expect(this.page.locator(`text=${errorMessage}`)).toBeVisible();
    await expect(this.page.locator('[data-testid="retry-button"]')).toBeVisible();
  }

  async retryOperation() {
    await this.page.click('[data-testid="retry-button"]');
  }

  /**
   * Performance and Load Testing Helpers
   */
  async measurePageLoadTime(): Promise<number> {
    const startTime = Date.now();
    await this.page.waitForLoadState('networkidle');
    return Date.now() - startTime;
  }

  async measureApiResponseTime(apiPattern: string): Promise<number> {
    const startTime = Date.now();
    await this.page.waitForResponse(apiPattern);
    return Date.now() - startTime;
  }

  /**
   * Accessibility Helpers
   */
  async verifyKeyboardNavigation(startSelector: string, expectedFocusSelector: string, tabCount: number = 1) {
    await this.page.click(startSelector);
    
    for (let i = 0; i < tabCount; i++) {
      await this.page.keyboard.press('Tab');
    }
    
    const focusedElement = await this.page.locator(':focus');
    await expect(focusedElement).toMatchSelector(expectedFocusSelector);
  }

  async verifyAriaLabels(selectors: string[]) {
    for (const selector of selectors) {
      await expect(this.page.locator(selector)).toHaveAttribute('aria-label');
    }
  }

  /**
   * Mobile and Responsive Helpers
   */
  async setMobileViewport() {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }

  async setTabletViewport() {
    await this.page.setViewportSize({ width: 768, height: 1024 });
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1920, height: 1080 });
  }

  async verifyMobileLayout() {
    await expect(this.page.locator('.ant-layout-sider')).toHaveCSS('width', '0px');
    await expect(this.page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
  }

  /**
   * Data Validation Helpers
   */
  async verifyTableRowCount(expectedCount: number) {
    await expect(this.page.locator('[data-testid="flag-table"] tbody tr')).toHaveCount(expectedCount);
  }

  async verifyTableContains(text: string) {
    await expect(this.page.locator(`[data-testid="flag-table"]:has-text("${text}")`)).toBeVisible();
  }

  async verifyTableNotContains(text: string) {
    await expect(this.page.locator(`[data-testid="flag-table"]:has-text("${text}")`)).not.toBeVisible();
  }

  /**
   * Export/Import Helpers
   */
  async exportFlags(format: 'json' | 'csv') {
    await this.page.click('[data-testid="export-flags-button"]');
    await this.page.click(`[data-testid="export-format-${format}"]`);
    await this.page.click('[data-testid="export-modal"] .ant-btn-primary');
    await expect(this.page.locator('text=フラグ設定をエクスポートしています')).toBeVisible();
  }

  async importFlags(format: 'json' | 'csv', conflictResolution: 'overwrite' | 'skip' | 'error') {
    await this.page.click('[data-testid="import-flags-button"]');
    
    const conflictText = conflictResolution === 'overwrite' ? '上書きする' : 
                        conflictResolution === 'skip' ? 'スキップする' : 'エラーとする';
    await this.page.check(`text=${conflictText}`);
  }
}

/**
 * Test Data Factories
 */
export class TestDataFactory {
  static createFlagData(overrides: any = {}) {
    return {
      key: 'test_flag_' + Date.now(),
      description: 'Test flag description for E2E testing',
      enabled: true,
      owner: 'team-e2e',
      ...overrides
    };
  }

  static createKillSwitchData(overrides: any = {}) {
    return {
      flagKey: 'billing_v2_enable',
      environment: 'production',
      reason: 'E2E testing - simulated emergency situation requiring immediate flag shutdown',
      ...overrides
    };
  }

  static createTenantOverrideData(overrides: any = {}) {
    return {
      tenantId: 'tenant-e2e-test',
      flagKey: 'new_dashboard_enable',
      enabled: true,
      reason: 'E2E testing - tenant-specific override for testing purposes',
      ...overrides
    };
  }

  static createBulkFlags(count: number) {
    return Array.from({ length: count }, (_, i) => this.createFlagData({
      key: `bulk_test_flag_${i}`,
      description: `Bulk test flag ${i} for performance testing`,
      enabled: i % 2 === 0
    }));
  }
}

/**
 * Test Configuration Constants
 */
export const TestConfig = {
  API_BASE_URL: 'http://localhost:3001',
  DEFAULT_TIMEOUT: 10000,
  DEBOUNCE_DELAY: 500,
  NETWORK_TIMEOUT: 30000,
  MOBILE_VIEWPORT: { width: 375, height: 667 },
  TABLET_VIEWPORT: { width: 768, height: 1024 },
  DESKTOP_VIEWPORT: { width: 1920, height: 1080 }
} as const;