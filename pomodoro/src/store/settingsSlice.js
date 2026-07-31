import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as settingsService from '../services/settings.js';
import { DEFAULT_SETTINGS } from '../services/settings.js';
import { logout, sessionCleared } from './authSlice.js';

/*
 * settingsSlice — the signed-in account's preferences.
 *
 * Like authSlice, it owns *state transitions only*: every request is delegated to
 * services/settings.js, so this file knows no endpoints and no payload shapes.
 *
 * `data` seeds to DEFAULT_SETTINGS and is never null. TimerPage and AppLayout read it
 * unconditionally and must never block or spin on it; only SettingPage renders `status`
 * (CONTRACT.md §8.2). Combined with PATCH semantics, that makes a failed initial read harmless:
 * a later save sends only the edited keys, so it cannot write these defaults over a stored row.
 *
 * There is no localStorage cache, deliberately. The access token is memory-only and a reload
 * signs the user out (§5), so there is no authenticated state that did not just come through
 * login — one fetch per session is sufficient. It also makes the old cross-account leak
 * unrepresentable rather than patched: `pomodoro.v1.settings` was never keyed by user.
 */

/**
 * @typedef {import('../services/settings.js').UserSettings} UserSettings
 *
 * @typedef {object} SettingsState
 * @property {UserSettings} data Always usable; defaults until a read succeeds.
 * @property {'idle'|'loading'|'ready'|'error'} status The last read. Rendered only by SettingPage.
 * @property {{message: string, fieldErrors: Record<string, string>}|null} error Last read failure.
 * @property {boolean} saving A write is in flight — the forms disable their submits.
 */

/** @type {SettingsState} */
const initialState = {
  data: DEFAULT_SETTINGS,
  status: 'idle',
  error: null,
  saving: false,
};

/** The serialisable part of a failure. The ApiError itself stays out of the store. */
function toStateError(error) {
  return {
    message: error?.message ?? 'Something went wrong. Please try again.',
    fieldErrors: error?.fieldErrors ?? {},
  };
}

/*
 * Same reason as authSlice: hand the thrown error through untouched so
 * `dispatch(saveSettings(…)).unwrap()` rejects with the original ApiError. SettingPage branches
 * on `status`, `isNetworkError` and `fieldErrors`, none of which survive RTK's default
 * serialisation.
 */
const thunkOptions = { serializeError: /** @type {(error: unknown) => any} */ ((error) => error) };

/**
 * Fetch the account's preferences. Dispatched on login success — non-blocking, because the app
 * already renders on defaults.
 */
export const loadSettings = createAsyncThunk(
  'settings/load',
  async () => settingsService.fetchSettings(),
  thunkOptions
);

/**
 * Save one section. Pass only the keys that changed; the response is adopted wholesale.
 * Rejects with the original ApiError.
 */
export const saveSettings = createAsyncThunk(
  'settings/save',
  async (patch) => settingsService.updateSettings(patch),
  thunkOptions
);

/** Back to a signed-out slice. Shared so every path that ends anonymous cannot drift apart. */
function clearSettings(state) {
  state.data = DEFAULT_SETTINGS;
  state.status = 'idle';
  state.error = null;
  state.saving = false;
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.status = 'ready';
        state.error = null;
      })
      .addCase(loadSettings.rejected, (state, action) => {
        // `data` deliberately keeps its defaults: every consumer but SettingPage carries on as
        // though nothing happened, and SettingPage offers a retry.
        state.status = 'error';
        state.error = toStateError(action.error);
      })

      .addCase(saveSettings.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        /*
         * The response, never the submitted values. The server trims labels and re-validates
         * every field, so echoing local state would show an un-normalised value until the next
         * reload — and a save that succeeded partially would be invisible.
         *
         * This also promotes the slice out of 'error': a successful write proves the session and
         * the endpoint are both fine, and the returned row is the whole truth.
         */
        state.data = action.payload;
        state.status = 'ready';
        state.saving = false;
        state.error = null;
      })
      .addCase(saveSettings.rejected, (state) => {
        // The failure travels to the caller, which renders it against the field that caused it.
        // Nothing in `data` changes: the stored row is unchanged, so the local copy must be too.
        state.saving = false;
      })

      /*
       * Preferences belong to an account, so they leave with it. Both logout outcomes clear, for
       * the same reason authSlice clears on both: the user asked to sign out.
       */
      .addCase(sessionCleared, clearSettings)
      .addCase(logout.fulfilled, clearSettings)
      .addCase(logout.rejected, clearSettings);
  },
});

/** @param {{settings: SettingsState}} state */
export const selectSettings = (state) => state.settings.data;
/** @param {{settings: SettingsState}} state */
export const selectSettingsStatus = (state) => state.settings.status;
/** @param {{settings: SettingsState}} state */
export const selectSettingsError = (state) => state.settings.error;
/** @param {{settings: SettingsState}} state */
export const selectSettingsSaving = (state) => state.settings.saving;

export default settingsSlice.reducer;
