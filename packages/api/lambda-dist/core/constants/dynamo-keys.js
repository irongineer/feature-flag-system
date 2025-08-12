"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoKeyBuilder = exports.DYNAMO_SPECIAL_KEYS = exports.DYNAMO_KEY_SUFFIXES = exports.DYNAMO_KEY_PREFIXES = void 0;
/**
 * DynamoDB Key Construction Constants
 *
 * マジックストリングを排除し、保守性と型安全性を向上
 */
exports.DYNAMO_KEY_PREFIXES = {
    FLAG: 'FLAG#',
    TENANT: 'TENANT#',
    EMERGENCY: 'EMERGENCY#',
};
exports.DYNAMO_KEY_SUFFIXES = {
    METADATA: '#METADATA',
    FLAG: '#FLAG#',
};
exports.DYNAMO_SPECIAL_KEYS = {
    GLOBAL: 'GLOBAL',
};
/**
 * DynamoDB key construction utilities
 */
class DynamoKeyBuilder {
    static flagMetadata(flagKey) {
        return `${exports.DYNAMO_KEY_PREFIXES.FLAG}${flagKey}${exports.DYNAMO_KEY_SUFFIXES.METADATA}`;
    }
    static tenantFlag(tenantId, flagKey) {
        return `${exports.DYNAMO_KEY_PREFIXES.TENANT}${tenantId}${exports.DYNAMO_KEY_SUFFIXES.FLAG}${flagKey}`;
    }
    static emergencyKey(flagKey) {
        const suffix = flagKey ? `${exports.DYNAMO_KEY_PREFIXES.FLAG}${flagKey}` : exports.DYNAMO_SPECIAL_KEYS.GLOBAL;
        return `${exports.DYNAMO_KEY_PREFIXES.EMERGENCY}${suffix}`;
    }
    static compositeKey(primaryKey, sortKey) {
        return `${primaryKey}#${sortKey}`;
    }
}
exports.DynamoKeyBuilder = DynamoKeyBuilder;
//# sourceMappingURL=dynamo-keys.js.map