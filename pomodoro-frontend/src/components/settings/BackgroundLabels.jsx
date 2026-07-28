import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../services/storage.js';
import { BACKGROUND_PRESETS, applyBackground } from '../../services/appearance.js';

/*
 * BackgroundLabels — the Pace Setter-gated feature: choose a shell background
 * and rename the timer's phase labels. Background choices preview live on the
 * shell; the labels are stored as settings.customLabels and consumed by the
 * TimerEngineTile (empty falls back to the default "Focus" / "Break").
 *
 * Rendered inside <FeatureGate>; while locked the body is inert and read-only.
 */

const LABEL_FIELDS = [
  { key: 'work', label: 'Focus label', placeholder: 'Focus', max: 18 },
  { key: 'break', label: 'Break label', placeholder: 'Break', max: 18 },
];

// A saved backgroundImage should name a known preset; default to the forest.
function savedPreset(settings) {
  const key = settings.backgroundImage;
  return BACKGROUND_PRESETS.some((preset) => preset.key === key) ? key : 'forest';
}

function BackgroundLabels({ onNotify }) {
  const [saved, setSaved] = useState(() => getSettings());
  const [background, setBackground] = useState(() => savedPreset(saved));
  const [labels, setLabels] = useState(() => ({
    work: saved.customLabels?.work ?? '',
    break: saved.customLabels?.break ?? '',
  }));

  // Live preview: swap the shell background as the user picks a preset.
  useEffect(() => {
    applyBackground(document.querySelector('.app-shell'), background);
  }, [background]);

  const isDirty =
    background !== savedPreset(saved) ||
    labels.work !== (saved.customLabels?.work ?? '') ||
    labels.break !== (saved.customLabels?.break ?? '');

  function setLabel(key, value) {
    setLabels((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const next = {
      ...getSettings(),
      backgroundImage: background,
      customLabels: { work: labels.work.trim(), break: labels.break.trim() },
    };
    if (!saveSettings(next)) {
      onNotify?.('error', 'Could not save your appearance.');
      return;
    }
    setSaved(next);
    onNotify?.('success', 'Background and labels saved.');
  }

  return (
    <div className="bg-labels">
      <fieldset className="bg-presets">
        <legend className="bg-presets__legend">Background</legend>
        <div className="bg-presets__grid" role="radiogroup" aria-label="Background">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={background === preset.key}
              className={`bg-preset${background === preset.key ? ' bg-preset--active' : ''}`}
              onClick={() => setBackground(preset.key)}
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
        {LABEL_FIELDS.map(({ key, label, placeholder, max }) => (
          <div className="label-field" key={key}>
            <label className="label-field__label" htmlFor={`label-${key}`}>
              {label}
            </label>
            <input
              id={`label-${key}`}
              type="text"
              className="label-field__input"
              value={labels[key]}
              placeholder={placeholder}
              maxLength={max}
              onChange={(event) => setLabel(key, event.target.value)}
            />
          </div>
        ))}
      </div>
      <p className="bg-labels__note">
        Labels appear on the Timer’s phase indicator. Leave a field blank to keep its default.
      </p>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={handleSave}
          disabled={!isDirty}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

export default BackgroundLabels;
