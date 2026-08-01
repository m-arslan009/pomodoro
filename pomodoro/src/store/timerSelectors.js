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

/** True when the §17.2 record cap stopped the session loop short of the full window. */
export const selectSessionsTruncated = (state) => state.timer.truncated ?? false;
