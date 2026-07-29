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
 * full lifetime.
 *
 * Throwing it away on reload is the whole reason `status` starts at 'anonymous' and there is no
 * startup bootstrap: with no cookie and nothing in storage, a cold start has no credential to
 * check, so the answer is known synchronously and the route guards never have to wait.
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

/** @type {AuthState} */
const initialState = {
  user: null,
  accessToken: null,
  status: 'anonymous',
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
 * Sign out. The server revokes nothing, so dropping the token here is what ends the session.
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
/** @param {{auth: AuthState}} state */
export const selectAccessToken = (state) => state.auth.accessToken;

export default authSlice.reducer;
