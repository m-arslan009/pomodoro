import { describe, expect, it } from 'vitest';
import { buildTimeline, summarize, taskOutcomes } from '../../services/history.js';

/*
 * Suite D5 — the three aggregates History is built on (CONTRACT.md §17.1).
 *
 * These functions ARE the seam. History's contract is the shape of an aggregate, not the shape of a
 * session, so everything the feature renders comes out of exactly three calls — and until now not
 * one of them had a test. That gap is what let a `Summary` field be computed and rendered nowhere,
 * and let two of its counts disagree with the chart drawn beside them (defect F14).
 *
 * Pure functions with no store, no clock and no DOM, so these are direct calls: the point of
 * putting the seam here was that it could be checked without mounting anything.
 */

function session(overrides = {}) {
  return {
    clientSessionId: `s-${Math.random()}`,
    taskId: 'task-1',
    taskTitle: 'Thesis chapter 3',
    type: 'focus',
    status: 'completed',
    startedAt: '2026-07-31T09:00:00.000Z',
    endedAt: '2026-07-31T09:25:00.000Z',
    plannedDurationMs: 1500000,
    actualDurationMs: 1500000,
    terminationReason: null,
    pointsAwarded: 100,
    ...overrides,
  };
}

function task(status, overrides = {}) {
  return { id: `t-${Math.random()}`, title: 'Thesis chapter 3', status, ...overrides };
}

const GAMIFICATION = {
  balance: 1250,
  lifetimePoints: 1250,
  currentDayStreak: 6,
  longestDayStreak: 11,
  currentSessionRun: 2,
  streakFreezesAvailable: 0,
  unlockedTitles: ['anchor'],
};

/** An ISO timestamp `daysAgo` days before `now`, at local noon so no test straddles midnight. */
function daysBefore(now, daysAgo) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe('D5. History aggregates (services/history.js)', () => {
  it('D5.1 counts focus time from terminated blocks as well as completed ones', () => {
    const summary = summarize(
      [
        session({ actualDurationMs: 25 * 60 * 1000 }),
        session({
          status: 'terminated',
          terminationReason: 'interrupted',
          actualDurationMs: 20 * 60 * 1000,
          pointsAwarded: 0,
        }),
      ],
      [],
      GAMIFICATION
    );

    /*
     * A block honestly ended after twenty minutes was twenty minutes of focus, and the caption
     * reads "min focused", not "min completed". This is the termination-penalty supersession
     * applied to the clock: the product stopped punishing an honest early stop, so it must not
     * quietly erase the work either.
     */
    expect(summary.focusMinutes).toBe(45);

    // The outcome counts still separate them — not counting the time is different from not
    // noticing the block ended early.
    expect(summary.completedSessions).toBe(1);
    expect(summary.terminatedSessions).toBe(1);
    expect(summary.completionRate).toBe(50);
  });

  it('D5.2 reports open and abandoned tasks separately, matching the outcome chart exactly', () => {
    const tasks = [
      task('completed'),
      task('completed'),
      task('todo'),
      task('abandoned'),
      task('abandoned'),
      task('abandoned'),
    ];

    const summary = summarize([], tasks, GAMIFICATION);
    const outcomes = Object.fromEntries(taskOutcomes(tasks).map((o) => [o.key, o.count]));

    /*
     * The tile and the chart render the same tasks on the same page, so they must bucket them the
     * same way. They were one `incompleteTasks` field against three bars, which is two answers to
     * one question and no way to tell which was wrong.
     */
    expect(summary.completedTasks).toBe(outcomes.completed);
    expect(summary.openTasks).toBe(outcomes.todo);
    expect(summary.abandonedTasks).toBe(outcomes.abandoned);
    expect([summary.completedTasks, summary.openTasks, summary.abandonedTasks]).toEqual([2, 1, 3]);
  });

  it('D5.3 takes points and both streaks from the server projection, never from the records', () => {
    const summary = summarize([session()], [], GAMIFICATION);

    // Lifetime, not balance: the caption says "Lifetime points earned", and the first spending
    // rule would otherwise turn the headline figure into a quiet lie.
    expect(summary.points).toBe(GAMIFICATION.lifetimePoints);
    expect(summary.currentDayStreak).toBe(6);
    expect(summary.longestDayStreak).toBe(11);

    // Missing progression is zeros, not NaN or undefined — the store holds a zeroed object before
    // the first fetch resolves, and every consumer reads it unconditionally.
    const empty = summarize([session()], [], {});
    expect(empty.points).toBe(0);
    expect(empty.currentDayStreak).toBe(0);
    expect(empty.longestDayStreak).toBe(0);
  });

  it('D5.4 excludes break intervals from every aggregate', () => {
    const sessions = [
      session({ actualDurationMs: 25 * 60 * 1000 }),
      session({ type: 'break', actualDurationMs: 5 * 60 * 1000, pointsAwarded: 0 }),
    ];

    const summary = summarize(sessions, [], GAMIFICATION);
    const timeline = buildTimeline(sessions, 'daily', new Date('2026-07-31T20:00:00.000Z').getTime());

    /*
     * Breaks are recorded — every path out of a running interval produces a record — but they are
     * not work. Letting them through would roughly double every figure the product reports.
     */
    expect(summary.totalSessions).toBe(1);
    expect(summary.focusMinutes).toBe(25);
    expect(timeline.reduce((sum, b) => sum + b.total, 0)).toBe(1);
  });

  it('D5.5 buckets a session by when it ENDED, and returns a fixed-length window either way', () => {
    const now = new Date('2026-07-31T20:00:00.000Z').getTime();

    const daily = buildTimeline(
      [
        session({ endedAt: daysBefore(now, 0) }),
        session({ endedAt: daysBefore(now, 3) }),
        session({ status: 'terminated', endedAt: daysBefore(now, 3) }),
        // Outside the seven-day window: counted by nothing, and must not throw.
        session({ endedAt: daysBefore(now, 30) }),
      ],
      'daily',
      now
    );

    expect(daily).toHaveLength(7);
    expect(daily.at(-1).completed).toBe(1);
    expect(daily.at(-4)).toMatchObject({ completed: 1, terminated: 1, total: 2 });

    // Fixed length regardless of data, so an empty range renders a flat chart rather than nothing.
    expect(buildTimeline([], 'weekly', now)).toHaveLength(6);
    expect(buildTimeline([], 'monthly', now)).toHaveLength(6);
  });

  it('D5.6 spans the whole hydration window, so the wide views can actually be populated', () => {
    const now = new Date('2026-07-31T20:00:00.000Z').getTime();

    /*
     * The reason the record cap matters. `buildTimeline`'s widest view is six months, which is what
     * the 180-day window exists to feed — a client that fetched only the most recent page would
     * leave five of these six buckets permanently empty, whatever the server held. That was the
     * 7-day prune's symptom, and then the page size's.
     */
    const monthly = buildTimeline(
      [0, 35, 65, 95, 125, 155].map((daysAgo) => session({ endedAt: daysBefore(now, daysAgo) })),
      'monthly',
      now
    );

    expect(monthly).toHaveLength(6);
    expect(monthly.every((bucket) => bucket.total > 0)).toBe(true);
  });

  it('D5.7 always returns the three task statuses, in a stable order, even with no tasks', () => {
    const empty = taskOutcomes([]);

    expect(empty.map((o) => o.key)).toEqual(['completed', 'todo', 'abandoned']);
    expect(empty.every((o) => o.count === 0)).toBe(true);

    // A status the model cannot produce is ignored rather than crashing the chart. `expired` and
    // `terminated` were bucketed here once; neither is a task status, so both bars were dead.
    const odd = taskOutcomes([task('expired'), task('terminated'), task('todo')]);
    expect(odd.reduce((sum, o) => sum + o.count, 0)).toBe(1);
  });
});
