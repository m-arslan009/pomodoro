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
import { hydrateSession } from '../store/hydrate.js';

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
   * Preferences, tasks, history and progression are fetched once per session start, through the one
   * shared helper (store/hydrate.js) that `bootstrapAuth` also uses at startup.
   *
   * ONCE PER SESSION START IS ENOUGH. Signing in and resuming from the refresh cookie are the only
   * two ways to reach an authenticated store, and both hydrate — so the store can never be staler
   * than the session that produced it, which is why there is no refetch-on-focus, no polling and no
   * cache invalidation.
   *
   * The one case that is now genuinely stale, and is a known deferral rather than an oversight: a
   * tab left open for days never re-bootstraps, so work done on a second device will not appear in
   * it. See CONTRACT.md §17.3 and §21.
   */
  const hydrate = useCallback(() => hydrateSession(dispatch), [dispatch]);

  const signIn = useCallback(
    async (credentials) => {
      const session = await dispatch(login(credentials)).unwrap();
      hydrate();
      return session.user;
    },
    [dispatch, hydrate]
  );

  const signUp = useCallback(
    async (values) => {
      const session = await dispatch(signUpThunk(values)).unwrap();
      hydrate();
      return session.user;
    },
    [dispatch, hydrate]
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
