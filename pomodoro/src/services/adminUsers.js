/*
 * adminUsers.js — reading the account directory behind /admin.
 *
 * SEPARATE FROM services/admin.js ON PURPOSE. That module is the role predicate and the landing
 * rule; it imports nothing and answers a question about the *signed-in* account. This one talks to
 * the API and answers questions about *other* accounts. Folding the two together would give the
 * predicate — which the navigation and the route guard both call on every render — a transitive
 * dependency on services/api.js for no reason, and would blur the one boundary that file's header
 * spends its length defending.
 *
 * NO SLICE, BY INSTRUCTION AND BY FIT. The directory is read by one surface, is a paged view rather
 * than a value, and is reset wholesale whenever the operator changes a filter — there is no second
 * reader for a store entry to serve, and a cursor-paged list in Redux would need its own reset,
 * staleness and page-append reducers to say what `useAdminUsers` says with local state.
 *
 * The constants below MIRROR the endpoint's validation (`admin_role_plan.md` §6.1); the server
 * re-validates every one of them. They exist so the UI can render a control and bound an input
 * without a round trip, exactly as `reports.js` mirrors the frequency enum.
 *
 * EVERY ENDPOINT BELOW IS BUILT (`CONTRACT.md` §31): the guard, the namespace, the list, the detail
 * read, and the five writes — each of which commits an `admin_audit_events` row inside the same
 * transaction as its state change, which is the precondition the design placed on any administrative
 * write existing at all. There is still no fixture, no fallback and no client-side filtering
 * anywhere in this file: what the API says is what the page shows, including when the API says no.
 *
 * THE ALLOW-LIST IS THE SERVER'S, AND THE DENY-LIST IS THE POINT. §6.2 excludes `password_hash`,
 * session token hashes, refresh tokens and cookies, `provider_subject`, `email_at_link`, report
 * token hashes, OAuth secrets, and **any task or focus-session row content** — counts and totals,
 * never records. This module asks for no other shape and the callers render named fields rather
 * than iterating whatever arrived, so a server that one day over-shares cannot leak through here by
 * accident.
 */

import { api } from './api.js';

/**
 * One account as the list returns it (`admin_role_plan.md` §6.1, `AdminUserSummary`).
 *
 * The allow-list is the API's, not ours — no credential material, no `provider_subject`, no hash. It
 * is repeated here only so callers know which fields exist; a field the server stops sending simply
 * arrives undefined and the card renders without it.
 *
 * @typedef {object} AdminUserSummary
 * @property {string} id
 * @property {string} email
 * @property {string} username
 * @property {string|null} firstName
 * @property {string|null} lastName
 * @property {'user'|'admin'} role
 * @property {'active'|'disabled'} status Derived server-side from `disabledAt`.
 * @property {boolean} emailVerified
 * @property {string} createdAt ISO 8601
 * @property {string|null} disabledAt ISO 8601, or null while the account is active.
 */

/**
 * One account as the detail view returns it (§6.2, `AdminUserDetail`).
 *
 * Everything in the summary, plus the facts an operator needs to decide whether to disable, revoke
 * or promote. `passwordChangedAt` is *when*, never *what*; `hasPassword` is a boolean, never a
 * hash; `identities` carry a provider and two timestamps and never `provider_subject`; and the
 * gamification, count and report groups are totals over rows whose contents no admin route returns.
 *
 * @typedef {AdminUserSummary & {
 *   timezone: string,
 *   avatarUpdatedAt: string|null,
 *   passwordChangedAt: string|null,
 *   hasPassword: boolean,
 *   identities: {provider: string, linkedAt: string|null, lastLoginAt: string|null}[],
 *   sessions: {activeCount: number, lastSeenAt: string|null},
 *   gamification: {lifetimePoints: number, balance: number, currentDayStreak: number,
 *                  longestDayStreak: number, streakFreezesAvailable: number,
 *                  unlockedTitles: string[]},
 *   counts: {tasks: number, focusSessions: number},
 *   reports: {status: string, frequency: string|null, lastDeliveryStatus: string|null,
 *             lastDeliveryAt: string|null}
 * }} AdminUserDetail
 */

/** The role filter's values, in the order the control offers them. */
export const ADMIN_USER_ROLES = [
  { key: 'user', label: 'User' },
  { key: 'admin', label: 'Admin' },
];

/** The status filter's values. `disabled` is derived from `disabled_at`, not stored as a string. */
export const ADMIN_USER_STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'disabled', label: 'Disabled' },
];

/**
 * How many accounts one page asks for.
 *
 * Well under the endpoint's cap of 100 because this list is read, not scanned: a *Load more* the
 * operator never needs to press is a page size that was already too large, and a first paint that
 * waits on 100 rows is slower for the search that matched three of them.
 */
export const ADMIN_USERS_PAGE_LIMIT = 25;

/** The `q` bound (§6.1). Matches the longest address the API will accept. */
export const ADMIN_SEARCH_MAX_LENGTH = 320;

/**
 * The disable reason's bounds (§6.4), mirrored so the form can bound its own field.
 *
 * The reason is REQUIRED and the server re-validates it: an unexplained disable is an audit row
 * that answers who and when but not why. Checking it here means the operator learns the field is
 * too short while they are still in it, rather than through a 422 after the round trip.
 */
export const DISABLE_REASON_MIN_LENGTH = 3;
export const DISABLE_REASON_MAX_LENGTH = 280;

/**
 * The exact string a disable request sends for what was typed.
 *
 * Trimmed and bounded the way §6.4 trims and bounds, for the same reason `normalizeAdminUserSearch`
 * is: a value that differs from the server's reading of it makes "why was this rejected"
 * unanswerable.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDisableReason(value) {
  return typeof value === 'string' ? value.trim().slice(0, DISABLE_REASON_MAX_LENGTH) : '';
}

/**
 * The exact string the search sends for what was typed.
 *
 * Trimmed because §6.1 trims, and bounded because §6.1 bounds — a query that differs from the
 * server's own reading of it would make "why did this return nothing" unanswerable. Empty means
 * *no `q` at all*, not a search for the empty string, which is why the caller drops it below.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAdminUserSearch(value) {
  return typeof value === 'string' ? value.trim().slice(0, ADMIN_SEARCH_MAX_LENGTH) : '';
}

/**
 * One page of the directory (`GET /admin/users`, §6.1).
 *
 * CURSOR ONLY — there is no page number and no total, by design. Sort is fixed `created_at DESC`
 * server-side and is not client-selectable, so the caller's whole job is to carry `nextCursor`
 * forward and stop when it comes back null. A null `nextCursor` is the end of the results, not a
 * missing field.
 *
 * Empty and absent parameters are dropped rather than sent blank: `?role=` is a value the endpoint
 * would have to validate and reject, while sending nothing means "no filter". Same idiom as
 * `fetchSessions`.
 *
 * @param {{q?: string, role?: string, status?: string, cursor?: string, limit?: number}} [params]
 * @returns {Promise<{users: AdminUserSummary[], nextCursor: string|null}>}
 */
export async function fetchAdminUsers(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  const payload = await api.get(`/admin/users${query ? `?${query}` : ''}`);

  /*
   * Read defensively. A page that renders `undefined.map` on an unexpected body would report a
   * client crash for what is really a server problem, and this caller's error state exists to say
   * so properly.
   */
  return {
    users: Array.isArray(payload?.users) ? payload.users : [],
    nextCursor: payload?.nextCursor ?? null,
  };
}

/* ------------------------------------------------------------ One account -- */

/**
 * The account out of a `{ user }` envelope, which is what §6.2 and every write below answer with.
 *
 * A 200 carrying no account is a server fault, not an empty result, so it becomes an error rather
 * than a null the callers would each have to re-check. It is deliberately NOT an `ApiError`: those
 * carry an HTTP status the caller branches on, and inventing one here would make an unreadable body
 * indistinguishable from a status the server actually sent.
 *
 * @param {unknown} payload
 * @returns {AdminUserDetail}
 */
function readUser(payload) {
  const user = payload && typeof payload === 'object' ? payload.user : null;
  if (!user || typeof user !== 'object') {
    throw new Error('The server returned an account we could not read.');
  }
  return user;
}

/** The path prefix for one account. Encoded because a route parameter is user input. */
function userPath(id) {
  return `/admin/users/${encodeURIComponent(id)}`;
}

/**
 * One account's detail (`GET /admin/users/:id`, §6.2).
 *
 * A 404 here is genuinely ambiguous and callers must treat it as such: §4.2 makes the whole admin
 * namespace answer 404 to a non-admin, so it means either "no such account" or "this namespace does
 * not exist for you". Both are "there is nothing to show", which is the only thing the page can
 * honestly say.
 *
 * @param {string} id
 * @returns {Promise<AdminUserDetail>}
 */
export async function fetchAdminUser(id) {
  return readUser(await api.get(userPath(id)));
}

/**
 * Blocks an account immediately (`POST /admin/users/:id/disable`, §6.4).
 *
 * One transaction server-side: `disabled_at` is set, EVERY session is revoked, and the audit row is
 * written. The response is the account's new detail, and the caller re-renders from it rather than
 * from an optimistic guess — which is the whole reason this returns a user instead of a boolean.
 *
 * 409 on self-target (rule 2) or on the last remaining admin (rule 3); 422 on a missing or
 * too-short reason. Idempotent on an already-disabled account.
 *
 * @param {string} id
 * @param {string} reason Required, 3–280 characters after trimming.
 * @returns {Promise<AdminUserDetail>}
 */
export async function disableAdminUser(id, reason) {
  return readUser(
    await api.post(`${userPath(id)}/disable`, { reason: normalizeDisableReason(reason) })
  );
}

/**
 * Restores the ability to sign in (`POST /admin/users/:id/reactivate`, §6.5).
 *
 * SESSIONS STAY REVOKED — reactivation gives back sign-in, not the sessions that existed before,
 * and both password and Google sign-in work unchanged because neither credential was touched.
 * Idempotent on an active account.
 *
 * @param {string} id
 * @returns {Promise<AdminUserDetail>}
 */
export async function reactivateAdminUser(id) {
  return readUser(await api.post(`${userPath(id)}/reactivate`));
}

/**
 * Cuts every refresh session without touching the account (`DELETE /admin/users/:id/sessions`, §6.6).
 *
 * ANSWERS A COUNT, NOT A USER — it is the one action whose response cannot re-render the page, so
 * the caller has to read the account again to show the new session summary.
 *
 * What it does and does not do has to reach the operator, not just this comment: it revokes the
 * refresh half, so the account must sign in again, but an access token already issued keeps working
 * until it expires because `JwtGuard` does not read `auth_sessions`. Disabling is the control that
 * acts immediately. 409 on self-target — an admin cutting their own sessions signs out instead.
 *
 * @param {string} id
 * @returns {Promise<{revoked: number}>}
 */
export async function revokeAdminUserSessions(id) {
  const payload = await api.del(`${userPath(id)}/sessions`);
  const revoked = Number(payload?.revoked);
  return { revoked: Number.isFinite(revoked) && revoked >= 0 ? revoked : 0 };
}

/**
 * The only write path to `users.role` in the product (`PATCH /admin/users/:id/role`, §6.7).
 *
 * A demotion does not revoke sessions: the account stays signed in as an ordinary user, and because
 * the role is read per request rather than from a token claim the change is effective on their very
 * next call. 409 on self-target (rule 1) or on the last remaining admin (rule 3); promotion also
 * requires the target to be active and to hold at least one credential. Idempotent to the role the
 * account already has.
 *
 * @param {string} id
 * @param {'user'|'admin'} role
 * @returns {Promise<AdminUserDetail>}
 */
export async function changeAdminUserRole(id, role) {
  return readUser(await api.patch(`${userPath(id)}/role`, { role }));
}

/**
 * Permanently deletes an account (`DELETE /admin/users/:id`, §6.9).
 *
 * ⚠️ IRREVERSIBLE, AND THE LAST ROUTE OF THE SET TO EXIST — §6.9 keeps it deferred behind its own
 * approval precisely because a destructive action needs its own specification. It cascades across
 * sessions, identities, avatars, settings, tasks, focus sessions, gamification and report
 * subscriptions; the audit rows survive, by `SET NULL` plus the email snapshots.
 *
 * `confirmEmail` IS VERIFIED BY THE SERVER. The typed confirmation in the dialog is a second guard
 * on the same fact, not the only one — a client-side check protects nobody against a request that
 * never went through the client. 409 on self-target and on the last admin.
 *
 * @param {string} id
 * @param {string} confirmEmail The account's exact address.
 * @returns {Promise<{counts: {tasks?: number, focusSessions?: number}}>}
 */
export async function deleteAdminUser(id, confirmEmail) {
  const payload = await api.del(userPath(id), { confirmEmail });
  const deleted = payload && typeof payload === 'object' ? payload.deleted : null;
  return { counts: (deleted && typeof deleted === 'object' && deleted.counts) || {} };
}
