import { test, expect } from '@playwright/test';
import axios from 'axios';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const ADMIN_UI_URL = 'http://localhost:3000';

// DynamoDB setup for test data management
const dynamoConfig = {
  endpoint: 'http://localhost:8000',
  region: 'ap-northeast-1',
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  }
};

const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLES = {
  FEATURE_FLAGS: 'FeatureFlags',
  TENANT_OVERRIDES: 'TenantOverrides',
  EMERGENCY_CONTROL: 'EmergencyControl'
} as const;

// API client for backend operations
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

test.describe('Live API Integration E2E Tests', () => {
  test.beforeAll(async () => {
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  test.beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestData();
  });

  test.afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  test.describe('Flag Management with Live API', () => {
    test('should create a flag through UI and verify via API', async ({ page }) => {
      await page.goto(`${ADMIN_UI_URL}/flags/list`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 });
      
      // Click create flag button
      await page.click('[data-testid="create-flag-button"]');
      
      // Wait for modal to appear
      await page.waitForSelector('[data-testid="create-flag-modal"]', { timeout: 10000 });
      
      // Fill in flag details
      const flagKey = 'e2e_live_test_flag';
      const description = 'E2E Live Test Flag';
      
      await page.fill('[data-testid="flag-key-input"]', flagKey);
      await page.fill('[data-testid="flag-description-input"]', description);
      
      // Submit form
      await page.click('.ant-modal-footer .ant-btn-primary');
      
      // Wait for success message
      await expect(page.locator('text=フラグが作成されました')).toBeVisible({ timeout: 10000 });
      
      // Verify flag was created via API
      const response = await apiClient.get(`/flags/${flagKey}`);
      expect(response.status).toBe(200);
      expect(response.data.flagKey).toBe(flagKey);
      expect(response.data.description).toBe(description);
    });

    test('should display flags from live API', async ({ page }) => {
      // Create test flags via API
      const testFlags = [
        { key: 'e2e_live_flag_1', description: 'E2E Live Flag 1', enabled: true },
        { key: 'e2e_live_flag_2', description: 'E2E Live Flag 2', enabled: false }
      ];
      
      for (const flag of testFlags) {
        await createTestFlag(flag.key, {
          description: flag.description,
          defaultEnabled: flag.enabled,
          owner: 'e2e-test@example.com'
        });
      }
      
      await page.goto(`${ADMIN_UI_URL}/flags/list`);
      
      // Wait for the table to load
      await page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 });
      
      // Verify flags are displayed
      for (const flag of testFlags) {
        await expect(page.locator(`text=${flag.key}`)).toBeVisible({ timeout: 10000 });
        await expect(page.locator(`text=${flag.description}`)).toBeVisible({ timeout: 10000 });
      }
    });

    test('should update flag status through UI and verify via API', async ({ page }) => {
      const flagKey = 'e2e_live_update_flag';
      
      // Create flag via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Update Test',
        defaultEnabled: false,
        owner: 'e2e-test@example.com'
      });
      
      await page.goto(`${ADMIN_UI_URL}/flags/list`);
      
      // Wait for table to load
      await page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 });
      
      // Find the flag row and click the enable toggle
      const flagRow = page.locator(`tr:has-text("${flagKey}")`);
      await expect(flagRow).toBeVisible({ timeout: 10000 });
      
      const toggleSwitch = flagRow.locator('[data-testid="flag-toggle"]');
      await toggleSwitch.click();
      
      // Wait for update to complete
      await page.waitForTimeout(2000);
      
      // Verify flag was updated via API
      const response = await apiClient.get(`/flags/${flagKey}`);
      expect(response.status).toBe(200);
      expect(response.data.defaultEnabled).toBe(true);
    });

    test('should filter flags in real-time', async ({ page }) => {
      // Create multiple test flags
      const testFlags = [
        'e2e_live_search_apple',
        'e2e_live_search_banana',
        'e2e_live_search_cherry'
      ];
      
      for (const flagKey of testFlags) {
        await createTestFlag(flagKey, {
          description: `E2E Live Search Test ${flagKey}`,
          defaultEnabled: true,
          owner: 'e2e-test@example.com'
        });
      }
      
      await page.goto(`${ADMIN_UI_URL}/flags/list`);
      
      // Wait for table to load
      await page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 });
      
      // Test search functionality
      const searchInput = page.locator('[data-testid="flag-search"]');
      await searchInput.fill('apple');
      
      // Wait for filtering to complete
      await page.waitForTimeout(1000);
      
      // Should show only apple flag
      await expect(page.locator('text=e2e_live_search_apple')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=e2e_live_search_banana')).not.toBeVisible();
      await expect(page.locator('text=e2e_live_search_cherry')).not.toBeVisible();
    });
  });

  test.describe('Tenant Management with Live API', () => {
    test('should create tenant override through UI and verify via API', async ({ page }) => {
      const flagKey = 'e2e_live_tenant_flag';
      const tenantId = 'e2e-live-tenant-123';
      
      // Create flag via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Tenant Test',
        defaultEnabled: false,
        owner: 'e2e-test@example.com'
      });
      
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      
      // Navigate to tenant overrides section
      await page.click('[data-testid="tenant-overrides-tab"]');
      
      // Add tenant override
      await page.click('[data-testid="add-tenant-override-button"]');
      
      // Fill tenant override form
      await page.fill('[data-testid="tenant-id-input"]', tenantId);
      await page.click('[data-testid="tenant-enable-toggle"]');
      
      // Submit form
      await page.click('[data-testid="save-tenant-override"]');
      
      // Wait for success message
      await expect(page.locator('text=テナントオーバーライドが設定されました')).toBeVisible({ timeout: 10000 });
      
      // Verify override was created via API
      const response = await apiClient.get(`/tenants/${tenantId}/flags/${flagKey}`);
      expect(response.status).toBe(200);
      expect(response.data.enabled).toBe(true);
    });

    test('should list tenant overrides from live API', async ({ page }) => {
      const flagKey = 'e2e_live_tenant_list_flag';
      const tenants = ['tenant-1', 'tenant-2', 'tenant-3'];
      
      // Create flag via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Tenant List Test',
        defaultEnabled: false,
        owner: 'e2e-test@example.com'
      });
      
      // Create tenant overrides via API
      for (const tenantId of tenants) {
        await createTestTenantOverride(tenantId, flagKey, true);
      }
      
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      
      // Navigate to tenant overrides section
      await page.click('[data-testid="tenant-overrides-tab"]');
      
      // Wait for tenant overrides to load
      await page.waitForSelector('[data-testid="tenant-overrides-table"]', { timeout: 10000 });
      
      // Verify all tenant overrides are displayed
      for (const tenantId of tenants) {
        await expect(page.locator(`text=${tenantId}`)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should remove tenant override through UI and verify via API', async ({ page }) => {
      const flagKey = 'e2e_live_tenant_remove_flag';
      const tenantId = 'e2e-live-tenant-remove';
      
      // Create flag and tenant override via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Tenant Remove Test',
        defaultEnabled: false,
        owner: 'e2e-test@example.com'
      });
      
      await createTestTenantOverride(tenantId, flagKey, true);
      
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      
      // Navigate to tenant overrides section
      await page.click('[data-testid="tenant-overrides-tab"]');
      
      // Wait for tenant overrides to load
      await page.waitForSelector('[data-testid="tenant-overrides-table"]', { timeout: 10000 });
      
      // Find and click remove button for the tenant
      const tenantRow = page.locator(`tr:has-text("${tenantId}")`);
      await tenantRow.locator('[data-testid="remove-tenant-override"]').click();
      
      // Confirm removal
      await page.click('[data-testid="confirm-remove-tenant-override"]');
      
      // Wait for success message
      await expect(page.locator('text=テナントオーバーライドが削除されました')).toBeVisible({ timeout: 10000 });
      
      // Verify override was removed via API
      try {
        await apiClient.get(`/tenants/${tenantId}/flags/${flagKey}`);
        expect(true).toBe(false); // Should not reach this line
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  test.describe('Kill-Switch Management with Live API', () => {
    test('should activate global kill-switch through UI and verify via API', async ({ page }) => {
      await page.goto(`${ADMIN_UI_URL}/emergency/kill-switch`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="kill-switch-panel"]', { timeout: 15000 });
      
      // Activate global kill-switch
      await page.click('[data-testid="activate-global-kill-switch"]');
      
      // Fill reason
      await page.fill('[data-testid="kill-switch-reason"]', 'E2E Live Test Global Emergency');
      
      // Confirm activation
      await page.click('[data-testid="confirm-kill-switch-activation"]');
      
      // Wait for success message
      await expect(page.locator('text=グローバルKill-Switchが有効化されました')).toBeVisible({ timeout: 10000 });
      
      // Verify kill-switch was activated via API
      const response = await apiClient.get('/emergency/status');
      expect(response.status).toBe(200);
      expect(response.data.globalKillSwitch).toBe(true);
    });

    test('should activate flag-specific kill-switch through UI and verify via API', async ({ page }) => {
      const flagKey = 'e2e_live_kill_switch_flag';
      
      // Create flag via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Kill-Switch Test',
        defaultEnabled: true,
        owner: 'e2e-test@example.com'
      });
      
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      
      // Navigate to emergency controls section
      await page.click('[data-testid="emergency-controls-tab"]');
      
      // Activate flag-specific kill-switch
      await page.click('[data-testid="activate-flag-kill-switch"]');
      
      // Fill reason
      await page.fill('[data-testid="kill-switch-reason"]', 'E2E Live Test Flag Emergency');
      
      // Confirm activation
      await page.click('[data-testid="confirm-flag-kill-switch-activation"]');
      
      // Wait for success message
      await expect(page.locator('text=フラグKill-Switchが有効化されました')).toBeVisible({ timeout: 10000 });
      
      // Verify kill-switch was activated via API
      const response = await apiClient.get(`/emergency/status?flagKey=${flagKey}`);
      expect(response.status).toBe(200);
      expect(response.data.flagKillSwitch).toBe(true);
    });

    test('should deactivate kill-switch through UI and verify via API', async ({ page }) => {
      const flagKey = 'e2e_live_deactivate_kill_switch_flag';
      
      // Create flag and activate kill-switch via API
      await createTestFlag(flagKey, {
        description: 'E2E Live Deactivate Kill-Switch Test',
        defaultEnabled: true,
        owner: 'e2e-test@example.com'
      });
      
      await createTestKillSwitch(flagKey, 'Test emergency');
      
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      
      // Wait for page to load
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      
      // Navigate to emergency controls section
      await page.click('[data-testid="emergency-controls-tab"]');
      
      // Deactivate flag-specific kill-switch
      await page.click('[data-testid="deactivate-flag-kill-switch"]');
      
      // Confirm deactivation
      await page.click('[data-testid="confirm-flag-kill-switch-deactivation"]');
      
      // Wait for success message
      await expect(page.locator('text=フラグKill-Switchが無効化されました')).toBeVisible({ timeout: 10000 });
      
      // Verify kill-switch was deactivated via API
      const response = await apiClient.get(`/emergency/status?flagKey=${flagKey}`);
      expect(response.status).toBe(200);
      expect(response.data.flagKillSwitch).toBe(false);
    });
  });

  test.describe('Dashboard Integration with Live API', () => {
    test('should display real-time metrics from live API', async ({ page }) => {
      // Create test data via API
      const testFlags = [
        { key: 'e2e_live_dashboard_flag_1', enabled: true },
        { key: 'e2e_live_dashboard_flag_2', enabled: false },
        { key: 'e2e_live_dashboard_flag_3', enabled: true }
      ];
      
      for (const flag of testFlags) {
        await createTestFlag(flag.key, {
          description: `E2E Live Dashboard Test ${flag.key}`,
          defaultEnabled: flag.enabled,
          owner: 'e2e-test@example.com'
        });
      }
      
      // Create tenant overrides
      await createTestTenantOverride('tenant-1', 'e2e_live_dashboard_flag_1', true);
      await createTestTenantOverride('tenant-2', 'e2e_live_dashboard_flag_2', false);
      
      await page.goto(`${ADMIN_UI_URL}/`);
      
      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="dashboard-metrics"]', { timeout: 15000 });
      
      // Verify total flags metric
      const totalFlags = await page.locator('[data-testid="total-flags-metric"]').textContent();
      expect(parseInt(totalFlags || '0')).toBeGreaterThanOrEqual(3);
      
      // Verify active flags metric
      const activeFlags = await page.locator('[data-testid="active-flags-metric"]').textContent();
      expect(parseInt(activeFlags || '0')).toBeGreaterThanOrEqual(2);
      
      // Verify tenant overrides metric
      const tenantOverrides = await page.locator('[data-testid="tenant-overrides-metric"]').textContent();
      expect(parseInt(tenantOverrides || '0')).toBeGreaterThanOrEqual(2);
    });

    test('should display recent activities from live API', async ({ page }) => {
      const flagKey = 'e2e_live_dashboard_activity_flag';
      
      // Create flag via API (this will generate an activity)
      await createTestFlag(flagKey, {
        description: 'E2E Live Dashboard Activity Test',
        defaultEnabled: true,
        owner: 'e2e-test@example.com'
      });
      
      await page.goto(`${ADMIN_UI_URL}/`);
      
      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="recent-activities"]', { timeout: 15000 });
      
      // Verify activity is displayed
      await expect(page.locator('text=フラグ作成')).toBeVisible({ timeout: 10000 });
      await expect(page.locator(`text=${flagKey}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('End-to-End Workflow Testing', () => {
    test('should complete full flag lifecycle through UI with live API', async ({ page }) => {
      const flagKey = 'e2e_live_full_lifecycle_flag';
      const tenantId = 'e2e-live-tenant-lifecycle';
      
      // 1. Create flag
      await page.goto(`${ADMIN_UI_URL}/flags/list`);
      await page.waitForSelector('[data-testid="flag-table"]', { timeout: 15000 });
      await page.click('[data-testid="create-flag-button"]');
      await page.waitForSelector('[data-testid="create-flag-modal"]', { timeout: 10000 });
      
      await page.fill('[data-testid="flag-key-input"]', flagKey);
      await page.fill('[data-testid="flag-description-input"]', 'E2E Live Full Lifecycle Test');
      await page.click('.ant-modal-footer .ant-btn-primary');
      
      await expect(page.locator('text=フラグが作成されました')).toBeVisible({ timeout: 10000 });
      
      // 2. Add tenant override
      await page.goto(`${ADMIN_UI_URL}/flags/detail/${flagKey}`);
      await page.waitForSelector('[data-testid="flag-detail"]', { timeout: 15000 });
      await page.click('[data-testid="tenant-overrides-tab"]');
      await page.click('[data-testid="add-tenant-override-button"]');
      
      await page.fill('[data-testid="tenant-id-input"]', tenantId);
      await page.click('[data-testid="tenant-enable-toggle"]');
      await page.click('[data-testid="save-tenant-override"]');
      
      await expect(page.locator('text=テナントオーバーライドが設定されました')).toBeVisible({ timeout: 10000 });
      
      // 3. Test flag evaluation via API
      const evalResponse = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      expect(evalResponse.status).toBe(200);
      expect(evalResponse.data.enabled).toBe(true);
      
      // 4. Activate kill-switch
      await page.click('[data-testid="emergency-controls-tab"]');
      await page.click('[data-testid="activate-flag-kill-switch"]');
      await page.fill('[data-testid="kill-switch-reason"]', 'E2E Test Emergency');
      await page.click('[data-testid="confirm-flag-kill-switch-activation"]');
      
      await expect(page.locator('text=フラグKill-Switchが有効化されました')).toBeVisible({ timeout: 10000 });
      
      // 5. Verify kill-switch blocks evaluation
      const evalResponse2 = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      expect(evalResponse2.status).toBe(200);
      expect(evalResponse2.data.enabled).toBe(false); // Kill-switch should disable
      
      // 6. Deactivate kill-switch
      await page.click('[data-testid="deactivate-flag-kill-switch"]');
      await page.click('[data-testid="confirm-flag-kill-switch-deactivation"]');
      
      await expect(page.locator('text=フラグKill-Switchが無効化されました')).toBeVisible({ timeout: 10000 });
      
      // 7. Verify flag works again
      const evalResponse3 = await apiClient.post('/evaluate', {
        tenantId,
        flagKey
      });
      expect(evalResponse3.status).toBe(200);
      expect(evalResponse3.data.enabled).toBe(true);
    });
  });

  // Helper functions for test data management
  async function createTestFlag(flagKey: string, options: {
    description: string;
    defaultEnabled: boolean;
    owner: string;
    expiresAt?: string;
  }) {
    await docClient.send(new PutCommand({
      TableName: TABLES.FEATURE_FLAGS,
      Item: {
        PK: `FLAG#${flagKey}`,
        SK: 'METADATA',
        flagKey,
        description: options.description,
        defaultEnabled: options.defaultEnabled,
        owner: options.owner,
        createdAt: new Date().toISOString(),
        ...(options.expiresAt && { 
          expiresAt: options.expiresAt,
          GSI1PK: 'EXPIRES',
          GSI1SK: options.expiresAt
        })
      }
    }));
  }

  async function createTestTenantOverride(tenantId: string, flagKey: string, enabled: boolean) {
    await docClient.send(new PutCommand({
      TableName: TABLES.TENANT_OVERRIDES,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `FLAG#${flagKey}`,
        enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: 'e2e-test@example.com',
        GSI1PK: `FLAG#${flagKey}`,
        GSI1SK: `TENANT#${tenantId}`
      }
    }));
  }

  async function createTestKillSwitch(flagKey: string, reason: string) {
    await docClient.send(new PutCommand({
      TableName: TABLES.EMERGENCY_CONTROL,
      Item: {
        PK: 'EMERGENCY',
        SK: `FLAG#${flagKey}`,
        enabled: true,
        reason,
        activatedAt: new Date().toISOString(),
        activatedBy: 'e2e-test@example.com'
      }
    }));
  }

  async function cleanupTestData() {
    const testPatterns = [
      'e2e_live_test_',
      'e2e_live_flag_',
      'e2e_live_search_',
      'e2e_live_tenant_',
      'e2e_live_kill_switch_',
      'e2e_live_dashboard_',
      'e2e_live_full_lifecycle_'
    ];

    try {
      // Clean up all test data patterns
      for (const pattern of testPatterns) {
        // Clean up flags
        await docClient.send(new DeleteCommand({
          TableName: TABLES.FEATURE_FLAGS,
          Key: { PK: `FLAG#${pattern}`, SK: 'METADATA' }
        })).catch(() => {}); // Ignore errors for non-existent items

        // Clean up tenant overrides
        await docClient.send(new DeleteCommand({
          TableName: TABLES.TENANT_OVERRIDES,
          Key: { PK: `TENANT#${pattern}`, SK: `FLAG#${pattern}` }
        })).catch(() => {}); // Ignore errors for non-existent items

        // Clean up kill switches
        await docClient.send(new DeleteCommand({
          TableName: TABLES.EMERGENCY_CONTROL,
          Key: { PK: 'EMERGENCY', SK: `FLAG#${pattern}` }
        })).catch(() => {}); // Ignore errors for non-existent items
      }

      // Clean up global kill switch
      await docClient.send(new DeleteCommand({
        TableName: TABLES.EMERGENCY_CONTROL,
        Key: { PK: 'EMERGENCY', SK: 'GLOBAL' }
      })).catch(() => {}); // Ignore errors for non-existent items

    } catch (error) {
      console.warn('Test cleanup failed:', error);
    }
  }
});