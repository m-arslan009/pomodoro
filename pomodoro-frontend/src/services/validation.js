/*
 * validation.js — pure, framework-agnostic form validation for the Sign Up
 * flow (and reusable by Sign In later). Each helper returns a localized,
 * human-readable error string, or an empty string when the value is valid.
 * Keeping this logic out of the component makes the rules testable in isolation.
 */

// Pragmatic email shape check: something@something.tld with no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;

/** First/Last name — required, at least 2 characters, no digits. */
export function validateName(value, label = 'Name') {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < 2) return `${label} must be at least 2 characters.`;
  if (/\d/.test(trimmed)) return `${label} cannot contain numbers.`;
  return '';
}

/** Email — required and syntactically valid. */
export function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return '';
}

/** Username — required, 3–20 chars, letters/numbers/underscore only. */
export function validateUsername(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Username is required.';
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > 20) return 'Username must be 20 characters or fewer.';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Use only letters, numbers, and underscores.';
  return '';
}

/**
 * Password — at least 8 characters and a mix of letters, numbers, and special
 * characters. Returns the first unmet requirement as a descriptive message.
 */
export function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[a-zA-Z]/.test(value)) return 'Password must include a letter.';
  if (!/\d/.test(value)) return 'Password must include a number.';
  if (!/[^a-zA-Z0-9]/.test(value)) return 'Password must include a special character.';
  return '';
}

/** Confirm password — required and an exact match of the password. */
export function validateConfirmPassword(password, confirm) {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}

/**
 * Validate the whole Sign Up form at once.
 * @returns {{ errors: Record<string,string>, isValid: boolean }}
 */
export function validateSignUpForm(values) {
  const errors = {
    firstName: validateName(values.firstName, 'First name'),
    lastName: validateName(values.lastName, 'Last name'),
    email: validateEmail(values.email),
    username: validateUsername(values.username),
    password: validatePassword(values.password),
    confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
  };
  const isValid = Object.values(errors).every((message) => message === '');
  return { errors, isValid };
}

/**
 * Surface high-risk / security-relevant conditions that are not hard failures
 * but should warn the user (drives the yellow warning toast). Returns a list of
 * messages; an empty list means nothing noteworthy.
 */
export function assessSecurityRisks(values, { emailTaken, usernameTaken } = {}) {
  const warnings = [];

  if (emailTaken) warnings.push('An account with this email already exists.');
  if (usernameTaken) warnings.push('That username is already taken.');

  const password = values.password ?? '';
  const username = (values.username ?? '').trim();
  if (password && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    warnings.push('Your password should not contain your username.');
  }

  return warnings;
}
