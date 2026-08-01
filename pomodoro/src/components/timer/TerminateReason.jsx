import ModalDialog from '../ModalDialog.jsx';
import { TERMINATION_REASONS } from '../../services/sessions.js';

/*
 * TerminateReason — the one-tap reason capture shown when a focus block is ended
 * early (CONTRACT.md §14.4, §15).
 *
 * WHY THIS EXISTS AT ALL. Terminating costs no points (§14.2). The reason is what
 * the product gets in exchange: without it an early stop is an unexplained gap,
 * and the focus-insight panel that eventually reads this data has nothing to read.
 * The reason is REQUIRED on a terminated focus session, so the four options are
 * the entire interaction — one tap, no free text, nothing to type.
 *
 * The block keeps running while this is open. Choosing a reason ends it; Cancel
 * dismisses and the countdown carries on, which is why this dialog is dismissible
 * and SessionRecovery is not.
 */

/*
 * Copy only. The KEYS come from services/sessions.js, which mirrors the server enum — this file
 * used to declare its own identical list, so one product had two copies of one server rule and
 * nothing would have noticed them drifting apart until a 422 (§15 mirror discipline).
 */
const REASON_COPY = {
  interrupted: { label: 'Something interrupted me', hint: 'A person, a call, a notification' },
  wrong_task: { label: 'Wrong task', hint: 'I picked the wrong thing to work on' },
  finished_early: { label: 'Finished early', hint: 'The work was done before the timer was' },
  out_of_energy: { label: 'Out of energy', hint: 'I could not keep focusing' },
};

const REASONS = TERMINATION_REASONS.map((key) => ({ key, ...REASON_COPY[key] }));

function TerminateReason({ taskTitle, onSelect, onCancel }) {
  return (
    <ModalDialog
      titleId="terminate-reason-title"
      descriptionId="terminate-reason-text"
      onDismiss={onCancel}
    >
      <h2 id="terminate-reason-title" className="modal-dialog__title">
        End this block early?
      </h2>
      <p id="terminate-reason-text" className="modal-dialog__text">
        {taskTitle ? (
          <>
            You are focusing on <strong>{taskTitle}</strong>. Ending now costs you no points — tell us
            what happened so your focus record stays honest.
          </>
        ) : (
          'Ending now costs you no points — tell us what happened so your focus record stays honest.'
        )}
      </p>

      <ul className="modal-dialog__choices">
        {REASONS.map((reason) => (
          <li key={reason.key}>
            <button type="button" className="modal-choice" onClick={() => onSelect(reason.key)}>
              <span className="modal-choice__label">{reason.label}</span>
              <span className="modal-choice__hint">{reason.hint}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="modal-dialog__actions">
        <button type="button" className="timer-btn" onClick={onCancel}>
          Keep focusing
        </button>
      </div>
    </ModalDialog>
  );
}

export default TerminateReason;
