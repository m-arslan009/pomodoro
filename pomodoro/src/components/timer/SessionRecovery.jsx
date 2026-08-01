import ModalDialog from '../ModalDialog.jsx';

/*
 * SessionRecovery — shown on return when a focus block finished while the tab was
 * closed (CONTRACT.md §19.2).
 *
 * WHY IT ASKS INSTEAD OF DECIDING. The previous build silently voided the block:
 * a user who started 25 minutes of work and closed the laptop came back to
 * nothing, which is the defect this replaces. The obvious fix — auto-crediting —
 * is a worse one, because it pays people for walking away, and any incentive to
 * leave a running timer unattended eventually gets used. Asking costs one dialog
 * and makes the honest answer the easy one.
 *
 * BOTH ANSWERS PRODUCE A RECORD. Keep finalizes it completed; Discard finalizes it
 * terminated with an `interrupted` reason. There is no silent void, which is what
 * lets History treat a missing record as proof the block never happened
 * (§14.3 rule 3).
 *
 * Deliberately NOT dismissible: neither answer is safe to assume, so Escape and
 * backdrop clicks are ignored rather than quietly picking one.
 */

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'earlier';
  }
}

function formatLength(ms) {
  const minutes = Math.max(1, Math.round((Number.isFinite(ms) ? ms : 0) / 60000));
  return `${minutes} min`;
}

function SessionRecovery({ draft, onKeep, onDiscard }) {
  if (!draft) return null;

  return (
    <ModalDialog titleId="session-recovery-title" descriptionId="session-recovery-text">
      <h2 id="session-recovery-title" className="modal-dialog__title">
        Your focus block finished while you were away
      </h2>
      <p id="session-recovery-text" className="modal-dialog__text">
        A {formatLength(draft.plannedDurationMs)} block on <strong>{draft.taskTitle}</strong> started{' '}
        {formatWhen(draft.startedAt)} and ran out before you came back. Did you finish it?
      </p>

      <div className="modal-dialog__actions">
        <button type="button" className="timer-btn timer-btn--primary" onClick={onKeep}>
          Yes, I finished it
        </button>
        <button type="button" className="timer-btn" onClick={onDiscard}>
          No, I stepped away
        </button>
      </div>
    </ModalDialog>
  );
}

export default SessionRecovery;
