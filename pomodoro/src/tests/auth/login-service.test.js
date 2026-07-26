import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HARDCODED_USER,
  endSession,
  getSession,
  startSession,
  verifyCredentials,
} from '../../services/auth.js';

/*
 * Suite D1/D2 — the login service in services/auth.js.
 *
 * SCOPE NOTE. This app is frontend-only: there is no backend, no Axios/fetch
 * client, no cookies and no sessionStorage anywhere in src/. "Logging in" means
 * verifying a credential pair against a hardcoded account (verifyCredentials)
 * and persisting the non-sensitive profile to localStorage as the session
 * (startSession) — the two calls LogInPage makes on submit. The storage layer
 * stands in for the network, so the one handled-failure case below is a
 * localStorage write that throws rather than an HTTP error.
 *
 * localStorage is replaced with an in-memory double so no real browser storage
 * is touched and no test can leak state into the next.
 */

// The namespaced key storage.js writes the session under. Restated here on
// purpose: the persisted shape is public behaviour, so a namespace change must
// fail loudly rather than be silently followed.
const SESSION_KEY = 'pomodoro.v1.session';

// Mirrors the private CREDENTIALS constant in auth.js, which is deliberately
// not exported so the password cannot leak into UI state.
const VALID_USERNAME = 'admin';
const VALID_PASSWORD = 'admin123!@#';

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

describe('Suite D1 — Credential verification', () => {
  it('D1.1 — accepts the valid credential pair', () => {
    expect(verifyCredentials(VALID_USERNAME, VALID_PASSWORD)).toBe(true);
  });

  it('D1.2 — matches the username case-insensitively and trimmed, the password exactly', () => {
    // Casing and stray whitespace in the username never lock a user out...
    expect(verifyCredentials('  ADMIN  ', VALID_PASSWORD)).toBe(true);
    // ...but the password is compared byte-for-byte.
    expect(verifyCredentials(VALID_USERNAME, VALID_PASSWORD.toUpperCase())).toBe(false);
  });

  it('D1.3 — rejects a wrong username, a wrong password, and a wrong pair', () => {
    expect(verifyCredentials('not-admin', VALID_PASSWORD)).toBe(false);
    expect(verifyCredentials(VALID_USERNAME, 'wrong-password')).toBe(false);
    expect(verifyCredentials('not-admin', 'wrong-password')).toBe(false);
  });

  it('D1.4 — rejects blank and missing credentials without throwing or writing', () => {
    // Verification is a pure read that always answers with a boolean, so the
    // login form can render its error toast instead of crashing on submit.
    expect(verifyCredentials('', '')).toBe(false);
    expect(verifyCredentials('   ', '   ')).toBe(false);
    expect(verifyCredentials(VALID_USERNAME, '')).toBe(false);
    expect(verifyCredentials(undefined, undefined)).toBe(false);

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

describe('Suite D2 — Session persistence', () => {
  it('D2.1 — starting a session persists the profile and makes it readable back', () => {
    const session = startSession();

    // The signed-in profile is both returned to the caller and written once, to
    // the namespaced session key, as the serialized profile.
    expect(session).toEqual(HARDCODED_USER);
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SESSION_KEY,
      JSON.stringify(HARDCODED_USER)
    );
    expect(getSession()).toEqual(HARDCODED_USER);
  });

  it('D2.2 — never persists the password alongside the session', () => {
    startSession();

    const stored = JSON.parse(store.get(SESSION_KEY));
    expect(stored).not.toHaveProperty('password');
    expect(Object.values(stored)).not.toContain(VALID_PASSWORD);
  });

  it('D2.3 — signing out clears the session and leaves the account able to log in again', () => {
    startSession();

    expect(endSession()).toBe(true);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(getSession()).toBeNull();
    expect(verifyCredentials(VALID_USERNAME, VALID_PASSWORD)).toBe(true);
  });

  it('D2.4 — a failed session write is swallowed, leaving no session behind', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    // Storage full or disabled (private mode): the failure is contained at the
    // storage boundary rather than escaping into the submit handler — but the
    // login does not durably take hold.
    expect(() => startSession()).not.toThrow();
    expect(getSession()).toBeNull();
  });
}); 
