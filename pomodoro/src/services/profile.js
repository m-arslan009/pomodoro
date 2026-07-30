/*
 * profile.js — reading and writing the signed-in account's profile.
 *
 * Split from auth.js so that module stays about credentials: these endpoints need a session but
 * are not part of establishing one. Like auth.js, this knows only how to talk to the API — state
 * lives in store/authSlice.js.
 */

import { ApiError, api } from './api.js';
import { blobToDataUrl } from './image.js';

/** @typedef {import('./auth.js').UserProfile} UserProfile */

/**
 * Re-reads the profile from the server.
 *
 * `/me` is the profile read; `/auth/me` is the token probe. They return the same payload today,
 * but they answer different questions and only this one is meant to be polled for fresh data.
 *
 * @returns {Promise<UserProfile>}
 */
export async function fetchProfile() {
  const payload = await api.get('/me');
  return payload.user;
}

/**
 * Updates the editable identity fields. PATCH semantics: pass only what changed.
 *
 * The server trims and normalises, so the returned profile is the authority on what was stored —
 * callers must adopt it rather than keeping the values they submitted.
 *
 * @param {{firstName?: string, lastName?: string, username?: string, timezone?: string}} fields
 * @returns {Promise<UserProfile>}
 */
export async function updateProfile(fields) {
  const payload = await api.patch('/me', fields);
  return payload.user;
}

/**
 * The avatar as a data URL, or null when the account has none.
 *
 * It cannot be an <img src="/api/v1/me/avatar">: the endpoint needs a bearer token and an img tag
 * cannot send one, so the bytes come through the same authenticated path as everything else.
 *
 * @returns {Promise<string|null>}
 */
export async function fetchAvatarImage() {
  try {
    const blob = await api.getBlob('/me/avatar');
    return blob ? await blobToDataUrl(blob) : null;
  } catch (error) {
    // Having no avatar is an answer, not a failure.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Replaces the avatar. `blob` must already be prepared by services/image.js.
 *
 * @param {Blob} blob
 * @returns {Promise<UserProfile>}
 */
export async function uploadAvatar(blob) {
  const form = new FormData();
  form.append('avatar', blob, 'avatar');
  const payload = await api.put('/me/avatar', form);
  return payload.user;
}
