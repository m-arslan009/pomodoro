/*
 * history.js — pure aggregation helpers that turn Timer-generated records into
 * the three shapes the History dashboard renders:
 *
 *   summarize()     → Summary
 *   buildTimeline() → Bucket[]
 *   taskOutcomes()  → Outcome[]
 *
 * THIS IS THE SEAM (CONTRACT.md §17.1). History's contract is the shape of an
 * AGGREGATE, not the shape of a session, and History knows nothing about where
 * the underlying records came from. That is what keeps the whole feature
 * backend-agnostic: the day these aggregates need to come from a server instead,
 * only this file changes and not one History component does.
 *
 * Deliberately side-effect free — it never touches storage, the network or the
 * DOM, so it stays trivially testable and can be called from any layer.
 *
 * EVERY AGGREGATE COUNTS FOCUS ONLY. Break intervals are recorded (every path out
 * of a running interval produces a record) but they are not work, so each function
 * filters them out. Letting them through would roughly double every figure the
 * product reports (edge case E12).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Milliseconds for an ISO string; 0 (epoch) when missing/unparseable. */
function timeOf(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Local-midnight timestamp for the day containing `ms`. */
function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local-midnight timestamp for the Monday of the week containing `ms`. */
function startOfWeek(ms) {
  const d = new Date(startOfDay(ms));
  const mondayOffset = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - mondayOffset);
  return d.getTime();
}

/** Focus intervals only — breaks are recorded but never counted (E12). */
function focusOnly(sessions) {
  return sessions.filter((s) => s.type === 'focus');
}

/**
 * Top-line KPIs. Sessions carry the focus outcomes; tasks carry the to-do
 * outcomes; gamification carries the point economy.
 *   incompleteTasks = every task that never reached 'completed' (todo or abandoned)
 *
 * `points` is LIFETIME points, matching the "Lifetime points earned" caption the
 * tile renders. It previously returned `balance` under that caption — the same
 * number while nothing subtracts, but the wrong field, so the first spending rule
 * would have turned the headline figure into a quiet lie (defect F5).
 */
export function summarize(sessions = [], tasks = [], gamification = {}) {
  const focus = focusOnly(sessions);
  const completedSessions = focus.filter((s) => s.status === 'completed').length;
  const terminatedSessions = focus.filter((s) => s.status === 'terminated').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const incompleteTasks = tasks.filter((t) => t.status !== 'completed').length;

  const totalSessions = completedSessions + terminatedSessions;
  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const focusMs = focus
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (Number.isFinite(s.actualDurationMs) ? s.actualDurationMs : 0), 0);
  const focusMinutes = Math.round(focusMs / 60000);

  return {
    points: Number.isFinite(gamification.lifetimePoints) ? gamification.lifetimePoints : 0,
    streak: Number.isFinite(gamification.currentDayStreak) ? gamification.currentDayStreak : 0,
    completedSessions,
    terminatedSessions,
    completedTasks,
    incompleteTasks,
    totalSessions,
    completionRate,
    focusMinutes,
  };
}

/**
 * Build a fixed set of time buckets (oldest → newest) for the given interval
 * and tally each session's outcome into the bucket its `endedAt` falls in.
 * Returns [{ label, completed, terminated, total }].
 *
 *   'daily'   → last 7 days       (weekday labels)
 *   'weekly'  → last 6 weeks      (week-start M/D labels)
 *   'monthly' → last 6 months     (month labels)
 */
export function buildTimeline(sessions = [], interval = 'daily', now = Date.now()) {
  const buckets = [];

  if (interval === 'weekly') {
    const thisWeek = startOfWeek(now);
    for (let i = 5; i >= 0; i -= 1) {
      const start = thisWeek - i * 7 * DAY_MS;
      const d = new Date(start);
      buckets.push({
        start,
        end: start + 7 * DAY_MS,
        label: `${MONTH[d.getMonth()]} ${d.getDate()}`,
      });
    }
  } else if (interval === 'monthly') {
    const ref = new Date(now);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(year, month - i, 1).getTime();
      const end = new Date(year, month - i + 1, 1).getTime();
      buckets.push({ start, end, label: MONTH[new Date(start).getMonth()] });
    }
  } else {
    const today = startOfDay(now);
    for (let i = 6; i >= 0; i -= 1) {
      const start = today - i * DAY_MS;
      buckets.push({ start, end: start + DAY_MS, label: WEEKDAY[new Date(start).getDay()] });
    }
  }

  buckets.forEach((b) => {
    b.completed = 0;
    b.terminated = 0;
  });

  /*
   * `endedAt` decides the bucket, while the day STREAK is decided by `startedAt`
   * (§14.2). They differ by design for a session spanning local midnight: the
   * chart shows the work where it finished, the streak credits the day it was
   * begun. Recorded here so neither gets "fixed" to match the other (edge case E8).
   */
  focusOnly(sessions).forEach((s) => {
    const t = timeOf(s.endedAt);
    const bucket = buckets.find((b) => t >= b.start && t < b.end);
    if (!bucket) return;
    if (s.status === 'completed') bucket.completed += 1;
    else if (s.status === 'terminated') bucket.terminated += 1;
  });

  return buckets.map(({ label, completed, terminated }) => ({
    label,
    completed,
    terminated,
    total: completed + terminated,
  }));
}

/**
 * Task outcome breakdown for the horizontal-bar view, in a stable display order.
 * `tone` maps each outcome to a semantic colour role in the CSS.
 *
 * The three buckets are the three task statuses, and nothing else (§13.1). The
 * previous version bucketed on `expired` and `terminated`: `expired` came from a
 * 24-hour rule that no longer exists, and `terminated` is what happens to a
 * SESSION — a task is `abandoned`. Both bars were therefore permanently empty,
 * and the chart mixed session vocabulary into a task breakdown (defect F11).
 */
export function taskOutcomes(tasks = []) {
  const counts = { completed: 0, todo: 0, abandoned: 0 };
  tasks.forEach((t) => {
    if (t.status in counts) counts[t.status] += 1;
  });

  return [
    { key: 'completed', label: 'Completed', count: counts.completed, tone: 'good' },
    { key: 'todo', label: 'In progress', count: counts.todo, tone: 'neutral' },
    { key: 'abandoned', label: 'Abandoned', count: counts.abandoned, tone: 'bad' },
  ];
}
