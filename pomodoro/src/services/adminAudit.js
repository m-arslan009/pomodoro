/*
 * adminAudit.js — reading the audit record behind /admin/audit.
 *
 * A THIRD ADMIN MODULE, FOR THE REASON THE SECOND ONE EXISTS. `services/admin.js` is the role
 * predicate and the landing rule; it imports nothing, is called by the navigation and the route guard
 * on every render, and its header spends its length defending that it has no transport dependency —
 * so the fetch below cannot go there. `services/adminUsers.js` answers questions about *accounts*;
 * this one answers questions about *what was done to them*, which is a different resource with a
 * different shape, a different filter set and a different endpoint. One file per resource is the
 * convention those two already established.
 *
 * NO SLICE, BY INSTRUCTION AND BY FIT. The feed has one reader, is a cursor-paged view rather than a
 * value, and is thrown away whenever a filter moves. A Redux entry would need its own reset,
 * staleness and page-append reducers to say what `useAdminAuditEvents` says with local state, and
 * nothing else in the app ever reads an audit event.
 *
 * THE RECORD IS READ-ONLY, AND THAT IS A PROPERTY OF THE TABLE, NOT A UI CHOICE. `admin_audit_events`
 * is append-only: `AdminAuditRepository` exposes `create` and two reads and **no** update or delete
 * (`admin_role_plan.md` §3.2), and the soft-delete pattern is deliberately not applied to it. So there
 * is no edit call and no delete call in this module to leave out — there is nothing to call.
 *
 * ⚠️ THE ENDPOINT IS SPECIFIED BUT NOT YET BUILT. §6.8 defines it down to the response body and it is
 * scheduled in phase G3 beside the write actions, but `admin-user.controller.ts` today carries only
 * the `/admin/users` routes. Everything below is written against that spec and against nothing else:
 * there is no fixture, no fallback and no client-side filtering anywhere in this file, so until the
 * route ships the page renders its own error state with a working retry — which is the honest thing
 * for a client to show when the server has not answered.
 *
 * The constants MIRROR the endpoint's validation (§6.8); the server re-validates every one of them.
 * They exist so the UI can render a control and reject a malformed id without a round trip, exactly
 * as `adminUsers.js` mirrors the role and status enums.
 */

import { api } from './api.js';

/**
 * One event as §6.8 returns it.
 *
 * `actor.id` and `target.id` are BOTH NULLABLE, and neither null means the same thing. An actor id is
 * null for the events the system wrote about itself — the CLI bootstrap and the reuse detector, which
 * have no administrator behind them. A target id is null once that account has been deleted, because
 * the foreign keys are `ON DELETE SET NULL`. The emails survive either way: they are snapshot columns
 * written at the time of the event, not a join, which is the whole reason a deletion row can still
 * say who it was about (§3.2).
 *
 * @typedef {object} AdminAuditEvent
 * @property {string} id
 * @property {string} action One of `ADMIN_AUDIT_ACTIONS` — but see `actionMeta`, which does not
 *   assume it.
 * @property {{id: string|null, email: string}} actor
 * @property {{id: string|null, email: string}} target
 * @property {Record<string, unknown>} metadata Per-action, a closed union server-side (§3.2).
 * @property {string|null} requestId Joins this row to its Pino log line and to a Problem Details
 *   `instance`.
 * @property {string|null} ip
 * @property {string|null} userAgent
 * @property {string} createdAt ISO 8601
 */

/**
 * Every action the feed can show, in the order the filter offers them.
 *
 * MIRRORS §5.2, WHICH IS THE READ SIDE'S ENUM — deliberately a longer list than
 * `backend/src/domain/admin-audit.ts` currently holds. That constant is the *write* vocabulary and is
 * pinned to a database CHECK constraint, so it names only what a service writes today;
 * `admin.bootstrap_granted` is written by the CLI script and `security.refresh_reuse_detected` by
 * `refresh-token.service.ts`, and §6.8 validates `action` against the full §5.2 set. A filter that
 * offered only the five would make the two most security-relevant events in the table unfilterable.
 *
 * `tone` is what the badge colours by, and it is a judgement about what an operator scans for, not a
 * severity ranking:
 *
 *  - `security` — the system detected something. No administrator is behind it.
 *  - `danger`   — access was taken away, or a record was destroyed.
 *  - `privilege` — someone's authority changed. The events an auditor opens the page for.
 *  - `quiet`    — routine and reversible; given no colour, so a normal week is not a wall of it.
 */
export const ADMIN_AUDIT_ACTIONS = [
  { key: 'user.disabled', label: 'Account disabled', tone: 'danger' },
  { key: 'user.reactivated', label: 'Account reactivated', tone: 'quiet' },
  { key: 'user.role_changed', label: 'Role changed', tone: 'privilege' },
  { key: 'user.sessions_revoked', label: 'Sessions revoked', tone: 'quiet' },
  { key: 'user.deleted', label: 'Account deleted', tone: 'danger' },
  { key: 'admin.bootstrap_granted', label: 'Admin bootstrap granted', tone: 'privilege' },
  { key: 'security.refresh_reuse_detected', label: 'Refresh token reuse', tone: 'security' },
];

const ACTION_META = new Map(ADMIN_AUDIT_ACTIONS.map((action) => [action.key, action]));

/**
 * How to label and tone one action value.
 *
 * AN UNKNOWN ACTION IS RENDERED, NEVER DROPPED. The write vocabulary is closed today but it is closed
 * by a CHECK constraint that a later migration can widen, and this bundle can be months older than
 * the API it is talking to. An event the UI has no label for still happened, and showing it as
 * readable text ("user unlocked") is a true statement, where hiding it would make the trail look
 * complete when it is not — the exact failure §3.2 says an audit surface may never produce.
 *
 * ITS TONE COMES FROM ITS NAMESPACE, WHICH IS THE ONE THING WE CAN STILL READ. Every action name in
 * §5.2 is `namespace.verb`, and the namespace is the part that says how much it matters — so a
 * `security.*` action this bundle has never heard of is still toned as a security event rather than
 * being dropped into the quiet pile. Getting that wrong is asymmetric: an unrecognised security event
 * rendered as routine is exactly the row an operator scrolls past.
 *
 * @param {string} action
 * @returns {{key: string, label: string, tone: string}}
 */
const TONE_BY_NAMESPACE = { security: 'security', admin: 'privilege' };

export function actionMeta(action) {
  const known = ACTION_META.get(action);
  if (known) return known;

  const raw = String(action ?? '');
  const [namespace] = raw.split('.');
  const text = raw
    .replace(/^[a-z]+\./, '')
    .replace(/[._]/g, ' ')
    .trim();

  return {
    key: raw,
    label: text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown action',
    tone: TONE_BY_NAMESPACE[namespace] ?? 'quiet',
  };
}

/**
 * How many events one page asks for.
 *
 * The endpoint's own default (§6.8), and larger than the directory's 25 because the two lists are
 * read differently: an account search is satisfied by the row you were looking for, while an audit
 * review is a scan down a timeline where every *Load more* is an interruption. Still well inside the
 * cap of 100.
 */
export const ADMIN_AUDIT_PAGE_LIMIT = 50;

/**
 * Whether a string is a syntactically valid uuid, which is what §6.8 requires of both id filters.
 *
 * Checked here so a half-typed id is simply not sent, rather than being sent and answered with a 422
 * the operator has to interpret mid-keystroke. It is a *syntax* check and nothing more — whether the
 * account exists is the server's to answer, and a well-formed id for a user who never existed
 * correctly returns an empty feed rather than an error.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

/**
 * The exact string an id filter sends for what was typed.
 *
 * Lowercased as well as trimmed: uuids are hex and case-insensitive, and an id pasted from a console
 * in upper case must produce the same criteria key — and therefore reuse the same results — as the
 * same id pasted from a URL in lower case.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUserId(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * A `YYYY-MM-DD` value from a date input, as the ISO instant that bounds that day.
 *
 * THE OPERATOR'S DAY, NOT UTC'S. A date input yields a calendar date with no time and no zone, and an
 * auditor who asks for "the 6th" means the 6th where they are sitting. So the bounds are built from
 * the local components — midnight local for the start, the last millisecond local for the end — and
 * `toISOString` converts to the instant the API compares against. Treating the string as UTC instead
 * would silently shift the window by the reader's offset and drop events at both edges, which on an
 * audit page reads as evidence that is not there.
 *
 * `endOfDay` is what makes the range INCLUSIVE of its last day. Without it "6th to 6th" is an empty
 * window rather than that whole day, and every range would quietly exclude its final date.
 *
 * @param {string} value `YYYY-MM-DD`, or empty.
 * @param {{endOfDay?: boolean}} [options]
 * @returns {string} The ISO instant, or '' when the value is absent or unparseable.
 */
export function dayBoundaryToIso(value, { endOfDay = false } = {}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return '';

  const [, year, month, day] = match;
  const date = endOfDay
    ? new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
    : new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);

  /*
   * A date input cannot normally produce an impossible date, but the value is still a string a user
   * can put anything into — `2026-02-31` rolls over to March in the Date constructor rather than
   * failing, so the components are compared back to confirm the date the operator named is the date
   * being sent.
   */
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(day)) return '';
  return date.toISOString();
}

/**
 * One page of the audit record (`GET /admin/audit-events`, §6.8).
 *
 * CURSOR ONLY — the cursor is on `(created_at, id)` DESC and there is no total and no page number, so
 * the caller's whole job is to carry `nextCursor` forward and stop when it comes back null. A null
 * `nextCursor` is the end of the record, not a missing field.
 *
 * Empty and absent parameters are dropped rather than sent blank: `?action=` is a value the endpoint
 * would have to validate and reject, while sending nothing means "no filter". Same idiom as
 * `fetchAdminUsers`.
 *
 * @param {{targetUserId?: string, actorUserId?: string, action?: string, from?: string, to?: string,
 *   cursor?: string, limit?: number}} [params]
 * @returns {Promise<{events: AdminAuditEvent[], nextCursor: string|null}>}
 */
export async function fetchAdminAuditEvents(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  const payload = await api.get(`/admin/audit-events${query ? `?${query}` : ''}`);

  /*
   * Read defensively, exactly as the directory read does. A page that ran `undefined.map` on an
   * unexpected body would report a client crash for what is really a server problem, and this
   * caller's error state exists to say so properly.
   */
  return {
    events: Array.isArray(payload?.events) ? payload.events : [],
    nextCursor: payload?.nextCursor ?? null,
  };
}
