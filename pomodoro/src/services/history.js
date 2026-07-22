/*
 * history.js — pure aggregation helpers that turn the raw persisted records
 * (sessions, tasks, gamification) into the shapes the History dashboard renders.
 *
 * Deliberately side-effect free: it never touches storage or the DOM, so the
 * same functions can back the future Stats page and stay trivially testable.
 * Reads come from services/storage.js in the page; this layer only derives.
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

/**
 * Top-line KPIs. Sessions carry the focus outcomes; tasks carry the to-do
 * outcomes; gamification carries the lifetime point economy.
 *   incompleteTasks = every task that never reached 'completed'
 *   (to-do, expired, or terminated).
 */
export function summarize(sessions = [], tasks = [], gamification = {}) {
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const terminatedSessions = sessions.filter((s) => s.status === 'terminated').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const incompleteTasks = tasks.filter((t) => t.status !== 'completed').length;

  const totalSessions = completedSessions + terminatedSessions;
  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const focusMs = sessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (Number.isFinite(s.durationMs) ? s.durationMs : 0), 0);
  const focusMinutes = Math.round(focusMs / 60000);

  return {
    points: Number.isFinite(gamification.points) ? gamification.points : 0,
    streak: Number.isFinite(gamification.streak) ? gamification.streak : 0,
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

  sessions.forEach((s) => {
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
 * Task outcome breakdown for the horizontal-bar view, in a stable display
 * order. `tone` maps each outcome to a semantic colour role in the CSS.
 */
export function taskOutcomes(tasks = []) {
  const counts = { completed: 0, todo: 0, expired: 0, terminated: 0 };
  tasks.forEach((t) => {
    if (t.status in counts) counts[t.status] += 1;
  });

  return [
    { key: 'completed', label: 'Completed', count: counts.completed, tone: 'good' },
    { key: 'todo', label: 'In progress', count: counts.todo, tone: 'neutral' },
    { key: 'expired', label: 'Expired', count: counts.expired, tone: 'muted' },
    { key: 'terminated', label: 'Terminated', count: counts.terminated, tone: 'bad' },
  ];
}
