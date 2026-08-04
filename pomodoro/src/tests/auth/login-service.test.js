import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api.js';
import { changePassword, login, logout } from '../../services/auth.js';

/*
 * Suite D1/D2 — the login service in services/auth.js.
 *
 * SCOPE NOTE. Authentication is a real backend call answering with a single JWT. What this suite
 * asserts is the contract with the API: the right request goes out, the response is unwrapped,
 * failures arrive as ApiError, and nothing about the session ever reaches localStorage.
 *
 * fetch is replaced with a double, so no network is touched.
 */

const USER = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'Ada_L',
  firstName: 'Ada',
  lastName: 'Lovelace',
  timezone: 'Europe/London',
  emailVerified: false,
  createdAt: '2026-07-28T09:00:00.000Z',
};

/** Stands in for the short-lived JWT the login response now returns. */
const ACCESS_TOKEN = 'header.payload.signature';

/** A minimal Response stand-in — only the members services/api.js actually reads. */
function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  };
}

let fetchMock;
let setItemSpy;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setItemSpy = vi.spyOn(window.localStorage, 'setItem');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Suite D1 — Credential verification', () => {
  it('D1.1 — posts the identifier and password to the login endpoint and returns the session', async () => {
    // The response carries the access token alongside the profile. It is the whole credential:
    // there is no second half in a cookie, and no way to renew it.
    fetchMock.mockResolvedValue(
      respond(200, { user: USER, accessToken: ACCESS_TOKEN, expiresIn: 900000 })
    );

    const session = await login({ identifier: 'ada@evergrove.app', password: 'a long passphrase' });

    expect(session).toEqual({ user: USER, accessToken: ACCESS_TOKEN, expiresIn: 900000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      identifier: 'ada@evergrove.app',
      password: 'a long passphrase',
    });
  });

  it('D1.2 — sends no ambient credentials, because the token is the only one', async () => {
    fetchMock.mockResolvedValue(respond(200, { user: USER }));

    await login({ identifier: 'Ada_L', password: 'a long passphrase' });

    // The API sets no cookies and reads none. Asking the browser to attach them would widen the
    // request's authority for nothing, and re-open the CSRF question the bearer header closes.
    expect(fetchMock.mock.calls[0][1].credentials).toBeUndefined();
  });

  it('D1.3 — surfaces a rejected credential pair as a 401 with no field-level detail', async () => {
    fetchMock.mockResolvedValue(
      respond(401, {
        type: 'about:blank',
        title: 'Invalid credentials',
        status: 401,
        detail: 'Incorrect email/username or password.',
      })
    );

    const error = await login({ identifier: 'ada', password: 'wrong' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    // A field error would tell an attacker which half was wrong — the server never sends one.
    expect(error.fieldErrors).toEqual({});
    expect(error.message).toBe('Incorrect email/username or password.');
  });

  it('D1.4 — reports an unreachable server as a network error rather than throwing raw', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await login({ identifier: 'ada', password: 'x' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/could not reach the server/i);
  });

  it('D1.5 — never writes credentials or a session to localStorage', async () => {
    fetchMock.mockResolvedValue(respond(200, { user: USER }));

    await login({ identifier: 'ada@evergrove.app', password: 'a long passphrase' });

    // The token is a bearer credential with no server-side record, so anything that can read it
    // can act as the user until it expires. Memory only is the entire mitigation.
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

describe('Suite D2 — Profile read and teardown', () => {
  it('D2.4 — signing out posts to the API and tolerates an empty 204 response', async () => {
    fetchMock.mockResolvedValue(respond(204, null));

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/logout');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('D2.5 — maps a rejected current password onto its field', async () => {
    fetchMock.mockResolvedValue(
      respond(422, {
        title: 'Validation failed',
        status: 422,
        errors: [{ field: 'currentPassword', message: 'That is not your current password.' }],
      })
    );

    const error = await changePassword({
      currentPassword: 'nope',
      newPassword: 'a long new passphrase',
    }).catch((caught) => caught);

    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({
      currentPassword: 'That is not your current password.',
    });
  });
});
