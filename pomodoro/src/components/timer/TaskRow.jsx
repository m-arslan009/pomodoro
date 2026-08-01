import { useEffect, useRef, useState } from 'react';
import { TITLE_MAX_LENGTH } from '../../services/tasks.js';

/*
 * TaskRow — one task, in either of its two modes.
 *
 * Extracted from TasksTile because CRUD turned a twelve-line <li> into a component with its own
 * form, its own draft state and its own per-row rules. Those rules are per-row by nature, so they
 * belong to the row.
 *
 * The rules it enforces:
 *   - The ACTIVE task cannot be abandoned or deleted while its block runs. Renaming is fine — the
 *     running block took its own title snapshot when it started, so a rename cannot disturb it.
 *   - A task whose id is still provisional cannot be focused: the id would be sent with the
 *     session and rejected. One round trip, so the state is momentary.
 *   - Empty or unchanged titles are a no-op that restores the previous value, never a request.
 */

function TaskRow({
  task,
  isActive,
  canChangeTask,
  canMutate,
  onFocus,
  onRename,
  onSetStatus,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const isPending = Boolean(task.pending) || Boolean(task.removing);
  const isDone = task.status === 'completed';
  const isAbandoned = task.status === 'abandoned';

  function beginEdit() {
    setDraft(task.title);
    setEditing(true);
  }

  function commit(event) {
    event.preventDefault();
    const trimmed = draft.trim();
    setEditing(false);
    // Nothing to say to the server: an empty title is not a deletion request, and an unchanged
    // one is not a change.
    if (!trimmed || trimmed === task.title) return;
    onRename(task.id, trimmed);
  }

  function cancel() {
    setDraft(task.title);
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="tasks-tile__item tasks-tile__item--editing">
        <form className="task-edit" onSubmit={commit}>
          <label htmlFor={`task-edit-${task.id}`} className="timer-visually-hidden">
            Rename “{task.title}”
          </label>
          <input
            id={`task-edit-${task.id}`}
            ref={inputRef}
            type="text"
            className="task-edit__input"
            value={draft}
            maxLength={TITLE_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            // Escape abandons the edit. Without it the only way out of the form is to commit,
            // which makes a mistyped rename feel like a trap.
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            }}
          />
          <span className="task-edit__actions">
            <button type="submit" className="tasks-tile__action">
              Save
            </button>
            <button type="button" className="tasks-tile__action" onClick={cancel}>
              Cancel
            </button>
          </span>
        </form>
      </li>
    );
  }

  return (
    <li
      className={[
        'tasks-tile__item',
        isActive ? 'tasks-tile__item--active' : '',
        isPending ? 'tasks-tile__item--pending' : '',
        isDone || isAbandoned ? 'tasks-tile__item--resolved' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="tasks-tile__name">
        {task.title}
        {isPending && <span className="tasks-tile__saving"> saving…</span>}
        {isAbandoned && <span className="tasks-tile__tag"> abandoned</span>}
      </span>

      <span className="tasks-tile__actions">
        {task.status === 'todo' && (
          <button
            type="button"
            className="tasks-tile__action"
            onClick={() => onFocus(task.id)}
            disabled={!canChangeTask || isActive || isPending}
            aria-pressed={isActive}
          >
            {isActive ? 'Active' : 'Focus'}
          </button>
        )}

        <button
          type="button"
          className="tasks-tile__action"
          onClick={beginEdit}
          disabled={isPending}
        >
          Rename
        </button>

        {task.status === 'todo' ? (
          <>
            <button
              type="button"
              className="tasks-tile__action tasks-tile__action--check"
              onClick={() => onSetStatus(task.id, 'completed')}
              disabled={isPending}
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
            <button
              type="button"
              className="tasks-tile__action"
              onClick={() => onSetStatus(task.id, 'abandoned')}
              disabled={isPending || !canMutate}
              title={canMutate ? undefined : 'Finish or end the running block first'}
            >
              Give up
            </button>
          </>
        ) : (
          <button
            type="button"
            className="tasks-tile__action"
            onClick={() => onSetStatus(task.id, 'todo')}
            disabled={isPending}
          >
            Reopen
          </button>
        )}

        <button
          type="button"
          className="tasks-tile__action tasks-tile__action--danger"
          onClick={() => onDelete(task)}
          disabled={isPending || !canMutate}
          aria-label={`Delete “${task.title}”`}
          title={canMutate ? undefined : 'Finish or end the running block first'}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </span>
    </li>
  );
}

export default TaskRow;
