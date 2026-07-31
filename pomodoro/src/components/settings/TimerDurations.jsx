import { useState } from 'react';
import { DEFAULT_SETTINGS, DURATION_LIMITS } from '../../services/settings.js';
import { validateDuration } from '../../services/validation.js';
import { describeSaveFailure } from './saveFailure.js';

/*
 * TimerDurations — the two Pomodoro lengths.
 *
 * The only section with a text buffer: its inputs hold strings while being typed, so they cannot
 * read straight from the store the way the other sections do. `workMinutes`/`breakMinutes` are
 * the saved server values and seed that buffer; SettingPage remounts this component when they
 * change, which is how the draft re-syncs after a save or after the initial fetch resolves.
 */

// Reusable spec for the two identical duration controls (stepper + number input).
const FIELDS = [
  {
    key: 'workMinutes',
    label: 'Focus session',
    description: 'How long each Pomodoro work block runs.',
    limits: DURATION_LIMITS.work,
  },
  {
    key: 'breakMinutes',
    label: 'Short break',
    description: 'The rest that follows a completed focus block.',
    limits: DURATION_LIMITS.break,
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// A single labelled duration control: −/＋ steppers around a numeric input, with
// its own inline range hint and validation message.
function DurationField({ id, label, description, limits, value, error, disabled, onValue }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const numeric = Number(value);

  function step(delta) {
    const base = Number.isFinite(numeric) ? Math.round(numeric) : limits.min;
    onValue(String(clamp(base + delta, limits.min, limits.max)));
  }

  return (
    <div className="duration-field">
      <label className="duration-field__label" htmlFor={id}>
        {label}
      </label>
      <p className="duration-field__desc" id={hintId}>
        {description}
      </p>

      <div className="duration-field__control">
        <button
          type="button"
          className="duration-field__step"
          onClick={() => step(-1)}
          disabled={disabled || (Number.isFinite(numeric) && numeric <= limits.min)}
          aria-label={`Decrease ${label.toLowerCase()} by one minute`}
        >
          <span aria-hidden="true">&minus;</span>
        </button>

        <div className="duration-field__value">
          <input
            id={id}
            className="duration-field__input"
            type="number"
            inputMode="numeric"
            min={limits.min}
            max={limits.max}
            step={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onValue(event.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          />
          <span className="duration-field__unit" aria-hidden="true">
            min
          </span>
        </div>

        <button
          type="button"
          className="duration-field__step"
          onClick={() => step(1)}
          disabled={disabled || (Number.isFinite(numeric) && numeric >= limits.max)}
          aria-label={`Increase ${label.toLowerCase()} by one minute`}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <p className="duration-field__range">
        {limits.min}–{limits.max} minutes
      </p>

      {error && (
        <p className="duration-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TimerDurations({ workMinutes, breakMinutes, onSave, saving, onNotify }) {
  const saved = { workMinutes, breakMinutes };
  const [values, setValues] = useState(() => ({
    workMinutes: String(workMinutes),
    breakMinutes: String(breakMinutes),
  }));
  const [errors, setErrors] = useState({});

  const isDirty = FIELDS.some(({ key }) => values[key] !== String(saved[key]));

  function setField(key, next) {
    setValues((prev) => ({ ...prev, [key]: next }));
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function validate() {
    const next = {};
    for (const { key, label, limits } of FIELDS) {
      const message = validateDuration(values[key], limits, label);
      if (message) next[key] = message;
    }
    return next;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      onNotify?.('error', 'Please fix the highlighted durations before saving.');
      return;
    }

    try {
      await onSave({
        workMinutes: Number(values.workMinutes),
        breakMinutes: Number(values.breakMinutes),
      });
      onNotify?.('success', 'Durations saved. Your next session will use them.');
    } catch (error) {
      /*
       * A 422 names the field it rejected, so it belongs under that input rather than in a
       * toast. Whatever the failure, the typed values stay put and the form stays dirty — the
       * stored row is unchanged, so the user's work is the only copy of what they wanted.
       */
      const fieldErrors = error?.fieldErrors ?? {};
      const mapped = {};
      for (const { key } of FIELDS) {
        if (fieldErrors[key]) mapped[key] = fieldErrors[key];
      }

      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        onNotify?.('error', 'Some durations were rejected. Please review them.');
      } else {
        onNotify?.('error', describeSaveFailure(error, 'durations'));
      }
    }
  }

  // Populate the form with factory defaults; the user still saves to apply.
  function handleReset() {
    setValues({
      workMinutes: String(DEFAULT_SETTINGS.workMinutes),
      breakMinutes: String(DEFAULT_SETTINGS.breakMinutes),
    });
    setErrors({});
  }

  return (
    <form className="settings-card" onSubmit={handleSubmit} noValidate>
      <div className="settings-card__head">
        <h2 className="settings-card__title">Timer durations</h2>
        <p className="settings-card__hint">
          Applied to your next Pomodoro — a session already running is left untouched.
        </p>
      </div>

      <div className="settings-fields">
        {FIELDS.map(({ key, label, description, limits }) => (
          <DurationField
            key={key}
            id={key}
            label={label}
            description={description}
            limits={limits}
            value={values[key]}
            error={errors[key]}
            disabled={saving}
            onValue={(next) => setField(key, next)}
          />
        ))}
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn settings-btn--ghost"
          onClick={handleReset}
          disabled={saving}
        >
          Reset to defaults
        </button>
        <button
          type="submit"
          className="settings-btn settings-btn--primary"
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export default TimerDurations;
