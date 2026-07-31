import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionCleared } from './authSlice.js';
import settingsReducer from './settingsSlice.js';
import { setAuthTokenAccessor, setOnAuthFailure } from '../services/api.js';

/*
 * The application store. Authentication and settings live here — timer, gamification and history
 * keep their existing local state and localStorage cache.
 *
 * Settings joined the store because it stopped being local: the backend owns it now
 * (CONTRACT.md §9). The others have not moved, and a wholesale migration is still declined.
 */
export const store = configureStore({
  reducer: { auth: authReducer, settings: settingsReducer },
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
