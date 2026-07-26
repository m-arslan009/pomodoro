import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assessSecurityRisks, validateSignUpForm } from '../../services/validation.js';
import { findUserByEmail, findUserByUsername, getUsers, saveUser } from '../../services/storage.js';

/*
 * Suite E1/E2 — the sign-up (registration) service.
 *
 * SCOPE NOTE. This app is frontend-only: there is no backend and no HTTP client,
 * so "registering" is the pair of service calls SignUpPage makes on submit —
 * validateSignUpForm + assessSecurityRisks decide whether the account may be
 * created (services/validation.js), and saveUser/findUserBy* create and look it
 * up in the persisted users list (services/storage.js). The storage layer stands
 * in for the network, so the one handled-failure case below is a localStorage
 * write that throws rather than an HTTP error.
 *
 * localStorage is replaced with an in-memory double so no real browser storage
 * is touched and no test can leak state into the next.
 */

// The namespaced key storage.js writes the users list under. Restated here on
// purpose: the persisted shape is public behaviour, so a namespace change must
// fail loudly rather than be silently followed.
const USERS_KEY = 'pomodoro.v1.users';

const VALID_FORM = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@evergrove.app',
  username: 'ada_l',
  password: 'Focus25!',
  confirmPassword: 'Focus25!',
};

let store;
let localStorageMock;
let originalDescriptor;

beforeEach(() => {
  store = new Map();
  localStorageMock = {
    getItem: vi.fn((name) => (store.has(name) ? store.get(name) : null)),
    setItem: vi.fn((name, value) => store.set(name, String(value))),
    removeItem: vi.fn((name) => store.delete(name)),
  };
  originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  // Hand the real storage back so this file cannot affect any other suite.
  Object.defineProperty(window, 'localStorage', originalDescriptor);
});

describe('Suite E1 — Sign-up form validation', () => {
  it('E1.1 — accepts a complete, well-formed registration with no field errors', () => {
    const { errors, isValid } = validateSignUpForm(VALID_FORM);

    expect(isValid).toBe(true);
    // No false positives: every field reports an empty message, not just the
    // aggregate flag.
    expect(Object.values(errors).every((message) => message === '')).toBe(true);
  });

  // One row per field rule the form enforces. Kept as a table rather than six
  // near-identical tests: the behaviour under test is the same each time —
  // the offending field carries its message and the form refuses to submit.
  it.each([
    ['a missing required field', { firstName: '   ' }, 'firstName', 'First name is required.'],
    [
      'a name containing digits',
      { lastName: 'Lovelace2' },
      'lastName',
      'Last name cannot contain numbers.',
    ],
    ['a malformed email', { email: 'ada@evergrove' }, 'email', 'Enter a valid email address.'],
    [
      'a too-short username',
      { username: 'ad' },
      'username',
      'Username must be at least 3 characters.',
    ],
    [
      'a password without a special character',
      { password: 'Focus2555', confirmPassword: 'Focus2555' },
      'password',
      'Password must include a special character.',
    ],
    [
      'a confirmation that does not match',
      { confirmPassword: 'Focus25?' },
      'confirmPassword',
      'Passwords do not match.',
    ],
  ])('E1.2 — rejects %s and names the offending field', (_case, overrides, field, message) => {
    const { errors, isValid } = validateSignUpForm({ ...VALID_FORM, ...overrides });

    expect(isValid).toBe(false);
    expect(errors[field]).toBe(message);
  });

  it('E1.3 — warns about a duplicate email or username and a password carrying the username', () => {
    // Duplicates are reported to the service by the caller (which looked them up
    // via findUserBy*), so this is where "account already exists" is worded.
    expect(assessSecurityRisks(VALID_FORM, { emailTaken: true, usernameTaken: true })).toEqual([
      'An account with this email already exists.',
      'That username is already taken.',
    ]);

    expect(assessSecurityRisks({ ...VALID_FORM, password: 'ada_l2025!' }, {})).toEqual([
      'Your password should not contain your username.',
    ]);

    // A clean, unique registration raises nothing — otherwise every sign-up
    // would be blocked by a warning.
    expect(assessSecurityRisks(VALID_FORM, { emailTaken: false, usernameTaken: false })).toEqual(
      []
    );
  });
});

describe('Suite E2 — Registration persistence', () => {
  it('E2.1 — registering persists a trimmed, non-sensitive profile that reads back', () => {
    const saved = saveUser({ ...VALID_FORM, firstName: '  Ada  ', email: '  ada@evergrove.app  ' });

    expect(saved).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@evergrove.app',
      username: 'ada_l',
    });
    expect(saved.id).toEqual(expect.any(String));
    expect(saved.createdAt).toEqual(expect.any(String));

    // Written once, to the namespaced users key, and readable back as the list.
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(USERS_KEY, JSON.stringify([saved]));
    expect(getUsers()).toEqual([saved]);

    // Credentials never reach storage: the users list holds profiles only.
    const stored = JSON.parse(store.get(USERS_KEY))[0];
    expect(stored).not.toHaveProperty('password');
    expect(stored).not.toHaveProperty('confirmPassword');
    expect(Object.values(stored)).not.toContain(VALID_FORM.password);
  });

  it('E2.2 — a second registration is appended, leaving the first account intact', () => {
    const first = saveUser(VALID_FORM);
    const second = saveUser({ ...VALID_FORM, email: 'grace@evergrove.app', username: 'grace_h' });

    expect(getUsers()).toEqual([first, second]);
  });

  it('E2.3 — finds a registered account by email or username, ignoring case and whitespace', () => {
    // This lookup is what makes the duplicate check in E1.3 fire, so it must not
    // be defeated by the casing or padding a user happens to type.
    const saved = saveUser(VALID_FORM);

    expect(findUserByEmail('  ADA@Evergrove.app ')).toEqual(saved);
    expect(findUserByUsername('  ADA_L  ')).toEqual(saved);

    expect(findUserByEmail('grace@evergrove.app')).toBeNull();
    expect(findUserByUsername('grace_h')).toBeNull();
  });

  it('E2.4 — a failed write leaves no half-registered account behind', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    // Storage full or disabled (private mode): the failure is contained at the
    // storage boundary rather than escaping into the submit handler — and the
    // account does not durably exist, so the user can retry cleanly.
    expect(() => saveUser(VALID_FORM)).not.toThrow();
    expect(getUsers()).toEqual([]);
    expect(findUserByEmail(VALID_FORM.email)).toBeNull();
  });
});
