// public/js/ui/theme.js
// Theme switcher: Dark / Light / High-Contrast.

import { localStore } from '../storage/local-store.js';

const THEMES = ['light', 'dark', 'contrast'];
const LABELS = { light: '☀ Light', dark: '☾ Dark', contrast: '◐ Contrast' };

export function initTheme() {
  const saved = localStore.getSettings().theme;
  const initial = THEMES.includes(saved)
    ? saved
    : matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
  applyTheme(initial);
  return initial;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStore.updateSettings({ theme });
}

export function cycleTheme() {
  const current =
    document.documentElement.getAttribute('data-theme') || 'light';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  applyTheme(next);
  return next;
}

export function themeLabel() {
  const current =
    document.documentElement.getAttribute('data-theme') || 'light';
  return LABELS[current];
}
