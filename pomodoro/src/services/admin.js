/*
 * admin.js — the one place that answers "is this account an administrator?".
 *
 * IT READS THE AUTHENTICATED USER AND NOTHING ELSE. `role` is a field on the account the store
 * already holds (`UserProfile` in services/auth.js), so there is no second auth state here, no admin
 * token flow, and no admin slice — the signed-in user is the single source of truth, and the answer
 * can therefore change only when the session does.
 *
 * Keeping the comparison in one function rather than writing `user?.role === 'admin'` at each call
 * site is what makes that true. Two call sites exist today — the route guard and the navigation's
 * link set — and they must never be able to disagree about who an admin is: a navigation that offers
 * pages the guard then refuses is worse than either component being wrong alone.
 *
 * **This predicate is a UX gate, never enforcement.** It decides what the client bothers to render.
 * Everything in this file can be edited by whoever is holding the browser, so the API must refuse a
 * non-admin on its own authority, from the bearer token, on every route it will eventually expose.
 * That backend half is deliberately not built yet.
 *
 * Standing constraints this file sits under: ADR-010 (`.claude/locked_decisions.md:64`) chose
 * ownership-as-a-query-constraint so that no roles table would exist; `role` is a column on `users`
 * rather than a reopening of that (see the ADR's supersession note, 2026-08-07). Every auth payload
 * now carries it — login, register, refresh and `/me` all serialise the same profile — and an
 * account whose payload somehow omits it reads as a normal user, which is the correct default for a
 * missing claim.
 */

/**
 * Whether the signed-in account may see the admin navigation and the admin routes.
 *
 * Absent, null, or any value other than `'admin'` is a normal user — including `undefined`, which is
 * what every account looks like until the backend ships role support. The check is deliberately an
 * exact match on a known string rather than a truthiness test, so a payload that grows some other
 * `role` value cannot promote anyone by accident.
 *
 * @param {import('./auth.js').UserProfile|null|undefined} user The signed-in account, or null.
 * @returns {boolean}
 */
export function isAdmin(user) {
  return user?.role === 'admin';
}

/** Where a normal account lands when nothing more specific was asked for. */
export const DEFAULT_LANDING_PATH = '/timer';

/** Where an administrator lands instead. */
export const ADMIN_LANDING_PATH = '/admin';

/**
 * Which page to open once a session starts and no particular destination was requested.
 *
 * An admin lands on the panel, everyone else on the Timer. It lives here beside `isAdmin` for the
 * same reason that predicate does: every path that can end in a live session — the login form, the
 * sign-up form, and `RequireGuest`, which is the one a restored session takes — must never disagree
 * about where signing in leads, and a landing rule split across those files is exactly how they
 * would drift apart.
 *
 * Provider sign-in is the one path that cannot call this, and it does not have its own copy either:
 * a Google login ends in a server-issued redirect, decided before this bundle runs. `domain/oauth.ts`
 * applies the same rule to the profile it just authenticated, and the two are written to match.
 *
 * **A REQUESTED DESTINATION ALWAYS WINS OVER THIS.** Callers pass the page the user was originally
 * headed for first and fall back to this — an admin bounced off `/history` by an expired session is
 * returned to `/history`, not diverted to the panel. This answers "where do I go when nobody said",
 * never "where does this account belong".
 *
 * It is a convenience, not a boundary. Landing an admin on `/admin` saves a click; it grants
 * nothing, because `RequireAdmin` still decides what renders and the API will decide what is served.
 *
 * @param {import('./auth.js').UserProfile|null|undefined} user The signed-in account, or null.
 * @returns {string}
 */
export function landingPathFor(user) {
  return isAdmin(user) ? ADMIN_LANDING_PATH : DEFAULT_LANDING_PATH;
}
