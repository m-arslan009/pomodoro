import { useState } from 'react';
import { TITLE_MAX_LENGTH } from '../../services/tasks.js';

/*
 * AddTask — a compact inline form for adding a task to the backlog.
 *
 * Controlled and single-purpose: it owns only its own input text and hands the
 * trimmed title up via `onAdd`, then clears itself so the user can keep adding
 * as many tasks as they like. Empty/whitespace-only titles are ignored and the
 * submit button stays disabled until there is something to add.
 *
 * The length cap is imported rather than restated: it mirrors the server's rule,
 * and a local copy would be a second number to keep in step with it.
 */

function AddTask({ onAdd }) {
  const [title, setTitle] = useState('');
  const trimmed = title.trim();

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <form className="add-task" onSubmit={handleSubmit}>
      <label htmlFor="add-task-input" className="timer-visually-hidden">
        Add a task for today
      </label>
      <input
        id="add-task-input"
        type="text"
        className="add-task__input"
        placeholder="Add a task for today…"
        value={title}
        maxLength={TITLE_MAX_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        autoComplete="off"
      />
      <button type="submit" className="add-task__btn" disabled={!trimmed}>
        Add
      </button>
    </form>
  );
}

export default AddTask;
