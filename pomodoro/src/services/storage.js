/*
 * storage.js — the single gateway to localStorage for the whole app.
 * Per convention.md: nothing else touches `window.localStorage` directly, and every key is
 * namespaced + versioned so future migrations are isolated.
 *
 * WHAT IS LEFT HERE IS ONLY WHAT THE SERVER CANNOT OWN.
 *
 * Tasks, sessions and gamification totals used to live here as three flat arrays. They are gone:
 * the API is the source of truth for all three, the store holds the working copy, and a reload
 * signs the user out anyway, so a local cache of server data could only ever be a second version
 * of the truth waiting to disagree with the first.
 *
 * Two things remain, and both are genuinely client-side:
 *
 *   activeSession — the in-flight draft. The server has no concept of a running block (it rejected
 *                   start/stop endpoints deliberately), so if this is not written down locally a
 *                   reload loses 25 minutes of the user's work.
 *   outbox        — finished records that have not reached the server yet. They exist precisely
 *                   because the server could not be told about them.
 *
 * Neither is a credential. NO TOKEN MAY LIVE IN localStorage OR sessionStorage — that rule is
 * unchanged and non-negotiable (CONTRACT.md §5, §17.2).
 */

const NAMESPACE = 'pomodoro.v1';

/** Build a fully-qualified, namespaced key from a short logical name. */
function key(name) {
  return `${NAMESPACE}.${name}`;
}

/**
 * Read and JSON-parse a value. Returns `fallback` when the key is missing or the stored value is
 * corrupt, so callers never have to try/catch.
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
 * The two remaining keys belong to one account but are not namespaced by user. Recording which
 * account they belong to, and clearing them when a different one signs in, is what stops one
 * person's queued session being flushed under another person's token.
 */

const CACHE_OWNER_KEY = 'cacheOwner';
const OWNED_KEYS = ['activeSession', 'outbox'];

/**
 * Keys written by the pre-API build. Nothing reads them any more, but they hold real user data
 * from before the server existed, so they are cleared on the next account switch rather than left
 * to sit in the browser indefinitely.
 */
const LEGACY_KEYS = ['tasks', 'sessions', 'gamification'];

/**
 * Claim the local cache for a user id, discarding it when it belonged to someone else.
 *
 * Called after every successful sign-in — which is the only moment it can be called, because there
 * is no session bootstrap: the token is memory-only, so a page load starts anonymous.
 */
export function adoptCacheOwner(userId) {
  if (!userId) return false;

  const previous = read(CACHE_OWNER_KEY, null);
  if (previous === userId) return false;

  for (const name of [...OWNED_KEYS, ...LEGACY_KEYS]) remove(name);
  write(CACHE_OWNER_KEY, userId);
  return true;
}

/* ------------------------------------------------------- Active session -- */
/*
 * The single in-flight draft (CONTRACT.md §19.1). Written on start and rewritten on pause, resume
 * and restart, so a reload can recover the block instead of voiding it.
 */

const ACTIVE_SESSION_KEY = 'activeSession';

/** The in-flight session draft, or null when no block is running. */
export function getActiveSession() {
  const draft = read(ACTIVE_SESSION_KEY, null);
  return draft && typeof draft === 'object' && draft.clientSessionId ? draft : null;
}

/** Persist the in-flight draft. */
export function saveActiveSession(draft) {
  return write(ACTIVE_SESSION_KEY, draft);
}

/** Drop the in-flight draft once the block is finalized or discarded. */
export function clearActiveSession() {
  return remove(ACTIVE_SESSION_KEY);
}

/**
 * Watch the draft for changes made by ANOTHER tab (edge case E7).
 *
 * The `storage` event only fires in other documents, which is exactly the signal needed: two tabs
 * on one account share one draft key, so the tab that did not write last is the stale one and must
 * stand down. The listener lives here because this module is the only thing that may know a
 * localStorage key name.
 *
 * @param {(draft: object|null) => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribeToActiveSession(handler) {
  if (typeof window === 'undefined') return () => {};
  const watched = key(ACTIVE_SESSION_KEY);

  function onStorage(event) {
    if (event.key !== watched) return;
    let next = null;
    try {
      next = event.newValue ? JSON.parse(event.newValue) : null;
    } catch {
      next = null;
    }
    handler(next);
  }

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/* --------------------------------------------------------------- Outbox -- */
/*
 * Finished records awaiting POST. Persisted rather than held in memory because the whole point is
 * to survive the thing that stopped them being sent — a closed tab, a dead connection, a reload.
 *
 * It holds WHOLE RECORDS, not just their ids. The contract originally specified `clientSessionId[]`
 * on the assumption that the session array would still be in localStorage to look them up in; that
 * array is gone, so an id alone would name a record nothing could find.
 */

const OUTBOX_KEY = 'outbox';

/** Finished-but-unsent records, oldest first (always an array). */
export function getOutbox() {
  const items = read(OUTBOX_KEY, []);
  return Array.isArray(items) ? items.filter((item) => item?.clientSessionId) : [];
}

/** Persist the queue. */
export function saveOutbox(items) {
  return write(OUTBOX_KEY, Array.isArray(items) ? items : []);
}
