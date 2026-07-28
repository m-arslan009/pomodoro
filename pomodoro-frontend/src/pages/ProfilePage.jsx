import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import Notification from '../components/Notification.jsx';
import { getProfile, updateProfile, verifyPassword, changePassword } from '../services/auth.js';
import {
  validateName,
  validateUsername,
  validatePassword,
  validateConfirmPassword,
} from '../services/validation.js';
import '../styles/ProfilePage.css';

/*
 * ProfilePage — view and edit the signed-in account, scoped inside the forest
 * .app-shell so it reuses the shared glass/forest tokens (--fg-*, --glass-*)
 * exactly like the Settings and History dashboards.
 *
 * Two independent glass cards, each with its own dirty-tracking + validation:
 *   1. Profile details — first/last name and username are editable; email is
 *      fixed (frontend-only single account) and shown read-only.
 *   2. Password        — verify the current password, then set a new one.
 *
 * Edits persist through auth.js (updateProfile / changePassword), which keeps
 * the active session in sync so the change is reflected app-wide immediately.
 */

// Build the avatar initials from whatever name parts are available.
function initialsOf({ firstName, lastName, username }) {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  const combined = `${first}${last}`.trim();
  return (combined || username?.trim()?.[0] || '?').toUpperCase();
}

// Shared labelled text field: forest-styled input, inline error, optional
// trailing slot (used for the password show/hide toggle). Non-exported so the
// file keeps a single default export (react/only-export-components).
function Field({
  id,
  label,
  type = 'text',
  value,
  error,
  autoComplete,
  readOnly = false,
  hint,
  onChange,
  onBlur,
  children,
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`profile-field${error ? ' profile-field--invalid' : ''}`}>
      <label className="profile-field__label" htmlFor={id}>
        {label}
      </label>
      <div className={`profile-control${readOnly ? ' profile-control--readonly' : ''}`}>
        <input
          id={id}
          name={id}
          type={type}
          className="profile-input"
          value={value}
          autoComplete={autoComplete}
          readOnly={readOnly}
          aria-readonly={readOnly || undefined}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        {children}
      </div>
      {hint && !error && (
        <p className="profile-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="profile-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function ProfilePage() {
  // Persisted account is the baseline; the details form tracks unsaved edits and
  // the baseline only advances after a successful save.
  const [profile, setProfile] = useState(() => getProfile());
  const [details, setDetails] = useState(() => ({
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
  }));
  const [detailErrors, setDetailErrors] = useState({});

  const [pwd, setPwd] = useState(EMPTY_PASSWORD_FORM);
  const [pwdErrors, setPwdErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [notification, setNotification] = useState(null);

  const detailsDirty =
    details.firstName !== profile.firstName ||
    details.lastName !== profile.lastName ||
    details.username !== profile.username;

  /* --------------------------------------------------------- Profile details */
  function setDetailField(key, value) {
    setDetails((prev) => ({ ...prev, [key]: value }));
    setDetailErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function validateDetails(values) {
    return {
      firstName: validateName(values.firstName, 'First name'),
      lastName: validateName(values.lastName, 'Last name'),
      username: validateUsername(values.username),
    };
  }

  function handleDetailBlur(event) {
    const { name } = event.target;
    const message = validateDetails(details)[name];
    setDetailErrors((prev) => ({ ...prev, [name]: message || undefined }));
  }

  function handleDetailsSubmit(event) {
    event.preventDefault();
    if (!detailsDirty) return;

    const found = validateDetails(details);
    const active = Object.fromEntries(Object.entries(found).filter(([, message]) => message));
    setDetailErrors(active);
    if (Object.keys(active).length > 0) {
      setNotification({
        type: 'error',
        message: 'Please fix the highlighted fields before saving.',
      });
      return;
    }

    const merged = updateProfile(details);
    setProfile(merged);
    setDetails({
      firstName: merged.firstName,
      lastName: merged.lastName,
      username: merged.username,
    });
    setNotification({ type: 'success', message: 'Your profile has been updated.' });
  }

  function handleDetailsReset() {
    setDetails({
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
    });
    setDetailErrors({});
  }

  /* --------------------------------------------------------------- Password */
  function setPwdField(key, value) {
    setPwd((prev) => ({ ...prev, [key]: value }));
    setPwdErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function handlePwdSubmit(event) {
    event.preventDefault();

    const errors = {};
    if (!pwd.currentPassword) {
      errors.currentPassword = 'Enter your current password.';
    } else if (!verifyPassword(pwd.currentPassword)) {
      errors.currentPassword = 'That is not your current password.';
    }

    const newError = validatePassword(pwd.newPassword);
    if (newError) errors.newPassword = newError;
    else if (pwd.newPassword === pwd.currentPassword)
      errors.newPassword = 'Choose a password different from your current one.';

    const confirmError = validateConfirmPassword(pwd.newPassword, pwd.confirmPassword);
    if (confirmError) errors.confirmPassword = confirmError;

    setPwdErrors(errors);
    if (Object.keys(errors).length > 0) {
      setNotification({
        type: 'error',
        message: 'Please fix the highlighted fields before saving.',
      });
      return;
    }

    if (!changePassword(pwd.newPassword)) {
      setNotification({
        type: 'error',
        message: 'Could not update your password. Please try again.',
      });
      return;
    }

    setPwd(EMPTY_PASSWORD_FORM);
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setNotification({
      type: 'success',
      message: 'Your password has been changed.',
    });
  }

  return (
    <AppLayout>
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      <div className="profile-page">
        <header className="profile-page__head">
          <h1 className="profile-page__title">Profile</h1>
          <p className="profile-page__subtitle">
            Manage your account details and password. Your email is fixed and can&apos;t be changed.
          </p>
        </header>

        {/* Identity summary */}
        <section className="profile-identity" aria-label="Account summary">
          <div className="profile-avatar" aria-hidden="true">
            {initialsOf(profile)}
          </div>
          <div className="profile-identity__text">
            <p className="profile-identity__name">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="profile-identity__meta">@{profile.username}</p>
            <p className="profile-identity__meta">{profile.email}</p>
          </div>
        </section>

        {/* Profile details form */}
        <form className="profile-card" onSubmit={handleDetailsSubmit} noValidate>
          <div className="profile-card__head">
            <h2 className="profile-card__title">Account details</h2>
            <p className="profile-card__hint">
              Update your name and username. Changes apply across the app right away.
            </p>
          </div>

          <div className="profile-fields">
            <div className="profile-fields__row">
              <Field
                id="firstName"
                label="First name"
                value={details.firstName}
                error={detailErrors.firstName}
                autoComplete="given-name"
                onChange={(e) => setDetailField('firstName', e.target.value)}
                onBlur={handleDetailBlur}
              />
              <Field
                id="lastName"
                label="Last name"
                value={details.lastName}
                error={detailErrors.lastName}
                autoComplete="family-name"
                onChange={(e) => setDetailField('lastName', e.target.value)}
                onBlur={handleDetailBlur}
              />
            </div>

            <Field
              id="username"
              label="Username"
              value={details.username}
              error={detailErrors.username}
              autoComplete="username"
              onChange={(e) => setDetailField('username', e.target.value)}
              onBlur={handleDetailBlur}
            />

            <Field
              id="email"
              label="Email"
              type="email"
              value={profile.email}
              readOnly
              hint="Your email address can't be changed."
              onChange={() => {}}
            />
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              onClick={handleDetailsReset}
              disabled={!detailsDirty}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="profile-btn profile-btn--primary"
              disabled={!detailsDirty}
            >
              Save changes
            </button>
          </div>
        </form>

        {/* Change password form */}
        <form className="profile-card" onSubmit={handlePwdSubmit} noValidate>
          <div className="profile-card__head">
            <h2 className="profile-card__title">Change password</h2>
            <p className="profile-card__hint">
              Use at least 8 characters with a mix of letters, numbers, and a special character.
            </p>
          </div>

          <div className="profile-fields">
            <Field
              id="currentPassword"
              label="Current password"
              type={showCurrent ? 'text' : 'password'}
              value={pwd.currentPassword}
              error={pwdErrors.currentPassword}
              autoComplete="current-password"
              onChange={(e) => setPwdField('currentPassword', e.target.value)}
            >
              <button
                type="button"
                className="profile-toggle"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                aria-pressed={showCurrent}
              >
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </Field>

            <div className="profile-fields__row">
              <Field
                id="newPassword"
                label="New password"
                type={showNew ? 'text' : 'password'}
                value={pwd.newPassword}
                error={pwdErrors.newPassword}
                autoComplete="new-password"
                onChange={(e) => setPwdField('newPassword', e.target.value)}
              >
                <button
                  type="button"
                  className="profile-toggle"
                  onClick={() => setShowNew((s) => !s)}
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  aria-pressed={showNew}
                >
                  {showNew ? 'Hide' : 'Show'}
                </button>
              </Field>

              <Field
                id="confirmPassword"
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                value={pwd.confirmPassword}
                error={pwdErrors.confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setPwdField('confirmPassword', e.target.value)}
              >
                <button
                  type="button"
                  className="profile-toggle"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </Field>
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="profile-btn profile-btn--primary">
              Update password
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default ProfilePage;
