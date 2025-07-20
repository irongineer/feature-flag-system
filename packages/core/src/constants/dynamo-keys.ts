/**
 * DynamoDB Key Construction Constants
 * 
 * マジックストリングを排除し、保守性と型安全性を向上
 */
export const DYNAMO_KEY_PREFIXES = {
  FLAG: 'FLAG#',
  TENANT: 'TENANT#', 
  EMERGENCY: 'EMERGENCY#',
} as const;

export const DYNAMO_KEY_SUFFIXES = {
  METADATA: '#METADATA',
  FLAG: '#FLAG#',
} as const;

export const DYNAMO_SPECIAL_KEYS = {
  GLOBAL: 'GLOBAL',
} as const;

/**
 * DynamoDB key construction utilities
 */
export class DynamoKeyBuilder {
  static flagMetadata(flagKey: string): string {
    return `${DYNAMO_KEY_PREFIXES.FLAG}${flagKey}${DYNAMO_KEY_SUFFIXES.METADATA}`;
  }

  static tenantFlag(tenantId: string, flagKey: string): string {
    return `${DYNAMO_KEY_PREFIXES.TENANT}${tenantId}${DYNAMO_KEY_SUFFIXES.FLAG}${flagKey}`;
  }

  static emergencyKey(flagKey?: string): string {
    const suffix = flagKey ? `${DYNAMO_KEY_PREFIXES.FLAG}${flagKey}` : DYNAMO_SPECIAL_KEYS.GLOBAL;
    return `${DYNAMO_KEY_PREFIXES.EMERGENCY}${suffix}`;
  }

  static compositeKey(primaryKey: string, sortKey: string): string {
    return `${primaryKey}#${sortKey}`;
  }
}