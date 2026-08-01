import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionCleared } from './authSlice.js';
import settingsReducer from './settingsSlice.js';
import timerReducer from './timerSlice.js';
import { setAuthTokenAccessor, setOnAuthFailure } from '../services/api.js';

/*
 * The application store: authentication, settings, and the timer's records.
 *
 * Each of these joined for the same reason — it stopped being local. Settings moved when the
 * backend took ownership of preferences; tasks, sessions and progression moved when the backend
 * took ownership of those (CONTRACT.md §13-§17).
 *
 * The RUNNING COUNTDOWN is still not here and is not going to be. It changes once a second, is read
 * by one component, and nothing outside that component can act on it — putting it in Redux would
 * dispatch some 1,500 actions per session for no subscriber. The frontend owns real-time execution;
 * the store owns what survives the block.
 */
export const store = configureStore({
  reducer: { auth: authReducer, settings: settingsReducer, timer: timerReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        /*
         * RTK's own defaults, plus `error`. A rejected auth thunk carries the original ApiError
         * on `action.error` on purpose (see authSlice's serializeError) so the submitting form
         * still receives `status` and `fieldErrors`. It is in transit only — the reducers keep
         * plain data in state — so the check would report a problem the design does not have.
         */
        ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'error'],
      },
    }),
});

/*
 * Wiring the HTTP layer to the store, once, here.
 *
 * services/api.js cannot import the store: the store imports the services, so the reverse
 * import closes a cycle — and injection is also what lets the service tests exercise api.js
 * with no store at all. So the store hands api.js the two things it needs and keeps every
 * piece of authentication state on this side of the boundary.
 */
setAuthTokenAccessor(() => store.getState().auth.accessToken);

setOnAuthFailure(() => store.dispatch(sessionCleared()));

export default store;
