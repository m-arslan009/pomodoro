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
 * ⚠️ THE ENDPOINT IS NOT BUILT YET. `CONTRACT.md` §2.4 states plainly that there is no `AdminGuard`,
 * no admin route and no `/api/v1/admin` namespace — `role` is currently the display half of the
 * admin role and nothing more. This module is written against `admin_role_plan.md` §6.1, which is
 * the specification the backend will implement, and the page renders the API's own failure until it
 * does. Nothing here is a stand-in for the server: there is no fixture, no fallback list and no
 * client-side filtering, so the day the route ships the page starts working with no change to it.
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
