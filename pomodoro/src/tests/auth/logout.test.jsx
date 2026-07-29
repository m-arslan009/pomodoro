import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../../components/AppLayout.jsx';
import { ApiError } from '../../services/api.js';
import * as authService from '../../services/auth.js';
import authReducer from '../../store/authSlice.js';

/*
 * Suite H5 — signing out, from the button the user actually presses.
 *
 * SCOPE NOTE. The slice suite already proves that both outcomes of the thunk clear state. What
 * it cannot prove is that the *screen* follows, and that is where the interesting case lives:
 * logging out is a network call that is allowed to fail, and the token is dropped locally either
 * way. So a failed sign-out must still take the user off the authenticated page — anything else
 * leaves them looking signed in when they are not.
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
  timezone: 'UTC',
  emailVerified: false,
  createdAt: '2026-07-28T09:00:00.000Z',
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A signed-in app shell at /timer, with the public landing page as the sign-out destination. */
function renderSignedIn() {
  const store = configureStore({
    reducer: { auth: authReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'error'] },
      }),
    preloadedState: {
      auth: {
        user: USER,
        accessToken: 'header.payload.signature',
        status: 'authenticated',
        loginStatus: 'idle',
        error: null,
      },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/timer']}>
        <Routes>
          <Route
            path="/timer"
            element={
              <AppLayout>
                <h1>Timer page</h1>
              </AppLayout>
            }
          />
          <Route path="/" element={<h1>Landing page</h1>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return { store };
}

/** Matches both labels, since the button relabels to "Logging out…" while the request runs. */
const logoutButton = () => screen.getByRole('button', { name: /log(ging)? ?out/i });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Suite H5 — Sign-out', () => {
  it('H5.1 — calls the API, clears the session and returns to the landing page', async () => {
    authService.logout.mockResolvedValue(undefined);
    const { store } = renderSignedIn();

    fireEvent.click(logoutButton());

    expect(await screen.findByText('Landing page')).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(store.getState().auth).toMatchObject({
      user: null,
      accessToken: null,
      status: 'anonymous',
    });
  });

  it('H5.2 — still signs out and still navigates when the request fails', async () => {
    authService.logout.mockRejectedValue(new ApiError(500, 'Internal server error', 'Broke.'));
    const { store } = renderSignedIn();

    fireEvent.click(logoutButton());

    /*
     * The whole point. The token is gone from memory whatever the server said, so the user IS
     * signed out — leaving them parked on an authenticated page would misreport that, and an
     * uncaught rejection here used to swallow the navigation entirely.
     */
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
    expect(store.getState().auth).toMatchObject({
      user: null,
      accessToken: null,
      status: 'anonymous',
    });
  });

  it('H5.3 — locks the button in flight so a double click sends one request', async () => {
    const call = deferred();
    authService.logout.mockReturnValue(call.promise);
    renderSignedIn();

    fireEvent.click(logoutButton());

    await waitFor(() => expect(logoutButton()).toBeDisabled());
    fireEvent.click(logoutButton());

    expect(authService.logout).toHaveBeenCalledTimes(1);

    call.resolve(undefined);
    await screen.findByText('Landing page');
  });
});
