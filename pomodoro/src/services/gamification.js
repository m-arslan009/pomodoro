/*
 * gamification.js — the single source of truth for the points economy and the
 * title/feature ladder (see idea.md). Pure and side-effect free: it never reads
 * or writes storage or the DOM, so the same functions can back the timer, the
 * title badge, and the Settings feature gates, and stay trivially testable.
 *
 * Titles derive from LIFETIME points (never lost to penalties); each title
 * unlocks exactly one previewable feature. Thresholds double at each rung, and
 * every tunable lives here so balancing is a one-line change.
 */

export const POINTS = {
  sessionComplete: 100,
  consecutiveBonus: 50,
  consecutiveThreshold: 3, // +50 on every 3rd consecutive completion
  terminatePenalty: 200, // subtracted from balance; balance floors at 0
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

/**
 * Apply a completed focus session to a gamification state, returning the next
 * state plus the point delta and any titles newly crossed. Lifetime and balance
 * both grow; the streak advances and earns the +50 bonus on each Nth completion.
 */
export function applyCompletion(state) {
  const lifetime = safePoints(state?.lifetimePoints);
  const balance = safePoints(state?.balance);
  const streak = safePoints(state?.currentStreak);

  const nextStreak = streak + 1;
  const bonus = nextStreak % POINTS.consecutiveThreshold === 0 ? POINTS.consecutiveBonus : 0;
  const delta = POINTS.sessionComplete + bonus;

  const before = titlesFor(lifetime);
  const nextLifetime = lifetime + delta;
  const after = titlesFor(nextLifetime);
  const unlocked = after.filter((key) => !before.includes(key));

  return {
    state: {
      lifetimePoints: nextLifetime,
      balance: balance + delta,
      currentStreak: nextStreak,
      unlockedTitles: after,
    },
    delta,
    bonus,
    unlocked, // title keys crossed by this completion
  };
}

/**
 * Apply an early termination: the balance loses the penalty (floored at 0), the
 * streak resets, and lifetime is untouched so earned titles never regress.
 */
export function applyTermination(state) {
  const lifetime = safePoints(state?.lifetimePoints);
  const balance = safePoints(state?.balance);
  return {
    state: {
      lifetimePoints: lifetime,
      balance: Math.max(0, balance - POINTS.terminatePenalty),
      currentStreak: 0,
      unlockedTitles: titlesFor(lifetime),
    },
    delta: -POINTS.terminatePenalty,
  };
}
