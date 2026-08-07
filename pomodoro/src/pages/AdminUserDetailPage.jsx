import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminActions from '../components/admin/AdminActions.jsx';
import AdminUserBadges from '../components/admin/AdminUserBadges.jsx';
import { describeAdminFailure } from '../components/admin/actionFailure.js';
import useAdminUser from '../hooks/useAdminUser.js';
import useAuth from '../hooks/useAuth.js';
import { TITLES } from '../services/gamification.js';
import { REPORT_FREQUENCIES } from '../services/reports.js';
import '../styles/AdminUserDetailPage.css';

/*
 * AdminUserDetailPage — one account, at /admin/users/:id.
 *
 * It renders `GET /api/v1/admin/users/:id` (`admin_role_plan.md` §6.2) and the five actions on that
 * account (§6.4–§6.7, §6.9). A detail page is reached from a list rather than from the navigation,
 * so it has no sidebar entry of its own: the Users entry stays marked while you are here (see
 * Nav.jsx's ADMIN_LINKS) and this page offers its own way back up.
 *
 * COUNTS AND TOTALS, NEVER RECORDS. §6.2's allow-list is the privacy line of the whole admin
 * surface: an operator can see that an account recorded 318 focus sessions and cannot see what the
 * user was working on, because a task title is the user's own text about their own work and no
 * admin route returns it. The same allow-list excludes every credential — no hash, no session or
 * refresh token, no `provider_subject`, no report token. This page reads NAMED FIELDS rather than
 * iterating whatever the payload happens to contain, so a server that one day over-shares still
 * cannot leak through this component.
 *
 * `passwordChangedAt` and `hasPassword` are the shape that rule takes for credentials: *when*, and
 * *whether*, never *what*.
 *
 * NO REDUX. One reader, one route, thrown away on navigation — `useAdminUser` owns the read and the
 * action lifecycle, and this file owns the markup. Same division as `useAdminUsers` and the list.
 *
 * THE ENDPOINTS BEHIND IT ARE BUILT — the detail read and all five actions (`CONTRACT.md` §31),
 * each write committing its audit row in the same transaction as its change. This page still holds
 * no fixture and no fallback: every state it draws comes from what the API answered, including the
 * failures, which is why the error branch below has a working retry rather than a placeholder.
 */

/** Absolute date and time in the reader's locale. Null when missing or unparseable. */
function formatDateTime(iso) {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Whole numbers, grouped. Falsy-safe: 0 is a real answer and must not read as missing. */
function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : null;
}

/** Title keys → the names the product shows, from the one mirror of the ladder. */
const TITLE_NAMES = Object.fromEntries(TITLES.map((title) => [title.key, title.name]));

const REPORT_STATUS_LABELS = {
  unasked: 'Never asked',
  pending_confirmation: 'Awaiting confirmation',
  active: 'Active',
  paused: 'Paused',
  declined: 'Declined',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
};

const FREQUENCY_LABELS = Object.fromEntries(
  REPORT_FREQUENCIES.map((option) => [option.key, option.label])
);

/*
 * A value the API sends that we have no label for is shown as readable text rather than dropped: a
 * blank field would say "this is empty", which is a different and false statement.
 */
function humanize(value) {
  if (!value) return null;
  const text = String(value).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * One labelled fact. `value` of null renders the absence in words — a bare dash is unreadable when
 * a screen reader announces the pair, and "Not recorded" is what the missing value actually means.
 */
function Fact({ label, value, children }) {
  return (
    <div className="admin-facts__item">
      <dt className="admin-facts__label">{label}</dt>
      <dd className="admin-facts__value">
        {children ??
          (value === null || value === undefined || value === '' ? (
            <span className="admin-facts__absent">Not recorded</span>
          ) : (
            value
          ))}
      </dd>
    </div>
  );
}

/** A titled group of facts. */
function FactGroup({ title, children, note }) {
  return (
    <section className="admin-facts">
      <h3 className="admin-facts__title">{title}</h3>
      {note && <p className="admin-facts__note">{note}</p>}
      <dl className="admin-facts__list">{children}</dl>
    </section>
  );
}

/*
 * The first-load placeholder, shaped like the real header and one fact group so the content does
 * not shove the page around when it lands. Hidden from assistive technology — the status line below
 * already announces that a read is running.
 */
function DetailSkeleton() {
  return (
    <div className="admin-user-detail__skeleton" aria-hidden="true">
      <span className="admin-user-detail__skeleton-line admin-user-detail__skeleton-line--title" />
      <span className="admin-user-detail__skeleton-line admin-user-detail__skeleton-line--meta" />
      <span className="admin-user-detail__skeleton-line admin-user-detail__skeleton-line--badges" />
      <span className="admin-user-detail__skeleton-line" />
      <span className="admin-user-detail__skeleton-line" />
    </div>
  );
}

function AdminUserDetailPage() {
  const { id } = useParams();
  const { user: signedInUser } = useAuth();
  const {
    user,
    loading,
    error,
    retry,
    dismissError,
    pending,
    actionError,
    actionResult,
    deleted,
    disable,
    reactivate,
    revokeSessions,
    changeRole,
    remove,
  } = useAdminUser(id);

  /*
   * Whether the operator is looking at themselves. Compared on id rather than on email, because an
   * address is editable and an id is not. It only decides which controls are offered — the rules it
   * anticipates are enforced by the server, which answers 409 (`admin_role_plan.md` §4.3).
   */
  const isSelf = Boolean(signedInUser?.id && user?.id && signedInUser.id === user.id);

  /*
   * Deletion is the one action that replaces the page instead of updating it, so it is the one that
   * strands the keyboard: the dialog's own focus restoration finds the button it came from already
   * gone, and leaves focus on <body>. Moving focus to the heading of what replaced it is what keeps
   * a keyboard user where they were. Every other action returns focus to the control that opened
   * the dialog, because that control is still on the page.
   */
  const doneHeadingRef = useRef(null);
  useEffect(() => {
    if (deleted) doneHeadingRef.current?.focus();
  }, [deleted]);

  const back = (
    <Link className="admin-user-detail__back" to="/admin">
      ← Back to Users
    </Link>
  );

  /* ------------------------------------------------------------------ Deleted */
  /*
   * A terminal state, not an error: the operator asked for this and it worked. The page stops
   * showing an account because there is no longer an account to show, and says what went with it.
   */
  if (deleted) {
    const tasks = formatCount(deleted.counts?.tasks);
    const sessions = formatCount(deleted.counts?.focusSessions);
    return (
      <section className="admin-panel admin-user-detail" aria-labelledby="admin-user-detail-title">
        {back}
        <h2
          id="admin-user-detail-title"
          className="admin-panel__title"
          ref={doneHeadingRef}
          tabIndex={-1}
        >
          Account deleted
        </h2>
        <p className="admin-user-detail__terminal" role="status">
          This account and everything belonging to it have been permanently deleted
          {tasks && sessions ? `, including ${tasks} tasks and ${sessions} focus sessions` : ''}.
          The audit record of the deletion is kept.
        </p>
      </section>
    );
  }

  /* ------------------------------------------------------------------ Loading */
  if (loading) {
    return (
      <section className="admin-panel admin-user-detail" aria-labelledby="admin-user-detail-title">
        {back}
        <h2 id="admin-user-detail-title" className="admin-panel__title">
          Account
        </h2>
        <p className="admin-user-detail__status" role="status">
          Loading account…
        </p>
        <DetailSkeleton />
      </section>
    );
  }

  /* -------------------------------------------------------- Not found / error */
  /*
   * A 404 is not a failure to show a retry for: §4.2 makes the whole admin namespace answer 404 to
   * a non-admin, and a deleted account answers it too, so the honest reading is "there is nothing
   * here" rather than "something went wrong". Every other failure keeps its retry, because trying
   * again is a reasonable thing to do about it.
   */
  if (error) {
    const notFound = error.status === 404;
    return (
      <section className="admin-panel admin-user-detail" aria-labelledby="admin-user-detail-title">
        {back}
        <h2 id="admin-user-detail-title" className="admin-panel__title">
          {notFound ? 'Account not available' : 'Account'}
        </h2>
        <div className="admin-user-detail__notice" role="alert">
          <p className="admin-user-detail__notice-text">{describeAdminFailure(error)}</p>
          {!notFound && (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={retry}>
              Try again
            </button>
          )}
        </div>
        {notFound && (
          <p className="admin-panel__note">
            Requested account: <span className="admin-panel__value">{id}</span>
          </p>
        )}
      </section>
    );
  }

  /* ------------------------------------------------------------------- Loaded */
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  /*
   * Accounts created through Google may carry no name, and a heading must never be blank — the
   * username is the next thing that identifies the person, and the address after that. Same fallback
   * order the list's cards use, so a card and the page it opens agree on who this is.
   */
  const heading = fullName || user.username || user.email;

  const titles = Array.isArray(user.gamification?.unlockedTitles)
    ? user.gamification.unlockedTitles
    : [];
  const identities = Array.isArray(user.identities) ? user.identities : [];

  return (
    <section className="admin-panel admin-user-detail" aria-labelledby="admin-user-detail-title">
      {back}

      <header className="admin-user-detail__head">
        <h2 id="admin-user-detail-title" className="admin-panel__title">
          {heading}
        </h2>
        <p className="admin-user-detail__identity">
          {fullName && user.username && (
            <span className="admin-user-detail__handle">@{user.username}</span>
          )}
          <span className="admin-user-detail__email">{user.email}</span>
        </p>
        <AdminUserBadges user={user} />
      </header>

      <div className="admin-user-detail__facts">
        <FactGroup title="Account">
          <Fact label="Username" value={user.username} />
          <Fact label="Full name" value={fullName || null} />
          <Fact label="Email address">
            <span className="admin-facts__mono">{user.email}</span>
          </Fact>
          <Fact label="Email verification" value={user.emailVerified ? 'Verified' : 'Unverified'} />
          <Fact label="Role" value={user.role === 'admin' ? 'Administrator' : 'User'} />
          <Fact label="Status" value={user.status === 'disabled' ? 'Disabled' : 'Active'} />
          <Fact label="Time zone" value={user.timezone} />
          <Fact label="Joined" value={formatDateTime(user.createdAt)} />
          {user.disabledAt && (
            <Fact label="Disabled since" value={formatDateTime(user.disabledAt)} />
          )}
          <Fact label="Avatar updated" value={formatDateTime(user.avatarUpdatedAt)} />
          <Fact label="Account ID">
            <span className="admin-facts__mono">{user.id}</span>
          </Fact>
        </FactGroup>

        {/*
          Authentication, as far as this surface is ever allowed to see it: whether a credential
          exists and when it last changed. No hash, no token, and no `provider_subject` — the
          identity rows carry a provider name and two timestamps and nothing that could be replayed.
        */}
        <FactGroup
          title="Authentication"
          note="Whether a credential exists and when it changed. No password, hash, token or provider identifier is ever returned to this page."
        >
          <Fact label="Password" value={user.hasPassword ? 'Set' : 'Not set'} />
          <Fact label="Password changed" value={formatDateTime(user.passwordChangedAt)} />
          <Fact label="Linked sign-ins">
            {identities.length === 0 ? (
              <span className="admin-facts__absent">None linked</span>
            ) : (
              <ul className="admin-facts__identities">
                {identities.map((identity) => (
                  <li key={identity.provider} className="admin-facts__identity">
                    <span className="admin-facts__identity-name">
                      {humanize(identity.provider) ?? 'Unknown provider'}
                    </span>
                    <span className="admin-facts__identity-meta">
                      Linked {formatDateTime(identity.linkedAt) ?? 'at an unrecorded time'} · Last
                      sign-in {formatDateTime(identity.lastLoginAt) ?? 'not recorded'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Fact>
        </FactGroup>

        <FactGroup title="Sessions">
          <Fact label="Active sessions" value={formatCount(user.sessions?.activeCount)} />
          <Fact label="Last seen" value={formatDateTime(user.sessions?.lastSeenAt)} />
        </FactGroup>

        <FactGroup title="Progress">
          <Fact label="Lifetime points" value={formatCount(user.gamification?.lifetimePoints)} />
          <Fact label="Balance" value={formatCount(user.gamification?.balance)} />
          <Fact
            label="Current day streak"
            value={formatCount(user.gamification?.currentDayStreak)}
          />
          <Fact
            label="Longest day streak"
            value={formatCount(user.gamification?.longestDayStreak)}
          />
          <Fact
            label="Streak freezes available"
            value={formatCount(user.gamification?.streakFreezesAvailable)}
          />
          <Fact label="Titles unlocked">
            {titles.length === 0 ? (
              <span className="admin-facts__absent">None yet</span>
            ) : (
              titles.map((key) => TITLE_NAMES[key] ?? humanize(key)).join(', ')
            )}
          </Fact>
        </FactGroup>

        <FactGroup
          title="Activity"
          note="Totals only. No task or focus-session content is available to administrators."
        >
          <Fact label="Tasks" value={formatCount(user.counts?.tasks)} />
          <Fact label="Focus sessions" value={formatCount(user.counts?.focusSessions)} />
        </FactGroup>

        <FactGroup title="Email reports">
          <Fact
            label="Subscription"
            value={
              REPORT_STATUS_LABELS[user.reports?.status] ?? humanize(user.reports?.status) ?? null
            }
          />
          <Fact
            label="Frequency"
            value={
              FREQUENCY_LABELS[user.reports?.frequency] ?? humanize(user.reports?.frequency) ?? null
            }
          />
          <Fact label="Last delivery" value={humanize(user.reports?.lastDeliveryStatus)} />
          <Fact label="Last delivery at" value={formatDateTime(user.reports?.lastDeliveryAt)} />
        </FactGroup>
      </div>

      <AdminActions
        user={user}
        isSelf={isSelf}
        pending={pending}
        actionError={actionError}
        actionResult={actionResult}
        onDisable={disable}
        onReactivate={reactivate}
        onRevokeSessions={revokeSessions}
        onChangeRole={changeRole}
        onDelete={remove}
        onDismissError={dismissError}
      />
    </section>
  );
}

export default AdminUserDetailPage;
