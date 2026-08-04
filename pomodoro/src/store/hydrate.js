import { loadSettings } from './settingsSlice.js';
import { hydrateTimer } from './timerSlice.js';

/**
 * Fetch everything an authenticated session needs, once per session start.
 *
 * This exists so that "a session has begun" has exactly one definition. There are two ways to get
 * one — signing in, and resuming from the refresh cookie at startup — and they must hydrate
 * identically. Two call sites each dispatching their own list is how a resumed session ends up
 * missing a fetch that a fresh sign-in makes, which presents as History being empty after a reload
 * and full after a login.
 *
 * It lives here rather than inside `bootstrapAuth` because `settingsSlice` and `timerSlice` both
 * import `authSlice`; dispatching them from there would close an import cycle.
 *
 * Neither dispatch is awaited and neither is unwrapped, which is the same non-blocking contract
 * sign-in has always had (CONTRACT.md §8.2, §8.3): the app renders on defaults while these are in
 * flight, and a failure lands in its own slice as `status: 'error'` for that slice's page to
 * render. Hydration failing must never turn a successful sign-in — or a successful reload — into a
 * failed one.
 *
 * @param {import('@reduxjs/toolkit').Dispatch} dispatch
 */
export function hydrateSession(dispatch) {
  dispatch(loadSettings());
  dispatch(hydrateTimer());
}
