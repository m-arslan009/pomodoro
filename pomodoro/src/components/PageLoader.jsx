import '../styles/PageLoader.css';

/*
 * PageLoader — the "we don't know yet" state.
 *
 * Shown while the session bootstrap is in flight, so a refresh on a protected page waits for
 * the answer instead of flashing the login screen. role="status" announces it to screen
 * readers without stealing focus.
 */
function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader__spinner" aria-hidden="true" />
      <p className="page-loader__label">{label}</p>
    </div>
  );
}

export default PageLoader;
