import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createTask,
  deleteTask,
  flushOutbox,
  hydrateTimer,
  recordSession,
  sessionFinalized,
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
 *   status: 'idle'|'loading'|'ready'|'error', error: string|null, pendingSync: number,
 *   rejectedSessions: object[], hydrationFailures: {key: string, label: string, error: string}[],
 *   backlogHydration: {status: string, error: string|null}, sessionsTruncated: boolean,
 *   addTask: (title: string) => Promise<object>,
 *   renameTask: (id: string, title: string) => Promise<object>,
 *   setTaskStatus: (id: string, status: string) => Promise<object>,
 *   removeTask: (id: string) => Promise<object>,
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
  const pendingSync = useSelector(selectPendingSyncCount);
  const rejectedSessions = useSelector(selectRejectedSessions);
  const hydrationFailures = useSelector(selectHydrationFailures);
  const backlogHydration = useSelector(selectBacklogHydration);
  const sessionsTruncated = useSelector(selectSessionsTruncated);

  const addTask = useCallback((title) => dispatch(createTask({ title })), [dispatch]);

  const renameTask = useCallback(
    (id, title) => dispatch(updateTask({ id, patch: { title } })),
    [dispatch]
  );

  const setTaskStatus = useCallback(
    (id, taskStatus) => dispatch(updateTask({ id, patch: { status: taskStatus } })),
    [dispatch]
  );

  const removeTask = useCallback((id) => dispatch(deleteTask({ id })), [dispatch]);

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
      pendingSync,
      rejectedSessions,
      hydrationFailures,
      backlogHydration,
      sessionsTruncated,
      addTask,
      renameTask,
      setTaskStatus,
      removeTask,
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
      pendingSync,
      rejectedSessions,
      hydrationFailures,
      backlogHydration,
      sessionsTruncated,
      addTask,
      renameTask,
      setTaskStatus,
      removeTask,
      finalize,
      retrySync,
      reload,
    ]
  );
}
