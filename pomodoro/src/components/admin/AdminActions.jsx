import { useId, useState } from 'react';
import {
  ADMIN_USER_ROLES,
  DISABLE_REASON_MAX_LENGTH,
  DISABLE_REASON_MIN_LENGTH,
  normalizeDisableReason,
} from '../../services/adminUsers.js';
import AdminActionDialog from './AdminActionDialog.jsx';
import { describeAdminFailure } from './actionFailure.js';
import '../../styles/AdminActions.css';

/*
 * AdminActions — everything an operator can *do* to the account they are looking at.
 *
 * TWO GROUPS, AND THE SPLIT IS THE DESIGN. Disable, reactivate, revoke and role change are all
 * recoverable: an account can be reactivated, a role can be set back, a revoked session can be
 * replaced by signing in again. Deletion is not, and it is the only one of the five whose effects
 * survive the operator changing their mind. Putting it under its own heading, in its own outlined
 * region, behind a typed address, is what stops it being one more button in a row of buttons.
 *
 * NOTHING HERE ENFORCES ANYTHING. The three domain rules — no self role change, no self disable or
 * delete, no demoting or disabling the last admin (`admin_role_plan.md` §4.3) — are the server's,
 * and it answers 409 when one fires. Two of them are knowable from what this page already has, so
 * the controls they forbid are rendered disabled with the reason written beside them: a button that
 * can only fail is worse than no button. The third is not knowable here at all — the client has no
 * admin count, and `GET /admin/stats` is a different feature — so a demotion that would empty the
 * administrator set is offered, attempted, and refused by the server, whose refusal is shown.
 *
 * NO OPTIMISTIC UPDATES ANYWHERE. Every action's caller re-renders from the account the API
 * returned (§6.4–§6.7 all answer with the full detail for exactly this reason). Until the server
 * confirms, the page still says what it said before.
 *
 * ONE ACTION AT A TIME. `pending` disables every control while a request is in flight, and
 * `useAdminUser` holds the synchronous guard behind it — a disabled attribute is a render behind
 * the click that set it, and two disables in flight would be two audit rows for one decision.
 */

/**
 * The typed confirmation, reduced to the form the server compares.
 *
 * Trim and lowercase, because `DELETE /admin/users/:id` normalises the submitted value exactly that
 * way before matching it against the stored address — which is itself stored trim+lowercase behind a
 * database CHECK. Comparing the raw input here would make the button refuse a capitalised address
 * the server would have accepted, which is the client being stricter than the rule it is mirroring.
 */
function normalizeConfirmEmail(value) {
  return value.trim().toLowerCase();
}

/** Which dialog is open, and the action key each confirms. */
const DIALOG_ACTION = {
  disable: 'disable',
  revoke: 'revoke',
  role: 'role',
  delete: 'delete',
};

/**
 * @param {{
 *   user: import('../../services/adminUsers.js').AdminUserDetail,
 *   isSelf: boolean,
 *   pending: string|null,
 *   actionError: {kind: string, error: Error}|null,
 *   actionResult: {kind: string, message: string}|null,
 *   onDisable: (reason: string) => Promise<boolean>,
 *   onReactivate: () => Promise<boolean>,
 *   onRevokeSessions: () => Promise<boolean>,
 *   onChangeRole: (role: string) => Promise<boolean>,
 *   onDelete: (confirmEmail: string) => Promise<boolean>,
 *   onDismissError: () => void,
 * }} props
 */
function AdminActions({
  user,
  isSelf,
  pending,
  actionError,
  actionResult,
  onDisable,
  onReactivate,
  onRevokeSessions,
  onChangeRole,
  onDelete,
  onDismissError,
}) {
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  /*
   * `null` means "whatever the account's role currently is". Holding the *absence* of a choice
   * rather than a copy of the role is what keeps the select correct after a successful change
   * without an effect that syncs one piece of state to another.
   */
  const [roleChoice, setRoleChoice] = useState(null);

  const fieldId = useId();
  const reasonId = `${fieldId}-reason`;
  const reasonHintId = `${fieldId}-reason-hint`;
  const roleId = `${fieldId}-role`;
  const confirmId = `${fieldId}-confirm`;
  const confirmHintId = `${fieldId}-confirm-hint`;
  const selfNoteId = `${fieldId}-self`;
  const promoteNoteId = `${fieldId}-promote`;

  const busy = pending !== null;
  const disabledAccount = user.status === 'disabled';
  const selectedRole = roleChoice ?? user.role;
  const roleUnchanged = selectedRole === user.role;

  /*
   * §6.7's extra control, checked here only so the operator is told why before they try: promotion
   * requires an active account holding at least one credential, because promoting a disabled
   * account creates an admin who cannot sign in and whom the last-admin rule then refuses to
   * demote. The server checks it too.
   */
  const hasCredential = Boolean(user.hasPassword) || (user.identities?.length ?? 0) > 0;
  const promotionBlocked =
    selectedRole === 'admin' && !roleUnchanged && (disabledAccount || !hasCredential);

  /* A failure while a dialog is open belongs in the dialog, beside the control that will retry. */
  const failureFor = (kind) =>
    actionError?.kind === kind ? describeAdminFailure(actionError.error) : '';
  const openAction = dialog ? DIALOG_ACTION[dialog] : null;
  const sectionError = actionError && actionError.kind !== openAction ? actionError : null;

  const closeDialog = () => {
    setDialog(null);
    setReasonError('');
    /*
     * A rejection belongs to the dialog it was shown in. Abandoning the confirmation must not leave
     * it behind as a page-level alert about something the operator decided not to do.
     */
    onDismissError();
  };

  /** Closes the dialog only once the server has confirmed the action. */
  const settle = async (promise) => {
    const ok = await promise;
    if (ok) {
      closeDialog();
      setReason('');
      setConfirmEmail('');
      setRoleChoice(null);
    }
  };

  const submitDisable = () => {
    /*
     * Bounds checked here as well as server-side, so a three-character minimum is learned while the
     * field is still in front of the operator rather than through a 422 after the round trip.
     */
    if (normalizeDisableReason(reason).length < DISABLE_REASON_MIN_LENGTH) {
      setReasonError(`Give a reason of at least ${DISABLE_REASON_MIN_LENGTH} characters.`);
      return;
    }
    setReasonError('');
    settle(onDisable(reason));
  };

  return (
    <section className="admin-actions" aria-labelledby="admin-actions-title">
      <h3 id="admin-actions-title" className="admin-actions__title">
        Admin actions
      </h3>
      <p className="admin-actions__lead">
        Everything above the divider can be undone. Everything below it cannot.
      </p>

      {/*
        One live region for the outcome of the last action. It keeps its space while empty so
        confirming something does not shove the buttons down the page.
      */}
      <p className="admin-actions__status" role="status">
        {actionResult?.message ?? ''}
      </p>

      {sectionError && (
        <p className="admin-actions__alert" role="alert">
          {describeAdminFailure(sectionError.error)}
        </p>
      )}

      {isSelf && (
        <p id={selfNoteId} className="admin-actions__note">
          This is your own account. You cannot change your own role, disable or delete yourself, or
          revoke your own sessions — sign out instead. These limits exist so an operator cannot lock
          themselves out of the system.
        </p>
      )}

      {/* ------------------------------------------------------------ Reversible */}
      <div className="admin-actions__group">
        <h4 className="admin-actions__group-title">Reversible</h4>

        <div className="admin-actions__row">
          <div className="admin-actions__copy">
            <p className="admin-actions__action-name">
              {disabledAccount ? 'Reactivate user' : 'Disable user'}
            </p>
            <p className="admin-actions__hint">
              {disabledAccount
                ? 'Restores the ability to sign in. Sessions revoked while the account was disabled stay revoked, and both password and Google sign-in work unchanged.'
                : 'Blocks sign-in immediately and revokes every session in the same step. This is the control that acts at once — use it when access must stop now.'}
            </p>
          </div>
          {disabledAccount ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => onReactivate()}
              disabled={busy}
              aria-busy={pending === 'reactivate' || undefined}
            >
              {pending === 'reactivate' ? 'Reactivating…' : 'Reactivate user'}
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => setDialog('disable')}
              disabled={busy || isSelf}
              aria-describedby={isSelf ? selfNoteId : undefined}
            >
              Disable user
            </button>
          )}
        </div>

        <div className="admin-actions__row">
          <div className="admin-actions__copy">
            <p className="admin-actions__action-name">Revoke sessions</p>
            {/*
              §6.6 requires this limit to be stated in the UI and not only in the plan: this cuts
              the refresh half, and an operator who believes it cuts access outright will not reach
              for the control that does.
            */}
            <p className="admin-actions__hint">
              Revokes every existing refresh session, so the account has to sign in again. An access
              token already issued keeps working until it expires — up to 15 minutes. To block
              access immediately, disable the account instead.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => setDialog('revoke')}
            disabled={busy || isSelf}
            aria-describedby={isSelf ? selfNoteId : undefined}
          >
            Revoke sessions
          </button>
        </div>

        <div className="admin-actions__row">
          <div className="admin-actions__copy">
            <label className="admin-actions__action-name" htmlFor={roleId}>
              Change role
            </label>
            <p className="admin-actions__hint">
              An administrator can read every account and act on it. A demotion does not sign the
              user out; it takes effect on their next request. The last remaining administrator
              cannot be demoted — the server refuses it.
            </p>
            {promotionBlocked && (
              <p id={promoteNoteId} className="admin-actions__hint admin-actions__hint--warn">
                {disabledAccount
                  ? 'A disabled account cannot be promoted: it would become an administrator who cannot sign in and cannot be demoted.'
                  : 'This account holds no password and no linked sign-in, so it cannot be promoted.'}
              </p>
            )}
          </div>
          <div className="admin-actions__control">
            <select
              id={roleId}
              className="admin-actions__select"
              value={selectedRole}
              onChange={(event) => setRoleChoice(event.target.value)}
              disabled={busy || isSelf}
              aria-describedby={isSelf ? selfNoteId : promotionBlocked ? promoteNoteId : undefined}
            >
              {ADMIN_USER_ROLES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => setDialog('role')}
              /* Unchanged is a no-op the server would answer 200 to; there is nothing to confirm. */
              disabled={busy || isSelf || roleUnchanged || promotionBlocked}
            >
              Change role
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- Permanent */}
      <div className="admin-actions__group admin-actions__group--danger">
        <h4 className="admin-actions__group-title">Permanent</h4>

        <div className="admin-actions__row">
          <div className="admin-actions__copy">
            <p className="admin-actions__action-name">Delete user</p>
            <p className="admin-actions__hint">
              Erases the account and everything belonging to it: tasks, focus sessions, gamification
              progress, settings, sessions and linked sign-ins. There is no undo and no export. The
              audit record of administrative actions survives. If you only need to stop access,
              disable the account instead.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={() => setDialog('delete')}
            disabled={busy || isSelf}
            aria-describedby={isSelf ? selfNoteId : undefined}
          >
            Delete user
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- Dialogs */}
      {dialog === 'disable' && (
        <AdminActionDialog
          title="Disable this account?"
          confirmLabel="Disable account"
          busyLabel="Disabling…"
          busy={pending === 'disable'}
          error={failureFor('disable')}
          onConfirm={submitDisable}
          onCancel={closeDialog}
          field={
            <div className="admin-dialog__field">
              <label className="admin-dialog__label" htmlFor={reasonId}>
                Reason
              </label>
              <textarea
                id={reasonId}
                className="admin-dialog__textarea"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) setReasonError('');
                }}
                maxLength={DISABLE_REASON_MAX_LENGTH}
                rows={3}
                required
                aria-describedby={reasonHintId}
                aria-invalid={reasonError ? true : undefined}
              />
              <p id={reasonHintId} className="admin-dialog__hint">
                {reasonError ||
                  `Required, ${DISABLE_REASON_MIN_LENGTH}–${DISABLE_REASON_MAX_LENGTH} characters. It is written to the audit record, which would otherwise say who and when but not why.`}
              </p>
            </div>
          }
        >
          <p>
            <strong>{user.email}</strong> will not be able to sign in, and every session they hold
            will be revoked in the same step.
          </p>
          <p>
            This can be undone: reactivating the account restores sign-in with the same credentials.
          </p>
        </AdminActionDialog>
      )}

      {dialog === 'revoke' && (
        <AdminActionDialog
          title="Revoke this account's sessions?"
          confirmLabel="Revoke sessions"
          busyLabel="Revoking…"
          busy={pending === 'revoke'}
          error={failureFor('revoke')}
          onConfirm={() => settle(onRevokeSessions())}
          onCancel={closeDialog}
        >
          <p>
            Every device signed in as <strong>{user.email}</strong> will have to sign in again.
            Nothing else about the account changes.
          </p>
          <p>
            An access token already issued can still work for up to 15 minutes. If access must stop
            immediately, disable the account instead.
          </p>
        </AdminActionDialog>
      )}

      {dialog === 'role' && (
        <AdminActionDialog
          title={
            selectedRole === 'admin'
              ? 'Make this account an administrator?'
              : 'Remove administrator access?'
          }
          confirmLabel="Change role"
          busyLabel="Changing…"
          busy={pending === 'role'}
          error={failureFor('role')}
          onConfirm={() => settle(onChangeRole(selectedRole))}
          onCancel={closeDialog}
        >
          {selectedRole === 'admin' ? (
            <p>
              <strong>{user.email}</strong> will be able to read every account in the system and
              disable, delete or promote any of them.
            </p>
          ) : (
            <p>
              <strong>{user.email}</strong> will lose administrator access. They stay signed in as
              an ordinary user; the change applies from their next request.
            </p>
          )}
          <p>
            This is reversible, and it is recorded in the audit log. If this is the last remaining
            administrator, the server will refuse the demotion.
          </p>
        </AdminActionDialog>
      )}

      {dialog === 'delete' && (
        <AdminActionDialog
          danger
          title="Permanently delete this account?"
          confirmLabel="Delete permanently"
          busyLabel="Deleting…"
          busy={pending === 'delete'}
          error={failureFor('delete')}
          /*
           * The typed address is checked here AND by the server, which is the half that counts —
           * §6.9 puts `confirmEmail` in the request body precisely so the confirmation is not
           * something a client can decide to skip.
           */
          confirmDisabled={normalizeConfirmEmail(confirmEmail) !== user.email}
          onConfirm={() => settle(onDelete(confirmEmail))}
          onCancel={closeDialog}
          field={
            <div className="admin-dialog__field">
              <label className="admin-dialog__label" htmlFor={confirmId}>
                Type <span className="admin-dialog__target">{user.email}</span> to confirm
              </label>
              <input
                id={confirmId}
                className="admin-dialog__input"
                type="text"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-describedby={confirmHintId}
              />
              <p id={confirmHintId} className="admin-dialog__hint">
                The address must match exactly. The server verifies it as well.
              </p>
            </div>
          }
        >
          <p>
            This erases the account and everything belonging to it
            {typeof user.counts?.tasks === 'number' &&
            typeof user.counts?.focusSessions === 'number'
              ? `, including ${user.counts.tasks} task${user.counts.tasks === 1 ? '' : 's'} and ${user.counts.focusSessions} focus session${user.counts.focusSessions === 1 ? '' : 's'}`
              : ''}
            . It cannot be undone.
          </p>
          <p>
            The audit record of administrative actions is kept. If you only need to stop access,
            cancel and disable the account instead.
          </p>
        </AdminActionDialog>
      )}
    </section>
  );
}

export default AdminActions;
