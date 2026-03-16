export declare class PushExpressStorage {
    getOrCreateIcToken(): string;
    getIcId(): string | null;
    setIcId(icId: string): void;
    getAppId(): string | null;
    setAppId(appId: string): void;
    getUpdateInterval(): number;
    setUpdateInterval(interval: number): void;
    /**
     * Сохраняет конфиг в IndexedDB для доступа из Service Worker.
     * SW не имеет доступа к localStorage, но может читать IndexedDB.
     */
    saveConfigForServiceWorker(appId: string, icId: string, baseURL: string): Promise<void>;
}
