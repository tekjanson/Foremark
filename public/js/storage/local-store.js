// public/js/storage/local-store.js
// Offline-first fallback + client settings persistence via localStorage.
// Used for AI provider settings (API keys never sent to our DB) and as a
// resilience cache when the server is briefly unreachable.

const SETTINGS_KEY = 'waymark.settings.v1';
const CACHE_PREFIX = 'waymark.cache.';

export const localStore = {
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  },

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  },

  updateSettings(patch) {
    const merged = { ...this.getSettings(), ...patch };
    return this.saveSettings(merged);
  },

  cacheRecords(templateId, records) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + templateId,
        JSON.stringify({ at: Date.now(), records })
      );
    } catch {
      /* quota — ignore */
    }
  },

  getCachedRecords(templateId) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + templateId);
      return raw ? JSON.parse(raw).records : null;
    } catch {
      return null;
    }
  },
};
