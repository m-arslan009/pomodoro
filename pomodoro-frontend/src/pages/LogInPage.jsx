import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Notification from '../components/Notification.jsx';
import { verifyCredentials, startSession } from '../services/auth.js';
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

function LogInPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: '', password: '' });
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [notification, setNotification] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  // Both fields must be filled before a login can be attempted. We deliberately
  // do not validate field shape or show inline errors — an invalid credential
  // pair is surfaced only through the global toast on submit.
  const canSubmit = values.username.trim() !== '' && values.password !== '';
  const disabled = isLoading || isSuccess || !canSubmit;

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (disabled) return;

    setStatus('loading');
    setNotification(null);

    // Simulate the async gap a real API call would introduce, so loading and
    // success states behave exactly as they do on the Sign Up page.
    setTimeout(() => {
      if (!verifyCredentials(values.username, values.password)) {
        // No field highlighting — a single global toast reports the failure.
        setStatus('idle');
        setNotification({
          type: 'error',
          message: 'The username or password is incorrect.',
        });
        return;
      }

      // Success — record the session, then route to the dashboard.
      startSession();
      setStatus('success');
      setNotification({
        type: 'success',
        message: 'Welcome back! Redirecting you to your dashboard…',
      });
      setTimeout(() => navigate('/timer'), 1400);
    }, 600);
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
              <label className="login-label" htmlFor="username">
                Username
              </label>
              <div className="login-control">
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="login-input"
                  value={values.username}
                  autoComplete="username"
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
