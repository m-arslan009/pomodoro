import ModalDialog from './ModalDialog.jsx';

/*
 * ConfirmDialog — the shared "are you sure" for a destructive, irreversible action.
 *
 * Reserved for actions that cannot be undone. Abandoning a task does NOT use this: it is reversible
 * in one click, and confirming reversible things trains people to dismiss confirmations without
 * reading them, which is how the irreversible one eventually gets through.
 *
 * The body should name what is actually lost rather than asking abstractly. "Delete this task?" is
 * a question the user cannot answer; "6 recorded sessions will keep their name but will no longer
 * be linked to a task" is.
 */

function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busyLabel = 'Deleting…',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <ModalDialog
      titleId="confirm-dialog-title"
      descriptionId="confirm-dialog-text"
      onDismiss={busy ? undefined : onCancel}
    >
      <h2 id="confirm-dialog-title" className="modal-dialog__title">
        {title}
      </h2>
      <div id="confirm-dialog-text" className="modal-dialog__text">
        {children}
      </div>

      <div className="modal-dialog__actions">
        {/*
          Cancel comes first and Confirm is the danger variant: the destructive action should not
          be the one a hurried keyboard user lands on by reflex.
        */}
        <button type="button" className="timer-btn" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className="timer-btn timer-btn--danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
}

export default ConfirmDialog;
