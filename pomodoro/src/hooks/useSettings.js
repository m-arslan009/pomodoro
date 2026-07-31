import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadSettings,
  saveSettings as saveSettingsThunk,
  selectSettings,
  selectSettingsError,
  selectSettingsSaving,
  selectSettingsStatus,
} from '../store/settingsSlice.js';

/**
 * The only way components read the account's preferences — the settings counterpart to useAuth,
 * and the same bargain: components never import the settings service or the slice directly, so
 * neither a change of transport nor a change of state library reaches a component.
 *
 * `settings` is always a complete object, never null and never partial, so consumers can read
 * `settings.workMinutes` on the first render without a guard. Only SettingPage has any business
 * looking at `status`.
 *
 * `save` returns a promise that rejects with the original ApiError, which is what lets a form
 * place `fieldErrors` under the input that caused them.
 *
 * @returns {{
 *   settings: import('../services/settings.js').UserSettings,
 *   status: 'idle'|'loading'|'ready'|'error',
 *   error: {message: string, fieldErrors: Record<string, string>}|null,
 *   saving: boolean,
 *   save: (patch: object) => Promise<object>,
 *   reload: () => Promise<object>,
 * }}
 */
export default function useSettings() {
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);
  const status = useSelector(selectSettingsStatus);
  const error = useSelector(selectSettingsError);
  const saving = useSelector(selectSettingsSaving);

  const save = useCallback(
    (patch) => dispatch(saveSettingsThunk(patch)).unwrap(),
    [dispatch]
  );

  const reload = useCallback(() => dispatch(loadSettings()).unwrap(), [dispatch]);

  return useMemo(
    () => ({ settings, status, error, saving, save, reload }),
    [settings, status, error, saving, save, reload]
  );
}
