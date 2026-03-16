class PushExpressApiClient {
    constructor(baseURL) {
        // Убираем trailing slash для предотвращения двойного слэша в URL
        this.normalizedBaseURL = baseURL.replace(/\/+$/, '');
    }
    async createInstance(appId, request) {
        return this.post(`apps/${appId}/instances`, request);
    }
    async updateInfo(appId, icId, request) {
        return this.put(`apps/${appId}/instances/${icId}/info`, request);
    }
    async notificationEvent(appId, icId, msgId, event) {
        await this.postVoid(`apps/${appId}/instances/${icId}/events/notification`, { msg_id: msgId, event });
    }
    async lifecycleEvent(appId, icId, event) {
        await this.postVoid(`apps/${appId}/instances/${icId}/events/lifecycle`, { event });
    }
    async post(path, body) {
        const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    /** POST без парсинга тела ответа — для void endpoints (notification, lifecycle). */
    async postVoid(path, body) {
        const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
        }
    }
    async put(path, body) {
        const response = await fetch(`${this.normalizedBaseURL}/${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`PushExpress API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}

const PREFIX = 'push_express_';
class PushExpressStorage {
    getOrCreateIcToken() {
        let token = localStorage.getItem(`${PREFIX}ic_token`);
        if (!token) {
            token = crypto.randomUUID();
            localStorage.setItem(`${PREFIX}ic_token`, token);
        }
        return token;
    }
    getIcId() {
        return localStorage.getItem(`${PREFIX}ic_id`);
    }
    setIcId(icId) {
        localStorage.setItem(`${PREFIX}ic_id`, icId);
    }
    getAppId() {
        return localStorage.getItem(`${PREFIX}app_id`);
    }
    setAppId(appId) {
        localStorage.setItem(`${PREFIX}app_id`, appId);
    }
    getUpdateInterval() {
        return parseInt(localStorage.getItem(`${PREFIX}update_interval`) || '120', 10);
    }
    setUpdateInterval(interval) {
        localStorage.setItem(`${PREFIX}update_interval`, interval.toString());
    }
    /**
     * Сохраняет конфиг в IndexedDB для доступа из Service Worker.
     * SW не имеет доступа к localStorage, но может читать IndexedDB.
     */
    async saveConfigForServiceWorker(appId, icId, baseURL) {
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

/** Минимальный интервал периодического обновления (30 секунд). */
const MIN_UPDATE_INTERVAL_SEC = 30;
async function initPushExpress(config) {
    const baseURL = config.baseURL || 'https://core.push.express/api/r/v2';
    const swPath = config.serviceWorkerPath || '/push-express-sw.js';
    const storage = new PushExpressStorage();
    const apiClient = new PushExpressApiClient(baseURL);
    let currentExternalId = config.externalId;
    let currentTags = config.tags;
    let updateIntervalId = null;
    // 1. Генерируем или восстанавливаем ic_token
    const icToken = storage.getOrCreateIcToken();
    // 2. Регистрируем инстанс (если ещё нет ic_id)
    let icId = storage.getIcId();
    if (!icId) {
        const response = await apiClient.createInstance(config.appId, {
            ic_token: icToken,
            ext_id: currentExternalId,
        });
        icId = response.id;
        storage.setIcId(icId);
    }
    // 3. Сохраняем appId для Service Worker
    storage.setAppId(config.appId);
    // 4. Запрашиваем разрешение на уведомления
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    if ('Notification' in window && Notification.permission !== 'granted') {
        console.warn('[PushExpress] Notification permission not granted, push will not work');
    }
    // 5. Регистрируем Service Worker
    const registration = await navigator.serviceWorker.register(swPath);
    await navigator.serviceWorker.ready;
    // 6. Подписываемся на Web Push
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidKey).buffer,
    });
    // Хелпер для сборки UpdateInfoRequest (используется в нескольких местах)
    function buildUpdateInfoRequest(overrides) {
        return {
            transport_type: 'webpush',
            transport_token: JSON.stringify(subscription.toJSON()),
            platform_type: 'browser',
            platform_name: navigator.userAgent.substring(0, 200),
            ext_id: overrides?.ext_id !== undefined ? overrides.ext_id : currentExternalId,
            lang: navigator.language.split('-')[0],
            country: '',
            tz_sec: -new Date().getTimezoneOffset() * 60,
            tags: overrides?.tags !== undefined ? overrides.tags : currentTags,
            onscreen_count: 0,
            onscreen_sec: 0,
            agent_name: '@pushexpress/web-sdk@1.0.0',
        };
    }
    // 7. Обновляем device info
    const updateResponse = await apiClient.updateInfo(config.appId, icId, buildUpdateInfoRequest());
    storage.setUpdateInterval(updateResponse.update_interval_sec);
    // 8. Сохраняем конфиг в IndexedDB для Service Worker (он не имеет доступа к localStorage)
    await storage.saveConfigForServiceWorker(config.appId, icId, baseURL);
    // 9. Запускаем периодическое обновление (с минимальным порогом)
    const intervalSec = Math.max(updateResponse.update_interval_sec, MIN_UPDATE_INTERVAL_SEC);
    const updateIntervalMs = intervalSec * 1000;
    updateIntervalId = setInterval(async () => {
        try {
            await apiClient.updateInfo(config.appId, icId, buildUpdateInfoRequest());
        }
        catch (e) {
            console.warn('[PushExpress] periodic update failed:', e);
        }
    }, updateIntervalMs);
    // 10. Слушаем сообщения от Service Worker (fallback: если SW не смог отправить напрямую)
    const messageHandler = async (event) => {
        const { type, msg_id } = event.data || {};
        if (!msg_id || !icId)
            return;
        if (type === 'push_express_delivered') {
            try {
                await apiClient.notificationEvent(config.appId, icId, msg_id, 'delivered');
            }
            catch (e) {
                console.warn('[PushExpress] delivered event failed:', e);
            }
        }
        else if (type === 'push_express_clicked') {
            try {
                await apiClient.notificationEvent(config.appId, icId, msg_id, 'clicked');
            }
            catch (e) {
                console.warn('[PushExpress] clicked event failed:', e);
            }
        }
    };
    navigator.serviceWorker.addEventListener('message', messageHandler);
    return {
        async setExternalId(externalId) {
            currentExternalId = externalId;
            await apiClient.updateInfo(config.appId, icId, buildUpdateInfoRequest({ ext_id: externalId }));
        },
        async setTags(tags) {
            currentTags = tags;
            await apiClient.updateInfo(config.appId, icId, buildUpdateInfoRequest({ tags }));
        },
        async notifyLifecycle(event) {
            if (!icId)
                return;
            try {
                await apiClient.lifecycleEvent(config.appId, icId, event);
            }
            catch (e) {
                console.warn('[PushExpress] lifecycle event failed:', e);
            }
        },
        getIcId() {
            return storage.getIcId();
        },
        destroy() {
            if (updateIntervalId !== null) {
                clearInterval(updateIntervalId);
                updateIntervalId = null;
            }
            navigator.serviceWorker.removeEventListener('message', messageHandler);
        },
    };
}
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export { initPushExpress };
//# sourceMappingURL=push-express-sdk.esm.js.map
