import { useId } from 'react';
import ModalDialog from '../ModalDialog.jsx';

/*
 * AdminActionDialog — the confirmation step in front of every administrative action.
 *
 * IT BUILDS ON ModalDialog, WHICH IS THE PART WORTH SHARING: the overlay, the dialog role, focus
 * moved in on open, Tab contained, and focus restored to the control that opened it on close. That
 * primitive is the reason a fourth dialog in this app is not a fourth chance to get focus wrong.
 *
 * IT IS NOT ConfirmDialog, AND THAT IS DELIBERATE. That component states its own scope in its first
 * line — *"reserved for actions that cannot be undone"* — and argues, correctly, that confirming
 * reversible things trains people to dismiss confirmations without reading them. Two of the actions
 * here are reversible and still require a confirm step, because their blast radius is another
 * person's access rather than the operator's own data; and two of them need something ConfirmDialog
 * has no shape for: a field the operator must fill in, and a server error rendered inside the
 * dialog so the request can be corrected and retried without losing what was typed. Widening
 * ConfirmDialog to cover both would have made it the thing its own header says it must not be.
 *
 * A FORM, NOT A PAIR OF BUTTONS. Enter submits from inside the field, which is what a keyboard user
 * expects after typing a reason or an address; without it the only way to confirm is to Tab past
 * Cancel to reach the confirm button.
 *
 * THE DIALOG STAYS OPEN ON FAILURE. A confirmation that vanishes on a 409 leaves the operator
 * looking at an unchanged page with a message somewhere else on it, unsure whether anything
 * happened. It closes only when the server has confirmed the action.
 */

/**
 * @param {{
 *   title: string,
 *   children?: import('react').ReactNode,  Body copy: what this action does, in the operator's terms.
 *   field?: import('react').ReactNode,     Optional control the confirmation requires.
 *   error?: string,                        A failure to show inside the dialog, already in our words.
 *   confirmLabel: string,
 *   busyLabel: string,
 *   busy?: boolean,
 *   confirmDisabled?: boolean,
 *   danger?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
function AdminActionDialog({
  title,
  children,
  field,
  error,
  confirmLabel,
  busyLabel,
  busy = false,
  confirmDisabled = false,
  danger = false,
  onConfirm,
  onCancel,
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const textId = `${baseId}-text`;

  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={textId}
      /*
       * Escape and backdrop clicks are live except while the request is running: dismissing a
       * confirmation is always safe, but dismissing one mid-flight would hide an action that is
       * still going to happen.
       */
      onDismiss={busy ? undefined : onCancel}
    >
      <h2 id={titleId} className="modal-dialog__title">
        {title}
      </h2>

      <form
        className="admin-dialog__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || confirmDisabled) return;
          onConfirm();
        }}
      >
        <div id={textId} className="modal-dialog__text">
          {children}
        </div>

        {field}

        {/*
          role="alert" so a rejection is announced rather than silently appearing below the fold of
          a scrolled dialog. It sits above the buttons, next to the control that will retry.
        */}
        {error && (
          <p className="admin-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-dialog__actions">
          {/*
            Cancel first, and Cancel is where ModalDialog puts initial focus when there is no field:
            the action being confirmed should not be the one a hurried keyboard user lands on by
            reflex.
          */}
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`admin-btn ${danger ? 'admin-btn--danger' : 'admin-btn--primary'}`}
            disabled={busy || confirmDisabled}
            aria-busy={busy || undefined}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export default AdminActionDialog;
