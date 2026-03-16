import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushExpressStorage } from '../storage';

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Мок crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });

describe('PushExpressStorage', () => {
  let storage: PushExpressStorage;

  beforeEach(() => {
    localStorageMock.clear();
    storage = new PushExpressStorage();
  });

  describe('getOrCreateIcToken', () => {
    it('генерирует новый токен при первом вызове', () => {
      const token = storage.getOrCreateIcToken();
      expect(token).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('возвращает тот же токен при повторном вызове', () => {
      const token1 = storage.getOrCreateIcToken();
      const token2 = storage.getOrCreateIcToken();
      expect(token1).toBe(token2);
    });

    it('сохраняет токен в localStorage', () => {
      storage.getOrCreateIcToken();
      expect(localStorageMock.getItem('push_express_ic_token')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });
  });

  describe('icId', () => {
    it('возвращает null если не установлен', () => {
      expect(storage.getIcId()).toBeNull();
    });

    it('сохраняет и возвращает ic_id', () => {
      storage.setIcId('12345');
      expect(storage.getIcId()).toBe('12345');
    });
  });

  describe('appId', () => {
    it('возвращает null если не установлен', () => {
      expect(storage.getAppId()).toBeNull();
    });

    it('сохраняет и возвращает app_id', () => {
      storage.setAppId('my-app');
      expect(storage.getAppId()).toBe('my-app');
    });
  });

  describe('updateInterval', () => {
    it('возвращает 120 по умолчанию', () => {
      expect(storage.getUpdateInterval()).toBe(120);
    });

    it('сохраняет и возвращает кастомный интервал', () => {
      storage.setUpdateInterval(300);
      expect(storage.getUpdateInterval()).toBe(300);
    });
  });
});
