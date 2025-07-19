import { featureFlagClient } from '../../feature-flag-integration/client/feature-flag-client';
import { TEST_TENANTS, TEST_USERS } from '../../packages/attendance-core/src/test-data';
import { FeatureFlagContext } from '../../packages/attendance-core/src/types';

describe('Feature Flag Integration Tests', () => {
  // テスト用のコンテキスト
  const enterpriseContext: FeatureFlagContext = {
    tenantId: 'enterprise-corp',
    userId: 'user-enterprise-employee',
    userRole: 'employee',
    plan: 'enterprise',
    environment: 'development'
  };

  const startupContext: FeatureFlagContext = {
    tenantId: 'startup-inc',
    userId: 'user-startup-employee',
    userRole: 'employee',
    plan: 'standard',
    environment: 'development'
  };

  const basicContext: FeatureFlagContext = {
    tenantId: 'small-business',
    userId: 'user-small-employee',
    userRole: 'employee',
    plan: 'basic',
    environment: 'development'
  };

  describe('Plan-based Feature Flags', () => {
    it('should enable advanced features for enterprise plan', async () => {
      const advancedAnalytics = await featureFlagClient.isEnabled('advanced_analytics', enterpriseContext);
      const gpsTracking = await featureFlagClient.isEnabled('gps_location_tracking', enterpriseContext);
      const biometricAuth = await featureFlagClient.isEnabled('biometric_authentication', enterpriseContext);
      
      expect(advancedAnalytics).toBe(true);
      expect(gpsTracking).toBe(true);
      expect(biometricAuth).toBe(true);
    });

    it('should disable advanced features for basic plan', async () => {
      const advancedAnalytics = await featureFlagClient.isEnabled('advanced_analytics', basicContext);
      const gpsTracking = await featureFlagClient.isEnabled('gps_location_tracking', basicContext);
      const biometricAuth = await featureFlagClient.isEnabled('biometric_authentication', basicContext);
      
      expect(advancedAnalytics).toBe(false);
      expect(gpsTracking).toBe(false);
      expect(biometricAuth).toBe(false);
    });

    it('should enable some features for standard plan', async () => {
      const slackIntegration = await featureFlagClient.isEnabled('slack_integration', startupContext);
      const customReports = await featureFlagClient.isEnabled('custom_reports', startupContext);
      const advancedAnalytics = await featureFlagClient.isEnabled('advanced_analytics', startupContext);
      
      expect(slackIntegration).toBe(true);
      expect(customReports).toBe(true);
      expect(advancedAnalytics).toBe(false); // Enterprise only
    });
  });

  describe('A/B Testing Scenarios', () => {
    it('should show different dashboard versions', async () => {
      const enterpriseDashboard = await featureFlagClient.isEnabled('new_dashboard_v2', enterpriseContext);
      const startupDashboard = await featureFlagClient.isEnabled('new_dashboard_v2', startupContext);
      
      expect(enterpriseDashboard).toBe(true);
      expect(startupDashboard).toBe(false); // A/B test: startup uses old version
    });

    it('should test overtime calculation versions', async () => {
      const enterpriseOvertimeV2 = await featureFlagClient.isEnabled('overtime_calculation_v2', enterpriseContext);
      const startupOvertimeV2 = await featureFlagClient.isEnabled('overtime_calculation_v2', startupContext);
      
      expect(enterpriseOvertimeV2).toBe(true);
      expect(startupOvertimeV2).toBe(false); // Using v1 for testing
    });
  });

  describe('Progressive Rollout Simulation', () => {
    it('should enable mobile app for all plans', async () => {
      const enterpriseMobile = await featureFlagClient.isEnabled('mobile_app_enabled', enterpriseContext);
      const startupMobile = await featureFlagClient.isEnabled('mobile_app_enabled', startupContext);
      const basicMobile = await featureFlagClient.isEnabled('mobile_app_enabled', basicContext);
      
      expect(enterpriseMobile).toBe(true);
      expect(startupMobile).toBe(true);
      expect(basicMobile).toBe(true);
    });

    it('should gradually enable dark mode theme', async () => {
      const enterpriseDarkMode = await featureFlagClient.isEnabled('dark_mode_theme', enterpriseContext);
      const startupDarkMode = await featureFlagClient.isEnabled('dark_mode_theme', startupContext);
      const basicDarkMode = await featureFlagClient.isEnabled('dark_mode_theme', basicContext);
      
      expect(enterpriseDarkMode).toBe(true);
      expect(startupDarkMode).toBe(false);
      expect(basicDarkMode).toBe(false);
    });
  });

  describe('Emergency Features', () => {
    it('should have maintenance mode disabled by default', async () => {
      const enterpriseMaintenance = await featureFlagClient.isEnabled('maintenance_mode', enterpriseContext);
      const startupMaintenance = await featureFlagClient.isEnabled('maintenance_mode', startupContext);
      const basicMaintenance = await featureFlagClient.isEnabled('maintenance_mode', basicContext);
      
      expect(enterpriseMaintenance).toBe(false);
      expect(startupMaintenance).toBe(false);
      expect(basicMaintenance).toBe(false);
    });

    it('should have emergency override disabled by default', async () => {
      const enterpriseEmergency = await featureFlagClient.isEnabled('emergency_override', enterpriseContext);
      const startupEmergency = await featureFlagClient.isEnabled('emergency_override', startupContext);
      const basicEmergency = await featureFlagClient.isEnabled('emergency_override', basicContext);
      
      expect(enterpriseEmergency).toBe(false);
      expect(startupEmergency).toBe(false);
      expect(basicEmergency).toBe(false);
    });
  });

  describe('User Role Based Features', () => {
    it('should handle admin user context', async () => {
      const adminContext: FeatureFlagContext = {
        tenantId: 'enterprise-corp',
        userId: 'user-enterprise-admin',
        userRole: 'admin',
        plan: 'enterprise',
        environment: 'development'
      };

      const advancedAnalytics = await featureFlagClient.isEnabled('advanced_analytics', adminContext);
      const realTimeMonitoring = await featureFlagClient.isEnabled('real_time_monitoring', adminContext);
      
      expect(advancedAnalytics).toBe(true);
      expect(realTimeMonitoring).toBe(true);
    });

    it('should handle manager user context', async () => {
      const managerContext: FeatureFlagContext = {
        tenantId: 'startup-inc',
        userId: 'user-startup-manager',
        userRole: 'manager',
        plan: 'standard',
        environment: 'development'
      };

      const advancedLeaveManagement = await featureFlagClient.isEnabled('advanced_leave_management', managerContext);
      const customReports = await featureFlagClient.isEnabled('custom_reports', managerContext);
      
      expect(advancedLeaveManagement).toBe(true);
      expect(customReports).toBe(true);
    });
  });

  describe('Integration Features', () => {
    it('should enable integrations based on plan', async () => {
      // Enterprise: All integrations
      const enterpriseSlack = await featureFlagClient.isEnabled('slack_integration', enterpriseContext);
      const enterpriseTeams = await featureFlagClient.isEnabled('teams_integration', enterpriseContext);
      const enterpriseWebhook = await featureFlagClient.isEnabled('webhook_notifications', enterpriseContext);
      
      expect(enterpriseSlack).toBe(true);
      expect(enterpriseTeams).toBe(true);
      expect(enterpriseWebhook).toBe(true);

      // Basic: No integrations
      const basicSlack = await featureFlagClient.isEnabled('slack_integration', basicContext);
      const basicTeams = await featureFlagClient.isEnabled('teams_integration', basicContext);
      const basicWebhook = await featureFlagClient.isEnabled('webhook_notifications', basicContext);
      
      expect(basicSlack).toBe(false);
      expect(basicTeams).toBe(false);
      expect(basicWebhook).toBe(false);
    });
  });

  describe('Error Handling and Failsafe', () => {
    it('should handle invalid flag keys gracefully', async () => {
      const invalidFlag = await featureFlagClient.isEnabled('invalid_flag_key', enterpriseContext);
      expect(invalidFlag).toBe(false); // Default failsafe
    });

    it('should handle network errors gracefully', async () => {
      // テスト用に無効なベースURLを設定
      const testClient = new (featureFlagClient.constructor as any)('http://invalid-url:9999');
      
      const result = await testClient.isEnabled('advanced_analytics', enterpriseContext);
      expect(result).toBe(true); // フェイルセーフ: プランベースのデフォルト値
    });
  });

  describe('Caching Behavior', () => {
    it('should cache feature flag evaluations', async () => {
      const startTime = Date.now();
      
      // 初回評価
      const result1 = await featureFlagClient.isEnabled('advanced_analytics', enterpriseContext);
      const firstCallTime = Date.now() - startTime;
      
      // 2回目評価（キャッシュから取得）
      const cacheStartTime = Date.now();
      const result2 = await featureFlagClient.isEnabled('advanced_analytics', enterpriseContext);
      const secondCallTime = Date.now() - cacheStartTime;
      
      expect(result1).toBe(result2);
      expect(secondCallTime).toBeLessThan(firstCallTime); // キャッシュの方が高速
    });

    it('should clear cache correctly', async () => {
      // キャッシュをクリア
      featureFlagClient.clearCache();
      
      // 評価を実行
      const result = await featureFlagClient.isEnabled('advanced_analytics', enterpriseContext);
      expect(result).toBe(true);
    });
  });

  describe('Batch Flag Evaluation', () => {
    it('should evaluate multiple flags at once', async () => {
      const allFlags = await featureFlagClient.getAllFlags(enterpriseContext);
      
      expect(allFlags).toHaveProperty('advanced_analytics', true);
      expect(allFlags).toHaveProperty('gps_location_tracking', true);
      expect(allFlags).toHaveProperty('maintenance_mode', false);
      expect(Object.keys(allFlags).length).toBeGreaterThan(10);
    });

    it('should handle batch evaluation for different plans', async () => {
      const enterpriseFlags = await featureFlagClient.getAllFlags(enterpriseContext);
      const basicFlags = await featureFlagClient.getAllFlags(basicContext);
      
      const enterpriseEnabledCount = Object.values(enterpriseFlags).filter(Boolean).length;
      const basicEnabledCount = Object.values(basicFlags).filter(Boolean).length;
      
      expect(enterpriseEnabledCount).toBeGreaterThan(basicEnabledCount);
    });
  });
});