import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../services/storage.js';
import { THEME_VARS, applyCustomTheme } from '../../services/appearance.js';

/*
 * ThemeEditor — the Anchor-gated feature: recolour the forest palette. Each
 * control maps to one CSS custom property on .app-shell; edits paint the live
 * shell immediately for a true preview, and "Apply" persists them to
 * settings.customTheme (which AppLayout re-applies on every mount). "Reset"
 * clears the override so the built-in forest colours return.
 *
 * Rendered inside <FeatureGate>, so while locked this whole body is inert and
 * the buttons below cannot fire — it reads purely as a preview.
 */

// Build a complete { key: color } map from a saved (possibly partial) theme.
function hydrate(customTheme) {
  const colors = {};
  for (const { key, fallback } of THEME_VARS) {
    colors[key] = customTheme?.[key] || fallback;
  }
  return colors;
}

function ThemeEditor({ onNotify }) {
  const [saved, setSaved] = useState(() => getSettings().customTheme ?? {});
  const [colors, setColors] = useState(() => hydrate(saved));

  // Live preview: repaint the shell whenever a colour changes.
  useEffect(() => {
    applyCustomTheme(document.querySelector('.app-shell'), colors);
  }, [colors]);

  const baseline = hydrate(saved);
  const isDirty = THEME_VARS.some(({ key }) => colors[key] !== baseline[key]);

  function setColor(key, value) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    const next = { ...getSettings(), customTheme: colors };
    if (!saveSettings(next)) {
      onNotify?.('error', 'Could not save your theme.');
      return;
    }
    setSaved(colors);
    onNotify?.('success', 'Custom theme applied.');
  }

  function handleReset() {
    const next = { ...getSettings() };
    delete next.customTheme;
    saveSettings(next);
    setColors(hydrate({}));
    setSaved({});
    applyCustomTheme(document.querySelector('.app-shell'), null);
    onNotify?.('success', 'Theme reset to the forest default.');
  }

  return (
    <div className="theme-editor">
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
                onChange={(event) => setColor(key, event.target.value)}
              />
              <span className="theme-swatch__value">{colors[key].toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-btn settings-btn--ghost" onClick={handleReset}>
          Reset to default
        </button>
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={handleApply}
          disabled={!isDirty}
        >
          Apply theme
        </button>
      </div>
    </div>
  );
}

export default ThemeEditor;
