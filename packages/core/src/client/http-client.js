"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagHttpClient = void 0;
class FeatureFlagHttpClient {
    options;
    defaultValues = new Map();
    constructor(options) {
        this.options = {
            timeout: 5000,
            retries: 2,
            ...options,
        };
    }
    async isEnabled(flagKey, context) {
        try {
            // コンテキスト検証
            if (!context.tenantId) {
                console.warn('tenantId is required in FeatureFlagContext');
                return this.getDefaultValue(flagKey);
            }
            // APIリクエスト構築（オプショナルフィールドは条件付きで追加）
            const requestPayload = {
                tenantId: context.tenantId,
                flagKey,
                environment: context.environment || 'production'
            };
            // オプショナルフィールドをundefinedの場合は送信しない
            if (context.userId)
                requestPayload.userId = context.userId;
            if (context.userRole)
                requestPayload.userRole = context.userRole;
            if (context.plan)
                requestPayload.plan = context.plan;
            if (context.metadata)
                requestPayload.metadata = context.metadata;
            const response = await this.sendRequest('/evaluate', requestPayload);
            return response.enabled;
        }
        catch (error) {
            console.error(`Feature flag evaluation failed for ${flagKey}:`, error);
            return this.getDefaultValue(flagKey);
        }
    }
    async getAllFlags(context) {
        try {
            if (!context.tenantId) {
                console.warn('tenantId is required in FeatureFlagContext');
                return {};
            }
            const requestPayload = {
                tenantId: context.tenantId,
                environment: context.environment || 'production'
            };
            // オプショナルフィールドを条件付きで追加
            if (context.userId)
                requestPayload.userId = context.userId;
            if (context.userRole)
                requestPayload.userRole = context.userRole;
            if (context.plan)
                requestPayload.plan = context.plan;
            if (context.metadata)
                requestPayload.metadata = context.metadata;
            const response = await this.sendRequest('/evaluate-all', requestPayload);
            return response.flags || {};
        }
        catch (error) {
            console.error('Bulk flag evaluation failed:', error);
            return {};
        }
    }
    async sendRequest(endpoint, payload) {
        const url = `${this.options.apiUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.options.apiKey}`,
            'User-Agent': 'FeatureFlagClient/1.0.0'
        };
        let lastError = null;
        for (let attempt = 0; attempt <= this.options.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            }
            catch (error) {
                lastError = error;
                if (attempt < this.options.retries) {
                    // 指数バックオフでリトライ
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }
    getDefaultValue(flagKey) {
        // 安全なデフォルト値を返す（通常は false）
        return this.defaultValues.get(flagKey) || false;
    }
    setDefaultValue(flagKey, defaultValue) {
        this.defaultValues.set(flagKey, defaultValue);
    }
}
exports.FeatureFlagHttpClient = FeatureFlagHttpClient;
//# sourceMappingURL=http-client.js.map