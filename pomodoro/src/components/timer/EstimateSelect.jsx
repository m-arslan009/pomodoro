import { useMemo } from 'react';
import { ESTIMATE_LIMITS } from '../../services/tasks.js';

/*
 * EstimateSelect — how many pomodoros the user thinks a task will take.
 *
 * PLANNING INFORMATION ONLY (CONTRACT.md §14.3 rule 7). Nothing reads this number but the code that
 * displays it: it does not size an interval, score a session, touch either streak, or move a task
 * between statuses. A task with an estimate behaves exactly like one without.
 *
 * A BOUNDED SELECT, NOT A NUMBER INPUT, and that is the whole reason this file exists. The server
 * accepts an integer in [1, 20]; a free-text field would need a client copy of that rule, an error
 * message, and an error state — a second copy of a number that §15's mirror discipline says must
 * never drift. A select makes every invalid value unreachable instead, so there is nothing to
 * validate and nothing to keep in step. The options are derived from ESTIMATE_LIMITS for the same
 * reason: the range is written down once.
 *
 * Shared by AddTask and TaskRow because both write the same field under the same rule — the second
 * caller is what makes it a component rather than markup.
 *
 * NULL IS "NO ESTIMATE", NEVER 0. An absent estimate is the normal resting state of a task, not an
 * incomplete one, so the empty option is first and selected by default.
 */

function EstimateSelect({ id, label, value, onChange, disabled = false }) {
  // ESTIMATE_LIMITS is module-scope and constant, so this list is built once per mount rather than
  // on every keystroke in the sibling title field.
  const options = useMemo(() => {
    const { min, max } = ESTIMATE_LIMITS;
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }, []);

  return (
    <span className="estimate-select">
      <label htmlFor={id} className="timer-visually-hidden">
        {label}
      </label>
      <select
        id={id}
        className="estimate-select__input"
        // The empty string is the DOM's only way to say "no value"; it becomes null on the way out.
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        <option value="">No estimate</option>
        {options.map((count) => (
          <option key={count} value={count}>
            {count} pomodoro{count === 1 ? '' : 's'}
          </option>
        ))}
      </select>
    </span>
  );
}

export default EstimateSelect;
