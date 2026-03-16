/// <reference lib="webworker" />

// Service Worker для push-уведомлений Push Express.
// SW не имеет доступа к localStorage, но имеет доступ к IndexedDB и fetch.
// Конфиг (appId, icId, baseURL) читается из IndexedDB, куда его записывает главный поток.
// Если конфиг недоступен — fallback на postMessage в открытые окна.

const sw = self as unknown as ServiceWorkerGlobalScope;

// --- IndexedDB helper ---

interface SDKConfig {
  appId: string;
  icId: string;
  baseURL: string;
}

async function getConfig(): Promise<SDKConfig | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('push_express', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('config');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('config', 'readonly');
        const get = tx.objectStore('config').get('sdk_config');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// --- API call ---

async function sendNotificationEvent(config: SDKConfig, msgId: string, event: string): Promise<void> {
  const response = await fetch(`${config.baseURL}/apps/${config.appId}/instances/${config.icId}/events/notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_id: msgId, event }),
  });
  if (!response.ok) {
    throw new Error(`notification event failed: ${response.status}`);
  }
}

// --- Fallback: postMessage to open windows ---

async function postMessageToClients(type: string, msgId: string): Promise<void> {
  const clients = await sw.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type, msg_id: msgId });
  }
}

// --- Push event ---

sw.addEventListener('push', ((event: PushEvent) => {
  if (!event.data) return;

  const payload = event.data.json();
  const { title, body, icon, image, url, msg_id } = payload;

  event.waitUntil(
    (async () => {
      // Отправляем delivered: сначала напрямую через fetch, fallback — postMessage
      if (msg_id) {
        const config = await getConfig();
        if (config) {
          try {
            await sendNotificationEvent(config, msg_id, 'delivered');
          } catch {
            await postMessageToClients('push_express_delivered', msg_id);
          }
        } else {
          await postMessageToClients('push_express_delivered', msg_id);
        }
      }

      // Показываем уведомление
      const options: NotificationOptions & { image?: string } = {
        body: body || '',
        icon,
        data: { url, msg_id },
      };
      if (image) options.image = image;
      await sw.registration.showNotification(title || 'Notification', options);
    })()
  );
}) as EventListener);

// --- Notification click ---

sw.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close();

  const { url, msg_id } = event.notification.data || {};

  event.waitUntil(
    (async () => {
      // Отправляем clicked: сначала напрямую через fetch, fallback — postMessage
      if (msg_id) {
        const config = await getConfig();
        if (config) {
          try {
            await sendNotificationEvent(config, msg_id, 'clicked');
          } catch {
            await postMessageToClients('push_express_clicked', msg_id);
          }
        } else {
          await postMessageToClients('push_express_clicked', msg_id);
        }
      }

      // Открываем URL
      if (url) {
        await sw.clients.openWindow(url);
      }
    })()
  );
}) as EventListener);
