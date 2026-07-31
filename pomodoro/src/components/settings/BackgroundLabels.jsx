import { useEffect, useState } from 'react';
import { BACKGROUND_PRESETS, applyBackground } from '../../services/appearance.js';
import { LABEL_MAX_LENGTH } from '../../services/settings.js';
import { validateLabel } from '../../services/validation.js';
import { describeSaveFailure } from './saveFailure.js';

/*
 * BackgroundLabels — choose a shell background and rename the timer's phase labels. Background
 * choices preview live on the shell; the labels are consumed by the TimerEngineTile (empty falls
 * back to the default "Focus" / "Break").
 *
 * Controlled: `background` and `labels` are the saved server values. Local state holds the draft
 * the user is editing; SettingPage remounts this component when the saved values change, which
 * is how the draft re-seeds after a save.
 *
 * Available to every account — ungated (CONTRACT.md §9.4).
 */

const LABEL_FIELDS = [
  { key: 'work', label: 'Focus label', placeholder: 'Focus' },
  { key: 'break', label: 'Break label', placeholder: 'Break' },
];

function BackgroundLabels({ background, labels, onSave, saving, onNotify }) {
  const [draftBackground, setDraftBackground] = useState(background);
  const [draftLabels, setDraftLabels] = useState(labels);
  const [errors, setErrors] = useState({});

  // Live preview: swap the shell background as the user picks a preset.
  useEffect(() => {
    applyBackground(document.querySelector('.app-shell'), draftBackground);
  }, [draftBackground]);

  const isDirty =
    draftBackground !== background ||
    draftLabels.work !== labels.work ||
    draftLabels.break !== labels.break;

  function setLabel(key, value) {
    setDraftLabels((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function validate() {
    const next = {};
    for (const { key, label } of LABEL_FIELDS) {
      const message = validateLabel(draftLabels[key]);
      if (message) next[key] = `${label}: ${message}`;
    }
    return next;
  }

  async function handleSave() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      /*
       * Both keys always travel: `labels` is replaced whole, never merged key-by-key
       * (CONTRACT.md §2.2), and a one-sided payload would be rejected for the missing half.
       * Trimmed to match what the server stores, so the field does not visibly change after
       * the response is adopted.
       */
      await onSave({
        background: draftBackground,
        labels: { work: draftLabels.work.trim(), break: draftLabels.break.trim() },
      });
      onNotify?.('success', 'Background and labels saved.');
    } catch (error) {
      // Place a 422 under the input that caused it; the rest is a toast.
      const fieldErrors = error?.fieldErrors ?? {};
      const mapped = {};
      for (const { key } of LABEL_FIELDS) {
        const message = fieldErrors[`labels.${key}`];
        if (message) mapped[key] = message;
      }
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      else onNotify?.('error', describeSaveFailure(error, 'appearance'));
    }
  }

  return (
    <section className="settings-card" aria-labelledby="bg-labels-heading">
      <div className="settings-card__head">
        <h2 id="bg-labels-heading" className="settings-card__title">
          Background &amp; labels
        </h2>
        <p className="settings-card__hint">
          Change the shell background and rename the timer’s phase labels.
        </p>
      </div>

      <fieldset className="bg-presets">
        <legend className="bg-presets__legend">Background</legend>
        <div className="bg-presets__grid" role="radiogroup" aria-label="Background">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={draftBackground === preset.key}
              className={`bg-preset${draftBackground === preset.key ? ' bg-preset--active' : ''}`}
              disabled={saving}
              onClick={() => setDraftBackground(preset.key)}
            >
              <span
                className="bg-preset__swatch"
                style={preset.image ? { backgroundImage: preset.image } : undefined}
                data-forest={preset.image ? undefined : 'true'}
                aria-hidden="true"
              />
              <span className="bg-preset__name">{preset.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="label-fields">
        {LABEL_FIELDS.map(({ key, label, placeholder }) => {
          const errorId = `label-${key}-error`;
          return (
            <div className="label-field" key={key}>
              <label className="label-field__label" htmlFor={`label-${key}`}>
                {label}
              </label>
              <input
                id={`label-${key}`}
                type="text"
                className="label-field__input"
                value={draftLabels[key]}
                placeholder={placeholder}
                maxLength={LABEL_MAX_LENGTH}
                disabled={saving}
                onChange={(event) => setLabel(key, event.target.value)}
                aria-invalid={errors[key] ? 'true' : undefined}
                aria-describedby={errors[key] ? errorId : undefined}
              />
              {errors[key] && (
                <p className="label-field__error" id={errorId} role="alert">
                  {errors[key]}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="bg-labels__note">
        Labels appear on the Timer’s phase indicator. Leave a field blank to keep its default.
      </p>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}

export default BackgroundLabels;
