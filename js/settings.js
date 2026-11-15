/* Ajustes del usuario, persistidos en localStorage. Sin dependencias. */
const SETTINGS_KEY = 'bp_settings';

export const SETTINGS_DEFAULTS = { brightness: 100, fov: 75, shadows: 'high', volume: 80, reducedMotion: false };

export const settings = { ...SETTINGS_DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  for (const k in SETTINGS_DEFAULTS) if (k in saved) settings[k] = saved[k];
} catch (e) { /* almacenamiento no disponible */ }

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
