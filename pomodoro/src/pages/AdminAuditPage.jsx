import { useCallback, useId, useState } from 'react';
import AdminAuditEventCard from '../components/admin/AdminAuditEventCard.jsx';
import useAdminAuditEvents from '../hooks/useAdminAuditEvents.js';
import { ADMIN_AUDIT_ACTIONS } from '../services/adminAudit.js';
import '../styles/AdminAuditPage.css';

/*
 * AdminAuditPage — the audit record at /admin/audit: who did what, to whom, and when.
 *
 * It renders `GET /api/v1/admin/audit-events` (`admin_role_plan.md` §6.8) and nothing else.
 *
 * READ-ONLY, BECAUSE THE TABLE IS. `admin_audit_events` is append-only by design — the repository
 * exposes `create` and two reads and no update or delete (§3.2), and the soft-delete pattern is
 * deliberately withheld from it. So this page has no edit control, no delete control and no bulk
 * selection: there is no call for them to make. The only writes on this surface are to the filter
 * boxes.
 *
 * NO REDUX. The feed has one reader, is a cursor-paged view rather than a value, and is thrown away
 * whenever a filter moves; `useAdminAuditEvents` owns the whole lifecycle and this file owns the
 * markup. That is the same division AdminUsersPage and `useAdminUsers` already use.
 *
 * LOAD MORE, NEVER PAGE NUMBERS. The endpoint pages on an opaque cursor over `(created_at, id)` DESC
 * and publishes no total (§6.8), so page numbers would be a control the API cannot answer — there is
 * no last page to jump to and no count to divide.
 *
 * FILTERING IS THE SERVER'S, ALL OF IT. The five filters go on the query string and the results are
 * whatever comes back. Filtering the loaded page client-side would search only the events already
 * fetched and quietly report "nothing matched" for an event sitting one page down — on an audit
 * surface, a false negative is indistinguishable from evidence that the thing never happened.
 *
 * ⚠️ THE ENDPOINT IS SPECIFIED BUT NOT YET BUILT — §6.8 defines it down to the response body, and it
 * is scheduled in phase G3 beside the write actions, but `admin-user.controller.ts` today carries
 * only the `/admin/users` routes. So this page renders its own error state with a working retry until
 * the route ships, which is the honest thing for a client to show when the server has not answered,
 * and is why there is no fixture anywhere in this feature.
 */

/**
 * What to tell the operator about a failed read.
 *
 * OUR WORDS, NOT THE SERVER'S — the same reasoning AdminUsersPage states: a problem document's
 * `detail` is written for a developer reading a log, can carry internals on a 500, and never suggests
 * what to do next. The one thing worth branching on is whose problem it is.
 *
 * The 404 case is not a mistake: §4.2 makes the whole admin namespace answer 404 to a non-admin, so
 * "not found" here means the record is not available to this session rather than that it is missing.
 * It is also what the unbuilt endpoint returns today.
 */
function errorMessage(error) {
  if (error?.status === 0) {
    return 'We could not reach the server. Check your connection, then try again.';
  }
  if (error?.status === 404) {
    return 'The audit record is not available for this session.';
  }
  if (error?.status === 429) {
    return 'Too many requests in a row. Wait a moment, then try again.';
  }
  return 'Something went wrong while loading the audit record.';
}

/*
 * Placeholder cards for the first load, shaped like the real ones so the events do not shove the page
 * around when they land. Hidden from assistive technology — the status line below already announces
 * that a read is running, and empty cards announced as content would be noise.
 */
function FeedSkeleton() {
  return (
    <ul className="admin-audit__list" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <li key={index} className="admin-audit__item">
          <div className="admin-audit__skeleton">
            <span className="admin-audit__skeleton-line admin-audit__skeleton-line--action" />
            <span className="admin-audit__skeleton-line admin-audit__skeleton-line--parties" />
            <span className="admin-audit__skeleton-line admin-audit__skeleton-line--meta" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The empty value every filter resets to, and the shape `Clear filters` restores. */
const NO_FILTERS = { action: '', actorUserId: '', targetUserId: '', from: '', to: '' };

function AdminAuditPage() {
  /*
   * The controls are this component's only state, held as ONE object so that *Clear filters* is a
   * single assignment rather than five that somebody has to remember to keep in step. Each value is
   * the raw input; the hook decides when one becomes a request, validates the three that can be
   * malformed, and resets the feed when the criteria change.
   */
  const [filters, setFilters] = useState(NO_FILTERS);

  const setFilter = useCallback(
    (name, value) => setFilters((current) => ({ ...current, [name]: value })),
    []
  );

  /* Stable identities, so a card's Filter button does not re-render the whole feed on every keystroke. */
  const filterByActor = useCallback((id) => setFilter('actorUserId', id), [setFilter]);
  const filterByTarget = useCallback((id) => setFilter('targetUserId', id), [setFilter]);

  const {
    events,
    loading,
    loadingMore,
    error,
    loadMoreError,
    hasMore,
    filterPending,
    filtered,
    invalidActorId,
    invalidTargetId,
    invalidRange,
    paused,
    loadMore,
    retry,
  } = useAdminAuditEvents(filters);

  /* Stable per mount, so the labels stay tied to their controls if this ever renders twice. */
  const fieldId = useId();
  const actionId = `${fieldId}-action`;
  const actorId = `${fieldId}-actor`;
  const actorErrorId = `${fieldId}-actor-error`;
  const targetId = `${fieldId}-target`;
  const targetErrorId = `${fieldId}-target-error`;
  const fromId = `${fieldId}-from`;
  const toId = `${fieldId}-to`;
  const rangeErrorId = `${fieldId}-range-error`;

  const showEmpty = !loading && !error && !paused && events.length === 0;

  /*
   * One live line for the whole feed, because there is one thing to say at a time. Silent while an
   * error or an invalid filter is showing — those carry their own alerts, and announcing both would
   * read the problem twice.
   */
  let statusLine = '';
  if (paused) statusLine = '';
  else if (loading) statusLine = 'Loading audit events…';
  else if (error) statusLine = '';
  else if (filterPending) statusLine = 'Filtering…';
  else if (events.length > 0) {
    statusLine = `${events.length} event${events.length === 1 ? '' : 's'} loaded${
      hasMore ? ' so far' : ''
    }.`;
  }

  return (
    <section className="admin-panel admin-audit" aria-labelledby="admin-audit-title">
      <header className="admin-audit__head">
        <h2 id="admin-audit-title" className="admin-panel__title">
          Audit
        </h2>
        <p className="admin-audit__lead">
          Every administrative action, and the security events the system recorded on its own. The
          record is append-only — entries cannot be edited or removed.
        </p>
      </header>

      {/*
        A filter form with no submit button: every control applies as it changes, so there is nothing
        for Enter to do. `onSubmit` is still handled — an Enter press inside a text field submits by
        default, and an unhandled submit would reload the page and discard the feed.
      */}
      <form
        className="admin-audit__filters"
        aria-label="Filter audit events"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="admin-audit__field">
          <label className="admin-audit__label" htmlFor={actionId}>
            Action
          </label>
          <select
            id={actionId}
            className="admin-audit__select"
            value={filters.action}
            onChange={(event) => setFilter('action', event.target.value)}
          >
            <option value="">All actions</option>
            {ADMIN_AUDIT_ACTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/*
          Both id filters are uuids because §6.8 filters on ids, not on addresses. Typing one is not
          the intended path and the placeholder says so — the Filter button on any event fills these
          in, which is how an operator actually gets from "this looks wrong" to "show me everything
          this account did".
        */}
        <div className="admin-audit__field admin-audit__field--id">
          <label className="admin-audit__label" htmlFor={actorId}>
            Actor
          </label>
          <input
            id={actorId}
            className="admin-audit__input"
            type="text"
            value={filters.actorUserId}
            onChange={(event) => setFilter('actorUserId', event.target.value)}
            placeholder="User ID"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-invalid={invalidActorId || undefined}
            aria-describedby={invalidActorId ? actorErrorId : undefined}
          />
          {invalidActorId && (
            <p id={actorErrorId} className="admin-audit__field-error">
              Enter a full user ID, or use the Filter button on an event.
            </p>
          )}
        </div>

        <div className="admin-audit__field admin-audit__field--id">
          <label className="admin-audit__label" htmlFor={targetId}>
            Target
          </label>
          <input
            id={targetId}
            className="admin-audit__input"
            type="text"
            value={filters.targetUserId}
            onChange={(event) => setFilter('targetUserId', event.target.value)}
            placeholder="User ID"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-invalid={invalidTargetId || undefined}
            aria-describedby={invalidTargetId ? targetErrorId : undefined}
          />
          {invalidTargetId && (
            <p id={targetErrorId} className="admin-audit__field-error">
              Enter a full user ID, or use the Filter button on an event.
            </p>
          )}
        </div>

        {/*
          Whole days, in the reader's own timezone — the hook widens them to the ISO instants §6.8
          compares against, so `to` covers all of its last day rather than stopping at its midnight.
        */}
        <div className="admin-audit__field admin-audit__field--date">
          <label className="admin-audit__label" htmlFor={fromId}>
            From
          </label>
          <input
            id={fromId}
            className="admin-audit__input"
            type="date"
            value={filters.from}
            onChange={(event) => setFilter('from', event.target.value)}
            aria-invalid={invalidRange || undefined}
            aria-describedby={invalidRange ? rangeErrorId : undefined}
          />
        </div>

        <div className="admin-audit__field admin-audit__field--date">
          <label className="admin-audit__label" htmlFor={toId}>
            To
          </label>
          <input
            id={toId}
            className="admin-audit__input"
            type="date"
            value={filters.to}
            onChange={(event) => setFilter('to', event.target.value)}
            aria-invalid={invalidRange || undefined}
            aria-describedby={invalidRange ? rangeErrorId : undefined}
          />
        </div>

        {filtered && (
          <div className="admin-audit__field admin-audit__field--reset">
            <button
              type="button"
              className="admin-audit__btn admin-audit__btn--ghost"
              onClick={() => setFilters(NO_FILTERS)}
            >
              Clear filters
            </button>
          </div>
        )}
      </form>

      {/*
        The range error belongs to the pair, not to either input, so it sits under the row rather than
        under one of them — and both inputs point at it with aria-describedby, so it is announced
        whichever one the operator is in.
      */}
      {invalidRange && (
        <p id={rangeErrorId} className="admin-audit__notice" role="alert">
          The <strong>From</strong> date is after the <strong>To</strong> date, so there is nothing to
          show. Swap them, or clear one.
        </p>
      )}

      <p className="admin-audit__status" role="status">
        {statusLine}
      </p>

      {loading && <FeedSkeleton />}

      {error && (
        <div className="admin-audit__notice admin-audit__notice--error" role="alert">
          <p className="admin-audit__notice-text">{errorMessage(error)}</p>
          <button type="button" className="admin-audit__btn admin-audit__btn--ghost" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {showEmpty && (
        <p className="admin-audit__empty">
          {filtered
            ? 'No audit events match these filters. Try a wider date range, or a different action.'
            : 'No administrative actions have been recorded yet.'}
        </p>
      )}

      {events.length > 0 && (
        <ul className="admin-audit__list">
          {events.map((event) => (
            <AdminAuditEventCard
              key={event.id}
              event={event}
              onFilterActor={filterByActor}
              onFilterTarget={filterByTarget}
            />
          ))}
        </ul>
      )}

      {/*
        Only rendered while the API says there is another page. A failed *Load more* keeps the button
        and the cursor — the events already on screen are still valid, so this is a retry rather than
        the error state above, and pressing again resumes from exactly where it stopped.
      */}
      {hasMore && !error && (
        <div className="admin-audit__more">
          {loadMoreError && (
            <p className="admin-audit__more-error" role="alert">
              {errorMessage(loadMoreError)}
            </p>
          )}
          <button
            type="button"
            className="admin-audit__btn admin-audit__btn--primary"
            onClick={loadMore}
            disabled={loadingMore}
            aria-busy={loadingMore}
          >
            {loadingMore ? 'Loading…' : loadMoreError ? 'Try again' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  );
}

export default AdminAuditPage;
