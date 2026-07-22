import { useEffect } from 'react';
import '../styles/Notification.css';

/*
 * Notification — reusable global toast for major event outcomes.
 *   type="success"  → green   (e.g. registration succeeded)
 *   type="error"    → red     (e.g. attempt failed / invalid form)
 *   type="warning"  → yellow  (security / high-risk input states)
 *
 * Controlled: the parent owns visibility by passing/clearing `message`.
 * Auto-dismisses after `duration` ms (set duration={0} to keep it sticky).
 */

const ICONS = {
  success: 'M20 6 9 17l-5-5',
  error:
    'M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  warning:
    'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
};

const LABELS = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
};

function Notification({ type = 'success', message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message || !duration || !onClose) return undefined;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  // Errors interrupt (assertive); success/warning are polite status updates.
  const isError = type === 'error';

  return (
    <div className="toast-region" aria-live={isError ? 'assertive' : 'polite'}>
      <div className={`toast toast--${type}`} role={isError ? 'alert' : 'status'}>
        <svg
          className="toast__icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d={ICONS[type] ?? ICONS.success} />
        </svg>
        <p className="toast__message">
          <span className="toast__label">{LABELS[type] ?? LABELS.success}:</span> {message}
        </p>
        {onClose && (
          <button
            type="button"
            className="toast__close"
            onClick={onClose}
            aria-label="Dismiss notification"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Notification;
