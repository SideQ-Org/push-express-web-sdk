export interface PushExpressConfig {
    appId: string;
    vapidKey: string;
    externalId?: string;
    tags?: Record<string, string>;
    serviceWorkerPath?: string;
    baseURL?: string;
}
export interface PushExpressInstance {
    setExternalId(externalId: string): Promise<void>;
    setTags(tags: Record<string, string>): Promise<void>;
    notifyLifecycle(event: 'onscreen' | 'background' | 'closed'): Promise<void>;
    getIcId(): string | null;
    destroy(): void;
}
export declare function initPushExpress(config: PushExpressConfig): Promise<PushExpressInstance>;
