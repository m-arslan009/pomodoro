import { Link } from 'react-router-dom';

/*
 * AdminUserCard — one account in the /admin results, and the way into its detail page.
 *
 * A CARD, NOT A TABLE ROW. The summary carries seven fields, three of which are states rather than
 * values; seven columns are unreadable below a tablet and the usual repair — a table on wide screens
 * and a stacked list on narrow ones — is two components rendering the same data, which the
 * responsive rule warns against directly. A card reflows on its own at every width, so there is one
 * markup for all of them.
 *
 * THE WHOLE CARD IS THE LINK. Navigating to the account is the only thing this row does, so making
 * the target the row itself means no hunting for a small "View" control on a touch screen and no
 * click target that misses. It carries a short `aria-label` because the default accessible name
 * would otherwise be the entire card read as one string — the fields stay in the accessibility tree
 * either way, so nothing is hidden by naming it.
 *
 * The detail page it points at is a placeholder for now, deliberately (see AdminUserDetailPage).
 * This component's job is to route to it correctly, which it can do before that page has content.
 *
 * EVERY STATE IS A WORD, NEVER A COLOUR. Disabled and unverified are the two facts an operator is
 * scanning for, and they are the two that must survive a monochrome screen or a colour-blind reader.
 * The tone classes only reinforce a label that already says it.
 */

const ROLE_LABELS = { user: 'User', admin: 'Admin' };
const STATUS_LABELS = { active: 'Active', disabled: 'Disabled' };

/*
 * Renders a value the API sends that we do not have a label for, rather than dropping it. A role or
 * status added server-side should degrade to readable text — a blank badge would tell the operator
 * the field is empty, which is a different and false statement.
 */
function labelFor(labels, value) {
  if (!value) return 'Unknown';
  return labels[value] ?? String(value).replace(/_/g, ' ');
}

/** The tone class suffix, restricted to values we actually style. */
function toneFor(labels, value) {
  return value && value in labels ? value : 'unknown';
}

/** Absolute date, in the reader's locale. Null when the value is missing or unparseable. */
function formatJoined(iso) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * @param {{user: import('../../services/adminUsers.js').AdminUserSummary}} props
 */
function AdminUserCard({ user }) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  /*
   * Accounts created through Google may have no name, and the heading of a result must never be
   * blank — the username is the next thing that identifies the person, and the address after that.
   * When the name is missing the username becomes the heading, so the separate handle line below is
   * dropped rather than printed twice.
   */
  const heading = fullName || user.username || user.email;
  const joined = formatJoined(user.createdAt);

  return (
    <li className="admin-users__item">
      <Link
        className="admin-user-card"
        to={`/admin/users/${user.id}`}
        aria-label={`View ${heading}`}
      >
        <span className="admin-user-card__identity">
          <span className="admin-user-card__name">{heading}</span>
          {fullName && user.username && (
            <span className="admin-user-card__handle">@{user.username}</span>
          )}
          <span className="admin-user-card__email">{user.email}</span>
        </span>

        <span className="admin-user-card__badges">
          <span className={`admin-badge admin-badge--role-${toneFor(ROLE_LABELS, user.role)}`}>
            {labelFor(ROLE_LABELS, user.role)}
          </span>
          <span className={`admin-badge admin-badge--${toneFor(STATUS_LABELS, user.status)}`}>
            {labelFor(STATUS_LABELS, user.status)}
          </span>
          <span
            className={`admin-badge admin-badge--${user.emailVerified ? 'verified' : 'unverified'}`}
          >
            {user.emailVerified ? 'Email verified' : 'Email unverified'}
          </span>
        </span>

        {joined && (
          <span className="admin-user-card__joined">
            Joined <time dateTime={user.createdAt}>{joined}</time>
          </span>
        )}
      </Link>
    </li>
  );
}

export default AdminUserCard;
