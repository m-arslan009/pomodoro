import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import Notification from '../components/Notification.jsx';
import TimerEngineTile from '../components/timer/TimerEngineTile.jsx';
import PointsTile from '../components/timer/PointsTile.jsx';
import TasksTile from '../components/timer/TasksTile.jsx';
import HistoryTile from '../components/timer/HistoryTile.jsx';
import AddTask from '../components/timer/AddTask.jsx';
import usePomodoroTimer from '../hooks/usePomodoroTimer.js';
import {
  getTasks,
  saveTasks,
  getSessions,
  saveSessions,
  getGamification,
  saveGamification,
  getSettings,
} from '../services/storage.js';
import {
  POINTS,
  TITLES,
  titlesFor,
  applyCompletion,
  applyTermination,
} from '../services/gamification.js';
import '../styles/TimerPage.css';

/*
 * TimerPage — the app's main view, laid out as a 2×2 glassmorphic dashboard, and
 * the single source of truth for its state (timer, tasks, gamification, history).
 * A change in the timer tile updates the points tile and appends to the history
 * tile in the same render — that is the real-time sync.
 *
 * PERSISTENCE: tasks, sessions, and gamification totals are all persisted via
 * services/storage.js, so nothing is lost on refresh. Two retention rules keep
 * the dashboard focused on the present while preserving data for the (future)
 * Stats page:
 *   - Task expiry: a to-do left unstarted for 24h is marked 'expired' and drops
 *     off Today's Focus, so a returning user starts each day clean.
 *   - 7-day window: task and session records older than 7 days are pruned; the
 *     dashboard itself only ever shows *today's* tasks and log.
 *
 * GAMIFICATION: the points economy and title ladder live in
 * services/gamification.js (single source of truth). This page holds the running
 * state and delegates every scoring decision to that service's pure functions:
 *   - applyCompletion — advances streak, awards points + the every-3rd bonus, and
 *     reports any title thresholds crossed by this session.
 *   - applyTermination — floors the spendable balance after the penalty and resets
 *     the streak, while LIFETIME points (which drive titles) are left untouched so
 *     an earned title never regresses.
 */

const DAILY_GOAL = 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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

// Drop task records older than 7 days, then expire any to-do left unstarted for
// 24h so it leaves Today's Focus.
function reconcileTasks(tasks, now = Date.now()) {
  return tasks
    .filter((task) => now - timeOf(task.createdAt) < WEEK_MS)
    .map((task) => {
      if (task.status === 'todo' && now - timeOf(task.createdAt) >= DAY_MS) {
        return { ...task, status: 'expired', endedAt: new Date(now).toISOString() };
      }
      return task;
    });
}

// Keep only the last 7 days of session history.
function pruneSessions(sessions, now = Date.now()) {
  return sessions.filter((session) => now - timeOf(session.endedAt) < WEEK_MS);
}

function TimerPage() {
  // Focus/break lengths come from the user's saved Settings, read once on mount;
  // navigating back from Settings remounts this page so a change takes effect on
  // the next session without disrupting one already running.
  const [{ workMinutes, breakMinutes, customLabels }] = useState(() => getSettings());

  // Hydrate from storage, applying retention rules once on mount.
  const [tasks, setTasks] = useState(() => reconcileTasks(getTasks()));
  const [sessions, setSessions] = useState(() => pruneSessions(getSessions()));
  // Gamification state mirrors the shape services/gamification.js consumes and
  // returns: a spendable `balance` (penalty-affected) split from `lifetimePoints`
  // (monotonic, drives titles), plus the running streak and unlocked titles.
  const [gamification, setGamification] = useState(() => {
    const g = getGamification();
    return {
      lifetimePoints: g.lifetimePoints,
      balance: g.balance,
      currentStreak: g.currentStreak,
      unlockedTitles: titlesFor(g.lifetimePoints),
    };
  });

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [lastDelta, setLastDelta] = useState(0);
  const [notification, setNotification] = useState(null);

  // Persist every record set so refreshes never lose information. The saved
  // gamification object is the canonical balance/lifetime split; storage.js
  // additionally guards lifetimePoints as monotonic.
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);
  useEffect(() => {
    saveGamification({
      balance: gamification.balance,
      currentStreak: gamification.currentStreak,
      lifetimePoints: gamification.lifetimePoints,
      unlockedTitles: gamification.unlockedTitles,
    });
  }, [gamification]);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );
  const hasBacklog = useMemo(() => tasks.some((task) => task.status === 'todo'), [tasks]);
  // Whether the user has already resolved a task today (session or manual), so
  // the empty backlog can read as "all handled" rather than "add your first".
  const handledToday = useMemo(
    () => tasks.some((task) => task.status !== 'todo' && task.endedAt && isToday(task.endedAt)),
    [tasks]
  );

  // The dashboard only ever surfaces *today's* records; the rest stays archived
  // in storage for stats.
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

  // Fired by the timer hook when a phase reaches 0. Work completions score,
  // record the task as completed, and append history; break completions just
  // quietly return to idle.
  const handleComplete = useCallback(
    (finishedPhase) => {
      if (finishedPhase !== 'work') return;

      const taskTitle = activeTask?.title ?? 'Focus session';
      const { state, delta, bonus, unlocked } = applyCompletion(gamification);

      setGamification(state);
      setLastDelta(delta);

      if (activeTaskId) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === activeTaskId
              ? { ...task, status: 'completed', endedAt: new Date().toISOString() }
              : task
          )
        );
        setActiveTaskId(null);
      }

      setSessions((prev) => [
        {
          id: makeId(),
          taskTitle,
          durationMs: workMinutes * 60 * 1000,
          endedAt: new Date().toISOString(),
          status: 'completed',
        },
        ...prev,
      ]);

      // A crossed title is the headline; otherwise report points (+ any bonus).
      if (unlocked.length > 0) {
        const names = unlocked
          .map((key) => TITLES.find((title) => title.key === key)?.name)
          .filter(Boolean)
          .join(', ');
        setNotification({
          type: 'success',
          message: `New title unlocked — ${names}! +${delta} points and a new feature to explore.`,
        });
      } else {
        setNotification({
          type: 'success',
          message: bonus
            ? `Session complete! +${POINTS.sessionComplete} points and a +${bonus} streak bonus.`
            : `Session complete! +${POINTS.sessionComplete} points. Break time.`,
        });
      }
    },
    [activeTask, activeTaskId, gamification, workMinutes]
  );

  const timer = usePomodoroTimer({
    workMinutes,
    breakMinutes,
    onComplete: handleComplete,
  });

  function handleAddTask(title) {
    setTasks((prev) => [
      ...prev,
      { id: makeId(), title, status: 'todo', createdAt: new Date().toISOString() },
    ]);
  }

  function handleStart() {
    if (!activeTaskId) return;
    timer.start();
  }

  function handleTerminate() {
    // Only a focus block is penalized/logged; abandoning a break just ends it.
    if (timer.phase === 'work') {
      const taskTitle = activeTask?.title ?? 'Focus session';
      const elapsedMs = Math.max(0, timer.totalMs - timer.remainingMs);
      const { state, delta } = applyTermination(gamification);

      setGamification(state);
      setLastDelta(delta);

      if (activeTaskId) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === activeTaskId
              ? { ...task, status: 'terminated', endedAt: new Date().toISOString() }
              : task
          )
        );
        setActiveTaskId(null);
      }

      setSessions((prev) => [
        {
          id: makeId(),
          taskTitle,
          durationMs: elapsedMs,
          endedAt: new Date().toISOString(),
          status: 'terminated',
        },
        ...prev,
      ]);

      setNotification({
        type: 'warning',
        message: `Session terminated. −${POINTS.terminatePenalty} points and your streak reset.`,
      });
    }

    timer.terminate();
  }

  function handleFocusTask(id) {
    if (!timer.isIdle) return;
    setActiveTaskId(id);
  }

  function handleCompleteTask(id) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, status: 'completed', endedAt: new Date().toISOString() } : task
      )
    );
    if (id === activeTaskId) setActiveTaskId(null);
  }

  return (
    <AppLayout>
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      <div className="timer-page">
        <header className="timer-page__head">
          <h1 className="timer-page__title">Focus Dashboard</h1>
          <p className="timer-page__subtitle">
            Add today’s tasks, run a Pomodoro, and watch your momentum build.
          </p>
        </header>

        <div className="timer-dashboard">
          <TimerEngineTile
            phase={timer.phase}
            isIdle={timer.isIdle}
            isRunning={timer.isRunning}
            isPaused={timer.isPaused}
            remainingMs={timer.remainingMs}
            totalMs={timer.totalMs}
            canStart={Boolean(activeTaskId)}
            hasBacklog={hasBacklog}
            activeTaskTitle={activeTask?.title ?? ''}
            labels={customLabels}
            onStart={handleStart}
            onPause={timer.pause}
            onResume={timer.resume}
            onRestart={timer.restart}
            onTerminate={handleTerminate}
          />

          <PointsTile
            points={gamification.balance}
            lifetimePoints={gamification.lifetimePoints}
            streak={gamification.currentStreak}
            completedCount={completedCount}
            terminatedCount={terminatedCount}
            lastDelta={lastDelta}
            dailyGoal={DAILY_GOAL}
            bonusEvery={POINTS.consecutiveThreshold}
          />

          <TasksTile
            tasks={tasks}
            activeTaskId={activeTaskId}
            canChangeTask={timer.isIdle}
            handledToday={handledToday}
            onFocusTask={handleFocusTask}
            onCompleteTask={handleCompleteTask}
          >
            <AddTask onAdd={handleAddTask} />
          </TasksTile>

          <HistoryTile entries={todaySessions} />
        </div>
      </div>
    </AppLayout>
  );
}

export default TimerPage;
