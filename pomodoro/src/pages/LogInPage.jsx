import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Notification from '../components/Notification.jsx';
import OAuthButtons from '../components/OAuthButtons.jsx';
import useAuth from '../hooks/useAuth.js';
import { ApiError } from '../services/api.js';
import { landingPathFor } from '../services/admin.js';
import '../styles/LogInPage.css';

const APP_NAME = 'Evergrove';

/*
 * A provider sign-in that fails comes back as a redirect to /login?oauth_error=<code>, not as a
 * Problem Document — a browser navigation renders whatever it is given, and a JSON body would land
 * the user on a page of raw JSON (CONTRACT §4.12). The server sends a code and nothing else; every
 * word the user reads is written here, and the provider's own error_description is never forwarded.
 */
const OAUTH_ERRORS = {
  access_denied: 'Sign-in was cancelled.',
  invalid_request: 'That sign-in link expired. Please try again.',
  email_unverified: 'Google has not verified that email address.',
  email_exists:
    'An Evergrove account already uses that email. Sign in with your password, then connect Google from your profile.',
  already_linked: 'That Google account is already connected to another Evergrove account.',
  provider_unavailable: 'Google could not be reached. Please try again.',
};

// An unrecognised code still gets a sentence. It is never logged: an unknown value here means the
// server grew a code this build has not seen, which is a deployment fact, not something to shout
// about in the user's console.
const OAUTH_ERROR_FALLBACK = 'Sign-in with Google did not complete. Please try again.';

function LeafIcon() {
  return (
    <svg
      className="login-leaf"
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

/*
 * Turn a failed sign-in into one sentence for the toast.
 *
 * Note what is deliberately absent: any branch that distinguishes "no such account" from "wrong
 * password". The server answers both identically, and the UI must not invent a difference.
 */
function describeFailure(error) {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.isNetworkError) return error.message;
  if (error.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (error.status === 422) {
    return Object.values(error.fieldErrors)[0] ?? 'Enter your email or username and password.';
  }
  return error.message;
}

function LogInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn } = useAuth();

  const [values, setValues] = useState({ identifier: '', password: '' });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [notification, setNotification] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // The page the user was originally sent here from, reused by both sign-in methods so they cannot
  // land somewhere different. The server re-validates it before redirecting (§4.11).
  const intended = location.state?.from?.pathname;

  /*
   * A failed provider sign-in is reported by the URL, so the toast for it is derived rather than
   * stored: copying the parameter into state on mount would be an effect whose only job is to
   * mirror something React can already see. A password failure is a live event and does own state,
   * and it takes precedence — it describes what the user just did, not what happened before.
   */
  const oauthError = searchParams.get('oauth_error');
  const shownNotification =
    notification ??
    (oauthError
      ? { type: 'error', message: OAUTH_ERRORS[oauthError] ?? OAUTH_ERROR_FALLBACK }
      : null);

  /*
   * Dismissing consumes the parameter as well as the state. Left in place it would re-raise a
   * message about a finished attempt on every reload, and would resurface underneath the next
   * password failure the moment that one cleared.
   */
  function dismissNotification() {
    setNotification(null);
    if (!oauthError) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('oauth_error');
        return next;
      },
      // `state` is carried across explicitly: this is still a navigation, and dropping it would
      // lose the page the user was originally headed for.
      { replace: true, state: location.state },
    );
  }

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  // Both fields must be filled before a login can be attempted. We deliberately do not validate
  // the identifier's shape or show inline errors — an invalid credential pair is surfaced only
  // through the global toast on submit.
  const canSubmit = values.identifier.trim() !== '' && values.password !== '';
  const disabled = isLoading || isSuccess || !canSubmit;

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (disabled) return;

    setStatus('loading');
    dismissNotification();

    try {
      const user = await signIn({ identifier: values.identifier, password: values.password });
      setStatus('success');
      /*
       * The token is in the store; go where the user was headed, and otherwise to whichever page
       * this account starts on — the panel for an admin, the Timer for everyone else.
       *
       * `signIn`'s return value is read rather than the `user` from `useAuth()`: the store has been
       * updated by now, but this closure still holds the render's value, which is null. The resolved
       * account is the only thing here that is not one render behind.
       */
      navigate(intended ?? landingPathFor(user), { replace: true });
    } catch (error) {
      setStatus('idle');
      // No field highlighting — a single global toast reports the failure.
      setNotification({ type: 'error', message: describeFailure(error) });
    }
  }

  return (
    <div className="login">
      <Notification
        type={shownNotification?.type}
        message={shownNotification?.message}
        onClose={dismissNotification}
      />

      <main className="login-main">
        <div className="login-card">
          <Link to="/" className="login-brand" aria-label={`${APP_NAME} home`}>
            <LeafIcon />
            <span className="login-brand__name">{APP_NAME}</span>
          </Link>

          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">
            Log in to return to your focus and keep your streak growing.
          </p>

          <OAuthButtons returnTo={intended} />

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label className="login-label" htmlFor="identifier">
                Email or username
              </label>
              <div className="login-control">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  className="login-input"
                  value={values.identifier}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck="false"
                  onChange={handleChange}
                  disabled={isLoading || isSuccess}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="password">
                Password
              </label>
              <div className="login-control">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={values.password}
                  autoComplete="current-password"
                  onChange={handleChange}
                  disabled={isLoading || isSuccess}
                />
                <button
                  type="button"
                  className="login-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={disabled}>
              {isLoading ? 'Logging in…' : isSuccess ? 'Logged in' : 'Log In'}
            </button>
          </form>

          {/*
           * An account created through Google has no password, and the form above cannot say so:
           * answering "that account has no password" to anyone who types an email would turn the
           * login form into an account-enumeration endpoint. The rejection stays generic and this
           * static line is the way out — it is shown to everyone and reveals nothing.
           */}
          <p className="login-hint">Signed up with Google? Use Continue with Google above.</p>

          <p className="login-redirect">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="login-redirect__link">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default LogInPage;
