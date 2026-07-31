import { useEffect, useState } from 'react';
import { THEME_VARS, applyCustomTheme } from '../../services/appearance.js';
import { describeSaveFailure } from './saveFailure.js';

/*
 * ThemeEditor — recolour the forest palette. Each control maps to one CSS custom property on
 * .app-shell; edits paint the live shell immediately for a true preview, "Apply" persists them
 * to settings.customTheme, and "Reset" sends `customTheme: null` to clear the override so the
 * built-in forest colours return.
 *
 * Controlled: `customTheme` is the saved server value and the only baseline. The local `colors`
 * state is the *draft* — what the user is currently previewing. SettingPage remounts this
 * component when the saved palette changes, which is how the draft re-seeds after a save.
 *
 * Available to every account — contrast is a capability, not a reward (CONTRACT.md §9.4).
 */

// Build a complete { key: color } map from a saved (possibly null) palette.
function hydrate(customTheme) {
  const colors = {};
  for (const { key, fallback } of THEME_VARS) {
    colors[key] = customTheme?.[key] || fallback;
  }
  return colors;
}

function ThemeEditor({ customTheme, onSave, saving, onNotify }) {
  const [colors, setColors] = useState(() => hydrate(customTheme));

  // Live preview: repaint the shell whenever a colour changes.
  useEffect(() => {
    applyCustomTheme(document.querySelector('.app-shell'), colors);
  }, [colors]);

  const baseline = hydrate(customTheme);
  const isDirty = THEME_VARS.some(({ key }) => colors[key] !== baseline[key]);

  function setColor(key, value) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  async function handleApply() {
    try {
      await onSave({ customTheme: colors });
      onNotify?.('success', 'Custom theme applied.');
    } catch (error) {
      onNotify?.('error', describeSaveFailure(error, 'theme'));
    }
  }

  async function handleReset() {
    // null is the value that clears the override; omitting the key would leave it alone.
    try {
      await onSave({ customTheme: null });
      onNotify?.('success', 'Theme reset to the forest default.');
    } catch (error) {
      onNotify?.('error', describeSaveFailure(error, 'theme'));
    }
  }

  return (
    <section className="settings-card" aria-labelledby="theme-editor-heading">
      <div className="settings-card__head">
        <h2 id="theme-editor-heading" className="settings-card__title">
          Theme editor
        </h2>
        <p className="settings-card__hint">
          Recolour the forest palette to make the app your own.
        </p>
      </div>

      <div className="theme-editor__rows">
        {THEME_VARS.map(({ key, label }) => (
          <div className="theme-swatch" key={key}>
            <label className="theme-swatch__label" htmlFor={`theme-${key}`}>
              {label}
            </label>
            <div className="theme-swatch__control">
              <input
                id={`theme-${key}`}
                type="color"
                className="theme-swatch__input"
                value={colors[key]}
                disabled={saving}
                onChange={(event) => setColor(key, event.target.value)}
              />
              <span className="theme-swatch__value">{colors[key].toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn settings-btn--ghost"
          onClick={handleReset}
          disabled={saving || !customTheme}
        >
          Reset to default
        </button>
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={handleApply}
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : 'Apply theme'}
        </button>
      </div>
    </section>
  );
}

export default ThemeEditor;
