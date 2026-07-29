import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LogInPage from '../../pages/LogInPage.jsx';
import { ApiError } from '../../services/api.js';
import * as authService from '../../services/auth.js';
import authReducer from '../../store/authSlice.js';

/*
 * Suite H — the login form, end to end through the real slice.
 *
 * SCOPE NOTE. The suites elsewhere cover the transport (services/auth.js) and the state
 * transitions (store/authSlice.js) in isolation. Nothing covered the thing the user actually
 * touches: the form. So this renders the real page over the real hook, the real thunk and the
 * real reducer, and doubles only the network call at the bottom.
 *
 * What it asserts is the four things a credential form owes its user — it refuses to submit
 * nothing, it visibly locks while the request is in flight, it says something useful when the
 * request fails, and it leaves for the right place when the request succeeds.
 */

vi.mock('../../services/auth.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

const USER = {
  id: '018f-user',
  email: 'ada@evergrove.app',
  username: 'ada_l',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

const SESSION = { user: USER, accessToken: 'header.payload.signature', expiresIn: 28800000 };

const PASSWORD = 'correct horse battery staple';

/** Resolves only when the test says so, so the in-flight state can be observed. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * The login page at /login, with a stand-in for each place it can navigate to. `from` seeds the
 * navigation state that RequireAuth attaches when it bounces someone off a protected page.
 */
function renderLogIn({ from } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'error'] },
      }),
  });

  const entry = from ? { pathname: '/login', state: { from: { pathname: from } } } : '/login';

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LogInPage />} />
          <Route path="/timer" element={<h1>Timer page</h1>} />
          <Route path="/history" element={<h1>History page</h1>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return { store };
}

const identifierBox = () => screen.getByLabelText(/email or username/i);
const passwordBox = () => screen.getByLabelText(/^password$/i);
const submitButton = () => screen.getByRole('button', { name: /^(log in|logging in…|logged in)$/i });

/** Controlled inputs need a change event; typing character by character adds nothing here. */
function fill(element, value) {
  fireEvent.change(element, { target: { value } });
}

function fillCredentials(identifier = 'ada@evergrove.app', password = PASSWORD) {
  fill(identifierBox(), identifier);
  fill(passwordBox(), password);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('Suite H1 — Submission gating', () => {
  it('H1.1 — keeps submit disabled until both fields carry a value', () => {
    renderLogIn();

    expect(submitButton()).toBeDisabled();

    fill(identifierBox(), 'ada@evergrove.app');
    // One field is not enough: submitting here would spend a request to be told so.
    expect(submitButton()).toBeDisabled();

    fill(passwordBox(), PASSWORD);
    expect(submitButton()).toBeEnabled();
  });

  it('H1.2 — treats a whitespace-only identifier as empty', () => {
    renderLogIn();

    fillCredentials('   ', PASSWORD);

    expect(submitButton()).toBeDisabled();
    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe('Suite H2 — Loading state', () => {
  it('H2.1 — locks the form while the request is in flight and releases it on failure', async () => {
    const call = deferred();
    authService.login.mockReturnValue(call.promise);
    renderLogIn();

    fillCredentials();
    fireEvent.click(submitButton());

    // Both inputs lock too, not just the button: a value edited mid-flight would not be the
    // value that was sent.
    await waitFor(() => expect(submitButton()).toHaveTextContent(/logging in/i));
    expect(submitButton()).toBeDisabled();
    expect(identifierBox()).toBeDisabled();
    expect(passwordBox()).toBeDisabled();

    call.reject(new ApiError(401, 'Invalid credentials', 'Incorrect email/username or password.'));

    // A form that stayed locked after a rejection would strand the user with no way to retry.
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(identifierBox()).toBeEnabled();
    expect(passwordBox()).toBeEnabled();
  });

  it('H2.2 — sends exactly one request when submit is clicked twice', async () => {
    const call = deferred();
    authService.login.mockReturnValue(call.promise);
    renderLogIn();

    fillCredentials();
    fireEvent.click(submitButton());
    fireEvent.click(submitButton());

    expect(authService.login).toHaveBeenCalledTimes(1);

    call.resolve(SESSION);
    await screen.findByText('Timer page');
  });
});

describe('Suite H3 — Failure reporting', () => {
  it('H3.1 — reports rejected credentials without revealing which half was wrong', async () => {
    authService.login.mockRejectedValue(
      new ApiError(401, 'Invalid credentials', 'Incorrect email/username or password.')
    );
    renderLogIn();

    fillCredentials('ada@evergrove.app', 'wrong but long enough');
    fireEvent.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Incorrect email/username or password.');
    // The server refuses to distinguish the two cases; the form must not invent a distinction.
    expect(alert).not.toHaveTextContent(/no such account|not registered|password is wrong/i);
  });

  it('H3.2 — keeps what the user typed so a retry is not a retype', async () => {
    authService.login.mockRejectedValue(
      new ApiError(401, 'Invalid credentials', 'Incorrect email/username or password.')
    );
    renderLogIn();

    fillCredentials('ada@evergrove.app', 'wrong but long enough');
    fireEvent.click(submitButton());

    await screen.findByRole('alert');
    expect(identifierBox()).toHaveValue('ada@evergrove.app');
  });

  it.each([
    ['a rate limit', new ApiError(429, 'Too many requests', 'Slow down.'), /too many attempts/i],
    [
      'an unreachable server',
      new ApiError(0, 'Network error', 'We could not reach the server. Check your connection.'),
      /could not reach the server/i,
    ],
    [
      'a validation failure',
      new ApiError(422, 'Validation failed', 'Invalid.', {
        identifier: 'Enter your email or username.',
      }),
      /enter your email or username/i,
    ],
    [
      'a failure that is not an ApiError at all',
      new TypeError('boom'),
      /something went wrong/i,
    ],
  ])('H3.3 — explains %s in terms the user can act on', async (_case, failure, expected) => {
    authService.login.mockRejectedValue(failure);
    renderLogIn();

    fillCredentials();
    fireEvent.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });
});

describe('Suite H4 — Success', () => {
  it('H4.1 — signs in, stores the session and lands on the timer', async () => {
    authService.login.mockResolvedValue(SESSION);
    const { store } = renderLogIn();

    fillCredentials();
    fireEvent.click(submitButton());

    expect(await screen.findByText('Timer page')).toBeInTheDocument();

    expect(authService.login).toHaveBeenCalledWith({
      identifier: 'ada@evergrove.app',
      password: PASSWORD,
    });
    expect(store.getState().auth).toMatchObject({
      user: USER,
      accessToken: SESSION.accessToken,
      status: 'authenticated',
    });
  });

  it('H4.2 — returns the user to the page that sent them here', async () => {
    authService.login.mockResolvedValue(SESSION);
    renderLogIn({ from: '/history' });

    fillCredentials();
    fireEvent.click(submitButton());

    // RequireAuth records where it bounced them from; signing in has to honour it, or a
    // bookmarked page silently becomes the dashboard.
    expect(await screen.findByText('History page')).toBeInTheDocument();
  });

  it('H4.3 — never writes the token to localStorage', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    authService.login.mockResolvedValue(SESSION);
    renderLogIn();

    fillCredentials();
    fireEvent.click(submitButton());
    await screen.findByText('Timer page');

    // The token is a bearer credential with no server-side record: anything that can read it can
    // act as the user until it expires. Signing in writes the cache owner and nothing else.
    const written = setItem.mock.calls.map(([, value]) => value).join('\n');
    expect(written).not.toContain(SESSION.accessToken);
  });
});
