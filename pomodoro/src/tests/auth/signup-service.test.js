import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateSignUpForm,
} from '../../services/validation.js';
import { ApiError } from '../../services/api.js';
import { register } from '../../services/auth.js';

/*
 * Suite E1/E2 — the sign-up (registration) service.
 *
 * SCOPE NOTE. Registration is now a backend call. Two things are worth asserting separately:
 * the client-side rules that spare the user a round trip (validateSignUpForm), and the contract
 * with the API — including that uniqueness is decided by the server, since a client-side
 * "is this taken?" lookup would be both racy and an account-enumeration oracle.
 */

const VALID_FORM = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@evergrove.app',
  username: 'ada_l',
  password: 'correct horse battery',
  confirmPassword: 'correct horse battery',
};

function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  };
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Suite E1 — Sign-up form validation', () => {
  it('E1.1 — accepts a complete, well-formed registration with no field errors', () => {
    const { errors, isValid } = validateSignUpForm(VALID_FORM);

    expect(isValid).toBe(true);
    expect(Object.values(errors).every((message) => message === '')).toBe(true);
  });

  it('E1.2 — accepts a long passphrase with no digits or symbols', () => {
    // The length-first policy: this is stronger than "Focus25!", which the old composition
    // rules accepted and this one rejects for being too short.
    const { isValid } = validateSignUpForm({
      ...VALID_FORM,
      password: 'seven green apples',
      confirmPassword: 'seven green apples',
    });

    expect(isValid).toBe(true);
  });

  // One row per field rule the form enforces. Kept as a table rather than six near-identical
  // tests: the behaviour under test is the same each time — the offending field carries its
  // message and the form refuses to submit.
  it.each([
    ['a missing required field', { firstName: '   ' }, 'firstName', 'First name is required.'],
    [
      'a name containing digits',
      { lastName: 'Lovelace2' },
      'lastName',
      'Last name cannot contain numbers.',
    ],
    ['a malformed email', { email: 'ada@evergrove' }, 'email', 'Enter a valid email address.'],
    /*
     * The four rows below mirror server limits the client used to omit. A client rule looser
     * than the server's produces a form that passes and then fails at the API with a 422 the
     * user never had a chance to avoid, so each one is pinned to the server's exact wording.
     */
    [
      'a name above the maximum length',
      { firstName: 'A'.repeat(51) },
      'firstName',
      'First name must be 50 characters or fewer.',
    ],
    [
      'an email above the maximum length',
      { email: `${'a'.repeat(310)}@evergrove.app` },
      'email',
      'Email is too long.',
    ],
    [
      'a too-short username',
      { username: 'ad' },
      'username',
      'Username must be at least 3 characters.',
    ],
    [
      'a too-long username',
      { username: 'a'.repeat(21) },
      'username',
      'Username must be 20 characters or fewer.',
    ],
    [
      'a username with unsupported characters',
      { username: 'ada-l' },
      'username',
      'Use only letters, numbers, and underscores.',
    ],
    [
      'a password below the minimum length',
      { password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) },
      'password',
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ],
    [
      'a password above the maximum length',
      { password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) },
      'password',
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    ],
    [
      'a password containing the username',
      { password: 'my ada_l password' },
      'password',
      'Password must not contain your username or email address.',
    ],
    [
      'a confirmation that does not match',
      { confirmPassword: 'something else entirely' },
      'confirmPassword',
      'Passwords do not match.',
    ],
  ])('E1.3 — rejects %s and names the offending field', (_case, overrides, field, message) => {
    const { errors, isValid } = validateSignUpForm({ ...VALID_FORM, ...overrides });

    expect(isValid).toBe(false);
    expect(errors[field]).toBe(message);
  });
});

describe('Suite E2 — Registration against the API', () => {
  it('E2.1 — posts the profile and password, and never the confirmation field', async () => {
    fetchMock.mockResolvedValue(respond(201, { user: { id: 'u1', username: 'ada_l' } }));

    await register({ ...VALID_FORM, timezone: 'Europe/London' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/register');
    expect(init.method).toBe('POST');

    const sent = JSON.parse(init.body);
    expect(sent).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@evergrove.app',
      username: 'ada_l',
      password: 'correct horse battery',
      timezone: 'Europe/London',
    });
    expect(sent).not.toHaveProperty('confirmPassword');
  });

  it('E2.2 — returns the created account, which is signed in by the same response', async () => {
    const created = { id: 'u1', username: 'Ada_L', email: 'ada@evergrove.app' };
    // "Signed in by the same response" is now literal: registering mints the access token too.
    fetchMock.mockResolvedValue(
      respond(201, { user: created, accessToken: 'header.payload.signature', expiresIn: 900000 })
    );

    await expect(register(VALID_FORM)).resolves.toEqual({
      user: created,
      accessToken: 'header.payload.signature',
      expiresIn: 900000,
    });
  });

  it('E2.3 — maps a taken email or username onto the offending fields', async () => {
    fetchMock.mockResolvedValue(
      respond(409, {
        title: 'Account already exists',
        status: 409,
        errors: [
          { field: 'email', message: 'An account with this email already exists.' },
          { field: 'username', message: 'That username is already taken.' },
        ],
      })
    );

    const error = await register(VALID_FORM).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    // Uniqueness is the database's answer, delivered as field errors the form can render —
    // there is no client-side lookup, and no endpoint that would confirm an address exists.
    expect(error.fieldErrors).toEqual({
      email: 'An account with this email already exists.',
      username: 'That username is already taken.',
    });
  });

  it('E2.4 — a failed registration leaves nothing behind locally', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    fetchMock.mockResolvedValue(respond(422, { title: 'Validation failed', status: 422 }));

    await expect(register(VALID_FORM)).rejects.toBeInstanceOf(ApiError);
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
