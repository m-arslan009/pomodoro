/*
 * storage.js — the single gateway to localStorage for the whole app.
 * Per convention.md: nothing else touches `window.localStorage` directly, and
 * every key is namespaced + versioned so future migrations are isolated.
 */

const NAMESPACE = 'pomodoro.v1';

/** Build a fully-qualified, namespaced key from a short logical name. */
function key(name) {
  return `${NAMESPACE}.${name}`;
}

/**
 * Read and JSON-parse a value. Returns `fallback` when the key is missing or
 * the stored value is corrupt, so callers never have to try/catch.
 */
export function read(name, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key(name));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** JSON-serialize and persist a value. Returns true on success. */
export function write(name, value) {
  try {
    window.localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    // e.g. quota exceeded or storage disabled (private mode)
    return false;
  }
}

/** Remove a namespaced key. */
export function remove(name) {
  try {
    window.localStorage.removeItem(key(name));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------- Cache owner -- */
/*
 * Accounts now live on the server, so this module no longer stores users or credentials — the
 * `users`, `session`, `profile` and `password` keys are gone.
 *
 * What remains is a consequence of that change: the dashboard keys below are a per-user cache,
 * but they are not namespaced by user. Two accounts used in the same browser would otherwise
 * show each other's tasks and points. Recording which account the cache belongs to, and
 * clearing it when a different one signs in, closes that leak.
 */

const CACHE_OWNER_KEY = 'cacheOwner';
const OWNED_KEYS = ['tasks', 'sessions', 'gamification'];

/**
 * Claim the local cache for a user id, discarding it when it belonged to someone else.
 * Called after every successful sign-in and on session bootstrap.
 */
export function adoptCacheOwner(userId) {
  if (!userId) return false;

  const previous = read(CACHE_OWNER_KEY, null);
  if (previous === userId) return false;

  // A different account (or a cache from the pre-backend build, which has no owner recorded).
  for (const name of OWNED_KEYS) remove(name);
  write(CACHE_OWNER_KEY, userId);
  return true;
}

/* ----------------------------------------------------------- Dashboard -- */
/*
 * Persisted dashboard records so nothing is lost on refresh. Three flat arrays /
 * objects, each a thin pass-through — expiry and 7-day pruning are domain rules
 * applied by the caller (see TimerPage) before saving, keeping this layer thin.
 *
 *   tasks    -> [ { id, title, status:'todo'|'completed'|'terminated'|'expired',
 *                   createdAt, endedAt? } ]      (kept ~7 days for stats)
 *   sessions -> [ { id, taskTitle, durationMs, endedAt, status } ]  (kept ~7 days)
 *   gamification -> { points, streak }           (lifetime running totals)
 */

const TASKS_KEY = 'tasks';
const SESSIONS_KEY = 'sessions';
const GAMIFICATION_KEY = 'gamification';

/** Persisted task records (always an array). */
export function getTasks() {
  const items = read(TASKS_KEY, []);
  return Array.isArray(items) ? items : [];
}

/** Persist the full task record list. */
export function saveTasks(items) {
  return write(TASKS_KEY, items);
}

/** Persisted session/history records (always an array). */
export function getSessions() {
  const items = read(SESSIONS_KEY, []);
  return Array.isArray(items) ? items : [];
}

/** Persist the full session record list. */
export function saveSessions(items) {
  return write(SESSIONS_KEY, items);
}

/*
 * Gamification totals. The canonical shape is { balance, currentStreak,
 * lifetimePoints, unlockedTitles }: a spendable `balance` that penalties can
 * reduce, split from a monotonic `lifetimePoints` that drives the title ladder
 * and must never regress (locked decision).
 *
 * Records written before that split used { points, streak } — a single
 * penalty-affected total. Both readers below fall back to those legacy fields so
 * an existing player's progress migrates in place on first read.
 */

/** Persisted gamification totals; safe defaults when absent/corrupt. */
export function getGamification() {
  const value = read(GAMIFICATION_KEY, null);
  const v = value && typeof value === 'object' ? value : {};
  // Legacy fallbacks: pre-split records carry the running total as `points`.
  const legacyPoints = Number.isFinite(v.points) ? v.points : 0;
  const legacyStreak = Number.isFinite(v.streak) ? v.streak : 0;
  const balance = Number.isFinite(v.balance) ? v.balance : legacyPoints;
  const currentStreak = Number.isFinite(v.currentStreak) ? v.currentStreak : legacyStreak;
  // Lifetime never decreases; seed it from the running total for legacy records.
  const lifetimePoints = Math.max(
    Number.isFinite(v.lifetimePoints) ? v.lifetimePoints : 0,
    legacyPoints,
    balance
  );
  return { balance, currentStreak, lifetimePoints };
}

/**
 * Persist gamification totals, keeping `lifetimePoints` monotonically increasing
 * regardless of the shape the caller writes — so a lifetime total accrues that
 * penalties can never claw back, even from a legacy { points, streak } write.
 */
export function saveGamification(value) {
  const prev = read(GAMIFICATION_KEY, null);
  const prevLifetime = prev && Number.isFinite(prev.lifetimePoints) ? prev.lifetimePoints : 0;
  const incoming = value && typeof value === 'object' ? value : {};
  const runningTotal = Number.isFinite(incoming.points)
    ? incoming.points
    : Number.isFinite(incoming.balance)
      ? incoming.balance
      : 0;
  const lifetimePoints = Math.max(
    prevLifetime,
    Number.isFinite(incoming.lifetimePoints) ? incoming.lifetimePoints : 0,
    runningTotal
  );
  return write(GAMIFICATION_KEY, { ...incoming, lifetimePoints });
}

/** Convenience reader for the title/feature ladder — lifetime points only. */
export function getLifetimePoints() {
  return getGamification().lifetimePoints;
}

/* ------------------------------------------------------------ Settings -- */
/*
 * User preferences. Phase 1 only exposes the two Pomodoro durations; theme,
 * custom labels, etc. (see idea.md's schema) are layered on in later phases,
 * so getSettings preserves any unknown persisted fields and only sanitizes the
 * ones it owns.
 *
 *   settings -> { workMinutes:25, breakMinutes:5, ... }
 */

const SETTINGS_KEY = 'settings';

/** Factory defaults for the core preferences the Settings page can edit. */
export const DEFAULT_SETTINGS = { workMinutes: 25, breakMinutes: 5, theme: 'system' };

/** Allowed base colour schemes for the always-available theme toggle. */
export const THEME_VALUES = ['system', 'light', 'dark'];

/** Safe editable ranges (whole minutes) for each duration. */
export const DURATION_LIMITS = {
  work: { min: 1, max: 120 },
  break: { min: 1, max: 60 },
};

/** Round to a whole number and clamp into [min, max]; fall back when invalid. */
function clampMinutes(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Persisted settings, merged over defaults with the durations sanitized. */
export function getSettings() {
  const value = read(SETTINGS_KEY, null);
  const base = value && typeof value === 'object' ? value : {};
  return {
    ...base,
    workMinutes: clampMinutes(
      base.workMinutes,
      DURATION_LIMITS.work.min,
      DURATION_LIMITS.work.max,
      DEFAULT_SETTINGS.workMinutes
    ),
    breakMinutes: clampMinutes(
      base.breakMinutes,
      DURATION_LIMITS.break.min,
      DURATION_LIMITS.break.max,
      DEFAULT_SETTINGS.breakMinutes
    ),
    theme: THEME_VALUES.includes(base.theme) ? base.theme : DEFAULT_SETTINGS.theme,
  };
}

/** Persist the full settings object. */
export function saveSettings(value) {
  return write(SETTINGS_KEY, value);
}
