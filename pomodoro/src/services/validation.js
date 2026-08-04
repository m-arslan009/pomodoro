/*
 * validation.js — pure, framework-agnostic form validation. Each helper returns a
 * human-readable error string, or an empty string when the value is valid.
 *
 * These rules are a MIRROR of the server's, not the authority: src/domain/identifier.ts,
 * src/domain/password-policy.ts and src/domain/settings.ts in the backend decide what is
 * actually accepted. They exist here so a user gets an answer without a round trip — which
 * means a rule that is looser here than there produces a form that passes and then fails.
 * Keep the numbers identical.
 */

import { LABEL_MAX_LENGTH } from './settings.js';

// Pragmatic email shape check: something@something.tld with no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * Length-first password policy. Composition rules (a letter, a digit, a symbol) pushed users
 * toward predictable substitutions without adding real entropy, so length carries the strength
 * instead. The maximum matches the server's cap on hashing work.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 320;

/** The shortest identifier fragment worth refusing inside a password. */
const MIN_FRAGMENT_LENGTH = 3;

/** First/Last name — required, 2–50 characters, no digits. */
export function validateName(value, label = 'Name') {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < NAME_MIN_LENGTH)
    return `${label} must be at least ${NAME_MIN_LENGTH} characters.`;
  if (trimmed.length > NAME_MAX_LENGTH)
    return `${label} must be ${NAME_MAX_LENGTH} characters or fewer.`;
  if (/\d/.test(trimmed)) return `${label} cannot contain numbers.`;
  return '';
}

/** Email — required, within the server's column width, and syntactically valid. */
export function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required.';
  if (trimmed.length > EMAIL_MAX_LENGTH) return 'Email is too long.';
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

function containsFragment(password, fragment) {
  if (!fragment) return false;
  const normalized = String(fragment).trim().toLowerCase();
  if (normalized.length < MIN_FRAGMENT_LENGTH) return false;
  return password.toLowerCase().includes(normalized);
}

/**
 * Password — length first, plus a refusal to embed the user's own identifiers.
 * `identifiers` is optional so the rule can also be applied where only one is known.
 */
export function validatePassword(value, identifiers = {}) {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (value.length > PASSWORD_MAX_LENGTH)
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;

  const emailLocalPart = identifiers.email ? String(identifiers.email).split('@')[0] : '';
  if (containsFragment(value, identifiers.username) || containsFragment(value, emailLocalPart)) {
    return 'Password must not contain your username or email address.';
  }

  return '';
}

/** Confirm password — required and an exact match of the password. */
export function validateConfirmPassword(password, confirm) {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}

/* ---------------------------------------------------------------- Settings -- */
/*
 * Mirrors backend/src/domain/settings.ts. The limits themselves live in services/settings.js
 * alongside the rest of the mirror, so there is one client-side copy of each number.
 */

/**
 * A timer duration — a whole number of minutes inside the field's range.
 *
 * Takes the limits rather than importing them so the caller names which field it is validating;
 * the two durations have different maxima and one shared message shape.
 *
 * @param {string|number} value Raw input; the field keeps it as a string while being typed.
 * @param {{min: number, max: number}} limits
 * @param {string} label
 */
export function validateDuration(value, limits, label = 'Duration') {
  const raw = String(value).trim();
  if (!raw) return `${label} is required.`;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes)) return `${label} must be a whole number of minutes.`;
  if (minutes < limits.min || minutes > limits.max) {
    return `${label} must be between ${limits.min} and ${limits.max} minutes.`;
  }
  return '';
}

/**
 * A timer phase label. Empty is valid and means "use the built-in label", so this rejects only
 * length — measured after trimming, exactly as the server does, so surrounding whitespace the
 * user cannot see never costs them characters they can.
 */
export function validateLabel(value) {
  if (value.trim().length > LABEL_MAX_LENGTH) {
    return `Labels must be ${LABEL_MAX_LENGTH} characters or fewer.`;
  }
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
    password: validatePassword(values.password, {
      username: values.username,
      email: values.email,
    }),
    confirmPassword: validateConfirmPassword(values.password, values.confirmPassword),
  };
  const isValid = Object.values(errors).every((message) => message === '');
  return { errors, isValid };
}
