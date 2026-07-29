import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../../services/api.js';
import * as authService from '../../services/auth.js';
import { adoptCacheOwner } from '../../services/storage.js';
import authReducer, {
  login,
  logout,
  sessionCleared,
  sessionRefreshed,
  signUp,
  userUpdated,
} from '../../store/authSlice.js';

/*
 * Suite F — the auth slice (store/authSlice.js).
 *
 * SCOPE NOTE. This is the state layer only: services/auth.js is doubled, so no request is made
 * and the suite is about transitions, not transport. Two properties carry real weight here.
 *
 * There is no startup bootstrap. The access token is held in memory and nothing is persisted, so
 * a cold store is anonymous by definition — `status` starts at 'anonymous' and the route guards
 * can answer synchronously.
 *
 * The access token is a JWT. Anything that can read it can act as the user, so the localStorage
 * assertions below scan what was actually written rather than trusting that nobody wrote
 * anything.
 *
 * adoptCacheOwner is left real (spied, not stubbed) because its whole job is a side effect on
 * localStorage — stubbing it would make the storage assertions vacuous.
 */

vi.mock('../../services/auth.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../services/storage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, adoptCacheOwner: vi.fn(actual.adoptCacheOwner) };
});

const USER = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'Ada_L',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

const OTHER_USER = { ...USER, id: '018f-other', username: 'Grace_H' };

const ACCESS_TOKEN = 'header.payload.signature';
const SESSION = { user: USER, accessToken: ACCESS_TOKEN, expiresIn: 900000 };

const INVALID_CREDENTIALS = new ApiError(
  401,
  'Invalid credentials',
  'Incorrect email/username or password.'
);

const CREDENTIALS = { identifier: 'ada@evergrove.app', password: 'a long passphrase' };

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer },
    // Mirrors store/index.js: a rejected auth thunk carries the original ApiError on
    // `action.error` by design, and it never reaches state.
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'error'] },
      }),
  });
}

/** A store already past the bootstrap, for the paths that begin signed in. */
function signedInStore() {
  const store = makeStore();
  store.dispatch(sessionRefreshed({ user: USER, accessToken: ACCESS_TOKEN }));
  return store;
}

const authState = (store) => store.getState().auth;

/** Everything currently in localStorage, so a leak is caught wherever it was written. */
function localStorageDump() {
  const entries = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const name = window.localStorage.key(index);
    entries.push(`${name}=${window.localStorage.getItem(name)}`);
  }
  return entries.join('\n');
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  // Call history has to be empty for the "was the cache claimed?" assertions to mean anything,
  // and the doubles are module-factory mocks rather than spies.
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Suite F1 — Initial state', () => {
  it('F1.1 — a cold store is anonymous, not loading', () => {
    // Nothing is persisted and there is no cookie, so a page load has no credential to check.
    // 'loading' here would park both route guards on PageLoader with nothing to wait for.
    expect(authState(makeStore())).toEqual({
      user: null,
      accessToken: null,
      status: 'anonymous',
      loginStatus: 'idle',
      error: null,
    });
  });

  it('F1.2 — keeps the access token out of localStorage while still writing the cache owner', async () => {
    authService.login.mockResolvedValue(SESSION);
    const store = makeStore();

    await store.dispatch(login(CREDENTIALS));

    // The cache owner proves the dump sees real writes, so the token assertion is not vacuous.
    expect(localStorageDump()).toContain(USER.id);
    expect(localStorageDump()).not.toContain(ACCESS_TOKEN);
    expect(authState(store).accessToken).toBe(ACCESS_TOKEN);
  });
});

describe('Suite F2 — Credential submission', () => {
  it('F2.1 — moves login idle → pending → succeeded and stores the session', async () => {
    const call = deferred();
    authService.login.mockReturnValue(call.promise);
    const store = makeStore();

    const inFlight = store.dispatch(login(CREDENTIALS));
    expect(authState(store)).toMatchObject({ loginStatus: 'pending', error: null });

    call.resolve(SESSION);
    await inFlight;

    expect(authState(store)).toEqual({
      user: USER,
      accessToken: ACCESS_TOKEN,
      status: 'authenticated',
      loginStatus: 'succeeded',
      error: null,
    });
    expect(authService.login).toHaveBeenCalledWith(CREDENTIALS);
    // A different account must not inherit the previous one's cached tasks and points.
    expect(adoptCacheOwner).toHaveBeenCalledWith(USER.id);
  });

  it('F2.2 — a rejected credential pair fails the submission and records a plain error', async () => {
    authService.login.mockRejectedValue(INVALID_CREDENTIALS);
    const store = makeStore();

    await store.dispatch(login(CREDENTIALS));

    expect(authState(store)).toMatchObject({
      user: null,
      accessToken: null,
      status: 'anonymous',
      loginStatus: 'failed',
    });
    expect(authState(store).error).toEqual({
      message: 'Incorrect email/username or password.',
      fieldErrors: {},
    });
    // State holds data, not an Error: the ApiError itself travels on the rejected action.
    expect(authState(store).error).not.toBeInstanceOf(ApiError);
    // A failed attempt must not wipe the cache of whoever is already signed in on this device.
    expect(adoptCacheOwner).not.toHaveBeenCalled();
  });

  it('F2.3 — clears the previous failure when the next attempt starts', async () => {
    authService.login.mockRejectedValueOnce(INVALID_CREDENTIALS);
    const store = makeStore();
    await store.dispatch(login(CREDENTIALS));

    const call = deferred();
    authService.login.mockReturnValue(call.promise);
    const inFlight = store.dispatch(login(CREDENTIALS));

    // A stale message next to a spinner reads as "it failed again".
    expect(authState(store).error).toBeNull();

    call.resolve(SESSION);
    await inFlight;
  });

  it('F2.4 — registering signs the new account in and claims the cache for it', async () => {
    authService.register.mockResolvedValue({ ...SESSION, user: OTHER_USER });
    const store = makeStore();

    await store.dispatch(signUp({ email: 'grace@evergrove.app' }));

    expect(authState(store)).toMatchObject({
      user: OTHER_USER,
      accessToken: ACCESS_TOKEN,
      status: 'authenticated',
      loginStatus: 'succeeded',
      error: null,
    });
    expect(adoptCacheOwner).toHaveBeenCalledWith(OTHER_USER.id);
  });

  it('F2.5 — a rejected registration keeps the field errors the form renders', async () => {
    authService.register.mockRejectedValue(
      new ApiError(409, 'Account already exists', 'That username is already taken.', {
        username: 'That username is already taken.',
      })
    );
    const store = makeStore();

    await store.dispatch(signUp({ username: 'ada_l' }));

    expect(authState(store)).toMatchObject({ status: 'anonymous', loginStatus: 'failed' });
    expect(authState(store).error).toEqual({
      message: 'That username is already taken.',
      fieldErrors: { username: 'That username is already taken.' },
    });
  });

  it('F2.6 — falls back to a readable message when the failure is not an ApiError', async () => {
    // Whatever went wrong, the toast still needs a sentence — an undefined message would render
    // as an empty error banner.
    authService.login.mockRejectedValue({ status: 503 });
    const store = makeStore();

    await store.dispatch(login(CREDENTIALS));

    expect(authState(store).error.message).toMatch(/something went wrong/i);
    expect(authState(store).error.fieldErrors).toEqual({});
  });
});

describe('Suite F3 — Sign-out and local session updates', () => {
  it('F3.1 — signing out drops the user, the token and the authenticated status', async () => {
    authService.logout.mockResolvedValue(undefined);
    const store = signedInStore();

    await store.dispatch(logout());

    expect(authState(store)).toEqual({
      user: null,
      accessToken: null,
      status: 'anonymous',
      loginStatus: 'idle',
      error: null,
    });
  });

  it('F3.2 — a failed sign-out still signs the user out locally, and still reports the failure', async () => {
    authService.logout.mockRejectedValue(new ApiError(500, 'Internal server error', 'Broke.'));
    const store = signedInStore();

    const action = await store.dispatch(logout());

    // Leaving someone looking signed in after they asked not to be is the worse outcome; the
    // rejection still reaches AppLayout so it can say the server did not hear about it.
    expect(action.type).toBe('auth/logout/rejected');
    expect(authState(store)).toMatchObject({
      user: null,
      accessToken: null,
      status: 'anonymous',
      loginStatus: 'idle',
    });
  });

  it('F3.3 — a refreshed session installs the new token and the profile that came with it', () => {
    const store = signedInStore();

    store.dispatch(sessionRefreshed({ user: OTHER_USER, accessToken: 'second.token.value' }));

    expect(authState(store)).toMatchObject({
      user: OTHER_USER,
      accessToken: 'second.token.value',
      status: 'authenticated',
    });
  });

  it('F3.4 — an unrenewable session clears everything derived from it', () => {
    const store = signedInStore();

    store.dispatch(sessionCleared());

    expect(authState(store)).toMatchObject({ user: null, accessToken: null, status: 'anonymous' });
  });

  it('F3.5 — a profile edit replaces the user without touching the token', () => {
    const store = signedInStore();

    store.dispatch(userUpdated({ ...USER, firstName: 'Augusta' }));

    expect(authState(store).user.firstName).toBe('Augusta');
    expect(authState(store).accessToken).toBe(ACCESS_TOKEN);
    expect(authState(store).status).toBe('authenticated');
  });

  it('F3.6 — a profile edit arriving with nobody signed in is ignored', () => {
    const store = makeStore();

    store.dispatch(userUpdated(USER));

    // Inventing a user here would fake an authenticated state the server never granted.
    expect(authState(store).user).toBeNull();
    expect(authState(store).status).toBe('anonymous');
  });
});
