import { useState } from 'react';
import { getSettings, saveSettings } from '../../services/storage.js';
import { applyBaseTheme, THEME_OPTIONS } from '../../services/appearance.js';

/*
 * BaseTheme — the always-available base colour-scheme toggle (System / Light /
 * Dark). It persists `settings.theme` and applies it at the document level
 * immediately, so the choice takes effect without a reload and survives one
 * (re-applied from storage at startup in main.jsx). Unlike the gated theme
 * editor, this needs no title and is never locked.
 */

function BaseTheme({ onNotify }) {
  const [theme, setTheme] = useState(() => getSettings().theme);

  function choose(next) {
    if (next === theme) return;
    const settings = { ...getSettings(), theme: next };
    if (!saveSettings(settings)) {
      onNotify?.('error', 'Could not save your theme preference.');
      return;
    }
    applyBaseTheme(next);
    setTheme(next);
  }

  return (
    <section className="settings-card" aria-labelledby="base-theme-heading">
      <div className="settings-card__head">
        <h2 id="base-theme-heading" className="settings-card__title">
          Base theme
        </h2>
        <p className="settings-card__hint">
          The overall colour scheme. “System” follows your device preference.
        </p>
      </div>

      <div className="theme-segment" role="group" aria-label="Base theme">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`theme-segment__btn${
              theme === option.key ? ' theme-segment__btn--active' : ''
            }`}
            aria-pressed={theme === option.key}
            onClick={() => choose(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default BaseTheme;
