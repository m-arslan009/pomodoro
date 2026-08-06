/*
 * reports.js — the account's periodic email report subscription.
 *
 * Split from settings.js the same way settings.js is split from profile.js: `/me/reports` needs a
 * session but is not a preference in the `user_settings` sense, and it returns its own payload
 * (CONTRACT.md §25.1). Two of the four calls below need no session at all — they are opened from
 * an email, on a device that may never have signed in.
 *
 * Like every other service module this one only knows how to talk to the API. There is no slice:
 * the subscription is read by exactly two surfaces that are never mounted at the same time, so a
 * shared store entry would be state without a second reader.
 *
 * The constants below MIRROR backend/src/domain/report.ts. They are not the authority — the server
 * re-validates every value — they exist so the UI can render a control without a round trip.
 */

import { api } from './api.js';

/**
 * The three answers, in the order every surface offers them. `none` is a real answer that gets
 * stored, not the absence of one: CONTRACT.md §23.0 consequence 3 turns on being able to tell
 * "asked, said no" (`declined`) apart from "never asked" (`unasked`), and only a stored `none`
 * makes that distinction exist.
 */
export const REPORT_FREQUENCIES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'none', label: 'No email reports' },
];

/**
 * What an account that has never answered gets (§25.1).
 *
 * `status: 'unasked'` is a real value the endpoint returns, not a client-side stand-in for a 404 —
 * a 404 here would mean "no such user". It is what the one-time invitation renders on.
 *
 * @typedef {object} ReportSubscription
 * @property {'unasked'|'pending_confirmation'|'active'|'paused'|'declined'|'unsubscribed'|'bounced'} status
 *   The documented enum is §23.1's five, plus the synthetic `unasked`. `unsubscribed` is accepted
 *   as a synonym for `declined` — §25.4 turns an unsubscribe into `declined`, so it should never
 *   arrive, but a status the UI cannot name would render a card with nothing selected and nothing
 *   explaining why. See the contract question in `CONTRACT.md` §23.1.
 * @property {'weekly'|'monthly'|null} frequency
 * @property {number|null} deliveryDay 1 = Monday … 7 = Sunday. Weekly only.
 * @property {string|null} confirmedAt ISO 8601; null until the address has been confirmed.
 * @property {boolean} requiresConfirmation True when a confirmation email is outstanding.
 */

/** @type {ReportSubscription} */
export const UNASKED_SUBSCRIPTION = {
  status: 'unasked',
  frequency: null,
  deliveryDay: null,
  confirmedAt: null,
  requiresConfirmation: false,
};

/**
 * Reads the caller's subscription (§25.1).
 *
 * **A missing row is not a failure, and this function refuses to let it become one.** §25.1 says
 * the endpoint answers the `unasked` shape rather than 404ing, so in principle the mapping below is
 * unreachable — but "has no subscription row" is the normal state of every account that never
 * answered, and it is the *only* state a Google-created account can be in, because the OAuth
 * callback has no form to answer (§23.0 consequence 2). A client that renders "we could not load
 * your preference" at those users is telling them something broke when nothing did.
 *
 * So a 404 is read as "never asked". Every other failure — offline, 500, an expired session —
 * propagates, because those genuinely are failures and the caller must be able to say so.
 *
 * @returns {Promise<ReportSubscription>}
 */
export async function fetchReportSubscription() {
  try {
    return await api.get('/me/reports');
  } catch (error) {
    if (error?.status === 404) return UNASKED_SUBSCRIPTION;
    throw error;
  }
}

/**
 * Sets the frequency, or declines (§25.2).
 *
 * The server decides what happens next and says so in the response, which is why callers adopt it
 * wholesale rather than assuming: a verified address goes straight to `active`, an unverified one
 * to `pending_confirmation` with `requiresConfirmation: true` and a confirmation email on its way
 * (CONTRACT.md §23.0 L3). Both are a 200, because neither is a failure.
 *
 * @param {'weekly'|'monthly'|'none'} frequency
 * @returns {Promise<ReportSubscription>}
 */
export async function updateReportFrequency(frequency) {
  return api.put('/me/reports', { frequency });
}

/**
 * Confirms the address a report was requested for (§25.3). **Needs no session.**
 *
 * An unknown, expired, or already-consumed token is a 200 carrying `status: 'invalid'`, not a 404 —
 * answering "no such token" would let anyone probe which tokens exist. So callers branch on the
 * returned status, and a rejected promise here means the request itself failed.
 *
 * @param {string} token
 * @returns {Promise<ReportSubscription | {status: 'invalid'}>}
 */
export async function confirmReports(token) {
  return api.post('/reports/confirm', { token });
}

/**
 * Turns reports off from a link in an email (§25.4). **Needs no session.**
 *
 * Idempotent by contract: the unsubscribe token does not expire, and a second click answers 200
 * exactly like the first. A link in a year-old email that errored would be a link that lied.
 *
 * @param {string} token
 * @returns {Promise<ReportSubscription | {status: 'invalid'}>}
 */
export async function unsubscribeFromReports(token) {
  return api.post('/reports/unsubscribe', { token });
}
