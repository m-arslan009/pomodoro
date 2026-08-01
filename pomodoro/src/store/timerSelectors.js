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
