/*
 * gamification.js — the points economy and the title/feature ladder. Pure and
 * side-effect free: it never reads or writes storage or the DOM, so the same
 * functions back the timer, the title badge, and the Settings feature gates, and
 * stay trivially testable.
 *
 * Titles derive from LIFETIME points, which never decrease; each title unlocks
 * exactly one previewable feature. Thresholds double at each rung, and every
 * tunable lives here so balancing is a one-line change.
 *
 * TWO STREAKS, deliberately (CONTRACT.md §14.2):
 *   - currentDayStreak  — consecutive CALENDAR DAYS with at least one completed
 *     focus session. This is the streak the UI shows.
 *   - currentSessionRun — consecutive completed focus sessions. Internal to the
 *     economy: it fires the +50 bonus every 3rd session and resets on terminate.
 * Collapsing them into one number is what made "streak" mean two things at once.
 *
 * TERMINATING COSTS NOTHING. It scores 0 and resets the session run — there is no
 * point penalty (§14.2, and the supersession in .claude/locked_decisions.md).
 * Punishing an honest early stop taught users to let the clock run out in another
 * tab, which is worse data and worse for them.
 *
 * THERE IS NO SCORING FUNCTION HERE, AND THERE MUST NEVER BE ONE AGAIN.
 * `applyCompletion` and `applyTermination` lived here until the API existed; the
 * server now owns the economy outright and returns new totals with every recorded
 * session. What remains is presentation only — thresholds, names, progress
 * arithmetic — because points drive titles and titles unlock features, so a
 * client that could compute its own score could award itself the product
 * (CONTRACT.md §14.3 rule 1, §18).
 *
 * The constants below MIRROR backend/src/domain/gamification.ts. They are not the
 * authority: they exist so a tile can render a threshold without a round trip.
 * Keep the numbers identical.
 */

export const POINTS = {
  sessionComplete: 100,
  consecutiveBonus: 50,
  consecutiveThreshold: 3, // +50 on every 3rd consecutive completion
};

export const TITLES = [
  { key: 'anchor', name: 'The Anchor', threshold: 1000, feature: 'themeEditor' },
  { key: 'paceSetter', name: 'The Pace Setter', threshold: 2000, feature: 'backgroundAndLabels' },
  { key: 'catalyst', name: 'The Catalyst', threshold: 4000, feature: 'timeUtilization' },
  { key: 'vanguard', name: 'The Vanguard', threshold: 8000, feature: 'graphicalReports' },
  { key: 'paragon', name: 'The Paragon', threshold: 16000, feature: 'scheduling' },
];

/** Coerce any input to a non-negative finite point total. */
function safePoints(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Title keys unlocked at the given lifetime points, in ascending order. */
export function titlesFor(lifetimePoints) {
  const points = safePoints(lifetimePoints);
  return TITLES.filter((title) => points >= title.threshold).map((title) => title.key);
}

/** The highest title earned at the given lifetime points, or null if none yet. */
export function currentTitle(lifetimePoints) {
  const points = safePoints(lifetimePoints);
  let earned = null;
  for (const title of TITLES) {
    if (points >= title.threshold) earned = title;
  }
  return earned;
}

/** The next title still to earn, or null once every title is unlocked. */
export function nextTitle(lifetimePoints) {
  const points = safePoints(lifetimePoints);
  return TITLES.find((title) => points < title.threshold) ?? null;
}

/**
 * Progress toward the next title as a 0–100 percentage measured from the
 * previous threshold, plus the surrounding context a progress bar renders.
 */
export function progressToNext(lifetimePoints) {
  const points = safePoints(lifetimePoints);
  const current = currentTitle(points);
  const next = nextTitle(points);
  if (!next) return { current, next: null, percent: 100, remaining: 0 };

  const floor = current ? current.threshold : 0;
  const span = next.threshold - floor;
  const gained = points - floor;
  const percent = span > 0 ? Math.min(100, Math.max(0, Math.round((gained / span) * 100))) : 0;
  return { current, next, percent, remaining: Math.max(0, next.threshold - points) };
}

/** The title that unlocks a given feature key, or null when the key is unknown. */
export function featureTitle(featureKey) {
  return TITLES.find((title) => title.feature === featureKey) ?? null;
}

/** Whether a feature is unlocked at the given lifetime points. */
export function isFeatureUnlocked(lifetimePoints, featureKey) {
  const title = featureTitle(featureKey);
  if (!title) return true; // unknown / ungated features are always available
  return safePoints(lifetimePoints) >= title.threshold;
}
