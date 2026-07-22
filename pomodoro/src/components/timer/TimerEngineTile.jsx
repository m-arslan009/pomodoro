/*
 * TimerEngineTile — top-left tile: the core state-driven countdown + controls.
 *
 * Presentational only: all timer state and actions arrive as props from
 * TimerPage. The countdown shows the running phase's remaining time; because the
 * hook auto-advances work → break, the same display simply switches to break
 * time the instant a focus session finishes.
 *
 * The clock is viewport-decoupled (toggled purely in CSS, so both forms stay in
 * the DOM without a JS media query):
 *   - >576px (medium/large): a sleek, minimalist DIGITAL readout — geometric
 *     monospace numerals with a slim progress underline.
 *   - ≤576px (mobile): the circular progress RING, with a lighter stroke and
 *     scaled-down digits that sit comfortably inside the boundary.
 * A single visually-hidden `role="timer"` element carries the accessible time so
 * the decorative visuals can be aria-hidden.
 *
 * The five controls are state-aware — each renders only in the lifecycle phases
 * where it is meaningful (Start only while idle and hidden once a session begins,
 * Resume only while paused, etc.).
 */

const RING_RADIUS = 54;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const PHASE_LABEL = {
  idle: 'Ready',
  work: 'Focus',
  break: 'Break',
};

function formatClock(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function TimerEngineTile({
  phase,
  isIdle,
  isRunning,
  isPaused,
  remainingMs,
  totalMs,
  canStart,
  hasBacklog,
  activeTaskTitle,
  labels,
  onStart,
  onPause,
  onResume,
  onRestart,
  onTerminate,
}) {
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const dashOffset = RING_CIRC * (1 - progress);
  const clock = formatClock(remainingMs);
  // The work/break phases can carry a user-defined label (Pace Setter feature);
  // an empty override falls back to the built-in name. Idle stays "Ready".
  const phaseLabel = labels?.[phase]?.trim() || PHASE_LABEL[phase];

  return (
    <section
      className={`timer-tile timer-engine timer-engine--${phase}`}
      aria-labelledby="timer-engine-heading"
    >
      <header className="timer-tile__head">
        <h2 id="timer-engine-heading" className="timer-tile__title">
          Session
        </h2>
        <span className="timer-engine__phase" data-phase={phase}>
          {phaseLabel}
        </span>
      </header>

      <div className="timer-engine__display">
        {/* Digital readout — visible >576px */}
        <div className="timer-engine__digital" aria-hidden="true">
          <span className="timer-engine__digits">{clock}</span>
          <span className="timer-engine__track">
            <span className="timer-engine__track-fill" style={{ width: `${progress * 100}%` }} />
          </span>
        </div>

        {/* Circular ring — visible ≤576px */}
        <div className="timer-engine__ring" aria-hidden="true">
          <svg className="timer-ring" viewBox="0 0 120 120" focusable="false">
            <circle className="timer-ring__track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="timer-ring__progress"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              style={{ strokeDasharray: RING_CIRC, strokeDashoffset: dashOffset }}
            />
          </svg>
          <span className="timer-engine__ring-digits">{clock}</span>
        </div>

        {/* Single accessible time source for both visuals. */}
        <span
          className="timer-visually-hidden"
          role="timer"
          aria-label={`${phaseLabel} time remaining ${clock}`}
        >
          {clock}
        </span>
      </div>

      <p className="timer-engine__task">
        {activeTaskTitle ? activeTaskTitle : 'Pick a task to begin'}
      </p>

      <div className="timer-engine__controls">
        {isIdle && (
          <button
            type="button"
            className="timer-btn timer-btn--primary"
            onClick={onStart}
            disabled={!canStart}
          >
            Start
          </button>
        )}
        {isRunning && (
          <button type="button" className="timer-btn" onClick={onPause}>
            Pause
          </button>
        )}
        {isPaused && (
          <button type="button" className="timer-btn timer-btn--primary" onClick={onResume}>
            Resume
          </button>
        )}
        {(isRunning || isPaused) && (
          <button type="button" className="timer-btn" onClick={onRestart}>
            Restart
          </button>
        )}
        {(isRunning || isPaused) && (
          <button type="button" className="timer-btn timer-btn--danger" onClick={onTerminate}>
            Terminate
          </button>
        )}
      </div>

      {isIdle && !canStart && (
        <p className="timer-engine__hint">
          {hasBacklog
            ? 'Select a task from Today’s Focus to enable Start.'
            : 'Add a task in Today’s Focus to get started.'}
        </p>
      )}
    </section>
  );
}

export default TimerEngineTile;
