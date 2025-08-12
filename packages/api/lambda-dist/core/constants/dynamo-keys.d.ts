/**
 * DynamoDB Key Construction Constants
 *
 * マジックストリングを排除し、保守性と型安全性を向上
 */
export declare const DYNAMO_KEY_PREFIXES: {
    readonly FLAG: "FLAG#";
    readonly TENANT: "TENANT#";
    readonly EMERGENCY: "EMERGENCY#";
};
export declare const DYNAMO_KEY_SUFFIXES: {
    readonly METADATA: "#METADATA";
    readonly FLAG: "#FLAG#";
};
export declare const DYNAMO_SPECIAL_KEYS: {
    readonly GLOBAL: "GLOBAL";
};
/**
 * DynamoDB key construction utilities
 */
export declare class DynamoKeyBuilder {
    static flagMetadata(flagKey: string): string;
    static tenantFlag(tenantId: string, flagKey: string): string;
    static emergencyKey(flagKey?: string): string;
    static compositeKey(primaryKey: string, sortKey: string): string;
}
