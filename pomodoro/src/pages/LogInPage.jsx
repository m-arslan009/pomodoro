import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Notification from '../components/Notification.jsx';
import useAuth from '../hooks/useAuth.js';
import { ApiError } from '../services/api.js';
import '../styles/LogInPage.css';

const APP_NAME = 'Evergrove';

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
  const { signIn } = useAuth();

  const [values, setValues] = useState({ identifier: '', password: '' });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [notification, setNotification] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

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
    setNotification(null);

    try {
      await signIn({ identifier: values.identifier, password: values.password });
      setStatus('success');
      // The token is in the store; go where the user was headed.
      navigate(location.state?.from?.pathname ?? '/timer', { replace: true });
    } catch (error) {
      setStatus('idle');
      // No field highlighting — a single global toast reports the failure.
      setNotification({ type: 'error', message: describeFailure(error) });
    }
  }

  return (
    <div className="login">
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
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
