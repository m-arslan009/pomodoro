import { act, renderHook } from '@testing-library/react';
import usePomodoroTimer from './usePomodoroTimer.js';

/*
 * Suite A1 — the phase transition engine.
 *
 * Proves the timer state machine drives a full work → break → idle round trip on
 * its own: it re-arms each phase with the right duration, reports every phase
 * boundary through `onComplete` exactly once, and leaves no residual time behind
 * for the next block.
 *
 * Timekeeping is timestamp-derived (`remainingMs` is recomputed from a stored end
 * time), so the system clock must move together with the interval. Vitest's fake
 * timers fake `Date` by default, so `vi.advanceTimersByTime()` moves both; the
 * clock is pinned in `beforeEach` to keep the arithmetic deterministic.
 */

const WORK_MINUTES = 5;
const BREAK_MINUTES = 2;
const WORK_MS = WORK_MINUTES * 60 * 1000; // 300,000 ms
const BREAK_MS = BREAK_MINUTES * 60 * 1000; // 120,000 ms
const TICK_MS = 250; // matches the hook's internal interval

const START_TIME = new Date('2026-01-01T09:00:00.000Z');

function renderTimer() {
  const onComplete = vi.fn();
  const view = renderHook(() =>
    usePomodoroTimer({ workMinutes: WORK_MINUTES, breakMinutes: BREAK_MINUTES, onComplete })
  );
  return { ...view, onComplete };
}

// Each advance gets its own act() so React flushes the state updates the interval
// queued and lets the ticking effect re-subscribe before the next phase runs.
function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('A1. Phase transition engine (usePomodoroTimer)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('A1.1 rolls a finished work phase straight into a break armed with the break duration', () => {
    const { result, onComplete } = renderTimer();

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe('work');
    expect(result.current.remainingMs).toBe(WORK_MS);

    advance(WORK_MS);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('work');
    expect(result.current.phase).toBe('break');
    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(BREAK_MS);
  });

  it('A1.2 returns to idle after the break so the next work block starts from a clean slate', () => {
    const { result, onComplete } = renderTimer();

    act(() => {
      result.current.start();
    });
    advance(WORK_MS); // work → break
    advance(BREAK_MS); // break → idle

    expect(onComplete.mock.calls).toEqual([['work'], ['break']]);
    expect(result.current.phase).toBe('idle');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingMs).toBe(WORK_MS);

    // Observable proof the previous end time was cleared: the next block behaves
    // like a first run instead of inheriting leftover break time.
    act(() => {
      result.current.start();
    });
    expect(result.current.remainingMs).toBe(WORK_MS);

    advance(30 * 1000);

    expect(result.current.phase).toBe('work');
    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(WORK_MS - 30 * 1000);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('A1.3 reports elapsed wall-clock time after a backgrounded jump, not elapsed ticks', () => {
    const { result } = renderTimer();
    const jumpMs = 4 * 60 * 1000; // 240,000 ms

    act(() => {
      result.current.start();
    });

    // Simulate a throttled background tab: four minutes of real time pass while
    // the interval only gets to run a single time.
    act(() => {
      vi.setSystemTime(START_TIME.getTime() + jumpMs);
      vi.advanceTimersByTime(TICK_MS);
    });

    // 300,000 − 240,250 = 59,750 ms. An accumulator counting ticks would still
    // be reporting 299,750 ms here.
    expect(result.current.remainingMs).toBe(WORK_MS - (jumpMs + TICK_MS));
    expect(result.current.remainingMs).not.toBe(WORK_MS - TICK_MS);
  });

  it('A1.4 freezes the countdown while paused and resumes from the frozen value', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.start();
    });
    advance(60 * 1000);
    expect(result.current.remainingMs).toBe(WORK_MS - 60 * 1000); // 240,000 ms

    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe('paused');

    advance(30 * 1000); // wall-clock time passes while paused

    expect(result.current.status).toBe('paused');
    expect(result.current.remainingMs).toBe(WORK_MS - 60 * 1000);

    act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe('running');

    advance(10 * 1000);

    // 240,000 − 10,000: the 30 s spent paused were not silently consumed, which
    // would have left 200,000 ms against the original end time.
    expect(result.current.remainingMs).toBe(WORK_MS - 70 * 1000);
  });

  it('A1.5 re-arms only the current phase on restart and resets to a work block on terminate', () => {
    const { result, onComplete } = renderTimer();

    act(() => {
      result.current.start();
    });
    advance(WORK_MS); // work → break
    advance(30 * 1000);
    expect(result.current.remainingMs).toBe(BREAK_MS - 30 * 1000);

    // restart() is phase-local: the break re-arms at its own full duration and
    // no phase boundary is reported.
    act(() => {
      result.current.restart();
    });
    expect(result.current.phase).toBe('break');
    expect(result.current.status).toBe('running');
    expect(result.current.remainingMs).toBe(BREAK_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // terminate() is a full reset back to an unstarted work block.
    act(() => {
      result.current.terminate();
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingMs).toBe(WORK_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // restart() has nothing to re-arm while idle.
    act(() => {
      result.current.restart();
    });
    advance(5 * 1000);

    expect(result.current.phase).toBe('idle');
    expect(result.current.status).toBe('idle');
    expect(result.current.remainingMs).toBe(WORK_MS);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
