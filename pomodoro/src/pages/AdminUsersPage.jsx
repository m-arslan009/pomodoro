import { useId, useState } from 'react';
import AdminUserCard from '../components/admin/AdminUserCard.jsx';
import useAdminUsers from '../hooks/useAdminUsers.js';
import {
  ADMIN_SEARCH_MAX_LENGTH,
  ADMIN_USER_ROLES,
  ADMIN_USER_STATUSES,
} from '../services/adminUsers.js';
import '../styles/AdminUsersPage.css';

/*
 * AdminUsersPage — the panel's landing page at /admin: find an account, or scan recent signups.
 *
 * It renders `GET /api/v1/admin/users` (`admin_role_plan.md` §6.1) and nothing else. This increment
 * is the LIST ONLY — the detail page it links to stays a placeholder, and disable, reactivate,
 * revoke-sessions, role changes, the audit view and the stats view are all deliberately absent. A
 * card offers exactly one action, which is to open the account.
 *
 * NO REDUX. The directory has one reader, is a paged view rather than a value, and is thrown away
 * whenever a filter moves; `useAdminUsers` owns the whole lifecycle and this file owns the markup.
 *
 * LOAD MORE, NEVER PAGE NUMBERS. The endpoint pages on an opaque cursor over `(created_at, id)` and
 * publishes no total (§6.1), so page numbers would be a control the API cannot answer — there is no
 * last page to jump to and no count to divide. *Load more* is the shape the data actually has.
 *
 * FILTERING IS THE SERVER'S, ALL OF IT. Search, role and status go on the query string and the
 * results are whatever comes back. Filtering the current page client-side would search only the
 * accounts already loaded and quietly report "no matches" for an account sitting on page two.
 *
 * ⚠️ The endpoint does not exist yet (`CONTRACT.md` §2.4: no `AdminGuard`, no `/api/v1/admin`
 * namespace). Until it ships this page renders its own error state, with a working retry — which is
 * the honest thing for a client to show when the server has not answered, and is why there is no
 * fixture anywhere in this feature.
 */

/**
 * What to tell the operator about a failed read.
 *
 * OUR WORDS, NOT THE SERVER'S. The API's problem documents are written for a developer reading a
 * log; `detail` on a 500 can carry internals, and none of it suggests what to do next. The one thing
 * worth branching on is *whose* problem it is, so the message can be actionable.
 *
 * The 404 case is not a mistake: §4.2 makes the whole admin namespace answer 404 to a non-admin, so
 * "not found" here means the directory is not available to this session rather than that a record is
 * missing. It is also what an unbuilt endpoint returns today.
 */
function errorMessage(error) {
  if (error?.status === 0) {
    return 'We could not reach the server. Check your connection, then try again.';
  }
  if (error?.status === 404) {
    return 'The account directory is not available for this session.';
  }
  if (error?.status === 429) {
    return 'Too many requests in a row. Wait a moment, then try again.';
  }
  return 'Something went wrong while loading accounts.';
}

/*
 * Placeholder cards for the first load, shaped like the real ones so the results do not shove the
 * page around when they land. Hidden from assistive technology — the status line below already
 * announces that a read is running, and three empty cards announced as content would be noise.
 */
function ResultsSkeleton() {
  return (
    <ul className="admin-users__list" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className="admin-users__item">
          <div className="admin-users__skeleton">
            <span className="admin-users__skeleton-line admin-users__skeleton-line--name" />
            <span className="admin-users__skeleton-line admin-users__skeleton-line--meta" />
            <span className="admin-users__skeleton-line admin-users__skeleton-line--badges" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AdminUsersPage() {
  /*
   * The controls are this component's only state. Each is the raw input value — the hook decides
   * when a value becomes a request, and resets the results when one does.
   */
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const {
    users,
    loading,
    loadingMore,
    error,
    loadMoreError,
    hasMore,
    searchPending,
    filtered,
    loadMore,
    retry,
  } = useAdminUsers({ query, role, status });

  /* Stable per mount, so the labels stay tied to their controls if this ever renders twice. */
  const fieldId = useId();
  const searchId = `${fieldId}-q`;
  const searchHintId = `${fieldId}-q-hint`;
  const roleId = `${fieldId}-role`;
  const statusId = `${fieldId}-status`;

  const showEmpty = !loading && !error && users.length === 0;

  /*
   * One live line for the whole result set, because there is one thing to say at a time. Silent
   * while an error is showing — the alert below carries that, and announcing both would read the
   * failure twice.
   */
  let statusLine = '';
  if (loading) statusLine = 'Loading accounts…';
  else if (error) statusLine = '';
  else if (searchPending) statusLine = 'Searching…';
  else if (users.length > 0) {
    statusLine = `${users.length} account${users.length === 1 ? '' : 's'} loaded${
      hasMore ? ' so far' : ''
    }.`;
  }

  return (
    <section className="admin-panel admin-users" aria-labelledby="admin-users-title">
      <header className="admin-users__head">
        <h2 id="admin-users-title" className="admin-panel__title">
          Users
        </h2>
        <p className="admin-users__lead">
          Find an account by email address or username, or scan the most recent signups.
        </p>
      </header>

      {/*
        A search form with no submit button: every control applies as it changes, so there is nothing
        for Enter to do. `onSubmit` is still handled — an Enter press inside a lone text field submits
        by default, and an unhandled submit would reload the page and discard the results.
      */}
      <form
        className="admin-users__filters"
        role="search"
        aria-label="Search accounts"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="admin-users__field admin-users__field--search">
          <label className="admin-users__label" htmlFor={searchId}>
            Search
          </label>
          <input
            id={searchId}
            className="admin-users__input"
            type="search"
            inputMode="email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Email or username"
            maxLength={ADMIN_SEARCH_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-describedby={searchHintId}
          />
          {/*
            Stated because it changes what the operator types. §6.1 fixes `q` as a PREFIX match on
            email and username so the search stays on an index — searching for a domain or a fragment
            from the middle of a handle returns nothing, and without this line that reads as a bug.
          */}
          <p id={searchHintId} className="admin-users__hint">
            Matches from the beginning of an email address or username.
          </p>
        </div>

        <div className="admin-users__field">
          <label className="admin-users__label" htmlFor={roleId}>
            Role
          </label>
          <select
            id={roleId}
            className="admin-users__select"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">All roles</option>
            {ADMIN_USER_ROLES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-users__field">
          <label className="admin-users__label" htmlFor={statusId}>
            Status
          </label>
          <select
            id={statusId}
            className="admin-users__select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {ADMIN_USER_STATUSES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      <p className="admin-users__status" role="status">
        {statusLine}
      </p>

      {loading && <ResultsSkeleton />}

      {error && (
        <div className="admin-users__notice" role="alert">
          <p className="admin-users__notice-text">{errorMessage(error)}</p>
          <button type="button" className="admin-users__btn admin-users__btn--ghost" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {showEmpty && (
        <p className="admin-users__empty">
          {filtered
            ? 'No accounts match this search. Try a different address, username, or filter.'
            : 'There are no accounts to show.'}
        </p>
      )}

      {users.length > 0 && (
        <ul className="admin-users__list">
          {users.map((user) => (
            <AdminUserCard key={user.id} user={user} />
          ))}
        </ul>
      )}

      {/*
        Only rendered while the API says there is another page. A failed *Load more* keeps the button
        and the cursor — the results already on screen are still valid, so this is a retry rather than
        the error state above, and pressing again resumes from exactly where it stopped.
      */}
      {hasMore && !error && (
        <div className="admin-users__more">
          {loadMoreError && (
            <p className="admin-users__more-error" role="alert">
              {errorMessage(loadMoreError)}
            </p>
          )}
          <button
            type="button"
            className="admin-users__btn admin-users__btn--primary"
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

export default AdminUsersPage;
