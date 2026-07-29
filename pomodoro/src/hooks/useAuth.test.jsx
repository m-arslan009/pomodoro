import { act, renderHook } from '@testing-library/react';
import useAuth from './useAuth.js';
import { ApiError } from '../services/api.js';
import * as authService from '../services/auth.js';
import { AuthTestProvider } from '../tests/helpers/authTestContext.jsx';

/*
 * Suite G — the useAuth contract every auth-aware component is written against.
 *
 * Two things are under test, and the second is the reason this file exists.
 *
 * The return shape. RequireAuth, RequireGuest, Nav, AppLayout, LogInPage, SignUpPage and
 * ProfilePage all destructure the same seven members. The state library underneath changed
 * wholesale; the shape must not have.
 *
 * The failure that reaches the form. `signIn` rejects through RTK's `unwrap()`, and RTK's
 * default error serialisation would flatten the thrown ApiError to { name, message, stack }.
 * LogInPage's describeFailure() branches on `status`, `isNetworkError` and `fieldErrors` — none
 * of which survive that flattening. The degradation is silent: every login failure would still
 * show *a* message, just the wrong one ("Request failed" instead of "Too many attempts…"), so
 * nothing else in the suite would catch it. Hence the assertions on the error's identity.
 *
 * services/auth.js is doubled, so no request is made; the store is the real reducer with the
 * real thunks, supplied by the shared AuthTestProvider.
 */

vi.mock('../services/auth.js', () => ({
  refresh: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

const USER = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'Ada_L',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

const SESSION = { user: USER, accessToken: 'header.payload.signature', expiresIn: 900000 };

const CREDENTIALS = { identifier: 'ada@evergrove.app', password: 'a long passphrase' };

/** Mounts the hook over a real store in the given auth state. */
function renderAuth({ user = null, overrides = {} } = {}) {
  function Wrapper({ children }) {
    return (
      <AuthTestProvider user={user} overrides={overrides}>
        {children}
      </AuthTestProvider>
    );
  }

  return renderHook(() => useAuth(), { wrapper: Wrapper });
}

/** Runs an action and returns whatever it settled with, resolved or rejected. */
async function settle(action) {
  let outcome;
  await act(async () => {
    outcome = await action().then(
      (value) => ({ resolved: value }),
      (error) => ({ rejected: error })
    );
  });
  return outcome;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Suite G1 — The shape components depend on', () => {
  it('G1.1 — exposes exactly the seven members, with the four actions callable', () => {
    const { result } = renderAuth({ user: USER });

    expect(Object.keys(result.current).sort()).toEqual([
      'isAuthenticated',
      'isLoading',
      'setUser',
      'signIn',
      'signOut',
      'signUp',
      'user',
    ]);
    for (const action of ['signIn', 'signUp', 'signOut', 'setUser']) {
      expect(typeof result.current[action]).toBe('function');
    }
  });

  it('G1.2 — reports the unresolved bootstrap as loading and not as signed out', () => {
    const { result } = renderAuth({ user: null, overrides: { status: 'loading' } });

    // The guards read exactly this pair: loading must not look like "anonymous", or a refresh
    // on a protected route redirects before the session has answered.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('G1.3 — reports a resolved session as authenticated and hands over the profile', () => {
    const { result } = renderAuth({ user: USER });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(USER);
  });

  it('G1.4 — reports a resolved anonymous session as neither loading nor authenticated', () => {
    const { result } = renderAuth({ user: null });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('Suite G2 — Actions and the failures they hand back', () => {
  it('G2.1 — signIn rejects with the original ApiError, not a flattened copy', async () => {
    authService.login.mockRejectedValue(
      new ApiError(422, 'Validation failed', 'Check your details.', {
        identifier: 'Enter your email or username.',
      })
    );
    const { result } = renderAuth({ user: null });

    const { rejected } = await settle(() => result.current.signIn(CREDENTIALS));

    // Each of these is a branch in LogInPage's describeFailure(); losing any one of them
    // silently downgrades the message the user is shown.
    expect(rejected).toBeInstanceOf(ApiError);
    expect(rejected.status).toBe(422);
    expect(rejected.fieldErrors).toEqual({ identifier: 'Enter your email or username.' });
    expect(rejected.isNetworkError).toBe(false);
  });

  it('G2.2 — an unreachable server still arrives as a network error', async () => {
    authService.login.mockRejectedValue(
      new ApiError(0, 'Network error', 'We could not reach the server.')
    );
    const { result } = renderAuth({ user: null });

    const { rejected } = await settle(() => result.current.signIn(CREDENTIALS));

    // `isNetworkError` is a getter on the class: it exists only while the instance does.
    expect(rejected.isNetworkError).toBe(true);
    expect(rejected.message).toMatch(/could not reach the server/i);
  });

  it('G2.3 — a successful signIn resolves with the profile and marks the app authenticated', async () => {
    authService.login.mockResolvedValue(SESSION);
    const { result } = renderAuth({ user: null });

    const { resolved } = await settle(() => result.current.signIn(CREDENTIALS));

    expect(resolved).toEqual(USER);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(USER);
    expect(authService.login).toHaveBeenCalledWith(CREDENTIALS);
  });

  it('G2.4 — signUp rejects with the original ApiError so the form can highlight its fields', async () => {
    authService.register.mockRejectedValue(
      new ApiError(409, 'Account already exists', 'That username is already taken.', {
        username: 'That username is already taken.',
      })
    );
    const { result } = renderAuth({ user: null });

    const { rejected } = await settle(() => result.current.signUp({ username: 'ada_l' }));

    expect(rejected).toBeInstanceOf(ApiError);
    expect(rejected.status).toBe(409);
    expect(rejected.fieldErrors).toEqual({ username: 'That username is already taken.' });
  });

  it('G2.5 — signOut resolves and leaves the app signed out', async () => {
    authService.logout.mockResolvedValue(undefined);
    const { result } = renderAuth({ user: USER });

    const { rejected } = await settle(() => result.current.signOut());

    expect(rejected).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('G2.6 — a failed signOut still signs out locally and still reports the failure', async () => {
    authService.logout.mockRejectedValue(new ApiError(500, 'Internal server error', 'Broke.'));
    const { result } = renderAuth({ user: USER });

    const { rejected } = await settle(() => result.current.signOut());

    // AppLayout catches this to tell the user the server was not reachable — but it must never
    // leave them looking signed in after they asked not to be.
    expect(rejected).toBeInstanceOf(ApiError);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('G2.7 — setUser publishes a profile edit without disturbing the session', () => {
    const { result } = renderAuth({ user: USER });

    act(() => {
      result.current.setUser({ ...USER, firstName: 'Augusta' });
    });

    expect(result.current.user.firstName).toBe('Augusta');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
