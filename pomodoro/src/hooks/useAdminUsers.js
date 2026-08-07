import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_USERS_PAGE_LIMIT,
  fetchAdminUsers,
  normalizeAdminUserSearch,
} from '../services/adminUsers.js';

/*
 * useAdminUsers — the cursor-paged directory read behind /admin, as one hook.
 *
 * IT OWNS *WHEN* TO FETCH; THE PAGE OWNS WHAT TO DRAW. Debouncing, resetting, appending and
 * discarding stale answers are all the same question — "which criteria are the results on screen
 * for?" — and splitting them across a page and a hook is how a list ends up showing one search's
 * rows under another search's heading. So the page hands over the raw control values and gets back
 * a set of states it can render directly.
 *
 * THE SEARCH IS DEBOUNCED, THE FILTERS ARE NOT. Typing produces a keystroke's worth of intent and
 * the operator is mid-thought; choosing a role is a finished decision and a wait after it just looks
 * broken. `searchPending` exposes the gap so the page can say a request is coming without pretending
 * one is already in flight.
 *
 * ANY CRITERIA CHANGE RESTARTS FROM PAGE ONE. Cursors are opaque and are only meaningful for the
 * query that produced them (`admin_role_plan.md` §6.1), so carrying one across a filter change would
 * page through the *old* result set. Rows, cursor and both error slots therefore travel as ONE state
 * object rather than as six `useState` calls — that is what makes "they reset together" a property
 * of the shape instead of six clears somebody has to remember to keep in step.
 *
 * STALENESS IS HANDLED BY SEQUENCE, NOT BY ABORT. `services/api.js` owns fetch and takes no signal,
 * so every request carries the id it was issued under and a late answer whose id has been superseded
 * is dropped. That covers the case this list is most exposed to — a slow broad search resolving
 * after the narrow one that replaced it — and it is also what keeps StrictMode's deliberate
 * double-invoke in development from appending the first page twice.
 *
 * THE RESET IS DERIVED, NOT DISPATCHED. Held results are stamped with the criteria they were fetched
 * for, and a render whose stamp does not match the current criteria reads as the empty loading state
 * — so changing a filter shows the loading state in the *same* render that changed it. Clearing the
 * results from inside the effect instead would paint one frame of the previous search under the new
 * filter and then re-render, which is both a visible lie and the cascading render the lint rule
 * exists to catch.
 */

/** How long typing has to settle before it becomes a request. */
export const ADMIN_SEARCH_DEBOUNCE_MS = 350;

/**
 * The resting state, and the exact shape a reset returns to.
 *
 * `loading: true` is the initial value because a mount always issues a read: starting at false would
 * paint the empty state for one frame before the first request even leaves.
 */
const INITIAL = {
  /** @type {import('../services/adminUsers.js').AdminUserSummary[]} */
  users: [],
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
 * @param {{query?: string, role?: string, status?: string}} [controls] Raw control values; empty
 *   string means "no filter" for each.
 */
function useAdminUsers({ query = '', role = '', status = '' } = {}) {
  /*
   * What was typed, reduced to what would actually be sent. Comparing the normalized forms is what
   * makes trailing whitespace a non-event: "arslan " and "arslan" are the same search, and a space
   * at the end of a word must not throw away the results already showing for it.
   */
  const typed = normalizeAdminUserSearch(query);
  const [appliedQuery, setAppliedQuery] = useState(typed);

  /*
   * The held result, stamped with the criteria key it was fetched under. `key` is what makes the
   * reset derivable: nothing clears this state, it is simply not read once the stamp goes stale.
   */
  const [result, setResult] = useState({ key: null, ...INITIAL });

  /* Bumped by `retry`, and part of the key, so a failed read can be reissued unchanged. */
  const [reloadToken, setReloadToken] = useState(0);

  /* The id of the most recently issued *first-page* read. See the staleness note above. */
  const requestId = useRef(0);

  useEffect(() => {
    if (typed === appliedQuery) return undefined;
    const timer = setTimeout(() => setAppliedQuery(typed), ADMIN_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed, appliedQuery]);

  /*
   * The criteria the results belong to. Memoized so its identity changes exactly when one of the
   * three values does — it is the refetch trigger below, and an object rebuilt every render would
   * reload the list on every keystroke, which is the one thing the debounce exists to stop.
   */
  const criteria = useMemo(() => ({ q: appliedQuery, role, status }), [appliedQuery, role, status]);

  /*
   * The same criteria as a comparable value. A NUL separator rather than a delimiter a search could
   * contain, so "a b" typed into the box cannot collide with the key for role `b`.
   */
  const criteriaKey = [appliedQuery, role, status, reloadToken].join('\u0000');

  /*
   * THE RESET. A result stamped for other criteria is not this render's result, so the render falls
   * back to the resting state — loading, no rows, no cursor, no errors — without anything having to
   * clear it.
   */
  const state = result.key === criteriaKey ? result : INITIAL;

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;

    fetchAdminUsers({ ...criteria, limit: ADMIN_USERS_PAGE_LIMIT }).then(
      ({ users, nextCursor }) => {
        if (requestId.current !== id) return;
        setResult({ key: criteriaKey, ...INITIAL, users, nextCursor, loading: false });
      },
      (error) => {
        if (requestId.current !== id) return;
        setResult({ key: criteriaKey, ...INITIAL, loading: false, error });
      }
    );
  }, [criteria, criteriaKey]);

  const { nextCursor, loading, loadingMore } = state;

  /**
   * Appends the next page. Re-pressing after a failure retries the same cursor, which is why the
   * cursor is not cleared when a page fails — losing it would strand the operator halfway down a
   * list with no way to continue.
   */
  const loadMore = useCallback(() => {
    if (!nextCursor || loading || loadingMore) return;

    /*
     * Captured, not bumped: this page belongs to the criteria already on screen, so it must be
     * discarded by the *next* reset rather than counting as one itself. Every update below is a
     * no-op unless the held stamp still matches, so a page that lands after a filter moved cannot
     * be merged into the new search's results.
     */
    const id = requestId.current;
    const merge = (update) =>
      setResult((current) => (current.key === criteriaKey ? update(current) : current));

    merge((current) => ({ ...current, loadingMore: true, loadMoreError: null }));

    fetchAdminUsers({ ...criteria, cursor: nextCursor, limit: ADMIN_USERS_PAGE_LIMIT }).then(
      (page) => {
        if (requestId.current !== id) return;
        merge((current) => {
          /*
           * Cursor pagination promises no duplicates (§6.1) — this only makes a broken promise
           * render as a short page instead of as duplicate React keys and a row shown twice.
           */
          const seen = new Set(current.users.map((user) => user.id));
          return {
            ...current,
            users: current.users.concat(page.users.filter((user) => !seen.has(user.id))),
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
    users: state.users,
    /** The first page is in flight — there is nothing to show yet. */
    loading: state.loading,
    /** A later page is in flight — what is on screen stays on screen. */
    loadingMore: state.loadingMore,
    error: state.error,
    loadMoreError: state.loadMoreError,
    hasMore: state.nextCursor != null,
    /** Typing has not settled into a request yet. */
    searchPending: typed !== appliedQuery,
    /** Whether an empty result means "nothing matched" rather than "no accounts exist". */
    filtered: appliedQuery !== '' || role !== '' || status !== '',
    loadMore,
    retry,
  };
}

export default useAdminUsers;
