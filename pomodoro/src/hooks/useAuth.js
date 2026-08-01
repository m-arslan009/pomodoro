import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  login,
  logout,
  selectAuthStatus,
  selectAuthUser,
  signUp as signUpThunk,
  userUpdated,
} from '../store/authSlice.js';
import { loadSettings } from '../store/settingsSlice.js';
import { hydrateTimer } from '../store/timerSlice.js';

/**
 * The only way components read authentication state. Components never import the auth service
 * or the slice directly, so neither a change of transport nor a change of state library reaches
 * a component — which is exactly what this hook absorbed when the store replaced the context.
 *
 * The three actions return promises that reject on failure, carrying the original ApiError.
 * Forms depend on that: LogInPage and SignUpPage catch it and read `status`, `isNetworkError`
 * and `fieldErrors` to decide what to tell the user. `unwrap()` is what re-throws instead of
 * resolving to a rejected action.
 *
 * @returns {{
 *   user: object|null,
 *   isLoading: boolean,
 *   isAuthenticated: boolean,
 *   signIn: (credentials: {identifier: string, password: string}) => Promise<object>,
 *   signUp: (values: object) => Promise<object>,
 *   signOut: () => Promise<void>,
 *   setUser: (user: object) => void,
 * }}
 */
export default function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectAuthUser);
  const status = useSelector(selectAuthStatus);

  /*
   * Preferences are fetched once per session, here, because signing in is the only moment an
   * authenticated session begins — the token is memory-only, so there is no other entry point.
   *
   * Deliberately not awaited and deliberately not unwrapped: the app renders on defaults while
   * this is in flight (CONTRACT.md §8.2), so making the login form wait would add a spinner for
   * data nothing is blocked on. A failure lands in the slice as `status: 'error'`, which only
   * SettingPage renders — it must never turn a successful sign-in into a failed one.
   */
  const fetchPreferences = useCallback(() => {
    dispatch(loadSettings());
  }, [dispatch]);

  /*
   * Tasks, history and progression are fetched once per session, on the same terms and for the same
   * reason as preferences: signing in is the only moment an authenticated session begins.
   *
   * ONCE IS ENOUGH, and only because the token is memory-only. A reload IS a sign-in, so the store
   * can never be staler than the current session — that is why this needs no refetch-on-focus, no
   * polling and no cache invalidation. It would not be true of an app with a refresh token.
   *
   * Not awaited: the Timer page renders and is fully usable while this is in flight, so blocking
   * the login form on it would add a spinner for data nothing is waiting on. A failure lands in the
   * slice as `status: 'error'` and History shows what it has behind a retry — it must never turn a
   * successful sign-in into a failed one.
   */
  const hydrateTimerData = useCallback(() => {
    dispatch(hydrateTimer());
  }, [dispatch]);

  const signIn = useCallback(
    async (credentials) => {
      const session = await dispatch(login(credentials)).unwrap();
      fetchPreferences();
      hydrateTimerData();
      return session.user;
    },
    [dispatch, fetchPreferences, hydrateTimerData]
  );

  const signUp = useCallback(
    async (values) => {
      const session = await dispatch(signUpThunk(values)).unwrap();
      fetchPreferences();
      hydrateTimerData();
      return session.user;
    },
    [dispatch, fetchPreferences, hydrateTimerData]
  );

  const signOut = useCallback(async () => {
    await dispatch(logout()).unwrap();
  }, [dispatch]);

  const setUser = useCallback((updated) => dispatch(userUpdated(updated)), [dispatch]);

  return useMemo(
    () => ({
      user,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      signIn,
      signUp,
      signOut,
      setUser,
    }),
    [user, status, signIn, signUp, signOut, setUser]
  );
}
