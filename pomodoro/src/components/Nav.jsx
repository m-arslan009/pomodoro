import { Link, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { isAdmin } from '../services/admin.js';

/*
 * Nav — the app's primary navigation links, rendered as a single vertical,
 * stacked list. It is intentionally presentation-agnostic: the same component
 * fills the middle section of the desktop sidebar AND the mobile slide-in
 * overlay (see AppLayout), so the link set lives in exactly one place.
 *
 * `onNavigate` lets the mobile overlay close itself the moment a destination is
 * chosen; on desktop it is simply omitted.
 *
 * ROLE DECIDES THE LINK SET, AND NOTHING ELSE HERE CHANGES. An admin gets the admin destinations
 * *instead of* the user ones — a replacement, not an addition — while everything around the list
 * stays exactly as it was: the same sidebar, the same mobile overlay and toggle, the same
 * breakpoints, the same styles, and the same Log Out button that AppLayout anchors to the bottom for
 * every account. That is why the swap lives in this component and AppLayout is untouched: Log Out is
 * already shared, so "the admin navigation includes Logout" needs no admin-specific logout path.
 *
 * The choice is driven by the authenticated user in the store, read through `services/admin.js` —
 * there is no second auth state and no admin slice. It follows that the set can change mid-session
 * only when the session itself changes, which is the correct granularity for an authorization fact.
 */

function TimerIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 3-6.9L3 8" />
      <path d="M3 3v5h5M12 8v4l3 2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.6" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16.5 5.2a3.6 3.6 0 0 1 0 6.9M18 20a6.6 6.6 0 0 0-2.2-4.9" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7z" />
      <path d="M14 3v5h5M8.5 12.5h7M8.5 16.5h4.5" />
    </svg>
  );
}

// Single source of truth for the primary destinations and their order.
const USER_LINKS = [
  { to: '/timer', label: 'Timer', Icon: TimerIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
];

/*
 * The admin destinations. Users carries its own matcher because it cannot be described by its path
 * alone: it lives at `/admin`, but `/admin/users/:id` is one of its pages and has no entry of its
 * own, so Users must stay marked while a detail page is open — and must NOT be marked on
 * `/admin/audit`, which `/admin` also prefixes. A hand-typed `/admin/` is the same page, so it
 * matches too; an unmarked navigation there would look like a bug rather than a URL detail.
 */
const ADMIN_LINKS = [
  {
    to: '/admin',
    label: 'Users',
    Icon: UsersIcon,
    isActive: (pathname) =>
      pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/users'),
  },
  { to: '/admin/audit', label: 'Audit', Icon: AuditIcon },
];

/*
 * Matching defaults to exact, which is precisely what `NavLink` resolved to for every link this
 * component had before roles existed — each of those routes is a leaf with no children. Entries that
 * need more say so themselves, which is why these render as `Link` with an explicit `aria-current`
 * rather than `NavLink`: `NavLink` derives active from its own `to` and cannot be told that one
 * entry owns a second path. One code path for both sets beats two that drift.
 */
function isLinkActive(link, pathname) {
  return link.isActive ? link.isActive(pathname) : pathname === link.to;
}

function Nav({ onNavigate }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const links = isAdmin(user) ? ADMIN_LINKS : USER_LINKS;

  return (
    /*
     * Still labelled "Primary" for an admin: this is the same landmark serving the same purpose, and
     * the role changes where it goes, not what it is. The links themselves say which set it is.
     */
    <nav className="app-nav" aria-label="Primary">
      <ul className="app-nav__list">
        {links.map((link) => {
          const { to, label, Icon } = link;
          const active = isLinkActive(link, pathname);
          return (
            <li key={to}>
              <Link
                to={to}
                className={active ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                <Icon />
                <span className="app-nav__label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Nav;
