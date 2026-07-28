import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * usePomodoroTimer — the timer state machine for the dashboard prototype.
 *
 * PROTOTYPE SCOPE: this hook owns only in-memory timer state. It does NOT touch
 * localStorage, global context, or the gamification engine — those side-effects
 * are deliberately deferred (see the plan). It simply reports lifecycle changes
 * (`onComplete`) so the page can update points/history without this hook needing
 * to know anything about them. When persistence is added later, the reducer/
 * storage wiring can live in the page's `onComplete`, leaving this markup intact.
 *
 * Timekeeping is timestamp-based: `remainingMs` is recomputed from a stored
 * `endTime` on every tick, so the countdown does not drift and survives the tab
 * being backgrounded (where interval callbacks are throttled).
 *
 * Phases:  idle → work → break → idle
 *   - work reaching 0  → fire onComplete('work'), auto-start the break
 *   - break reaching 0 → fire onComplete('break'), return to idle
 *
 * Status:  'idle' | 'running' | 'paused' | 'completed'
 */

const TICK_MS = 250;

function minutesToMs(minutes) {
  return Math.round(minutes * 60 * 1000);
}

export default function usePomodoroTimer({ workMinutes = 25, breakMinutes = 5, onComplete } = {}) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'work' | 'break'
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'paused' | 'completed'
  const [remainingMs, setRemainingMs] = useState(minutesToMs(workMinutes));

  // Absolute timestamp the current interval ends at (while running). When paused,
  // we instead keep the frozen remaining time in `pausedRemainingRef`.
  const endTimeRef = useRef(null);
  const pausedRemainingRef = useRef(null);
  // Keep the latest onComplete without re-subscribing the interval each render.
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const durationFor = useCallback(
    (which) => minutesToMs(which === 'break' ? breakMinutes : workMinutes),
    [workMinutes, breakMinutes]
  );

  // Begin (or restart) a phase's countdown from its full duration.
  const beginPhase = useCallback(
    (which) => {
      const total = durationFor(which);
      pausedRemainingRef.current = null;
      endTimeRef.current = Date.now() + total;
      setPhase(which);
      setStatus('running');
      setRemainingMs(total);
    },
    [durationFor]
  );

  // The single ticking effect — active only while running.
  useEffect(() => {
    if (status !== 'running') return undefined;

    function tick() {
      const left = Math.max(0, (endTimeRef.current ?? 0) - Date.now());
      setRemainingMs(left);

      if (left > 0) return;

      // Interval elapsed. Transition based on the phase that just finished.
      const finishedPhase = phase;
      onCompleteRef.current?.(finishedPhase);

      if (finishedPhase === 'work') {
        beginPhase('break');
      } else {
        endTimeRef.current = null;
        setPhase('idle');
        setStatus('idle');
        setRemainingMs(durationFor('work'));
      }
    }

    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, phase, beginPhase, durationFor]);

  const start = useCallback(() => {
    beginPhase('work');
  }, [beginPhase]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    const left = Math.max(0, (endTimeRef.current ?? 0) - Date.now());
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
    setStatus('running');
  }, [status]);

  // Reset the CURRENT interval back to full — no penalty, keeps the same phase.
  const restart = useCallback(() => {
    if (phase === 'idle') return;
    beginPhase(phase);
  }, [phase, beginPhase]);

  // Abandon the block early and return to idle. The page decides scoring.
  const terminate = useCallback(() => {
    endTimeRef.current = null;
    pausedRemainingRef.current = null;
    setPhase('idle');
    setStatus('idle');
    setRemainingMs(durationFor('work'));
  }, [durationFor]);

  const totalMs = durationFor(phase === 'break' ? 'break' : 'work');

  return {
    phase,
    status,
    remainingMs,
    totalMs,
    isIdle: status === 'idle',
    isRunning: status === 'running',
    isPaused: status === 'paused',
    start,
    pause,
    resume,
    restart,
    terminate,
  };
}
