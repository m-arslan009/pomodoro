import { Link } from 'react-router-dom';
import AdminUserBadges from './AdminUserBadges.jsx';

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
 * The three state badges are AdminUserBadges, shared with the detail page this card opens: the same
 * three facts about the same account must not be able to read differently on the two surfaces.
 */

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

        <AdminUserBadges user={user} />

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
