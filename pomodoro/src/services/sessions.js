/*
 * sessions.js — recording finished intervals and reading history back.
 *
 * Knows only how to talk to the API; state lives in store/timerSlice.js.
 *
 * THE CLIENT COMPUTES NOTHING. `recordSession` sends what happened and returns what the server
 * decided it was worth. There is no scoring function anywhere in the frontend any more — points
 * drive titles and titles unlock features, so a client that scored itself could award itself the
 * product (CONTRACT.md §14.3 rule 1).
 */

import { api } from './api.js';

/** Mirrors HYDRATION_WINDOW_DAYS. Exactly the span History's widest chart can render. */
export const HYDRATION_WINDOW_DAYS = 180;

/** Mirrors TERMINATION_REASONS. Required on a terminated focus block, forbidden otherwise. */
export const TERMINATION_REASONS = [
  'interrupted',
  'wrong_task',
  'finished_early',
  'out_of_energy',
];

/**
 * The canonical session record (CONTRACT.md §14.1).
 *
 * @typedef {object} Session
 * @property {string} clientSessionId The client's primary key, minted when the block started.
 * @property {string|null} id Server id; null until synced.
 * @property {string|null} taskId
 * @property {string} taskTitle Snapshot — survives renaming and deleting the task.
 * @property {'focus'|'break'} type
 * @property {'completed'|'terminated'} status
 * @property {string} startedAt ISO 8601
 * @property {string} endedAt ISO 8601
 * @property {number} plannedDurationMs
 * @property {number} actualDurationMs Server-clamped once synced.
 * @property {string|null} terminationReason
 * @property {number|null} pointsAwarded Null until synced — never render it as 0.
 * @property {'pending'|'synced'|'rejected'} syncState Client-only; never sent.
 */

/** The fields the API accepts. `syncState` and `id` are ours and are stripped before sending. */
function toRequest(session) {
  return {
    clientSessionId: session.clientSessionId,
    taskId: session.taskId,
    taskTitle: session.taskTitle,
    type: session.type,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    plannedDurationMs: session.plannedDurationMs,
    actualDurationMs: session.actualDurationMs,
    terminationReason: session.terminationReason,
  };
}

/**
 * Records a finished interval (§16.5) and returns the stored record with recomputed totals.
 *
 * One round trip for both, deliberately: a session never costs two requests, and the record and
 * the totals can never disagree with each other.
 *
 * A repeated `clientSessionId` answers 200 with the original record instead of 201 — a retried
 * flush is success, not an error — so callers need no special case for it.
 *
 * @param {Session} session
 * @returns {Promise<{session: Session, gamification: object}>}
 */
export async function recordSession(session) {
  const payload = await api.post('/sessions', toRequest(session));
  return { session: payload.session, gamification: payload.gamification };
}

/**
 * Reads history (§16.6). `from` defaults server-side to 180 days back.
 *
 * This is the ONLY read History needs: the client aggregates these records itself, so summaries,
 * timelines and outcome breakdowns cost no further requests and cannot drift from the log.
 *
 * @param {{from?: string, to?: string, cursor?: string, limit?: number}} [params]
 * @returns {Promise<{sessions: Session[], nextCursor: string|null}>}
 */
export async function fetchSessions(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return api.get(`/sessions${query ? `?${query}` : ''}`);
}

/**
 * Reads progression (§16.7).
 *
 * Needed only at sign-in, to seed totals before any session has been recorded in this browser —
 * every recording already returns the updated object.
 *
 * @returns {Promise<object>}
 */
export async function fetchGamification() {
  const payload = await api.get('/gamification');
  return payload.gamification;
}
