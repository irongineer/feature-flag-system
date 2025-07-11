import AWS from 'aws-sdk';
import { DynamoDbClient } from '@feature-flag/core';
import { getConfig } from './config';

export class ApiClient {
  private dynamoClient: DynamoDbClient;
  private config: any;

  constructor() {
    this.config = getConfig();
    this.dynamoClient = new DynamoDbClient({
      region: this.config.region,
      tableName: this.config.tableName,
      endpoint: this.config.endpoint,
    });
  }

  async createFlag(flagData: any) {
    return this.dynamoClient.createFlag(flagData);
  }

  async listFlags() {
    return this.dynamoClient.listFlags();
  }

  async updateFlag(flagKey: string, updates: any) {
    return this.dynamoClient.updateFlag(flagKey, updates);
  }

  async listTenantOverrides(tenantId: string) {
    return this.dynamoClient.listTenantOverrides(tenantId);
  }

  async setTenantOverride(tenantId: string, flagKey: string, enabled: boolean, updatedBy: string) {
    return this.dynamoClient.setTenantOverride(tenantId, flagKey, enabled, updatedBy);
  }

  async activateKillSwitch(flagKey: string | null, reason: string, activatedBy: string) {
    return this.dynamoClient.setKillSwitch(flagKey, true, reason, activatedBy);
  }

  async deactivateKillSwitch(flagKey: string | null, deactivatedBy: string) {
    return this.dynamoClient.setKillSwitch(flagKey, false, `Deactivated by ${deactivatedBy}`, deactivatedBy);
  }

  async evaluateFlag(tenantId: string, flagKey: string, userId?: string, environment?: string) {
    // 実際のAPI呼び出しの代わりにDynamoClientを直接使用
    const flag = await this.dynamoClient.getFlag(flagKey);
    const tenantOverride = await this.dynamoClient.getTenantOverride(tenantId, flagKey);
    const killSwitch = await this.dynamoClient.getKillSwitch(flagKey);
    
    if (killSwitch && killSwitch.enabled) {
      return { enabled: false, reason: 'Kill-switch active' };
    }
    
    if (tenantOverride) {
      return { enabled: tenantOverride.enabled, reason: 'Tenant override' };
    }
    
    return { enabled: flag?.defaultEnabled || false, reason: 'Default value' };
  }
}

let apiClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClient) {
    apiClient = new ApiClient();
  }
  return apiClient;
}