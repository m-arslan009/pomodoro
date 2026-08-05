import { useMemo } from 'react';
import { detectTimeZone } from '../services/auth.js';
import '../styles/OAuthButtons.css';

/*
 * OAuthButtons — the "Continue with Google" entry point, shared by Log In and Sign Up.
 *
 * For a provider, signing in and signing up are the same action: the server decides which one
 * happened by looking for an existing identity (CONTRACT §4.12.1). So both pages render the same
 * control with the same label, and neither knows which outcome it will get.
 *
 * This is an <a>, not a <button>, and that is the whole design. The OAuth flow is backend-driven
 * (ADR-008a): the client's entire contribution is a top-level navigation to §4.11. It never sees an
 * authorization code, a PKCE verifier, a state value, a nonce, an ID token or any provider token —
 * those exist only on the server and in HttpOnly cookies. There is no callback route here and no
 * code exchange, because a fetch() would defeat the point: the browser must follow the redirect
 * chain itself so the Set-Cookie at the end of it lands.
 *
 * It follows that this component performs no request and holds no state. Nothing to load, nothing
 * to fail, nothing to put in Redux.
 */

// Mirrors api.js's API_BASE. Deliberately re-declared rather than imported: api.js is the fetch
// boundary and this is a navigation, not a request — O3 leaves that module untouched (§7.2).
const OAUTH_START_PATH = '/api/v1/auth/oauth/google/start';

// Where to land after a successful sign-in. The server re-validates this against its own allow-list
// and falls back to /timer, so a value from here can widen nothing (§4.11).
const DEFAULT_RETURN_TO = '/timer';

function GoogleMark() {
  return (
    <svg
      className="oauth-mark"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function OAuthButtons({ returnTo = DEFAULT_RETURN_TO }) {
  /*
   * Memoised because the login form re-renders on every keystroke, and resolving the zone means
   * constructing an Intl.DateTimeFormat each time. The zone cannot change mid-render anyway.
   */
  const href = useMemo(() => {
    const params = new URLSearchParams({ returnTo: returnTo || DEFAULT_RETURN_TO });
    // Same reason sign-up sends it: the server buckets the account's days by zone, and an account
    // created through Google has no other chance to tell it. Omitted rather than guessed on failure.
    const timezone = detectTimeZone();
    if (timezone) params.set('tz', timezone);
    return `${OAUTH_START_PATH}?${params.toString()}`;
  }, [returnTo]);

  return (
    <div className="oauth">
      <a className="oauth-button" href={href}>
        <GoogleMark />
        <span className="oauth-button__label">Continue with Google</span>
      </a>

      {/* Decorative separator: the "or" carries no information a screen reader needs. */}
      <div className="oauth-divider" aria-hidden="true">
        or
      </div>
    </div>
  );
}

export default OAuthButtons;
