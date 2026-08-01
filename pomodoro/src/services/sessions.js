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

/** Mirrors the `limit` bound on every list endpoint (§15). The largest page the API will serve. */
export const PAGE_LIMIT_MAX = 100;

/**
 * The §17.2 record cap, expressed in pages: 5 000 / 100.
 *
 * Derived, not chosen — if the storage bound moves, this moves with it and nothing else changes.
 * Reaching it is not an error; it is the IndexedDB (N7) trigger, and it is reported so the banner
 * can tell the user their view is bounded. A chart that is quietly incomplete is the defect this
 * whole phase exists to remove.
 */
export const MAX_HYDRATION_PAGES = 50;

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
 * Reads the whole window, following `nextCursor` to exhaustion (§17.3 rule 3).
 *
 * `limit` caps a PAGE; §17.2's 180 days and 5 000 records cap the WINDOW. Issuing one request and
 * leaving `nextCursor` unread silently replaces the second bound with the first, which is how
 * History came to render at most 100 sessions against a 3 600-record budget — the 7-day prune that
 * T1 deleted, re-implemented as a page size (defect F12).
 *
 * `onPage` is called with each page as it lands so the caller can adopt records progressively. At
 * full volume this loop is ~36 sequential round trips, and the user must see the charts filling in
 * rather than a spinner holding a complete answer hostage.
 *
 * @param {{from?: string, to?: string}} [params]
 * @param {{maxPages?: number, onPage?: (sessions: Session[]) => void}} [options]
 * @returns {Promise<{sessions: Session[], truncated: boolean}>} `truncated` when the cap stopped it
 */
export async function fetchAllSessions(params = {}, options = {}) {
  const { maxPages = MAX_HYDRATION_PAGES, onPage } = options;
  const collected = [];
  let cursor;

  for (let page = 0; page < maxPages; page += 1) {
    const { sessions, nextCursor } = await fetchSessions({
      ...params,
      cursor,
      limit: PAGE_LIMIT_MAX,
    });

    collected.push(...sessions);
    onPage?.(sessions);

    if (!nextCursor) return { sessions: collected, truncated: false };
    cursor = nextCursor;
  }

  return { sessions: collected, truncated: true };
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
