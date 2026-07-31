/*
 * settings.js — reading and writing the signed-in account's preferences.
 *
 * Split from profile.js the same way profile.js is split from auth.js: `/me/settings` needs a
 * session but is not part of establishing one, and it returns its own payload rather than a
 * UserProfile (CONTRACT.md §2.2). Like both of those, this module knows only how to talk to the
 * API — state lives in store/settingsSlice.js.
 *
 * The constants below MIRROR backend/src/domain/settings.ts. They are not the authority: the
 * server re-validates everything, and these exist so a user gets an answer without a round trip.
 * A rule looser here than there produces a form that passes and then fails at the API with
 * wording the user has already been shown; a stricter one blocks input the server would accept.
 * Both are contract violations (CONTRACT.md §3). Keep the numbers identical.
 */

import { api } from './api.js';

/** Editable ranges in whole minutes. Mirrors WORK_/BREAK_MINUTES_MIN/MAX. */
export const DURATION_LIMITS = {
  work: { min: 1, max: 120 },
  break: { min: 1, max: 60 },
};

/** Mirrors THEMES. 'light' is deferred until a light .app-shell palette exists (§9.3). */
export const THEME_VALUES = ['system', 'dark'];

/** Mirrors BACKGROUNDS, and the preset keys in appearance.js. */
export const BACKGROUND_VALUES = ['forest', 'dusk', 'ember', 'midnight'];

/** Mirrors THEME_COLOR_KEYS — the three forest variables the palette editor may override. */
export const THEME_COLOR_KEYS = ['accent', 'leaf', 'wood'];

/** Mirrors HEX_COLOR_PATTERN. Six-digit hex is the only form <input type="color"> produces. */
export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Mirrors LABEL_MAX_LENGTH. */
export const LABEL_MAX_LENGTH = 18;

/**
 * What an account that has never saved anything gets, and what the store seeds itself with so
 * consumers never block on the network (CONTRACT.md §8.2).
 *
 * @typedef {object} UserSettings
 * @property {number} workMinutes
 * @property {number} breakMinutes
 * @property {'system'|'dark'} theme
 * @property {{accent: string, leaf: string, wood: string}|null} customTheme
 * @property {'forest'|'dusk'|'ember'|'midnight'} background
 * @property {{work: string, break: string}} labels
 * @property {string|null} updatedAt ISO 8601; null until the row is first written.
 */

/** @type {UserSettings} */
export const DEFAULT_SETTINGS = {
  workMinutes: 25,
  breakMinutes: 5,
  theme: 'system',
  customTheme: null,
  background: 'forest',
  labels: { work: '', break: '' },
  updatedAt: null,
};

/**
 * Reads the account's preferences (§4.7).
 *
 * Never 404s: an account with no stored row gets the domain defaults with `updatedAt: null`, so
 * there is no "not found" case for a caller to handle.
 *
 * @returns {Promise<UserSettings>}
 */
export async function fetchSettings() {
  const payload = await api.get('/me/settings');
  return payload.settings;
}

/**
 * Updates preferences (§4.8). PATCH semantics: pass only what changed.
 *
 * The server is the authority on what was stored — it trims labels and re-validates every field —
 * so callers must adopt the returned object rather than keeping the values they submitted.
 *
 * `customTheme: null` clears the palette override; omitting the key leaves it alone. The two are
 * different instructions and both are sendable.
 *
 * @param {Partial<UserSettings>} patch At least one key.
 * @returns {Promise<UserSettings>}
 */
export async function updateSettings(patch) {
  const payload = await api.patch('/me/settings', patch);
  return payload.settings;
}
