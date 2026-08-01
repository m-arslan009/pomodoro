/*
 * tasks.js — reading and writing the signed-in account's tasks.
 *
 * Knows only how to talk to the API; state lives in store/timerSlice.js, exactly as settings.js
 * relates to settingsSlice.js.
 *
 * The constants below MIRROR backend/src/domain/task.ts. They are not the authority — the server
 * re-validates everything — and exist so a user gets an answer without a round trip. A rule looser
 * here produces a form that passes and then fails at the API; a stricter one blocks input the
 * server would accept. Both are contract violations (CONTRACT.md §15). Keep the numbers identical.
 */

import { api } from './api.js';

/** Mirrors TASK_TITLE_MAX_LENGTH. */
export const TITLE_MAX_LENGTH = 120;

/** Mirrors TASK_STATUSES. A task is abandoned; a *session* is terminated. */
export const TASK_STATUSES = ['todo', 'completed', 'abandoned'];

/** Mirrors TASK_ESTIMATE_MIN / MAX. Accepted by the API; no control writes it yet. */
export const ESTIMATE_LIMITS = { min: 1, max: 20 };

/** Mirrors the `limit` bound on every list endpoint. The largest page the API will serve. */
export const PAGE_LIMIT_MAX = 100;

/** Runaway guard on the §17.3 cursor loop, not a product bound — see `fetchAllTasks`. */
export const MAX_TASK_PAGES = 50;

/**
 * A task as the API returns it (CONTRACT.md §16).
 *
 * @typedef {object} Task
 * @property {string} id
 * @property {string} title
 * @property {'todo'|'completed'|'abandoned'} status
 * @property {number|null} estimatedPomodoros
 * @property {string} createdAt ISO 8601
 * @property {string|null} completedAt ISO 8601; set iff status is 'completed'
 * @property {string} updatedAt ISO 8601
 */

function toQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Lists tasks, newest first (§16.1).
 *
 * `status` is optional and omitting it returns EVERY status, which is what hydration wants so the
 * task-outcome breakdown can count all of them. `from` is ignored by the server for `status: 'todo'`
 * — an open task is a commitment, not history, so it is never out of window.
 *
 * @param {{status?: string, from?: string, cursor?: string, limit?: number}} [params]
 * @returns {Promise<{tasks: Task[], nextCursor: string|null}>}
 */
export async function fetchTasks(params = {}) {
  return api.get(`/tasks${toQuery(params)}`);
}

/**
 * Lists every task matching `params`, following `nextCursor` to exhaustion (§17.3 rule 3).
 *
 * The backlog read has no product bound — an open task is a commitment and is never evicted (§17.2,
 * E18) — so the page cap here is a runaway guard rather than a window. Hitting it would mean an
 * account with more than 5 000 tasks, which is an N7 conversation, not a rule.
 *
 * @param {{status?: string, from?: string}} [params]
 * @param {{maxPages?: number, onPage?: (tasks: Task[]) => void}} [options]
 * @returns {Promise<{tasks: Task[], truncated: boolean}>}
 */
export async function fetchAllTasks(params = {}, options = {}) {
  const { maxPages = MAX_TASK_PAGES, onPage } = options;
  const collected = [];
  let cursor;

  for (let page = 0; page < maxPages; page += 1) {
    const { tasks, nextCursor } = await fetchTasks({ ...params, cursor, limit: PAGE_LIMIT_MAX });

    collected.push(...tasks);
    onPage?.(tasks);

    if (!nextCursor) return { tasks: collected, truncated: false };
    cursor = nextCursor;
  }

  return { tasks: collected, truncated: true };
}

/**
 * Creates a task (§16.2). Duplicate titles are allowed — two tasks called "email" on different
 * days are two tasks.
 *
 * @param {{title: string, estimatedPomodoros?: number|null}} input
 * @returns {Promise<Task>}
 */
export async function createTask(input) {
  const payload = await api.post('/tasks', input);
  return payload.task;
}

/**
 * Applies a patch (§16.3). Send only what changed.
 *
 * `completedAt` is derived by the server from `status` and is never sent: a client that could set
 * it independently could claim a task was finished at a time it was not.
 *
 * @param {string} id
 * @param {{title?: string, status?: string, estimatedPomodoros?: number|null}} patch
 * @returns {Promise<Task>}
 */
export async function updateTask(id, patch) {
  const payload = await api.patch(`/tasks/${id}`, patch);
  return payload.task;
}

/**
 * Deletes a task (§16.4).
 *
 * Its recorded sessions survive: the API nulls their task link but each keeps the title snapshot
 * taken when the work was done. Deleting a label has never been a reason to delete the work.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTask(id) {
  await api.del(`/tasks/${id}`);
}
