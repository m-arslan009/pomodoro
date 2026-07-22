/*
 * auth.js — frontend-only authentication against a single hardcoded profile.
 * There is no backend or live API, so credentials are verified here and the
 * resulting session profile becomes the app-wide source of truth for "who is
 * logged in", reused consistently by every subsequent page.
 *
 * The account starts from HARDCODED_USER + CREDENTIALS, but the Profile page can
 * edit the non-sensitive fields (name, username) and change the password. Those
 * edits are persisted as overrides that layer over the hardcoded defaults. In a
 * real app the password would live behind a backend; here — with no server — the
 * changed password is stored locally so the change survives a refresh/re-login.
 */

import { read, write, remove } from './storage.js';

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
};

// Kept alongside (not on) the exported profile so the password never leaks
// into session storage or UI state.
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123!@#',
};

const SESSION_KEY = 'session';
const PROFILE_KEY = 'profile'; // persisted editable overrides (name, username)
const PASSWORD_KEY = 'password'; // persisted password override (frontend-only)

/** The only fields the Profile page is allowed to edit; email + id are fixed. */
const EDITABLE_FIELDS = ['firstName', 'lastName', 'username'];

/**
 * The active account profile: HARDCODED_USER with any persisted Profile-page
 * edits layered on top. Email and id can never be overridden.
 */
export function getProfile() {
  const overrides = read(PROFILE_KEY, null);
  const profile = { ...HARDCODED_USER };
  if (overrides && typeof overrides === 'object') {
    for (const field of EDITABLE_FIELDS) {
      if (typeof overrides[field] === 'string' && overrides[field].trim()) {
        profile[field] = overrides[field].trim();
      }
    }
  }
  return profile;
}

/**
 * Persist edits to the non-sensitive profile fields and keep the active session
 * (the app-wide "who is logged in") in sync so the change shows immediately.
 * Returns the merged profile.
 */
export function updateProfile(fields) {
  const overrides = {};
  for (const field of EDITABLE_FIELDS) {
    if (fields[field] != null) overrides[field] = String(fields[field]).trim();
  }
  write(PROFILE_KEY, overrides);
  const merged = getProfile();
  if (getSession()) write(SESSION_KEY, merged);
  return merged;
}

/** The password currently in effect: a saved override, else the default. */
function currentPassword() {
  const override = read(PASSWORD_KEY, null);
  return typeof override === 'string' && override.length > 0 ? override : CREDENTIALS.password;
}

/** True when the supplied password matches the account's current password. */
export function verifyPassword(password) {
  return password === currentPassword();
}

/** Replace the account password. Returns true on success. */
export function changePassword(nextPassword) {
  return write(PASSWORD_KEY, nextPassword);
}

/**
 * True only when both the username and the password match the current account.
 * Username is matched case-insensitively against the (possibly edited) profile;
 * the password must exactly match the current (possibly changed) password.
 */
export function verifyCredentials(username, password) {
  return (
    String(username).trim().toLowerCase() === getProfile().username.toLowerCase() &&
    password === currentPassword()
  );
}

/** Persist the logged-in (non-sensitive) profile as the active session. */
export function startSession() {
  const profile = getProfile();
  write(SESSION_KEY, profile);
  return profile;
}

/** The currently logged-in profile, or null when signed out. */
export function getSession() {
  return read(SESSION_KEY, null);
}

/** Clear the active session (sign out). */
export function endSession() {
  return remove(SESSION_KEY);
}
