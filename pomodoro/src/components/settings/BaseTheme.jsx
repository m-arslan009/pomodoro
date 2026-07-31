import { applyBaseTheme, THEME_OPTIONS } from '../../services/appearance.js';
import { describeSaveFailure } from './saveFailure.js';

/*
 * BaseTheme — the base colour-scheme toggle (System / Dark).
 *
 * Controlled: the value comes from the server-owned settings state and the save goes back
 * through `onSave`, so this component holds no copy of its own. 'Light' is deferred until a
 * light .app-shell palette exists — see CONTRACT.md §9.3.
 *
 * The scheme is applied optimistically, before the request resolves, because it is instant and
 * visible: waiting for a round trip to repaint would make the control feel broken. A failure
 * puts the previous value back.
 */

function BaseTheme({ theme, onSave, saving, onNotify }) {
  async function choose(next) {
    if (next === theme || saving) return;

    applyBaseTheme(next);
    try {
      await onSave({ theme: next });
    } catch (error) {
      applyBaseTheme(theme);
      onNotify?.('error', describeSaveFailure(error, 'theme preference'));
    }
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
            disabled={saving}
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
