import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as authService from '../services/auth.js';
import { adoptCacheOwner } from '../services/storage.js';

/*
 * authSlice — the app's authentication state.
 *
 * It owns *state transitions only*: every actual authentication call is delegated to
 * services/auth.js, so this file has no knowledge of endpoints or payload shapes.
 *
 * The access token lives here and nowhere else. It is a JWT, so anything that can read it can
 * act as the user until it expires — keeping it in memory means a stored XSS payload has to run
 * during the session to steal it, and reloading the page throws it away. Persisting it to
 * localStorage would hand it to every script that ever runs on this origin, for the token's
 * full lifetime. **That rule is unchanged by ADR-008 rev. 3 and is not negotiable.**
 *
 * What rev. 3 changed is that throwing the token away on reload no longer ends the session. There
 * is a refresh cookie now, and this file cannot read it — it is HttpOnly, which is the entire
 * reason it is allowed to outlive the tab. So `status` starts at 'loading' rather than 'anonymous':
 * a cold start genuinely does not know the answer yet, and `bootstrapAuth` is what asks. The route
 * guards park on PageLoader for exactly as long as that takes.
 */

/**
 * @typedef {import('../services/auth.js').AuthSession} AuthSession
 * @typedef {import('../services/auth.js').UserProfile} UserProfile
 */

/**
 * @typedef {object} AuthState
 * @property {UserProfile|null} user The signed-in account, or null when anonymous.
 * @property {string|null} accessToken The JWT. Memory only — never persisted.
 * @property {'loading'|'anonymous'|'authenticated'} status Whether anyone is signed in.
 * @property {'idle'|'pending'|'succeeded'|'failed'} loginStatus The last credential submission.
 * @property {{message: string, fieldErrors: Record<string, string>}|null} error Last failure.
 */

/**
 * `status` starts at 'loading', not 'anonymous': a refresh cookie may exist, and only the server
 * can say. Nothing renders an authenticated or an anonymous view until `bootstrapAuth` answers.
 *
 * @type {AuthState}
 */
const initialState = {
  user: null,
  accessToken: null,
  status: 'loading',
  loginStatus: 'idle',
  error: null,
};

/**
 * The serialisable part of a failed request. The ApiError itself is deliberately *not* stored:
 * state holds plain data, while the rejected action still carries the original error for the
 * form that submitted it (see `serializeError` below).
 *
 * @param {unknown} error
 * @returns {{message: string, fieldErrors: Record<string, string>}}
 */
function toStateError(error) {
  return {
    message: error?.message ?? 'Something went wrong. Please try again.',
    fieldErrors: error?.fieldErrors ?? {},
  };
}

/*
 * Hand the thrown error through untouched instead of letting RTK flatten it to
 * { name, message, stack }. `dispatch(login(…)).unwrap()` then rejects with the original
 * ApiError, which is what LogInPage's describeFailure() branches on — it needs `status`,
 * `isNetworkError` and `fieldErrors`, none of which survive the default serialisation.
 * Nothing puts that error into the store; only toStateError()'s plain object goes in.
 */
const thunkOptions = { serializeError: /** @type {(error: unknown) => any} */ ((error) => error) };

/**
 * Sign in with an email address or username. Rejects with the original ApiError.
 * @type {import('@reduxjs/toolkit').AsyncThunk<AuthSession, {identifier: string, password: string}, {}>}
 */
export const login = createAsyncThunk(
  'auth/login',
  async (credentials) => {
    const session = await authService.login(credentials);
    // A different account must not inherit the previous one's cached tasks and points.
    adoptCacheOwner(session.user.id);
    return session;
  },
  thunkOptions
);

/**
 * Register and sign in, which is what the sign-up form has always implied.
 * Rejects with the original ApiError.
 * @type {import('@reduxjs/toolkit').AsyncThunk<AuthSession, object, {}>}
 */
export const signUp = createAsyncThunk(
  'auth/signUp',
  async (values) => {
    const session = await authService.register(values);
    adoptCacheOwner(session.user.id);
    return session;
  },
  thunkOptions
);

/**
 * Resume a session from the refresh cookie, once, at startup.
 *
 * **Its rejection is the ordinary case, not a failure.** Most cold starts are anonymous, and this
 * thunk is how we find that out — so the rejected reducer clears to anonymous without setting
 * `error` or touching `loginStatus`. Anything else would paint "Something went wrong" on a login
 * form that the user has not yet typed into.
 *
 * @type {import('@reduxjs/toolkit').AsyncThunk<AuthSession, void, {}>}
 */
export const bootstrapAuth = createAsyncThunk(
  'auth/bootstrap',
  async () => {
    const session = await authService.refresh();
    // A resumed session is a session start, so the same cache-owner rule applies as at sign-in:
    // a different account must not inherit the previous one's cached tasks and points.
    adoptCacheOwner(session.user.id);
    return session;
  },
  thunkOptions
);

/**
 * Sign out. The server revokes the refresh session, so this device cannot renew; dropping the
 * access token here is what ends the session locally, since nothing can revoke that half.
 * Local state clears whether or not the request succeeded — see the reducers.
 * @type {import('@reduxjs/toolkit').AsyncThunk<void, void, {}>}
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await authService.logout();
  },
  thunkOptions
);

/** Shared by every path that ends anonymous, so they cannot drift apart. */
function clearSession(state) {
  state.user = null;
  state.accessToken = null;
  state.status = 'anonymous';
  state.error = null;
}

/** Shared by login and signUp: both end in exactly the same authenticated state. */
function acceptSession(state, session) {
  state.user = session.user;
  state.accessToken = session.accessToken;
  state.status = 'authenticated';
  state.loginStatus = 'succeeded';
  state.error = null;
}

function rejectCredentials(state, action) {
  clearSession(state);
  state.loginStatus = 'failed';
  state.error = toStateError(action.error);
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Installs a session that did not come from a credential submission on this page. */
    sessionRefreshed(state, action) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
    },

    /** The server rejected the token — drop everything derived from it. */
    sessionCleared: clearSession,

    /**
     * A profile edit saved elsewhere (ProfilePage). Ignored when nobody is signed in: there is
     * no user to update, and inventing one would fake an authenticated state.
     */
    userUpdated(state, action) {
      if (state.user) state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      /*
       * Deliberately NOT rejectCredentials: nobody submitted a credential. `loginStatus` stays
       * 'idle' and `error` stays null, so an anonymous cold start looks like what it is — an
       * anonymous cold start — rather than a failed sign-in attempt.
       */
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(bootstrapAuth.rejected, clearSession)

      .addCase(login.pending, (state) => {
        state.loginStatus = 'pending';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => acceptSession(state, action.payload))
      .addCase(login.rejected, rejectCredentials)

      .addCase(signUp.pending, (state) => {
        state.loginStatus = 'pending';
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => acceptSession(state, action.payload))
      .addCase(signUp.rejected, rejectCredentials)

      /*
       * Both outcomes clear: the user asked to sign out, and forgetting the token is the only
       * thing that ends the session anyway. The rejection still reaches the caller so the UI can
       * react, but it never leaves someone looking signed in after they asked not to be.
       */
      .addCase(logout.fulfilled, (state) => {
        clearSession(state);
        state.loginStatus = 'idle';
      })
      .addCase(logout.rejected, (state) => {
        clearSession(state);
        state.loginStatus = 'idle';
      });
  },
});

export const { sessionRefreshed, sessionCleared, userUpdated } = authSlice.actions;

/** @param {{auth: AuthState}} state */
export const selectAuthUser = (state) => state.auth.user;
/** @param {{auth: AuthState}} state */
export const selectAuthStatus = (state) => state.auth.status;

export default authSlice.reducer;
