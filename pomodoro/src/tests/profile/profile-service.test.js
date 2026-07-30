import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api.js';
import {
  fetchAvatarImage,
  fetchProfile,
  updateProfile,
  uploadAvatar,
} from '../../services/profile.js';

/*
 * Suite I — services/profile.js, the profile's half of the HTTP boundary.
 *
 * SCOPE NOTE. Suite J drives the page and doubles this module out. This one is the other side of
 * that seam: it asserts the wire contract the page is entitled to assume — the right URL and
 * method, PATCH carrying only what changed, the server's answer being what the caller adopts,
 * and failures arriving as ApiError with the field errors already unpacked.
 *
 * fetch is replaced with a double, so no network is touched.
 */

const PROFILE = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'Ada_L',
  firstName: 'Ada',
  lastName: 'Lovelace',
  timezone: 'Europe/London',
  emailVerified: false,
  avatarUpdatedAt: null,
  createdAt: '2026-07-28T09:00:00.000Z',
};

/** A minimal Response stand-in — only the members services/api.js actually reads. */
function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  };
}

/** An RFC 9457 problem document, shaped as the API's exception filter renders one. */
function problem(status, title, detail, errors) {
  return respond(status, { type: 'about:blank', title, status, detail, errors });
}

function respondWithImage(blob) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => blob.type },
    blob: () => Promise.resolve(blob),
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

describe('Suite I1 — Reading the profile', () => {
  it('I1.1 — reads /me and unwraps the profile from the envelope', async () => {
    fetchMock.mockResolvedValue(respond(200, { user: PROFILE }));

    await expect(fetchProfile()).resolves.toEqual(PROFILE);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/me');
    expect(init.method).toBe('GET');
  });

  it('I1.2 — surfaces a rejected session as an ApiError rather than a null profile', async () => {
    // The page swallows this failure, but it must arrive as one: a resolved `undefined` would be
    // adopted into Redux as the signed-in account.
    fetchMock.mockResolvedValue(problem(401, 'Not authenticated', 'Sign in to continue.'));

    const error = await fetchProfile().catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
  });
});

describe('Suite I2 — Updating the profile', () => {
  it('I2.1 — PATCHes only the fields it was given', async () => {
    fetchMock.mockResolvedValue(respond(200, { user: { ...PROFILE, firstName: 'Grace' } }));

    await updateProfile({ firstName: 'Grace' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/me');
    expect(init.method).toBe('PATCH');
    // PATCH semantics: an absent key means "leave it alone", which is not the same as sending
    // the current value back.
    expect(JSON.parse(init.body)).toEqual({ firstName: 'Grace' });
  });

  it('I2.2 — returns what the server stored, not what was submitted', async () => {
    fetchMock.mockResolvedValue(respond(200, { user: { ...PROFILE, username: 'Grace_H' } }));

    // The server trims and normalises. Callers adopt its answer, or the app drifts from the row.
    await expect(updateProfile({ username: '  Grace_H  ' })).resolves.toMatchObject({
      username: 'Grace_H',
    });
  });

  it.each([
    [
      'a username already held by someone else',
      problem(409, 'Username taken', 'That username is already in use.', [
        { field: 'username', message: 'That username is already taken.' },
      ]),
      409,
      { username: 'That username is already taken.' },
    ],
    [
      'a value the server refuses',
      problem(422, 'Validation failed', 'The request did not pass validation.', [
        { field: 'firstName', message: 'First name cannot contain numbers.' },
      ]),
      422,
      { firstName: 'First name cannot contain numbers.' },
    ],
  ])(
    'I2.3 — reports %s as a field error the form can render',
    async (_case, response, status, fieldErrors) => {
      fetchMock.mockResolvedValue(response);

      const error = await updateProfile({ username: 'ada' }).catch((caught) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(status);
      expect(error.fieldErrors).toEqual(fieldErrors);
    }
  );
});

describe('Suite I3 — The avatar image', () => {
  it('I3.1 — reads the bytes from /me/avatar as a data URL', async () => {
    // An <img> cannot send a bearer token, so the image comes through the authenticated path and
    // is inlined rather than pointed at.
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    fetchMock.mockResolvedValue(respondWithImage(png));

    const dataUrl = await fetchAvatarImage();

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/me/avatar');
  });

  it('I3.2 — treats a 404 as "no photo" rather than a failure', async () => {
    fetchMock.mockResolvedValue(problem(404, 'Not found', 'This account has no profile photo.'));

    await expect(fetchAvatarImage()).resolves.toBeNull();
  });

  it('I3.3 — lets any other failure through, so a broken endpoint is not read as "no photo"', async () => {
    fetchMock.mockResolvedValue(
      problem(500, 'Internal server error', 'Something went wrong. Please try again.')
    );

    await expect(fetchAvatarImage()).rejects.toBeInstanceOf(ApiError);
  });

  it('I3.4 — PUTs the image as multipart under "avatar" and sets no Content-Type by hand', async () => {
    fetchMock.mockResolvedValue(
      respond(200, { user: { ...PROFILE, avatarUpdatedAt: '2026-07-30T10:00:00.000Z' } })
    );

    await uploadAvatar(new Blob(['prepared bytes'], { type: 'image/webp' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/me/avatar');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('avatar')).toBeInstanceOf(Blob);
    expect(init.body.get('avatar').type).toBe('image/webp');
    // Only the browser knows the boundary it generated. Naming the type by hand omits it, and the
    // server then cannot parse a request that looks perfectly well formed.
    expect((init.headers ?? {})['Content-Type']).toBeUndefined();
  });
});
