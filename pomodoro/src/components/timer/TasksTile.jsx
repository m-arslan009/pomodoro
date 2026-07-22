/*
 * TasksTile — bottom-left tile: today's active backlog.
 *
 * Lists only tasks still to do (status 'todo'); tasks whose session is completed
 * or terminated leave this list but are kept (with their outcome) in the task
 * record. Each row has two quick actions: "Focus" binds the task as the active
 * one for the next session (Start stays disabled until something is active), and
 * a complete toggle marks it done. Selecting the active task is disabled while a
 * session runs so the running block can't be re-pointed mid-flight.
 *
 * The add-task form is provided by TimerPage as `children` and rendered in the
 * footer so a user can add as many tasks as they like at any time. When the day
 * starts with no tasks at all, the empty state prompts the user to add some.
 */

function TasksTile({
  tasks,
  activeTaskId,
  canChangeTask,
  handledToday,
  onFocusTask,
  onCompleteTask,
  children,
}) {
  const backlog = tasks.filter((task) => task.status === 'todo');

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
            {backlog.map((task) => {
              const isActive = task.id === activeTaskId;
              return (
                <li
                  key={task.id}
                  className={`tasks-tile__item${isActive ? ' tasks-tile__item--active' : ''}`}
                >
                  <span className="tasks-tile__name">{task.title}</span>
                  <span className="tasks-tile__actions">
                    <button
                      type="button"
                      className="tasks-tile__action"
                      onClick={() => onFocusTask(task.id)}
                      disabled={!canChangeTask || isActive}
                      aria-pressed={isActive}
                    >
                      {isActive ? 'Active' : 'Focus'}
                    </button>
                    <button
                      type="button"
                      className="tasks-tile__action tasks-tile__action--check"
                      onClick={() => onCompleteTask(task.id)}
                      aria-label={`Mark “${task.title}” done`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : handledToday ? (
          <p className="tasks-tile__empty">
            Every task for today is handled. Add another below to keep going. 🌿
          </p>
        ) : (
          <p className="tasks-tile__empty">
            No tasks yet for today. Add your first one below to start focusing.
          </p>
        )}
      </div>

      <div className="tasks-tile__form">{children}</div>
    </section>
  );
}

export default TasksTile;
