/*
 * auth.js — authentication against the Evergrove API.
 *
 * This module knows how to *talk* about authentication and nothing else: no React state, no
 * storage, no routing. State lives in store/authSlice.js, which calls these functions.
 *
 * Authentication is two credentials (ADR-008 rev. 3), and this module only ever handles one of
 * them. The access token is a JWT returned in the body of login, register and refresh; the caller
 * keeps it in memory and api.js sends it as a bearer header. The refresh token is a `Set-Cookie`
 * this code never reads and could not read if it tried — it is HttpOnly, which is exactly what
 * makes it safe to be the long-lived half.
 *
 * So `refresh()` below takes no argument and sends no body. The browser supplies the credential.
 */

import { api } from './api.js';

/**
 * @typedef {object} UserProfile
 * @property {string} id
 * @property {string} email
 * @property {string} username
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} timezone IANA zone. Not a display preference — it is how the server buckets
 *   the account's days, so a wrong value mis-groups every session it will ever record.
 * @property {boolean} emailVerified Always false today: nothing verifies addresses yet.
 * @property {string|null} avatarUpdatedAt ISO 8601, or null when the account has no photo. The
 *   bytes are never inlined here — this is what decides whether to fetch them.
 * @property {string} createdAt ISO 8601.
 */

/**
 * What every sign-in shaped endpoint returns.
 *
 * @typedef {object} AuthSession
 * @property {UserProfile} user The signed-in account.
 * @property {string} accessToken Short-lived JWT for the Authorization header. Memory only.
 * @property {number} expiresIn Milliseconds until `accessToken` expires.
 */

/**
 * Narrow a login/register body to the session fields, so a change to what the endpoint
 * volunteers cannot quietly widen what the store keeps.
 *
 * @param {{user: UserProfile, accessToken: string, expiresIn: number}} payload
 * @returns {AuthSession}
 */
function toSession(payload) {
  return {
    user: payload.user,
    accessToken: payload.accessToken,
    expiresIn: payload.expiresIn,
  };
}

/**
 * Accepts an email address or a username in `identifier` — the server resolves which.
 * @returns {Promise<AuthSession>}
 */
export async function login({ identifier, password }) {
  return toSession(await api.post('/auth/login', { identifier, password }));
}

/**
 * Registering also signs the account in, which is what the sign-up form has always implied.
 * @returns {Promise<AuthSession>}
 */
export async function register({ firstName, lastName, email, username, password, timezone }) {
  return toSession(
    await api.post('/auth/register', {
      firstName,
      lastName,
      email,
      username,
      password,
      timezone,
    })
  );
}

/**
 * Renews the access token from the refresh cookie.
 *
 * No arguments and no body: the credential is the cookie, which the browser attaches and this code
 * cannot see. The response is shaped exactly like login's, which is the point — a resumed session
 * and a fresh sign-in are the same thing to everything downstream.
 *
 * @returns {Promise<AuthSession>} Rejects with a 401 ApiError when there is no live session, which
 *   on a cold start is the ordinary answer rather than an error to show anyone.
 */
export async function refresh() {
  return toSession(await api.post('/auth/refresh'));
}

/**
 * Tells the server this device is signing out, and it now revokes for real: the refresh session
 * the cookie names is killed and the cookie is cleared, so this device cannot renew. The access
 * token already in memory stays valid until it expires — nothing can shorten that — which is why
 * dropping it from memory is still part of signing out.
 */
export async function logout() {
  await api.post('/auth/logout');
}

/**
 * Changes the password, which also signs every *other* device out (ADR-008 rev. 3).
 *
 * The response carries a fresh access token that is deliberately discarded, and the rotated cookie
 * that comes with it is adopted by the browser without this code touching it. Discarding is still
 * correct: the token already in memory is valid for its full lifetime regardless — `JwtGuard` reads
 * no session row — so adopting the new one would change nothing observable, and when it does expire
 * the new cookie renews it.
 */
export async function changePassword({ currentPassword, newPassword }) {
  const payload = await api.post('/auth/change-password', { currentPassword, newPassword });
  return payload.user;
}

/** The browser's IANA zone, used to bucket the user's local days. Null when unavailable. */
export function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
