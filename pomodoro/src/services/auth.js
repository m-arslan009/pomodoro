/*
 * auth.js — authentication against the Evergrove API.
 *
 * This module knows how to *talk* about authentication and nothing else: no React state, no
 * storage, no routing. State lives in store/authSlice.js, which calls these functions.
 *
 * Authentication is one credential: a JWT returned in the body of login and register, which the
 * caller keeps in memory and api.js sends as a bearer header. There is no refresh token and no
 * cookie, so nothing survives a page reload and there is no way to renew a token — when it
 * expires the user signs in again.
 */

import { ApiError, api } from './api.js';

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
 * Probes whether the access token is still good: the account when it is, null when it is not.
 *
 * Not used at startup — there is no persisted credential to bootstrap from. Reading the profile
 * is `/me` (services/profile.js); this endpoint answers "is this token alive?".
 */
export async function fetchCurrentUser() {
  try {
    const payload = await api.get('/auth/me');
    return payload.user;
  } catch (error) {
    // Not being signed in is an expected answer, not a failure to report.
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
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
 * Tells the server this device is signing out. It revokes nothing — the token stays valid until
 * it expires — so dropping it from memory is what actually ends the session here.
 */
export async function logout() {
  await api.post('/auth/logout');
}

/**
 * Changes the password.
 *
 * The response also carries a fresh access token, which is deliberately discarded: with no
 * server-side sessions the token already in memory stays valid for its full lifetime, so
 * adopting the new one would change nothing observable. Note that this does *not* sign other
 * devices out — nothing can, under a stateless token model.
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
