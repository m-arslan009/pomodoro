import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * usePomodoroTimer — the timer state machine.
 *
 * Owns TIMEKEEPING only. It does not touch storage, the store, or the points
 * economy: it reports each finished interval through `onComplete` and hands back
 * the numbers a session record needs, so the page can finalize without this hook
 * knowing what a session record is (CONTRACT.md §18 — "owns no persistence").
 *
 * Timekeeping is timestamp-based: `remainingMs` is recomputed from a stored
 * `endTime` on every sample, so the countdown does not drift and survives the tab
 * being backgrounded, where interval callbacks are throttled.
 *
 * Phases:  idle → work → break → idle
 *   - work reaching 0  → onComplete('work'), auto-start the break
 *   - break reaching 0 → onComplete('break'), return to idle
 *
 * Four behaviours are easy to misread as bugs, so they are stated here:
 *
 * 1. DURATIONS ARE SNAPSHOTTED AT start(), NOT AT MOUNT (§14.4, defect F1). While
 *    idle the clock tracks the current settings live, so a saved 50/10 shows as
 *    50:00 the moment preferences resolve. Once a block begins it keeps the
 *    duration it began with, so changing Settings mid-session cannot retarget the
 *    block the user is already running.
 *
 * 2. FOCUSED TIME IS NOT WALL-CLOCK TIME. Pause freezes the count but the clock on
 *    the wall keeps moving, so a block paused for an hour has a 25-minute focused
 *    duration and an 85-minute span. `focusedMs()` accumulates only running
 *    segments; it is what becomes `actualDurationMs` (§13.2, §15.1 rule 5).
 *
 * 3. RESTART FROM PAUSED RESUMES RUNNING (§14.4). Restart resets the current
 *    interval to full and starts it — it does not restore the paused state.
 *
 * 4. RECOVERY IS AN INITIALISER, NOT A METHOD. A persisted draft is passed in as
 *    `initialDraft` and the machine is BORN mid-block, rather than mounting idle
 *    and being corrected a tick later. There is no frame in which a recovered
 *    session renders as 00:00, and no effect racing the first paint.
 *
 * Sampling runs at SAMPLE_MS for accuracy, but state is only written when the
 * DISPLAYED second changes. The previous build set state four times a second for
 * a value that changes once, re-rendering every dashboard tile on each write
 * (defect F6).
 */

const SAMPLE_MS = 250;

function minutesToMs(minutes) {
  return Math.round(minutes * 60 * 1000);
}

/** The whole second a countdown displays, so state writes can be deduped against it. */
function displayedSecond(ms) {
  return Math.ceil(Math.max(0, ms) / 1000);
}

function timeOf(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Derive the machine's starting state, either idle or resumed from a draft.
 * Pure, so it can run in a lazy initialiser during the first render.
 */
function deriveInitialState(draft, workMinutes) {
  const idleTotal = minutesToMs(workMinutes);
  const idle = {
    phase: 'idle',
    status: 'idle',
    remaining: idleTotal,
    planned: idleTotal,
    startedAt: null,
    accumulated: 0,
    segmentStart: null,
    endTime: null,
    pausedRemaining: null,
  };

  if (!draft) return idle;

  const planned = Number.isFinite(draft.plannedDurationMs) ? draft.plannedDurationMs : idleTotal;
  const phase = draft.type === 'break' ? 'break' : 'work';
  const startedAt = timeOf(draft.startedAt) || Date.now();
  const now = Date.now();

  if (draft.pausedAt) {
    const banked = Number.isFinite(draft.accumulatedMs) ? draft.accumulatedMs : 0;
    const left = Math.min(planned, Math.max(0, planned - banked));
    return {
      phase,
      status: 'paused',
      remaining: left,
      planned,
      startedAt,
      accumulated: banked,
      segmentStart: null,
      endTime: null,
      pausedRemaining: left,
    };
  }

  const endTime = timeOf(draft.endTime) || now;
  const left = Math.min(planned, Math.max(0, endTime - now));
  return {
    phase,
    status: 'running',
    remaining: left,
    planned,
    startedAt,
    // A running block genuinely progressed while the tab was gone — the countdown
    // is timestamp-based, so the elapsed span counts as focused time.
    accumulated: Math.max(0, planned - left),
    segmentStart: now,
    endTime,
    pausedRemaining: null,
  };
}

export default function usePomodoroTimer({
  workMinutes = 25,
  breakMinutes = 5,
  onComplete,
  initialDraft = null,
} = {}) {
  const [initial] = useState(() => deriveInitialState(initialDraft, workMinutes));

  const [phase, setPhase] = useState(initial.phase); // 'idle' | 'work' | 'break'
  const [status, setStatus] = useState(initial.status); // 'idle' | 'running' | 'paused'
  const [remainingMs, setRemainingMs] = useState(initial.remaining);
  // The duration this interval began with — the F1 snapshot. Held as state because
  // the view renders it, and mirrored in a ref for the sampling loop.
  const [plannedMs, setPlannedMs] = useState(initial.planned);
  // Bumped on every phase start. Restart keeps the same phase and status, so it is
  // the only signal a caller can key a "the run changed" effect on.
  const [runId, setRunId] = useState(0);

  const endTimeRef = useRef(initial.endTime);
  const pausedRemainingRef = useRef(initial.pausedRemaining);
  const plannedRef = useRef(initial.planned);
  const startedAtRef = useRef(initial.startedAt);
  // Focused ms banked from finished running segments, plus the start of the
  // current one. Together they make focusedMs() pause-aware.
  const accumulatedRef = useRef(initial.accumulated);
  const segmentStartRef = useRef(initial.segmentStart);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const durationFor = useCallback(
    (which) => minutesToMs(which === 'break' ? breakMinutes : workMinutes),
    [workMinutes, breakMinutes]
  );

  /** Focused milliseconds so far in the current interval — excludes paused time. */
  const focusedMs = useCallback(() => {
    const running = segmentStartRef.current !== null ? Date.now() - segmentStartRef.current : 0;
    return Math.max(0, accumulatedRef.current + running);
  }, []);

  /** Everything the caller needs to persist the current interval as a draft. */
  const getTimings = useCallback(
    () => ({
      startedAt: startedAtRef.current,
      endTime: endTimeRef.current,
      plannedDurationMs: plannedRef.current,
      accumulatedMs: accumulatedRef.current,
      focusedMs: focusedMs(),
    }),
    [focusedMs]
  );

  /** The record-shaped description of an interval that has just ended. */
  const describe = useCallback(
    (reason) => {
      const planned = plannedRef.current;
      return {
        startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
        endedAt: new Date().toISOString(),
        plannedDurationMs: planned,
        // Clamped locally too: the server clamps authoritatively (§15.1 rule 7),
        // but a record that is wrong before it is sent renders wrong in History
        // until the echo comes back.
        actualDurationMs: Math.min(focusedMs(), planned),
        reason,
      };
    },
    [focusedMs]
  );

  const goIdle = useCallback(() => {
    const total = durationFor('work');
    endTimeRef.current = null;
    pausedRemainingRef.current = null;
    startedAtRef.current = null;
    segmentStartRef.current = null;
    accumulatedRef.current = 0;
    plannedRef.current = total;
    setPlannedMs(total);
    setPhase('idle');
    setStatus('idle');
    setRemainingMs(total);
  }, [durationFor]);

  // Begin (or restart) a phase's countdown from its full duration.
  const beginPhase = useCallback(
    (which) => {
      const total = durationFor(which);
      const now = Date.now();
      plannedRef.current = total;
      startedAtRef.current = now;
      accumulatedRef.current = 0;
      segmentStartRef.current = now;
      pausedRemainingRef.current = null;
      endTimeRef.current = now + total;
      setPlannedMs(total);
      setPhase(which);
      setStatus('running');
      setRemainingMs(total);
      setRunId((id) => id + 1);
    },
    [durationFor]
  );

  // The single sampling effect — active only while running.
  useEffect(() => {
    if (status !== 'running') return undefined;

    function sample() {
      // Clamped to the planned duration so a backwards system-clock jump cannot
      // show more time remaining than the interval ever had (edge case E6).
      const raw = (endTimeRef.current ?? 0) - Date.now();
      const left = Math.min(plannedRef.current, Math.max(0, raw));

      // Only write state when the displayed second actually changes (F6).
      setRemainingMs((prev) => (displayedSecond(prev) === displayedSecond(left) ? prev : left));

      if (left > 0) return;

      const finishedPhase = phase;
      const detail = describe(null);

      if (finishedPhase === 'work') {
        onCompleteRef.current?.('work', detail);
        beginPhase('break');
      } else {
        onCompleteRef.current?.('break', detail);
        goIdle();
      }
    }

    const id = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [status, phase, beginPhase, goIdle, describe]);

  const start = useCallback(() => {
    beginPhase('work');
  }, [beginPhase]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    const left = Math.max(0, (endTimeRef.current ?? 0) - Date.now());
    if (segmentStartRef.current !== null) {
      accumulatedRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    pausedRemainingRef.current = left;
    endTimeRef.current = null;
    setRemainingMs(left);
    setStatus('paused');
  }, [status]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    const left = pausedRemainingRef.current ?? 0;
    endTimeRef.current = Date.now() + left;
    pausedRemainingRef.current = null;
    segmentStartRef.current = Date.now();
    setStatus('running');
  }, [status]);

  // Reset the CURRENT interval to full — same phase, no record, no penalty.
  const restart = useCallback(() => {
    if (phase === 'idle') return;
    beginPhase(phase);
  }, [phase, beginPhase]);

  /**
   * End an interval early. Returns its description so the caller can finalize a
   * record; for a focus block the caller supplies the reason (§15).
   */
  const terminate = useCallback(
    (reason = null) => {
      if (phase === 'idle') return null;
      const wasFocus = phase === 'work';
      const detail = describe(wasFocus ? reason : null);
      goIdle();
      return detail;
    },
    [phase, describe, goIdle]
  );

  /**
   * End a break early and return to idle. The break still produces a record —
   * every path out of a running interval does (§14.3 rule 3).
   */
  const skipBreak = useCallback(() => {
    if (phase !== 'break') return null;
    const detail = describe(null);
    onCompleteRef.current?.('break', detail);
    goIdle();
    return detail;
  }, [phase, describe, goIdle]);

  /*
   * While idle the clock shows the CURRENT setting, derived at render rather than
   * synced through state. A preference that resolves after mount is therefore
   * reflected on the very next render, with no effect and no intermediate frame
   * showing the stale duration (F1).
   */
  const idleTotal = minutesToMs(workMinutes);
  const isIdle = status === 'idle';
  const totalMs = isIdle ? idleTotal : plannedMs;

  return {
    phase,
    status,
    remainingMs: isIdle ? idleTotal : remainingMs,
    totalMs,
    runId,
    isIdle,
    isRunning: status === 'running',
    isPaused: status === 'paused',
    start,
    pause,
    resume,
    restart,
    terminate,
    skipBreak,
    getTimings,
    focusedMs,
  };
}
