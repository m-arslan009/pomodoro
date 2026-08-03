import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createTask,
  deleteTask,
  flushOutbox,
  hydrateTimer,
  recordSession,
  sessionFinalized,
  streakFreezeAcknowledged,
  taskErrorCleared,
  updateTask,
} from '../store/timerSlice.js';
import {
  selectBacklog,
  selectBacklogHydration,
  selectFocusSessions,
  selectGamification,
  selectHydrationFailures,
  selectPendingSyncCount,
  selectRejectedSessions,
  selectResolvedTasks,
  selectSessionsTruncated,
  selectStreakFreeze,
  selectTaskError,
  selectTimerError,
  selectTimerStatus,
} from '../store/timerSelectors.js';

/**
 * The only way components read and write the timer's persisted data — the timer counterpart to
 * useAuth and useSettings, and the same bargain: components never import the slice or a service
 * directly, so neither a change of transport nor a change of state library reaches a component.
 *
 * This hook covers PERSISTENCE only. The running countdown — start, pause, resume, restart, skip
 * and the tick — belongs to usePomodoroTimer and never leaves the page, because the server has no
 * concept of a block in progress (CONTRACT.md §7.1).
 *
 * `finalize` is the one that matters: it adopts the finished record locally FIRST and then tries to
 * deliver it, so a block that ends while the connection is down is never lost and never invisible.
 *
 * @returns {{
 *   backlog: object[], resolvedTasks: object[], sessions: object[], gamification: object,
 *   status: 'idle'|'loading'|'ready'|'error', error: string|null, taskError: string|null,
 *   pendingSync: number,
 *   streakFreeze: {
 *     status: 'loading'|'error'|'consumed'|'available'|'none', available: number, spent: number,
 *   },
 *   acknowledgeStreakFreeze: () => void,
 *   rejectedSessions: object[], hydrationFailures: {key: string, label: string, error: string}[],
 *   backlogHydration: {status: string, error: string|null}, sessionsTruncated: boolean,
 *   addTask: (title: string, estimatedPomodoros?: number|null) => Promise<object>,
 *   editTask: (id: string, patch: {title?: string, estimatedPomodoros?: number|null}) => Promise<object>,
 *   setTaskStatus: (id: string, status: string) => Promise<object>,
 *   removeTask: (id: string) => Promise<object>,
 *   dismissTaskError: () => void,
 *   finalize: (record: object) => Promise<object>,
 *   retrySync: () => void,
 *   reload: () => void,
 * }}
 */
export default function useTimer() {
  const dispatch = useDispatch();

  const backlog = useSelector(selectBacklog);
  const resolvedTasks = useSelector(selectResolvedTasks);
  const sessions = useSelector(selectFocusSessions);
  const gamification = useSelector(selectGamification);
  const status = useSelector(selectTimerStatus);
  const error = useSelector(selectTimerError);
  const taskError = useSelector(selectTaskError);
  const pendingSync = useSelector(selectPendingSyncCount);
  const rejectedSessions = useSelector(selectRejectedSessions);
  const hydrationFailures = useSelector(selectHydrationFailures);
  const backlogHydration = useSelector(selectBacklogHydration);
  const sessionsTruncated = useSelector(selectSessionsTruncated);
  const streakFreeze = useSelector(selectStreakFreeze);

  const addTask = useCallback(
    (title, estimatedPomodoros = null) => dispatch(createTask({ title, estimatedPomodoros })),
    [dispatch]
  );

  /**
   * Rename and re-estimate — ONE operation (CONTRACT.md §14.5), so one call and one request.
   *
   * The caller passes only what changed; an empty patch is its own bug and the row never sends one.
   * `status` does not belong here — it has its own verb below, because the four status transitions
   * are user intents with their own rules, not a field to be patched in passing.
   *
   * @param {string} id
   * @param {{title?: string, estimatedPomodoros?: number|null}} patch
   */
  const editTask = useCallback((id, patch) => dispatch(updateTask({ id, patch })), [dispatch]);

  const setTaskStatus = useCallback(
    (id, taskStatus) => dispatch(updateTask({ id, patch: { status: taskStatus } })),
    [dispatch]
  );

  const removeTask = useCallback((id) => dispatch(deleteTask({ id })), [dispatch]);

  const dismissTaskError = useCallback(() => dispatch(taskErrorCleared()), [dispatch]);

  const acknowledgeStreakFreeze = useCallback(
    () => dispatch(streakFreezeAcknowledged()),
    [dispatch]
  );

  /**
   * Adopt a finalized record and deliver it.
   *
   * The local adoption is dispatched synchronously and unconditionally: the block happened, so the
   * record exists whatever the network says. Delivery follows, and the returned action tells the
   * caller whether the server has scored it yet.
   */
  const finalize = useCallback(
    (record) => {
      dispatch(sessionFinalized(record));
      return dispatch(recordSession(record));
    },
    [dispatch]
  );

  const retrySync = useCallback(() => dispatch(flushOutbox()), [dispatch]);
  const reload = useCallback(() => dispatch(hydrateTimer()), [dispatch]);

  return useMemo(
    () => ({
      backlog,
      resolvedTasks,
      sessions,
      gamification,
      status,
      error,
      taskError,
      pendingSync,
      rejectedSessions,
      hydrationFailures,
      backlogHydration,
      sessionsTruncated,
      streakFreeze,
      addTask,
      editTask,
      setTaskStatus,
      removeTask,
      dismissTaskError,
      acknowledgeStreakFreeze,
      finalize,
      retrySync,
      reload,
    }),
    [
      backlog,
      resolvedTasks,
      sessions,
      gamification,
      status,
      error,
      taskError,
      pendingSync,
      rejectedSessions,
      hydrationFailures,
      backlogHydration,
      sessionsTruncated,
      streakFreeze,
      addTask,
      editTask,
      setTaskStatus,
      removeTask,
      dismissTaskError,
      acknowledgeStreakFreeze,
      finalize,
      retrySync,
      reload,
    ]
  );
}
