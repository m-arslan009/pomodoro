import { NavLink } from 'react-router-dom'

/*
 * Nav — the app's primary navigation links, rendered as a single vertical,
 * stacked list. It is intentionally presentation-agnostic: the same component
 * fills the middle section of the desktop sidebar AND the mobile slide-in
 * overlay (see AppLayout), so the link set lives in exactly one place.
 *
 * `onNavigate` lets the mobile overlay close itself the moment a destination is
 * chosen; on desktop it is simply omitted.
 */

function TimerIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 3-6.9L3 8" />
      <path d="M3 3v5h5M12 8v4l3 2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

// Single source of truth for the primary destinations and their order.
const LINKS = [
  { to: '/timer', label: 'Timer', Icon: TimerIcon },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

function Nav({ onNavigate }) {
  return (
    <nav className="app-nav" aria-label="Primary">
      <ul className="app-nav__list">
        {LINKS.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
              }
              onClick={onNavigate}
            >
              <Icon />
              <span className="app-nav__label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default Nav
