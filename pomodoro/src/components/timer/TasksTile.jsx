import { memo, useState } from 'react';
import TaskRow from './TaskRow.jsx';

/*
 * TasksTile — bottom-left tile: the open backlog, and a way back to what is already resolved.
 *
 * A TASK LEAVES THIS LIST ONLY WHEN THE USER SAYS SO (CONTRACT.md §14.3 rules 4-6). Finishing a
 * pomodoro does not finish the task, abandoning a block does not abandon it, and nothing expires:
 * a task spans as many pomodoros as it takes. The previous build did all three, so real work that
 * outlived a day or a single block silently disappeared.
 *
 * Resolved tasks are COLLAPSED, NOT ABSENT. Reopening and deleting have to stay reachable, and a
 * completed task that cannot be found again is indistinguishable from one that was lost.
 *
 * Composition only: row behaviour lives in TaskRow. Memoised because it sits beside a countdown and
 * its own props change only when a task does (defect F6).
 */

function TasksTile({
  backlog,
  resolvedTasks,
  activeTaskId,
  canChangeTask,
  timerIdle,
  loading,
  failed,
  onRetry,
  onFocusTask,
  onRenameTask,
  onSetTaskStatus,
  onDeleteTask,
  children,
}) {
  const [showResolved, setShowResolved] = useState(false);

  // `timerIdle` is a fact about the timer, not a per-row permission: each row decides for itself
  // what it means, and only the active one is pinned by a running block.
  const rowProps = {
    canChangeTask,
    timerIdle,
    onFocus: onFocusTask,
    onRename: onRenameTask,
    onSetStatus: onSetTaskStatus,
    onDelete: onDeleteTask,
  };

  return (
    <section className="timer-tile tasks-tile" aria-labelledby="tasks-heading">
      <header className="timer-tile__head">
        <h2 id="tasks-heading" className="timer-tile__title">
          Today’s Focus
        </h2>
        <span className="tasks-tile__count">{backlog.length} left</span>
      </header>

      <div className="tasks-tile__body">
        {backlog.length > 0 ? (
          <ul className="tasks-tile__list">
            {backlog.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                {...rowProps}
              />
            ))}
          </ul>
        ) : loading ? (
          <p className="tasks-tile__empty">Loading your tasks…</p>
        ) : failed ? (
          /*
           * An empty backlog and a failed fetch must never look alike. Inviting someone with
           * twenty open tasks to "add your first one" is worse than showing nothing at all.
           */
          <p className="tasks-tile__empty">
            We could not load your tasks.{' '}
            <button type="button" className="tasks-tile__inline-btn" onClick={onRetry}>
              Try again
            </button>
          </p>
        ) : resolvedTasks.length > 0 ? (
          <p className="tasks-tile__empty">
            Every task is done. Add another below to keep going. 🌿
          </p>
        ) : (
          <p className="tasks-tile__empty">
            No tasks yet. Add your first one below to start focusing.
          </p>
        )}

        {resolvedTasks.length > 0 && (
          <div className="tasks-tile__resolved">
            <button
              type="button"
              className="tasks-tile__disclosure"
              aria-expanded={showResolved}
              onClick={() => setShowResolved((open) => !open)}
            >
              {showResolved ? 'Hide' : 'Show'} resolved ({resolvedTasks.length})
            </button>

            {showResolved && (
              <ul className="tasks-tile__list tasks-tile__list--resolved">
                {resolvedTasks.map((task) => (
                  <TaskRow key={task.id} task={task} isActive={false} {...rowProps} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="tasks-tile__form">{children}</div>
    </section>
  );
}

export default memo(TasksTile);
