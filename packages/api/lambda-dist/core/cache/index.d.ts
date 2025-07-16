export interface TimeProvider {
    now(): number;
}
export declare class RealTimeProvider implements TimeProvider {
    now(): number;
}
export declare class MockTimeProvider implements TimeProvider {
    private currentTime;
    now(): number;
    setTime(time: number): void;
    advanceTime(milliseconds: number): void;
}
export declare class FeatureFlagCache {
    private cache;
    private defaultTtl;
    private timeProvider;
    constructor(options?: {
        ttl?: number;
        timeProvider?: TimeProvider;
    });
    get(tenantId: string, flagKey: string): boolean | undefined;
    set(tenantId: string, flagKey: string, value: boolean, ttl?: number): void;
    invalidate(tenantId: string, flagKey: string): void;
    invalidateAll(): void;
    isExpired(): boolean;
    size(): number;
    keys(): string[];
    private cleanup;
    private createKey;
}
