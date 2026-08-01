import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Notification from '../components/Notification.jsx';
import TimerEngineTile from '../components/timer/TimerEngineTile.jsx';
import PointsTile from '../components/timer/PointsTile.jsx';
import TasksTile from '../components/timer/TasksTile.jsx';
import HistoryTile from '../components/timer/HistoryTile.jsx';
import AddTask from '../components/timer/AddTask.jsx';
import TerminateReason from '../components/timer/TerminateReason.jsx';
import SessionRecovery from '../components/timer/SessionRecovery.jsx';
import usePomodoroTimer from '../hooks/usePomodoroTimer.js';
import useSettings from '../hooks/useSettings.js';
import useTimer from '../hooks/useTimer.js';
import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession,
  subscribeToActiveSession,
} from '../services/storage.js';
import { POINTS, TITLES } from '../services/gamification.js';
import { announceIntervalEnd, requestNotificationPermission } from '../services/alerts.js';
import { isProvisional } from '../store/timerSlice.js';
import '../styles/TimerPage.css';

/*
 * TimerPage — the app's main view, and the boundary between the two halves of this feature.
 *
 * THE PAGE OWNS REAL-TIME EXECUTION. Start, pause, resume, restart, skip, the countdown and every
 * piece of UI state live here and in usePomodoroTimer, never on the server. The API has no concept
 * of a block in progress — start/stop endpoints were rejected deliberately, because they would need
 * a live connection for 25 minutes and a reaper for the sessions that never came back.
 *
 * THE SERVER OWNS EVERYTHING THAT OUTLIVES THE BLOCK. Tasks, finished records and the points they
 * earn all go through useTimer, and the client computes none of them.
 *
 * The seam between the two is FINALIZATION (§19.1): every exit path — completion, termination,
 * break end, skip, reload recovery, another tab taking over — fills in a complete record locally
 * and hands it over. The record is real the moment the block ends, whatever the network is doing,
 * which is what lets History treat a missing record as proof the block never happened.
 *
 * The only thing still written to localStorage is the in-flight DRAFT, because the server cannot
 * hold it: without it, a reload loses 25 minutes of someone's work.
 */

const DAILY_GOAL = 4;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function timeOf(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isToday(iso) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function TimerPage() {
  /*
   * Durations come from the account's Settings and are read LIVE. The hook snapshots them at
   * start(), so a change mid-block cannot retarget the running block, while an idle clock still
   * reflects the saved value immediately (defect F1).
   */
  const { settings } = useSettings();
  const { workMinutes, breakMinutes, labels: customLabels } = settings;

  const {
    backlog,
    resolvedTasks,
    sessions,
    gamification,
    status,
    pendingSync,
    addTask,
    renameTask,
    setTaskStatus,
    removeTask,
    finalize,
    retrySync,
    reload,
  } = useTimer();

  /*
   * Recovery is decided ONCE, before the first render (§19.2), so a recovered block is on screen in
   * the first paint rather than appearing a beat later:
   *   still running  → resume silently; nothing was lost, so nothing is asked
   *   paused         → restore paused, with its focused time intact
   *   finished, <7d  → prompt; both answers produce a record
   *   finished, ≥7d  → drop; the server could never accept it anyway
   */
  const [recovery] = useState(() => {
    const draft = getActiveSession();
    if (!draft) return { resume: null, prompt: null };
    if (draft.pausedAt) return { resume: draft, prompt: null };
    if (Date.now() < timeOf(draft.endTime)) return { resume: draft, prompt: null };
    // A break that ran out unattended has nothing to record: no points, no task outcome, and every
    // aggregate filters it out anyway (E12).
    if (draft.type === 'break') return { resume: null, prompt: null };
    if (Date.now() - timeOf(draft.startedAt) >= SEVEN_DAYS_MS) return { resume: null, prompt: null };
    return { resume: null, prompt: draft };
  });

  const [activeTaskId, setActiveTaskId] = useState(recovery.resume?.taskId ?? null);
  const [lastDelta, setLastDelta] = useState(0);
  const [notification, setNotification] = useState(null);
  // The identity of the in-flight interval: minted at start, carried into the break, and the
  // primary key of the record it will become.
  const [activeSession, setActiveSession] = useState(() =>
    recovery.resume
      ? {
          clientSessionId: recovery.resume.clientSessionId,
          taskId: recovery.resume.taskId ?? null,
          taskTitle: recovery.resume.taskTitle ?? 'Focus session',
          type: recovery.resume.type ?? 'focus',
        }
      : null
  );
  const [recoveryDraft, setRecoveryDraft] = useState(recovery.prompt);
  const [terminatePrompt, setTerminatePrompt] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeTask = useMemo(
    () => backlog.find((task) => task.id === activeTaskId) ?? null,
    [backlog, activeTaskId]
  );

  const todaySessions = useMemo(
    () => sessions.filter((session) => isToday(session.endedAt)),
    [sessions]
  );
  const completedCount = useMemo(
    () => todaySessions.filter((session) => session.status === 'completed').length,
    [todaySessions]
  );
  const terminatedCount = useMemo(
    () => todaySessions.filter((session) => session.status === 'terminated').length,
    [todaySessions]
  );

  /**
   * Build a complete §14.1 record. `pointsAwarded` is deliberately null — only the server may say
   * what a session was worth, and the UI renders "—" until it does. Zero would be a claim.
   */
  const buildRecord = useCallback(
    (identity, detail, { status: recordStatus, reason = null }) => ({
      clientSessionId: identity.clientSessionId,
      id: null,
      taskId: isProvisional(identity.taskId) ? null : identity.taskId,
      taskTitle: identity.taskTitle,
      type: identity.type,
      status: recordStatus,
      startedAt: detail.startedAt,
      endedAt: detail.endedAt,
      plannedDurationMs: detail.plannedDurationMs,
      actualDurationMs: detail.actualDurationMs,
      terminationReason: reason,
      pointsAwarded: null,
      syncState: 'pending',
    }),
    []
  );

  /** Hand a record over, then report what the server made of it. */
  const deliver = useCallback(
    async (record, { announce = true } = {}) => {
      const action = await finalize(record);
      const result = action?.payload;

      if (!result?.gamification) {
        // Queued, not lost. The outbox will retry, and History shows it as pending meanwhile.
        if (announce) {
          setNotification({
            type: 'warning',
            message: 'Saved on this device — we will sync it when you are back online.',
          });
        }
        return null;
      }

      setLastDelta(result.gamification.pointsDelta ?? 0);
      return result.gamification;
    },
    [finalize]
  );

  const timer = usePomodoroTimer({
    workMinutes,
    breakMinutes,
    onComplete: handleComplete,
    initialDraft: recovery.resume,
  });

  // Fired by the hook when an interval reaches 0.
  function handleComplete(finishedPhase, detail) {
    const identity = activeSession;
    if (!identity) return;

    if (finishedPhase === 'break') {
      void deliver(buildRecord(identity, detail, { status: 'completed' }), { announce: false });
      setActiveSession(null);
      announceIntervalEnd('break', 'Break over — ready for the next block.');
      setNotification({ type: 'success', message: 'Break over. Ready when you are.' });
      return;
    }

    const record = buildRecord(identity, detail, { status: 'completed' });

    // The hook auto-starts the break; it is a new interval, so it gets its own identity and
    // becomes its own record.
    setActiveSession({
      clientSessionId: makeId(),
      taskId: identity.taskId,
      taskTitle: identity.taskTitle,
      type: 'break',
    });

    announceIntervalEnd('work', 'Focus block complete.');
    setNotification({ type: 'success', message: 'Session complete! Break time.' });

    void deliver(record).then((totals) => {
      if (!totals) return;
      const names = (totals.newlyUnlocked ?? [])
        .map((key) => TITLES.find((title) => title.key === key)?.name)
        .filter(Boolean)
        .join(', ');

      setNotification({
        type: 'success',
        message: names
          ? `New title unlocked — ${names}! +${totals.pointsDelta} points and a new feature to explore.`
          : `Session complete! +${totals.pointsDelta} points. Break time.`,
      });
    });
  }

  /*
   * Persist the draft on every timing change, so a reload can offer the block back instead of
   * voiding it. `runId` covers Restart, which changes neither phase nor status and would otherwise
   * leave a stale draft behind.
   */
  const { runId, isIdle, isPaused, getTimings } = timer;

  useEffect(() => {
    if (!activeSession || isIdle) {
      clearActiveSession();
      return;
    }
    const t = getTimings();
    saveActiveSession({
      ...activeSession,
      startedAt: new Date(t.startedAt ?? Date.now()).toISOString(),
      plannedDurationMs: t.plannedDurationMs,
      endTime: t.endTime ? new Date(t.endTime).toISOString() : null,
      accumulatedMs: t.accumulatedMs,
      pausedAt: isPaused ? new Date().toISOString() : null,
    });
  }, [activeSession, runId, isIdle, isPaused, getTimings]);

  /*
   * Retry queued records on mount and whenever the browser reports it is back online. Delivery is
   * the only part of this feature that retries, because a finished block is the only thing it holds
   * that the user cannot simply redo.
   */
  useEffect(() => {
    retrySync();
    window.addEventListener('online', retrySync);
    return () => window.removeEventListener('online', retrySync);
  }, [retrySync]);

  const resolveRecovery = useCallback(
    (kept) => {
      const draft = recoveryDraft;
      if (!draft) return;

      const identity = {
        clientSessionId: draft.clientSessionId,
        taskId: draft.taskId ?? null,
        taskTitle: draft.taskTitle ?? 'Focus session',
        type: 'focus',
      };
      const endedAt = new Date(timeOf(draft.endTime)).toISOString();
      const detail = {
        startedAt: draft.startedAt,
        endedAt,
        plannedDurationMs: draft.plannedDurationMs,
        actualDurationMs: kept
          ? draft.plannedDurationMs
          : // Only the time we can actually vouch for.
            (Number.isFinite(draft.accumulatedMs) ? draft.accumulatedMs : 0),
      };

      void deliver(
        buildRecord(
          identity,
          detail,
          kept ? { status: 'completed' } : { status: 'terminated', reason: 'interrupted' }
        )
      );

      setNotification(
        kept
          ? { type: 'success', message: 'Block recorded.' }
          : { type: 'warning', message: 'Block recorded as interrupted. No penalty.' }
      );

      clearActiveSession();
      setRecoveryDraft(null);
    },
    [recoveryDraft, buildRecord, deliver]
  );

  /*
   * Two tabs, one account, both running (edge case E7). The draft key is single, so whichever tab
   * wrote last owns the block and this one stands down — finalizing rather than vanishing, because
   * every path produces a record.
   */
  const handleTakeover = useCallback(
    (next) => {
      if (!activeSession || timer.isIdle) return;
      // Our own write echoing back through another document is not a takeover.
      if (next && next.clientSessionId === activeSession.clientSessionId) return;

      const detail = timer.terminate('interrupted');
      if (detail) {
        const isFocus = activeSession.type === 'focus';
        void deliver(
          buildRecord(
            activeSession,
            detail,
            isFocus ? { status: 'terminated', reason: 'interrupted' } : { status: 'completed' }
          ),
          { announce: false }
        );
      }
      setActiveSession(null);
      setNotification({
        type: 'warning',
        message: 'This block continued in another tab, so it was closed here.',
      });
    },
    [activeSession, timer, buildRecord, deliver]
  );

  useEffect(() => subscribeToActiveSession(handleTakeover), [handleTakeover]);

  function handleStart() {
    if (!activeTaskId || !activeTask || isProvisional(activeTaskId)) return;
    // Asked on a gesture, never on mount — an unprompted permission dialog on page load is the
    // pattern browsers now penalise.
    requestNotificationPermission();
    setActiveSession({
      clientSessionId: makeId(),
      taskId: activeTaskId,
      taskTitle: activeTask.title,
      type: 'focus',
    });
    timer.start();
  }

  /*
   * Ending a BREAK needs no reason — there is nothing to explain about not resting — so the same
   * control skips it outright. Ending a FOCUS block asks, because the reason is the only thing the
   * product gets in exchange for charging nothing.
   */
  const handleSkipBreak = useCallback(() => {
    // skipBreak fires onComplete('break'), which records the interval and clears the identity.
    timer.skipBreak();
  }, [timer]);

  function handleTerminateRequest() {
    if (timer.phase === 'break') {
      handleSkipBreak();
      return;
    }
    setTerminatePrompt(true);
  }

  const handleTerminateConfirmed = useCallback(
    (reason) => {
      setTerminatePrompt(false);
      const identity = activeSession;
      const detail = timer.terminate(reason);
      if (!identity || !detail) return;

      void deliver(buildRecord(identity, detail, { status: 'terminated', reason }), {
        announce: false,
      });
      setActiveSession(null);
      setLastDelta(0);
      setNotification({
        type: 'warning',
        message: 'Block ended and recorded. No points lost — your day streak is safe.',
      });
    },
    [activeSession, timer, buildRecord, deliver]
  );

  function handleFocusTask(id) {
    if (!timer.isIdle || isProvisional(id)) return;
    setActiveTaskId(id);
  }

  const handleSetTaskStatus = useCallback(
    (id, nextStatus) => {
      void setTaskStatus(id, nextStatus);
      if (id === activeTaskId && nextStatus !== 'todo') setActiveTaskId(null);
    },
    [setTaskStatus, activeTaskId]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    void removeTask(deleteTarget.id);
    if (deleteTarget.id === activeTaskId) setActiveTaskId(null);
    setDeleteTarget(null);
  }, [deleteTarget, removeTask, activeTaskId]);

  /*
   * The confirmation names what is actually lost, and the client already knows the number — it
   * holds the session window in the store, so this costs no request and needs no endpoint.
   */
  const affectedSessions = useMemo(
    () => (deleteTarget ? sessions.filter((s) => s.taskId === deleteTarget.id).length : 0),
    [deleteTarget, sessions]
  );

  // A block in progress pins its task: it may be renamed, but not abandoned or deleted out from
  // under itself.
  const canMutateActive = timer.isIdle;

  return (
    <AppLayout>
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      {recoveryDraft && (
        <SessionRecovery
          draft={recoveryDraft}
          onKeep={() => resolveRecovery(true)}
          onDiscard={() => resolveRecovery(false)}
        />
      )}

      {terminatePrompt && (
        <TerminateReason
          taskTitle={activeSession?.taskTitle}
          onSelect={handleTerminateConfirmed}
          onCancel={() => setTerminatePrompt(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.title}”?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        >
          {affectedSessions > 0 ? (
            <p>
              {affectedSessions} recorded {affectedSessions === 1 ? 'session' : 'sessions'} will keep
              this name in your history, but will no longer be linked to a task. The points you
              earned are unaffected.
            </p>
          ) : (
            <p>This task has no recorded sessions. Deleting it cannot be undone.</p>
          )}
        </ConfirmDialog>
      )}

      <div className="timer-page">
        <header className="timer-page__head">
          <h1 className="timer-page__title">Focus Dashboard</h1>
          <p className="timer-page__subtitle">
            Add today’s tasks, run a Pomodoro, and watch your momentum build.
          </p>
        </header>

        {pendingSync > 0 && (
          <p className="timer-page__sync" role="status">
            {pendingSync} {pendingSync === 1 ? 'session is' : 'sessions are'} waiting to sync.{' '}
            <button type="button" className="tasks-tile__inline-btn" onClick={retrySync}>
              Retry now
            </button>
          </p>
        )}

        <div className="timer-dashboard">
          <TimerEngineTile
            phase={timer.phase}
            isIdle={timer.isIdle}
            isRunning={timer.isRunning}
            isPaused={timer.isPaused}
            remainingMs={timer.remainingMs}
            totalMs={timer.totalMs}
            canStart={Boolean(activeTaskId) && !isProvisional(activeTaskId)}
            hasBacklog={backlog.length > 0}
            /*
             * The running block's own snapshot wins over the backlog row. It is the title the
             * record will carry, it is what the user was actually focusing on, and it is the only
             * one available at all after a reload — the draft survives, the backlog is refetched.
             */
            activeTaskTitle={activeSession?.taskTitle ?? activeTask?.title ?? ''}
            labels={customLabels}
            onStart={handleStart}
            onPause={timer.pause}
            onResume={timer.resume}
            onRestart={timer.restart}
            onTerminate={handleTerminateRequest}
            onSkipBreak={handleSkipBreak}
          />

          <PointsTile
            lifetimePoints={gamification.lifetimePoints}
            dayStreak={gamification.currentDayStreak}
            sessionRun={gamification.currentSessionRun}
            completedCount={completedCount}
            terminatedCount={terminatedCount}
            lastDelta={lastDelta}
            dailyGoal={DAILY_GOAL}
            bonusEvery={POINTS.consecutiveThreshold}
          />

          <TasksTile
            backlog={backlog}
            resolvedTasks={resolvedTasks}
            activeTaskId={activeTaskId}
            canChangeTask={timer.isIdle}
            canMutate={canMutateActive}
            loading={status === 'loading'}
            failed={status === 'error'}
            onRetry={reload}
            onFocusTask={handleFocusTask}
            onRenameTask={renameTask}
            onSetTaskStatus={handleSetTaskStatus}
            onDeleteTask={setDeleteTarget}
          >
            <AddTask onAdd={addTask} />
          </TasksTile>

          <HistoryTile entries={todaySessions} />
        </div>
      </div>
    </AppLayout>
  );
}

export default TimerPage;
