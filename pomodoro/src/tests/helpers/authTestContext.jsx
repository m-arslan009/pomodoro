import { useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice.js';

/*
 * Test-only auth state.
 *
 * Suites that render a page inside AppLayout need a signed-in user, but they are not testing
 * authentication — signing in for real would make every one of them mock fetch and drive the
 * login form. Preloading a store with the finished state keeps those suites about the behaviour
 * they actually cover.
 *
 * This is a real store with the real reducer, not a stub: what the suites render then exercises
 * the same selectors the app does.
 */

// Not exported: this file exports a component only, so fast refresh stays happy.
const TEST_USER = {
  id: 'test-user',
  email: 'ada@evergrove.app',
  username: 'ada_l',
  firstName: 'Ada',
  lastName: 'Lovelace',
  timezone: 'UTC',
  emailVerified: false,
  avatarUpdatedAt: null,
  createdAt: '2026-07-28T09:00:00.000Z',
};

function createTestStore(user, overrides) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user,
        // A placeholder token: nothing in these suites reaches the network, but an
        // authenticated state without one would not be a state the app can actually be in.
        accessToken: user ? 'test-access-token' : null,
        status: user ? 'authenticated' : 'anonymous',
        loginStatus: 'idle',
        error: null,
        ...overrides,
      },
    },
  });
}

/**
 * Wraps children in a resolved, signed-in auth store.
 *
 * `overrides` now merges into the preloaded *state* — `{ status: 'loading' }` to hold the route
 * guards on their loader, for instance. It can no longer replace `signIn` and friends, because
 * those are thunks dispatched through the store rather than values handed down a context.
 */
export function AuthTestProvider({ children, user = TEST_USER, overrides = {} }) {
  // Created once per mount: a store rebuilt on re-render would drop everything dispatched into it.
  const [store] = useState(() => createTestStore(user, overrides));

  return <Provider store={store}>{children}</Provider>;
}
