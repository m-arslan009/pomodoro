import { useState } from 'react';
import { getSettings, saveSettings } from '../../services/storage.js';

/*
 * Scheduling — the Paragon-gated feature: set a recurring daily focus time on
 * chosen weekdays. It persists settings.schedule and previews the next
 * occurrence so the intent is legible; wiring it to real reminders (Notifications
 * API) is a later concern, so this stays a stored plan with a live preview.
 *
 * Rendered inside <FeatureGate>; while locked the whole body is inert.
 */

// Display order Mon→Sun; `value` matches Date.getDay() (0 = Sunday).
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const LONG_WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultSchedule(settings) {
  const schedule = settings.schedule ?? {};
  return {
    enabled: Boolean(schedule.enabled),
    startTime: typeof schedule.startTime === 'string' ? schedule.startTime : '09:00',
    days: Array.isArray(schedule.days) ? schedule.days : [1, 2, 3, 4, 5],
  };
}

// The next datetime matching the chosen days + time, searching up to a week out.
function nextOccurrence(days, startTime, from = new Date()) {
  if (!days.length || !startTime) return null;
  const [hours, minutes] = startTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (days.includes(candidate.getDay()) && candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }
  return null;
}

function formatNext(date) {
  const day = LONG_WEEKDAY[date.getDay()];
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} at ${time}`;
}

function Scheduling({ onNotify }) {
  const [schedule, setSchedule] = useState(() => defaultSchedule(getSettings()));

  function toggleDay(value) {
    setSchedule((prev) => {
      const active = prev.days.includes(value);
      const days = active
        ? prev.days.filter((day) => day !== value)
        : [...prev.days, value].sort((a, b) => a - b);
      return { ...prev, days };
    });
  }

  function handleSave() {
    const next = { ...getSettings(), schedule };
    if (!saveSettings(next)) {
      onNotify?.('error', 'Could not save your schedule.');
      return;
    }
    onNotify?.('success', 'Focus schedule saved.');
  }

  const upcoming = schedule.enabled ? nextOccurrence(schedule.days, schedule.startTime) : null;

  return (
    <div className="schedule">
      <label className="schedule__toggle">
        <input
          type="checkbox"
          className="schedule__checkbox"
          checked={schedule.enabled}
          onChange={(event) => setSchedule((prev) => ({ ...prev, enabled: event.target.checked }))}
        />
        <span>Enable a recurring focus schedule</span>
      </label>

      <div className="schedule__row">
        <label className="schedule__field">
          <span className="schedule__field-label">Start time</span>
          <input
            type="time"
            className="schedule__time"
            value={schedule.startTime}
            onChange={(event) =>
              setSchedule((prev) => ({ ...prev, startTime: event.target.value }))
            }
          />
        </label>
      </div>

      <fieldset className="schedule__days">
        <legend className="schedule__field-label">Active days</legend>
        <div className="schedule__days-grid">
          {WEEKDAYS.map(({ value, label }) => {
            const active = schedule.days.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                className={`schedule__day${active ? ' schedule__day--active' : ''}`}
                onClick={() => toggleDay(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="schedule__next">
        {schedule.enabled ? (
          upcoming ? (
            <>
              Next focus block: <strong>{formatNext(upcoming)}</strong>
            </>
          ) : (
            'Pick at least one day and a time to schedule a focus block.'
          )
        ) : (
          'Scheduling is off — turn it on to plan your focus blocks.'
        )}
      </p>

      <div className="settings-actions">
        <button type="button" className="settings-btn settings-btn--primary" onClick={handleSave}>
          Save schedule
        </button>
      </div>
    </div>
  );
}

export default Scheduling;
