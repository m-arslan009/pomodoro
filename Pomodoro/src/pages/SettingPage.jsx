import { useState } from 'react'
import AppLayout from '../components/AppLayout.jsx'
import Notification from '../components/Notification.jsx'
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  DURATION_LIMITS,
} from '../services/storage.js'
import '../styles/SettingPage.css'

/*
 * SettingPage — user preferences, scoped to the forest .app-shell so it reuses
 * the shared glass/forest tokens (--fg-*, --glass-*) exactly like the Timer and
 * History dashboards.
 *
 * PHASE 1 SCOPE: only the two Pomodoro durations (focus session + short break)
 * are editable here. Theme, custom labels, and background (see idea.md) land in
 * later phases; storage.getSettings already preserves unknown persisted fields
 * so this page can grow without a migration.
 *
 * The saved durations drive TimerPage, which reads them on mount — so a change
 * here takes effect on the user's next session.
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
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// A single labelled duration control: −/＋ steppers around a numeric input, with
// its own inline range hint and validation message.
function DurationField({ id, label, description, limits, value, error, onValue }) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const numeric = Number(value)

  function step(delta) {
    const base = Number.isFinite(numeric) ? Math.round(numeric) : limits.min
    onValue(String(clamp(base + delta, limits.min, limits.max)))
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
          disabled={Number.isFinite(numeric) && numeric <= limits.min}
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
          disabled={Number.isFinite(numeric) && numeric >= limits.max}
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
  )
}

function SettingPage() {
  // The persisted baseline; updated only after a successful save so the form can
  // track "unsaved changes" and revert cleanly.
  const [saved, setSaved] = useState(() => getSettings())
  const [values, setValues] = useState(() => ({
    workMinutes: String(saved.workMinutes),
    breakMinutes: String(saved.breakMinutes),
  }))
  const [errors, setErrors] = useState({})
  const [notification, setNotification] = useState(null)

  const isDirty = FIELDS.some(({ key }) => values[key] !== String(saved[key]))

  function setField(key, next) {
    setValues((prev) => ({ ...prev, [key]: next }))
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function validate() {
    const next = {}
    for (const { key, label, limits } of FIELDS) {
      const raw = values[key].trim()
      const n = Number(raw)
      if (raw === '' || !Number.isInteger(n) || n < limits.min || n > limits.max) {
        next[key] = `${label} must be a whole number between ${limits.min} and ${limits.max} minutes.`
      }
    }
    return next
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setNotification({
        type: 'error',
        message: 'Please fix the highlighted durations before saving.',
      })
      return
    }

    const nextSettings = {
      ...saved,
      workMinutes: Number(values.workMinutes),
      breakMinutes: Number(values.breakMinutes),
    }

    if (!saveSettings(nextSettings)) {
      setNotification({
        type: 'error',
        message: 'Could not save your settings. Please try again.',
      })
      return
    }

    setSaved(nextSettings)
    setNotification({
      type: 'success',
      message: 'Durations saved. Your next session will use them.',
    })
  }

  // Populate the form with factory defaults; the user still saves to apply.
  function handleReset() {
    setValues({
      workMinutes: String(DEFAULT_SETTINGS.workMinutes),
      breakMinutes: String(DEFAULT_SETTINGS.breakMinutes),
    })
    setErrors({})
  }

  return (
    <AppLayout>
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      <div className="settings-page">
        <header className="settings-page__head">
          <h1 className="settings-page__title">Settings</h1>
          <p className="settings-page__subtitle">
            Tune how long you focus and rest. More options arrive as you unlock them.
          </p>
        </header>

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
                onValue={(next) => setField(key, next)}
              />
            ))}
          </div>

          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={handleReset}
            >
              Reset to defaults
            </button>
            <button
              type="submit"
              className="settings-btn settings-btn--primary"
              disabled={!isDirty}
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}

export default SettingPage
