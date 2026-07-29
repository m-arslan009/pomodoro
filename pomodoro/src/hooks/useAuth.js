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

  const signIn = useCallback(
    async (credentials) => {
      const session = await dispatch(login(credentials)).unwrap();
      return session.user;
    },
    [dispatch]
  );

  const signUp = useCallback(
    async (values) => {
      const session = await dispatch(signUpThunk(values)).unwrap();
      return session.user;
    },
    [dispatch]
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
