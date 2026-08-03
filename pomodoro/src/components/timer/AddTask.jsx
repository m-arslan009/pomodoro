import { useState } from 'react';
import EstimateSelect from './EstimateSelect.jsx';
import { TITLE_MAX_LENGTH } from '../../services/tasks.js';

/*
 * AddTask — a compact inline form for adding a task to the backlog.
 *
 * Controlled and single-purpose: it owns only its own draft and hands the trimmed
 * title and the optional estimate up via `onAdd`, then clears itself so the user
 * can keep adding as many tasks as they like. Empty/whitespace-only titles are
 * ignored and the submit button stays disabled until there is something to add.
 *
 * THE ESTIMATE IS OPTIONAL AND STAYS OPTIONAL. It never gates the button, and it
 * resets to "No estimate" after each add rather than sticking — one task taking
 * three pomodoros is no evidence about the next one, and a value that carried over
 * would be a guess made on the user's behalf (CONTRACT.md §14.3 rule 7).
 *
 * The length cap is imported rather than restated: it mirrors the server's rule,
 * and a local copy would be a second number to keep in step with it.
 */

function AddTask({ onAdd }) {
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(null);
  const trimmed = title.trim();

  function handleSubmit(event) {
    event.preventDefault();
    if (!trimmed) return;
    onAdd(trimmed, estimate);
    setTitle('');
    setEstimate(null);
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
      <EstimateSelect
        id="add-task-estimate"
        label="Estimated pomodoros for this task (optional)"
        value={estimate}
        onChange={setEstimate}
      />
      <button type="submit" className="add-task__btn" disabled={!trimmed}>
        Add
      </button>
    </form>
  );
}

export default AddTask;
