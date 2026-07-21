/*
 * auth.js — frontend-only authentication against a single hardcoded profile.
 * There is no backend or live API, so credentials are verified here and the
 * resulting session profile becomes the app-wide source of truth for "who is
 * logged in", reused consistently by every subsequent page. Only non-sensitive
 * profile fields are ever persisted — never the password.
 */

import { read, write, remove } from './storage.js'

/*
 * The one and only account the app recognizes. Exported so other pages can
 * render the signed-in user without re-declaring the profile.
 */
export const HARDCODED_USER = {
  id: 'admin-0001',
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@evergrove.app',
  username: 'admin',
}

// Kept alongside (not on) the exported profile so the password never leaks
// into session storage or UI state.
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123!@#',
}

const SESSION_KEY = 'session'

/**
 * True only when both the username and password match the single hardcoded
 * account. Username is matched case-insensitively; the password must be exact.
 */
export function verifyCredentials(username, password) {
  return (
    String(username).trim().toLowerCase() === CREDENTIALS.username &&
    password === CREDENTIALS.password
  )
}

/** Persist the logged-in (non-sensitive) profile as the active session. */
export function startSession() {
  write(SESSION_KEY, HARDCODED_USER)
  return HARDCODED_USER
}

/** The currently logged-in profile, or null when signed out. */
export function getSession() {
  return read(SESSION_KEY, null)
}

/** Clear the active session (sign out). */
export function endSession() {
  return remove(SESSION_KEY)
}
