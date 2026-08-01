import { useCallback, useEffect, useRef } from 'react';
import '../styles/ModalDialog.css';

/*
 * ModalDialog — the shared modal primitive: overlay, labelled dialog role, focus
 * management and Tab containment.
 *
 * It exists because the Timer needs two decision dialogs (terminate reason,
 * session recovery) and phase T2 needs a third (delete confirmation). Three
 * hand-rolled focus traps would be three chances to get focus restoration wrong.
 *
 * Focus behaviour, which is the whole reason this is a component:
 *   - on open, focus moves to the first focusable control inside
 *   - Tab and Shift+Tab cycle within the dialog, never escaping to the page behind
 *   - on close, focus returns to whatever was focused when the dialog opened
 *
 * `onDismiss` is OPTIONAL and controls Escape and overlay clicks. Omit it for a
 * dialog that must be answered — a decision with no safe default should not have
 * a way to be dismissed by accident, because "dismissed" would silently become
 * one of the answers.
 */

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function ModalDialog({ titleId, descriptionId, onDismiss, className = '', children }) {
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);

  // Remember what had focus so it can be handed back on close.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    const node = dialogRef.current;
    const first = node?.querySelector(FOCUSABLE);
    (first ?? node)?.focus();

    return () => {
      const target = restoreRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) {
        target.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && onDismiss) {
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends so focus cannot reach the inert page behind the overlay.
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onDismiss]
  );

  return (
    <div
      className="modal-overlay"
      // A dismissible dialog closes on backdrop click; one that must be answered
      // ignores it, for the same reason it ignores Escape.
      onMouseDown={(event) => {
        if (onDismiss && event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

export default ModalDialog;
