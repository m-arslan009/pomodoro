import { useState } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice.js';
import settingsReducer from '../../store/settingsSlice.js';
import { DEFAULT_SETTINGS } from '../../services/settings.js';

/*
 * Test-only signed-in state.
 *
 * Suites that render a page inside AppLayout need a signed-in user, but they are not testing
 * authentication — signing in for real would make every one of them mock fetch and drive the
 * login form. Preloading a store with the finished state keeps those suites about the behaviour
 * they actually cover.
 *
 * Preferences are preloaded here for the same reason. They moved to the server (CONTRACT.md
 * §4.7), so a suite can no longer seed durations by writing to localStorage — the store is where
 * TimerPage and AppLayout read them from, and the real fetch happens on login, which these
 * suites deliberately skip.
 *
 * This is a real store with the real reducers, not a stub: what the suites render then exercises
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

function createTestStore(user, overrides, settings) {
  return configureStore({
    reducer: { auth: authReducer, settings: settingsReducer },
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
      settings: {
        // 'ready' rather than 'idle': the suites render as though login already fetched them.
        data: { ...DEFAULT_SETTINGS, ...settings },
        status: 'ready',
        error: null,
        saving: false,
      },
    },
  });
}

/**
 * Wraps children in a resolved, signed-in store.
 *
 * `overrides` merges into the preloaded *auth* state — `{ status: 'loading' }` to hold the route
 * guards on their loader, for instance. It cannot replace `signIn` and friends, because those
 * are thunks dispatched through the store rather than values handed down a context.
 *
 * `settings` merges over the defaults, so a suite names only the preferences it cares about:
 * `settings={{ workMinutes: 2, breakMinutes: 1 }}` for a timer suite that needs short phases.
 */
export function AuthTestProvider({ children, user = TEST_USER, overrides = {}, settings = {} }) {
  // Created once per mount: a store rebuilt on re-render would drop everything dispatched into it.
  const [store] = useState(() => createTestStore(user, overrides, settings));

  return <Provider store={store}>{children}</Provider>;
}
