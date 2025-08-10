import { FeatureFlagContext, FeatureFlagKey } from '../models';
export interface FeatureFlagHttpClientOptions {
    apiUrl: string;
    apiKey: string;
    timeout?: number;
    retries?: number;
}
export interface EvaluationRequest {
    tenantId: string;
    flagKey: string;
    userId?: string;
    userRole?: string;
    plan?: string;
    environment?: string;
    metadata?: Record<string, any>;
}
export interface EvaluationResponse {
    enabled: boolean;
    flagKey: string;
    reason: string;
    cached?: boolean;
}
export declare class FeatureFlagHttpClient {
    private options;
    private defaultValues;
    constructor(options: FeatureFlagHttpClientOptions);
    isEnabled(flagKey: FeatureFlagKey, context: FeatureFlagContext): Promise<boolean>;
    getAllFlags(context: FeatureFlagContext): Promise<Record<string, boolean>>;
    private sendRequest;
    private getDefaultValue;
    setDefaultValue(flagKey: string, defaultValue: boolean): void;
}
//# sourceMappingURL=http-client.d.ts.map