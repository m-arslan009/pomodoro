import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Notification from '../components/Notification.jsx';
import {
  validateName,
  validateEmail,
  validateUsername,
  validatePassword,
  validateConfirmPassword,
  validateSignUpForm,
} from '../services/validation.js';
import useAuth from '../hooks/useAuth.js';
import { ApiError } from '../services/api.js';
import { detectTimeZone } from '../services/auth.js';
import '../styles/SignUpPage.css';

const APP_NAME = 'Evergrove';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
};

// Single source of truth for validating one field, reused on blur and on change.
function validateField(name, values) {
  switch (name) {
    case 'firstName':
      return validateName(values.firstName, 'First name');
    case 'lastName':
      return validateName(values.lastName, 'Last name');
    case 'email':
      return validateEmail(values.email);
    case 'username':
      return validateUsername(values.username);
    case 'password':
      // The identifiers travel with the value: the rule refuses a password that embeds them.
      return validatePassword(values.password, {
        username: values.username,
        email: values.email,
      });
    case 'confirmPassword':
      return validateConfirmPassword(values.password, values.confirmPassword);
    default:
      return '';
  }
}

function LeafIcon() {
  return (
    <svg
      className="signup-leaf"
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

// Non-exported field so the file keeps a single default export (react/only-export-components).
function Field({
  id,
  label,
  type = 'text',
  value,
  error,
  autoComplete,
  onChange,
  onBlur,
  children,
}) {
  const errorId = `${id}-error`;
  return (
    <div className={`signup-field${error ? ' signup-field--invalid' : ''}`}>
      <label className="signup-label" htmlFor={id}>
        {label}
      </label>
      <div className="signup-control">
        <input
          id={id}
          name={id}
          type={type}
          className="signup-input"
          value={value}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
        />
        {children}
      </div>
      {error && (
        <p className="signup-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function SignUpPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [notification, setNotification] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  // Every field must be filled and pass its validation rule before enabling.
  const { isValid: isFormValid } = validateSignUpForm(values);
  const disabled = isLoading || isSuccess || !isFormValid;

  function handleChange(event) {
    const { name, value } = event.target;
    const next = { ...values, [name]: value };
    setValues(next);

    // Live-validate a field only after it has been interacted with, so users
    // aren't scolded while first typing. Password edits also refresh confirm.
    setErrors((prev) => {
      const updated = { ...prev };
      if (touched[name]) updated[name] = validateField(name, next);
      if (name === 'password' && touched.confirmPassword)
        updated.confirmPassword = validateField('confirmPassword', next);
      return updated;
    });
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (disabled) return;

    // 1) Client-side validation — block and point the user at the failing fields. These rules
    //    mirror the server's; the server re-checks every one of them regardless.
    const { errors: allErrors, isValid } = validateSignUpForm(values);
    setErrors(allErrors);
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      password: true,
      confirmPassword: true,
    });

    if (!isValid) {
      setNotification({
        type: 'error',
        message: 'Please fix the highlighted fields and try again.',
      });
      return;
    }

    /*
     * 2) Register. Uniqueness is settled by the server's unique indexes, not by a lookup here:
     *    a client-side "is this taken?" check would be both racy and an account-enumeration
     *    endpoint. A collision comes back as a 409 carrying field errors instead.
     */
    setStatus('loading');
    setNotification(null);

    try {
      await signUp({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        username: values.username,
        password: values.password,
        // Bucketing the user's local days needs their zone; the server falls back to UTC.
        timezone: detectTimeZone() ?? undefined,
      });

      setStatus('success');
      // Registering signs the account in, so land on the dashboard rather than the login form.
      navigate('/timer', { replace: true });
    } catch (error) {
      setStatus('idle');

      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
        setNotification({ type: 'warning', message: Object.values(error.fieldErrors)[0] });
        return;
      }

      setNotification({
        type: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'We could not create your account. Please try again.',
      });
    }
  }

  return (
    <div className="signup">
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      <main className="signup-main">
        <div className="signup-card">
          <Link to="/" className="signup-brand" aria-label={`${APP_NAME} home`}>
            <LeafIcon />
            <span className="signup-brand__name">{APP_NAME}</span>
          </Link>

          <h1 className="signup-title">Create your account</h1>
          <p className="signup-subtitle">Plant your focus and start growing your streak.</p>

          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            <div className="signup-row">
              <Field
                id="firstName"
                label="First name"
                value={values.firstName}
                error={errors.firstName}
                autoComplete="given-name"
                onChange={handleChange}
                onBlur={handleBlur}
              />
              <Field
                id="lastName"
                label="Last name"
                value={values.lastName}
                error={errors.lastName}
                autoComplete="family-name"
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>

            <Field
              id="email"
              label="Email"
              type="email"
              value={values.email}
              error={errors.email}
              autoComplete="email"
              onChange={handleChange}
              onBlur={handleBlur}
            />

            <Field
              id="username"
              label="Username"
              value={values.username}
              error={errors.username}
              autoComplete="username"
              onChange={handleChange}
              onBlur={handleBlur}
            />

            <Field
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              error={errors.password}
              autoComplete="new-password"
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <button
                type="button"
                className="signup-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </Field>

            <Field
              id="confirmPassword"
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              value={values.confirmPassword}
              error={errors.confirmPassword}
              autoComplete="new-password"
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <button
                type="button"
                className="signup-toggle"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                aria-pressed={showConfirm}
              >
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </Field>

            <button type="submit" className="signup-submit" disabled={disabled}>
              {isLoading ? 'Creating account…' : isSuccess ? 'Account created' : 'Sign Up'}
            </button>
          </form>

          <p className="signup-redirect">
            Already have an account?{' '}
            <Link to="/login" className="signup-redirect__link">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default SignUpPage;
