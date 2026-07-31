import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Nav from './Nav.jsx';
import useAuth from '../hooks/useAuth.js';
import useSettings from '../hooks/useSettings.js';
import { applyBaseTheme, applyCustomTheme, applyBackground } from '../services/appearance.js';
import '../styles/AppLayout.css';

/*
 * AppLayout — the shared shell for every authenticated (internal) page.
 *
 * Desktop / tablet (>576px): a persistent, fixed-width forest sidebar is docked
 * on the left, splitting the screen; page content flows in <main> on the right.
 * The sidebar is a flex column of three parts — brand (top), primary links
 * (middle), and a Log Out button anchored to the very bottom. No global top
 * header is rendered here, so each page owns its own local header if it needs one.
 *
 * Mobile (≤576px): the sidebar is hidden and a fixed, non-scrolling top header
 * takes over. Its far-left menu button toggles the same sidebar back in as a
 * single-column slide-in overlay (with a dismiss backdrop), so the navigation
 * markup is authored once and simply restyled per breakpoint.
 */

const APP_NAME = 'Evergrove';

function LeafIcon() {
  return (
    <svg
      className="app-brand__leaf"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11 21c-4 0-8-3-8-9 0-5 4-9 17-9 0 12-4 18-9 18-2.5 0-4-1.5-4-4 0-4 4-7 9-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Brand({ onClick }) {
  return (
    <Link to="/timer" className="app-brand" aria-label={`${APP_NAME} dashboard`} onClick={onClick}>
      <LeafIcon />
      <span className="app-brand__name">{APP_NAME}</span>
    </Link>
  );
}

function AppLayout({ children }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuButtonRef = useRef(null);
  const shellRef = useRef(null);

  const closeMenu = () => setMenuOpen(false);

  /*
   * Apply the account's personalization. Base theme is document-wide; the forest palette and
   * background are inline overrides on the shell (cleared by the appearance helpers when the
   * setting is default).
   *
   * Keyed on the settings themselves rather than running once on mount: they arrive from the
   * server after login, so a mount-time snapshot would paint the defaults and never correct
   * itself. This also repaints immediately when a Settings save lands, without a navigation.
   */
  useEffect(() => {
    applyBaseTheme(settings.theme);
    applyCustomTheme(shellRef.current, settings.customTheme);
    applyBackground(shellRef.current, settings.background);
  }, [settings.theme, settings.customTheme, settings.background]);

  // While the mobile overlay is open, Escape dismisses it and returns focus to
  // the toggle so keyboard users are never stranded.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Signing out is a network call, but the token is dropped locally either way — the slice
  // clears on both outcomes. So a failed request must still navigate: leaving someone on a
  // protected page after they asked to sign out is the worse outcome, and an uncaught rejection
  // here would also surface as an unhandled promise error.
  // The button locks while the request is in flight so a double click cannot fire two of them.
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Reported by the slice; nothing useful to add here.
    } finally {
      setSigningOut(false);
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="app-shell" ref={shellRef}>
      {/* Mobile-only top header: fixed, non-scrolling, menu toggle on the far left. */}
      <header className="app-topbar">
        <button
          type="button"
          ref={menuButtonRef}
          className="app-menu-btn"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {menuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <Brand />
      </header>

      {/* Dismiss backdrop — only mounted while the mobile overlay is open. */}
      {menuOpen && <div className="app-backdrop" aria-hidden="true" onClick={closeMenu} />}

      <aside id="app-sidebar" className="app-sidebar" data-open={menuOpen}>
        <div className="app-sidebar__top">
          <Brand onClick={closeMenu} />
        </div>

        <Nav onNavigate={closeMenu} />

        <div className="app-sidebar__bottom">
          <button
            type="button"
            className="app-logout"
            onClick={handleLogout}
            disabled={signingOut}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {signingOut ? 'Logging out…' : 'Log Out'}
          </button>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}

export default AppLayout;
