import { FeatureFlagKey } from '../models';
export declare class FeatureFlagCache {
  private cache;
  private defaultTtl;
  constructor(options?: { ttl?: number });
  get(tenantId: string, flagKey: FeatureFlagKey): boolean | undefined;
  set(tenantId: string, flagKey: FeatureFlagKey, value: boolean, ttl?: number): void;
  invalidate(tenantId: string, flagKey: FeatureFlagKey): void;
  invalidateAll(): void;
  isExpired(): boolean;
  size(): number;
  private createKey;
}
//# sourceMappingURL=index.d.ts.map
