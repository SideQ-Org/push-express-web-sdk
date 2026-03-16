// Push Express Service Worker
// Handles push notifications: shows notification, sends delivered/clicked events

// --- IndexedDB helper ---
async function getConfig() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('push_express', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('config'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('config', 'readonly');
        const get = tx.objectStore('config').get('sdk_config');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      };
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

async function sendNotificationEvent(config, msgId, event) {
  const response = await fetch(
    config.baseURL + '/apps/' + config.appId + '/instances/' + config.icId + '/events/notification',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg_id: msgId, event: event }) }
  );
  if (!response.ok) throw new Error('notification event failed: ' + response.status);
}

async function postMessageToClients(type, msgId) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: type, msg_id: msgId });
  }
}

// --- Push event ---
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const { title, body, icon, image, url, msg_id } = payload;

  event.waitUntil((async () => {
    if (msg_id) {
      const config = await getConfig();
      if (config) {
        try { await sendNotificationEvent(config, msg_id, 'delivered'); }
        catch (e) { await postMessageToClients('push_express_delivered', msg_id); }
      } else {
        await postMessageToClients('push_express_delivered', msg_id);
      }
    }
    const options = { body: body || '', icon: icon, data: { url: url, msg_id: msg_id } };
    if (image) options.image = image;
    await self.registration.showNotification(title || 'Push Express', options);
  })());
});

// --- Notification click ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, msg_id } = event.notification.data || {};

  event.waitUntil((async () => {
    if (msg_id) {
      const config = await getConfig();
      if (config) {
        try { await sendNotificationEvent(config, msg_id, 'clicked'); }
        catch (e) { await postMessageToClients('push_express_clicked', msg_id); }
      } else {
        await postMessageToClients('push_express_clicked', msg_id);
      }
    }
    if (url) await self.clients.openWindow(url);
  })());
});
