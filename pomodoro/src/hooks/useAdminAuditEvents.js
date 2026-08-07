import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_AUDIT_PAGE_LIMIT,
  dayBoundaryToIso,
  fetchAdminAuditEvents,
  isUuid,
  normalizeUserId,
} from '../services/adminAudit.js';

/*
 * useAdminAuditEvents — the cursor-paged audit read behind /admin/audit, as one hook.
 *
 * THE SAME SHAPE AS `useAdminUsers`, ON PURPOSE. Both surfaces are a filtered, cursor-paged read of
 * an unscoped admin list, and the four things that make one correct — debounce what is typed, reset
 * on any criteria change, append on *Load more*, drop superseded answers — are the same four here.
 * Writing them differently would mean two paging bugs to find instead of one. What differs is the
 * criteria set and one genuinely new job, described next.
 *
 * IT VALIDATES BEFORE IT FETCHES, WHICH THE DIRECTORY HOOK HAS NO NEED TO. Three of these five
 * filters can hold a value the endpoint will refuse: §6.8 requires both ids to be uuids and requires
 * `from <= to`. A half-typed id is not a search that returns nothing, it is a 422 — so criteria that
 * cannot be served are not sent at all, and the page is told *which* control is wrong so it can say
 * so beside that control. This is the one place where "no results" and "that is not a valid filter"
 * are told apart, and conflating them would leave an operator reading an empty audit page as though
 * it were evidence that nothing happened.
 *
 * THE IDS ARE DEBOUNCED, THE ACTION AND THE DATES ARE NOT. A uuid is 36 characters of typing (or a
 * paste that lands one character at a time under some input methods) and the operator is mid-thought;
 * choosing an action or picking a date is a finished decision, and a wait after it just looks broken.
 *
 * ANY CRITERIA CHANGE RESTARTS FROM PAGE ONE. Cursors are opaque and are only meaningful for the
 * query that produced them (§6.8), so carrying one across a filter change would page through the
 * *old* result set. Events, cursor and both error slots therefore travel as ONE state object rather
 * than as six `useState` calls — that is what makes "they reset together" a property of the shape
 * instead of six clears somebody has to remember to keep in step.
 *
 * STALENESS IS HANDLED BY SEQUENCE, NOT BY ABORT. `services/api.js` owns fetch and takes no signal,
 * so every request carries the id it was issued under and a late answer whose id has been superseded
 * is dropped. That also keeps StrictMode's deliberate double-invoke in development from appending the
 * first page twice.
 *
 * THE RESET IS DERIVED, NOT DISPATCHED. Held results are stamped with the criteria they were fetched
 * for, and a render whose stamp does not match reads as the empty loading state — so changing a
 * filter shows the loading state in the *same* render that changed it. Clearing from inside the
 * effect would paint one frame of the previous results under the new filter and then re-render, which
 * is both a visible lie and the cascading render the lint rule exists to catch.
 */

/** How long typing an id has to settle before it becomes a request. */
export const ADMIN_AUDIT_DEBOUNCE_MS = 350;

/**
 * The resting state, and the exact shape a reset returns to.
 *
 * `loading: true` because valid criteria always issue a read: starting at false would paint the empty
 * state for one frame before the first request even leaves.
 */
const INITIAL = {
  /** @type {import('../services/adminAudit.js').AdminAuditEvent[]} */
  events: [],
  /** @type {string|null} */
  nextCursor: null,
  loading: true,
  loadingMore: false,
  /** @type {Error|null} The first page failed — there is nothing on screen. */
  error: null,
  /** @type {Error|null} A later page failed — what is on screen is still valid. */
  loadMoreError: null,
};

/**
 * What the page shows while a filter is invalid: no rows, and explicitly NOT loading.
 *
 * Distinct from `INITIAL` because a spinner here would promise an answer that was never requested.
 */
const IDLE = { ...INITIAL, loading: false };

/**
 * @param {{action?: string, actorUserId?: string, targetUserId?: string, from?: string, to?: string}}
 *   [controls] Raw control values; empty string means "no filter" for each. `from` and `to` are
 *   `YYYY-MM-DD` as a date input produces them — the conversion to the ISO instants §6.8 wants is
 *   this hook's job, so the page never has to think in timezones.
 */
function useAdminAuditEvents({
  action = '',
  actorUserId = '',
  targetUserId = '',
  from = '',
  to = '',
} = {}) {
  /*
   * What was typed, reduced to what would actually be sent. Comparing the normalized forms is what
   * makes trailing whitespace and a pasted upper-case id non-events: they are the same filter, and
   * neither should throw away the results already showing for it.
   */
  const typedActor = normalizeUserId(actorUserId);
  const typedTarget = normalizeUserId(targetUserId);
  const [appliedIds, setAppliedIds] = useState({ actor: typedActor, target: typedTarget });

  useEffect(() => {
    if (appliedIds.actor === typedActor && appliedIds.target === typedTarget) return undefined;
    const timer = setTimeout(
      () => setAppliedIds({ actor: typedActor, target: typedTarget }),
      ADMIN_AUDIT_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [typedActor, typedTarget, appliedIds]);

  /*
   * Validity is judged on what was TYPED, not on what has been applied, so a filter that has just
   * become malformed stops the feed in the same render rather than after the debounce. The empty
   * string is always valid — it means "no filter", which is not the same as a filter that is wrong.
   */
  const invalidActorId = typedActor !== '' && !isUuid(typedActor);
  const invalidTargetId = typedTarget !== '' && !isUuid(typedTarget);

  const fromIso = dayBoundaryToIso(from);
  const toIso = dayBoundaryToIso(to, { endOfDay: true });
  const invalidRange = fromIso !== '' && toIso !== '' && Date.parse(fromIso) > Date.parse(toIso);

  const enabled = !invalidActorId && !invalidTargetId && !invalidRange;

  /* The held result, stamped with the criteria key it was fetched under. */
  const [result, setResult] = useState({ key: null, ...INITIAL });

  /* Bumped by `retry`, and part of the key, so a failed read can be reissued unchanged. */
  const [reloadToken, setReloadToken] = useState(0);

  /* The id of the most recently issued *first-page* read. See the staleness note above. */
  const requestId = useRef(0);

  /*
   * The criteria the results belong to. Memoized so its identity changes exactly when one of the five
   * values does — it is the refetch trigger below, and an object rebuilt every render would reload
   * the feed on every keystroke, which is the one thing the debounce exists to stop.
   *
   * The applied ids are used here, the typed ones above: a request is issued for what has settled,
   * while the validity that gates it is judged on what is on screen right now.
   */
  const criteria = useMemo(
    () => ({
      action,
      actorUserId: appliedIds.actor,
      targetUserId: appliedIds.target,
      from: fromIso,
      to: toIso,
    }),
    [action, appliedIds, fromIso, toIso]
  );

  /*
   * The same criteria as a comparable value. A NUL separator rather than a delimiter any of these
   * values could contain.
   */
  const criteriaKey = [
    action,
    appliedIds.actor,
    appliedIds.target,
    fromIso,
    toIso,
    reloadToken,
  ].join('\u0000');

  /*
   * THE RESET. A result stamped for other criteria is not this render's result, so the render falls
   * back to the resting state without anything having to clear it — and invalid criteria fall back to
   * the idle state instead, which is the same emptiness without the promise of an answer.
   */
  let state = IDLE;
  if (enabled) state = result.key === criteriaKey ? result : INITIAL;

  useEffect(() => {
    /*
     * Bumped even when nothing is about to be sent. Invalidating a filter must discard the read that
     * is already in flight for the previous one, or its rows would land under criteria that can no
     * longer be served.
     */
    const id = requestId.current + 1;
    requestId.current = id;

    if (!enabled) return;

    fetchAdminAuditEvents({ ...criteria, limit: ADMIN_AUDIT_PAGE_LIMIT }).then(
      ({ events, nextCursor }) => {
        if (requestId.current !== id) return;
        setResult({ key: criteriaKey, ...INITIAL, events, nextCursor, loading: false });
      },
      (error) => {
        if (requestId.current !== id) return;
        setResult({ key: criteriaKey, ...INITIAL, loading: false, error });
      }
    );
  }, [criteria, criteriaKey, enabled]);

  const { nextCursor, loading, loadingMore } = state;

  /**
   * Appends the next page. Re-pressing after a failure retries the same cursor, which is why the
   * cursor is not cleared when a page fails — losing it would strand the operator halfway down the
   * record with no way to continue.
   */
  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) return;

    /*
     * Captured, not bumped: this page belongs to the criteria already on screen, so it must be
     * discarded by the *next* reset rather than counting as one itself. Every update below is a
     * no-op unless the held stamp still matches, so a page that lands after a filter moved cannot be
     * merged into the new feed's results.
     */
    const id = requestId.current;
    const merge = (update) =>
      setResult((current) => (current.key === criteriaKey ? update(current) : current));

    merge((current) => ({ ...current, loadingMore: true, loadMoreError: null }));

    fetchAdminAuditEvents({ ...criteria, cursor: nextCursor, limit: ADMIN_AUDIT_PAGE_LIMIT }).then(
      (page) => {
        if (requestId.current !== id) return;
        merge((current) => {
          /*
           * Cursor pagination promises no duplicates (§6.8) — this only makes a broken promise
           * render as a short page instead of as duplicate React keys and an event shown twice,
           * which on an audit surface would read as the action having happened twice.
           */
          const seen = new Set(current.events.map((event) => event.id));
          return {
            ...current,
            events: current.events.concat(page.events.filter((event) => !seen.has(event.id))),
            nextCursor: page.nextCursor,
            loadingMore: false,
          };
        });
      },
      (error) => {
        if (requestId.current !== id) return;
        merge((current) => ({ ...current, loadingMore: false, loadMoreError: error }));
      }
    );
  }, [criteria, criteriaKey, nextCursor, loading, loadingMore]);

  /** Reissues the first page under the current criteria, after a failure. */
  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    events: state.events,
    /** The first page is in flight — there is nothing to show yet. */
    loading: state.loading,
    /** A later page is in flight — what is on screen stays on screen. */
    loadingMore: state.loadingMore,
    error: state.error,
    loadMoreError: state.loadMoreError,
    hasMore: state.nextCursor != null,
    /** Typing has not settled into a request yet. */
    filterPending: enabled && (typedActor !== appliedIds.actor || typedTarget !== appliedIds.target),
    /** Whether an empty feed means "nothing matched" rather than "nothing has been recorded". */
    filtered:
      action !== '' || typedActor !== '' || typedTarget !== '' || from !== '' || to !== '',
    /** A filter the endpoint would refuse, so nothing was sent. Reported per control. */
    invalidActorId,
    invalidTargetId,
    invalidRange,
    /** True while any filter is invalid — the feed is deliberately not being read. */
    paused: !enabled,
    loadMore,
    retry,
  };
}

export default useAdminAuditEvents;
