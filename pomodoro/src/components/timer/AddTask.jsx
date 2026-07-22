import { useState } from 'react';

/*
 * AddTask — a compact inline form for adding a task to today's backlog.
 *
 * Controlled and single-purpose: it owns only its own input text and hands the
 * trimmed title up via `onAdd`, then clears itself so the user can keep adding
 * as many tasks as they like. Empty/whitespace-only titles are ignored and the
 * submit button stays disabled until there is something to add.
 */

const MAX_LENGTH = 120;

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
        maxLength={MAX_LENGTH}
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
