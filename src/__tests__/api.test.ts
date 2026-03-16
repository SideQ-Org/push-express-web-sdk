import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushExpressApiClient } from '../api';

// Мок fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('PushExpressApiClient', () => {
  let api: PushExpressApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    api = new PushExpressApiClient('https://core.push.express/api/r/v2');
  });

  describe('URL нормализация', () => {
    it('убирает trailing slash из baseURL', () => {
      const apiWithSlash = new PushExpressApiClient('https://example.com/api/');
      mockFetch.mockReturnValue(jsonResponse({ id: '1', just_created: true }));

      apiWithSlash.createInstance('app1', { ic_token: 'tok' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/apps/app1/instances',
        expect.any(Object),
      );
    });

    it('работает без trailing slash', () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1', just_created: true }));

      api.createInstance('app1', { ic_token: 'tok' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://core.push.express/api/r/v2/apps/app1/instances',
        expect.any(Object),
      );
    });
  });

  describe('createInstance', () => {
    it('отправляет POST с ic_token и ext_id', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '999', just_created: true }));

      const result = await api.createInstance('app1', { ic_token: 'my-token', ext_id: 'user-42' });

      expect(result).toEqual({ id: '999', just_created: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://core.push.express/api/r/v2/apps/app1/instances',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ic_token: 'my-token', ext_id: 'user-42' }),
        },
      );
    });

    it('работает без ext_id', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1', just_created: false }));

      const result = await api.createInstance('app1', { ic_token: 'tok' });

      expect(result.just_created).toBe(false);
    });
  });

  describe('updateInfo', () => {
    it('отправляет PUT со всеми полями DTO', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1', update_interval_sec: 120 }));

      const request = {
        transport_type: 'webpush',
        transport_token: '{"endpoint":"..."}',
        platform_type: 'browser',
        platform_name: 'Chrome 120',
        ext_id: 'user-1',
        lang: 'ru',
        country: '',
        tz_sec: 10800,
        tags: { plan: 'premium' },
        onscreen_count: 0,
        onscreen_sec: 0,
        agent_name: '@pushexpress/web-sdk@1.0.0',
      };

      const result = await api.updateInfo('app1', 'ic-1', request);

      expect(result.update_interval_sec).toBe(120);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://core.push.express/api/r/v2/apps/app1/instances/ic-1/info',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
    });
  });

  describe('notificationEvent', () => {
    it('отправляет delivered событие', async () => {
      mockFetch.mockReturnValue(jsonResponse({}));

      await api.notificationEvent('app1', 'ic-1', 'msg-42', 'delivered');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://core.push.express/api/r/v2/apps/app1/instances/ic-1/events/notification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg_id: 'msg-42', event: 'delivered' }),
        },
      );
    });

    it('отправляет clicked событие', async () => {
      mockFetch.mockReturnValue(jsonResponse({}));

      await api.notificationEvent('app1', 'ic-1', 'msg-42', 'clicked');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.event).toBe('clicked');
    });
  });

  describe('lifecycleEvent', () => {
    it('отправляет lifecycle событие', async () => {
      mockFetch.mockReturnValue(jsonResponse({}));

      await api.lifecycleEvent('app1', 'ic-1', 'onscreen');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://core.push.express/api/r/v2/apps/app1/instances/ic-1/events/lifecycle',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'onscreen' }),
        },
      );
    });
  });

  describe('void endpoints (postVoid)', () => {
    it('notificationEvent работает с пустым телом ответа (204)', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: true, status: 204, statusText: 'No Content' }),
      );

      // Не должен бросить ошибку — postVoid не вызывает response.json()
      await api.notificationEvent('app1', 'ic-1', 'msg-1', 'delivered');
    });

    it('lifecycleEvent работает с пустым телом ответа (204)', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: true, status: 204, statusText: 'No Content' }),
      );

      await api.lifecycleEvent('app1', 'ic-1', 'background');
    });
  });

  describe('обработка ошибок', () => {
    it('бросает ошибку при статусе 4xx', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 400, statusText: 'Bad Request', json: () => Promise.resolve({}) }),
      );

      await expect(api.createInstance('app1', { ic_token: 'tok' }))
        .rejects.toThrow('PushExpress API error: 400 Bad Request');
    });

    it('бросает ошибку при статусе 5xx', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', json: () => Promise.resolve({}) }),
      );

      await expect(api.updateInfo('app1', 'ic-1', {} as any))
        .rejects.toThrow('PushExpress API error: 500');
    });
  });
});
