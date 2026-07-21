/*
 * storage.js — the single gateway to localStorage for the whole app.
 * Per convention.md: nothing else touches `window.localStorage` directly, and
 * every key is namespaced + versioned so future migrations are isolated.
 */

const NAMESPACE = 'pomodoro.v1'

/** Build a fully-qualified, namespaced key from a short logical name. */
function key(name) {
  return `${NAMESPACE}.${name}`
}

/**
 * Read and JSON-parse a value. Returns `fallback` when the key is missing or
 * the stored value is corrupt, so callers never have to try/catch.
 */
export function read(name, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key(name))
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** JSON-serialize and persist a value. Returns true on success. */
export function write(name, value) {
  try {
    window.localStorage.setItem(key(name), JSON.stringify(value))
    return true
  } catch {
    // e.g. quota exceeded or storage disabled (private mode)
    return false
  }
}

/** Remove a namespaced key. */
export function remove(name) {
  try {
    window.localStorage.removeItem(key(name))
    return true
  } catch {
    return false
  }
}

/* --------------------------------------------------------------- Users -- */
/*
 * Frontend-only "accounts": a list of registered profiles. Only non-sensitive
 * profile fields are stored here — never the password.
 */

const USERS_KEY = 'users'

/** All registered user profiles (always an array). */
export function getUsers() {
  const users = read(USERS_KEY, [])
  return Array.isArray(users) ? users : []
}

/** Case-insensitive lookup by email. */
export function findUserByEmail(email) {
  const target = String(email).trim().toLowerCase()
  return getUsers().find((u) => u.email?.toLowerCase() === target) ?? null
}

/** Case-insensitive lookup by username. */
export function findUserByUsername(username) {
  const target = String(username).trim().toLowerCase()
  return getUsers().find((u) => u.username?.toLowerCase() === target) ?? null
}

/**
 * Append a non-sensitive profile to the users list and persist it.
 * Returns the saved profile (with a generated id + timestamp).
 */
export function saveUser({ firstName, lastName, email, username }) {
  const profile = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    username: username.trim(),
    createdAt: new Date().toISOString(),
  }
  const users = getUsers()
  users.push(profile)
  write(USERS_KEY, users)
  return profile
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

const TASKS_KEY = 'tasks'
const SESSIONS_KEY = 'sessions'
const GAMIFICATION_KEY = 'gamification'

/** Persisted task records (always an array). */
export function getTasks() {
  const items = read(TASKS_KEY, [])
  return Array.isArray(items) ? items : []
}

/** Persist the full task record list. */
export function saveTasks(items) {
  return write(TASKS_KEY, items)
}

/** Persisted session/history records (always an array). */
export function getSessions() {
  const items = read(SESSIONS_KEY, [])
  return Array.isArray(items) ? items : []
}

/** Persist the full session record list. */
export function saveSessions(items) {
  return write(SESSIONS_KEY, items)
}

/** Persisted gamification totals; safe defaults when absent/corrupt. */
export function getGamification() {
  const value = read(GAMIFICATION_KEY, null)
  if (!value || typeof value !== 'object') return { points: 0, streak: 0 }
  return {
    points: Number.isFinite(value.points) ? value.points : 0,
    streak: Number.isFinite(value.streak) ? value.streak : 0,
  }
}

/** Persist gamification totals. */
export function saveGamification(value) {
  return write(GAMIFICATION_KEY, value)
}
