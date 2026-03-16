const PREFIX = 'push_express_';

export class PushExpressStorage {
  getOrCreateIcToken(): string {
    let token = localStorage.getItem(`${PREFIX}ic_token`);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(`${PREFIX}ic_token`, token);
    }
    return token;
  }

  getIcId(): string | null {
    return localStorage.getItem(`${PREFIX}ic_id`);
  }

  setIcId(icId: string): void {
    localStorage.setItem(`${PREFIX}ic_id`, icId);
  }

  getAppId(): string | null {
    return localStorage.getItem(`${PREFIX}app_id`);
  }

  setAppId(appId: string): void {
    localStorage.setItem(`${PREFIX}app_id`, appId);
  }

  getUpdateInterval(): number {
    return parseInt(localStorage.getItem(`${PREFIX}update_interval`) || '120', 10);
  }

  setUpdateInterval(interval: number): void {
    localStorage.setItem(`${PREFIX}update_interval`, interval.toString());
  }

  /**
   * Сохраняет конфиг в IndexedDB для доступа из Service Worker.
   * SW не имеет доступа к localStorage, но может читать IndexedDB.
   */
  async saveConfigForServiceWorker(appId: string, icId: string, baseURL: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('push_express', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('config');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('config', 'readwrite');
        tx.objectStore('config').put({ appId, icId, baseURL }, 'sdk_config');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  }
}
