import { createSelector } from '@reduxjs/toolkit';

/*
 * timerSelectors — reading the timer slice.
 *
 * DELIBERATELY ITS OWN MODULE, and the reason is architectural rather than tidiness. History must
 * not reach the network: it renders whatever the store holds and aggregates it with the pure
 * helpers in services/history.js. If its selectors lived in timerSlice.js, importing one would drag
 * in the thunks, and through them services/sessions.js and services/api.js — so the rule
 * "History makes no API call" would be true only by everyone's continued good behaviour
 * (CONTRACT.md §17.4).
 *
 * This file imports nothing but Redux. That is what makes the boundary checkable instead of
 * aspirational.
 */

const EMPTY = [];

/** @param {{timer: object}} state */
export const selectTasks = (state) => state.timer.tasks ?? EMPTY;
/** @param {{timer: object}} state */
export const selectSessions = (state) => state.timer.sessions ?? EMPTY;
/** @param {{timer: object}} state */
export const selectGamification = (state) => state.timer.gamification;
/** @param {{timer: object}} state */
export const selectTimerStatus = (state) => state.timer.status;
/** @param {{timer: object}} state */
export const selectTimerError = (state) => state.timer.error;

/**
 * The last task write that failed and was rolled back.
 *
 * Its own field rather than `error`, which `rollUp` rewrites on every hydration outcome. Nothing
 * rendered a rolled-back write before this, so a failed complete or abandon reverted in silence —
 * which is what makes two different row actions look like one action that does nothing.
 *
 * @param {{timer: object}} state
 */
export const selectTaskError = (state) => state.timer.taskError ?? null;

/** Lifetime points drive the title ladder, and never decrease. */
export const selectLifetimePoints = createSelector(
  selectGamification,
  (gamification) => gamification?.lifetimePoints ?? 0
);

/**
 * Focus intervals only. Breaks are recorded — every path out of a running interval produces a
 * record — but they are not work, and counting them would roughly double every figure the product
 * reports (edge case E12).
 *
 * Memoised because it derives a new array: an unmemoised selector returning a fresh array on every
 * call re-renders its subscribers on every unrelated store change.
 */
export const selectFocusSessions = createSelector(selectSessions, (sessions) =>
  sessions.filter((session) => session.type === 'focus')
);

/** Open tasks, oldest first — a to-do list is worked front to back. */
export const selectBacklog = createSelector(selectTasks, (tasks) =>
  tasks
    .filter((task) => task.status === 'todo')
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
);

/** Resolved tasks, newest first, for the "show completed" disclosure. */
export const selectResolvedTasks = createSelector(selectTasks, (tasks) =>
  tasks
    .filter((task) => task.status !== 'todo')
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
);

/** How many finished records are still waiting to reach the server. */
export const selectPendingSyncCount = createSelector(
  selectSessions,
  (sessions) => sessions.filter((session) => session.syncState === 'pending').length
);

/**
 * Records the server has permanently refused (§17.5).
 *
 * They are kept, never dropped — but keeping a rejection nothing renders is the same outcome as
 * dropping it, arrived at more expensively (defect F15). This is what makes it visible.
 */
export const selectRejectedSessions = createSelector(selectSessions, (sessions) =>
  sessions.filter((session) => session.syncState === 'rejected')
);

/* ------------------------------------------------------- Hydration state -- */

/** Human labels for the four reads, so the banner can name what is missing. */
const RESOURCE_LABELS = {
  sessions: 'your session history',
  backlog: 'your tasks',
  resolved: 'your resolved tasks',
  gamification: 'your points',
};

/**
 * Per-resource hydration outcome (§17.3 rule 5).
 *
 * Falls back to synthesising all four from the flat `status` when `hydration` is absent. That is not
 * defensive clutter: `preloadedState` is a public Redux API, so a partially-shaped timer slice is a
 * state the store can genuinely be in, and a selector that returned `undefined` there would push a
 * null check into every consumer.
 */
export const selectHydration = createSelector(
  (state) => state.timer.hydration,
  selectTimerStatus,
  selectTimerError,
  (hydration, status, error) => {
    if (hydration) return hydration;
    const synthesised = { status: status ?? 'idle', error: error ?? null };
    return {
      sessions: synthesised,
      backlog: synthesised,
      resolved: synthesised,
      gamification: synthesised,
    };
  }
);

/** Just the reads that failed, each with the label the banner shows. */
export const selectHydrationFailures = createSelector(selectHydration, (hydration) =>
  Object.entries(hydration)
    .filter(([, resource]) => resource.status === 'error')
    .map(([key, resource]) => ({ key, label: RESOURCE_LABELS[key] ?? key, error: resource.error }))
);

/** The backlog read alone — the task tile must not report failure because points were slow (E9). */
export const selectBacklogHydration = createSelector(
  selectHydration,
  (hydration) => hydration.backlog
);

/** The points read alone, for the same reason in reverse: freeze status is only as good as it. */
export const selectGamificationHydration = createSelector(
  selectHydration,
  (hydration) => hydration.gamification
);

/* --------------------------------------------------------- Streak freeze -- */

/** Stable identity, so a slice without the field does not churn the memo (see selectHydration). */
const EMPTY_STREAK_FREEZE = { lastSeenAvailable: null, spent: 0 };

const selectStreakFreezeState = (state) => state.timer.streakFreeze ?? EMPTY_STREAK_FREEZE;

/**
 * Everything a surface needs to render streak protection, resolved to ONE status (§14.6).
 *
 *   loading   — no snapshot yet and the points read is still in flight
 *   error     — no snapshot and the points read failed; there is nothing honest to show
 *   consumed  — the server's count dropped, so a freeze was spent and not yet acknowledged
 *   available — at least one freeze is banked
 *   none      — the count is zero; the next missed day ends the streak
 *
 * `consumed` outranks `available` because it is news and the count is not: the number is on screen
 * either way, but "we just used one" is the thing the user did not know. `loading` and `error` are
 * gated on having NO snapshot at all — once real totals exist, a slow or failed REFRESH must not
 * replace them with a skeleton, and the shell's banner already names the read that failed (§17.4).
 */
export const selectStreakFreeze = createSelector(
  selectGamification,
  selectGamificationHydration,
  selectStreakFreezeState,
  (gamification, hydration, freeze) => {
    const available = Number.isFinite(gamification?.streakFreezesAvailable)
      ? Math.max(0, gamification.streakFreezesAvailable)
      : 0;
    const spent = freeze.spent ?? 0;
    const loaded = freeze.lastSeenAvailable !== null;

    let status;
    if (!loaded && hydration.status === 'loading') status = 'loading';
    else if (!loaded && hydration.status === 'error') status = 'error';
    else if (spent > 0) status = 'consumed';
    else if (available > 0) status = 'available';
    else status = 'none';

    // No `error` string here on purpose: the panel's failure copy is fixed, the shell's banner is
    // what quotes the read's own message, and a field no surface renders is how F14 happened.
    return { status, available, spent };
  }
);

/** True when the §17.2 record cap stopped the session loop short of the full window. */
export const selectSessionsTruncated = (state) => state.timer.truncated ?? false;
