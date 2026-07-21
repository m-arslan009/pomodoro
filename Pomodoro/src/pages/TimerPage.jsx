import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/AppLayout.jsx'
import Notification from '../components/Notification.jsx'
import TimerEngineTile from '../components/timer/TimerEngineTile.jsx'
import PointsTile from '../components/timer/PointsTile.jsx'
import TasksTile from '../components/timer/TasksTile.jsx'
import HistoryTile from '../components/timer/HistoryTile.jsx'
import AddTask from '../components/timer/AddTask.jsx'
import usePomodoroTimer from '../hooks/usePomodoroTimer.js'
import {
  getTasks,
  saveTasks,
  getSessions,
  saveSessions,
  getGamification,
  saveGamification,
} from '../services/storage.js'
import '../styles/TimerPage.css'

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
 * The point/streak rules mirror idea.md and are flagged to migrate into
 * services/gamification.js later.
 */

// Mirrors idea.md's economy; migrate to services/gamification.js when persisted.
const POINTS = {
  complete: 100,
  bonus: 50,
  bonusEvery: 3, // +50 on every 3rd consecutive completion
  terminatePenalty: 200,
}

const WORK_MINUTES = 25
const BREAK_MINUTES = 5
const DAILY_GOAL = 4

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function timeOf(iso) {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function isToday(iso) {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// Drop task records older than 7 days, then expire any to-do left unstarted for
// 24h so it leaves Today's Focus.
function reconcileTasks(tasks, now = Date.now()) {
  return tasks
    .filter((task) => now - timeOf(task.createdAt) < WEEK_MS)
    .map((task) => {
      if (task.status === 'todo' && now - timeOf(task.createdAt) >= DAY_MS) {
        return { ...task, status: 'expired', endedAt: new Date(now).toISOString() }
      }
      return task
    })
}

// Keep only the last 7 days of session history.
function pruneSessions(sessions, now = Date.now()) {
  return sessions.filter((session) => now - timeOf(session.endedAt) < WEEK_MS)
}

function TimerPage() {
  // Hydrate from storage, applying retention rules once on mount.
  const [tasks, setTasks] = useState(() => reconcileTasks(getTasks()))
  const [sessions, setSessions] = useState(() => pruneSessions(getSessions()))
  const [points, setPoints] = useState(() => getGamification().points)
  const [streak, setStreak] = useState(() => getGamification().streak)

  const [activeTaskId, setActiveTaskId] = useState(null)
  const [lastDelta, setLastDelta] = useState(0)
  const [notification, setNotification] = useState(null)

  // Persist every record set so refreshes never lose information.
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])
  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])
  useEffect(() => {
    saveGamification({ points, streak })
  }, [points, streak])

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId],
  )
  const hasBacklog = useMemo(() => tasks.some((task) => task.status === 'todo'), [tasks])
  // Whether the user has already resolved a task today (session or manual), so
  // the empty backlog can read as "all handled" rather than "add your first".
  const handledToday = useMemo(
    () => tasks.some((task) => task.status !== 'todo' && task.endedAt && isToday(task.endedAt)),
    [tasks],
  )

  // The dashboard only ever surfaces *today's* records; the rest stays archived
  // in storage for stats.
  const todaySessions = useMemo(
    () => sessions.filter((session) => isToday(session.endedAt)),
    [sessions],
  )
  const completedCount = useMemo(
    () => todaySessions.filter((session) => session.status === 'completed').length,
    [todaySessions],
  )
  const terminatedCount = useMemo(
    () => todaySessions.filter((session) => session.status === 'terminated').length,
    [todaySessions],
  )

  // Fired by the timer hook when a phase reaches 0. Work completions score,
  // record the task as completed, and append history; break completions just
  // quietly return to idle.
  const handleComplete = useCallback(
    (finishedPhase) => {
      if (finishedPhase !== 'work') return

      const taskTitle = activeTask?.title ?? 'Focus session'
      const nextStreak = streak + 1
      const bonus = nextStreak % POINTS.bonusEvery === 0 ? POINTS.bonus : 0
      const delta = POINTS.complete + bonus

      setStreak(nextStreak)
      setPoints((prev) => prev + delta)
      setLastDelta(delta)

      if (activeTaskId) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === activeTaskId
              ? { ...task, status: 'completed', endedAt: new Date().toISOString() }
              : task,
          ),
        )
        setActiveTaskId(null)
      }

      setSessions((prev) => [
        {
          id: makeId(),
          taskTitle,
          durationMs: WORK_MINUTES * 60 * 1000,
          endedAt: new Date().toISOString(),
          status: 'completed',
        },
        ...prev,
      ])

      setNotification({
        type: 'success',
        message: bonus
          ? `Session complete! +${POINTS.complete} points and a +${bonus} streak bonus.`
          : `Session complete! +${POINTS.complete} points. Break time.`,
      })
    },
    [activeTask, activeTaskId, streak],
  )

  const timer = usePomodoroTimer({
    workMinutes: WORK_MINUTES,
    breakMinutes: BREAK_MINUTES,
    onComplete: handleComplete,
  })

  function handleAddTask(title) {
    setTasks((prev) => [
      ...prev,
      { id: makeId(), title, status: 'todo', createdAt: new Date().toISOString() },
    ])
  }

  function handleStart() {
    if (!activeTaskId) return
    timer.start()
  }

  function handleTerminate() {
    // Only a focus block is penalized/logged; abandoning a break just ends it.
    if (timer.phase === 'work') {
      const taskTitle = activeTask?.title ?? 'Focus session'
      const elapsedMs = Math.max(0, timer.totalMs - timer.remainingMs)

      setPoints((prev) => Math.max(0, prev - POINTS.terminatePenalty))
      setStreak(0)
      setLastDelta(-POINTS.terminatePenalty)

      if (activeTaskId) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === activeTaskId
              ? { ...task, status: 'terminated', endedAt: new Date().toISOString() }
              : task,
          ),
        )
        setActiveTaskId(null)
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
      ])

      setNotification({
        type: 'warning',
        message: `Session terminated. −${POINTS.terminatePenalty} points and your streak reset.`,
      })
    }

    timer.terminate()
  }

  function handleFocusTask(id) {
    if (!timer.isIdle) return
    setActiveTaskId(id)
  }

  function handleCompleteTask(id) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, status: 'completed', endedAt: new Date().toISOString() }
          : task,
      ),
    )
    if (id === activeTaskId) setActiveTaskId(null)
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
            onStart={handleStart}
            onPause={timer.pause}
            onResume={timer.resume}
            onRestart={timer.restart}
            onTerminate={handleTerminate}
          />

          <PointsTile
            points={points}
            streak={streak}
            completedCount={completedCount}
            terminatedCount={terminatedCount}
            lastDelta={lastDelta}
            dailyGoal={DAILY_GOAL}
            bonusEvery={POINTS.bonusEvery}
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
  )
}

export default TimerPage
