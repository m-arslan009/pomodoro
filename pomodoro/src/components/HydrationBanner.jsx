import { useState } from 'react';
import useTimer from '../hooks/useTimer.js';

/*
 * HydrationBanner — everything the account-level data load needs to say, in one place.
 *
 * IT LIVES IN THE SHELL, AND THAT IS ARCHITECTURE RATHER THAN CONVENIENCE (CONTRACT.md §17.4).
 * History may not import a slice thunk — that is the rule the whole feature rests on — and a retry
 * has to dispatch one. So a Retry button rendered by any History component would quietly re-couple
 * the page to the network it is defined by not touching. Putting the banner in AppLayout, which
 * already owns useAuth and is already the single named exception in the import-boundary walk,
 * satisfies both halves of §17.4 instead of trading one for the other. TimerPage's own sync strip
 * folded in here for the same reason: two dialects of one message is one too many.
 *
 * It reports three things, most urgent first:
 *
 *   1. A read that failed, BY NAME. "Something went wrong" tells a user nothing they can act on,
 *      and the four reads answer four different questions — only the failed one is unanswered, so
 *      the other three are still on screen and still correct.
 *   2. A view bounded by the record cap. A chart the user has silently outgrown is a chart that
 *      lies, which is the whole class of defect this work exists to remove.
 *   3. Records the server has not taken, or has refused. An undelivered session is not a lost one
 *      and the user is entitled to know which — a rejection kept in the store but drawn nowhere is
 *      indistinguishable from a rejection dropped.
 *
 * ONE role="status" REGION, never several. Assistive tech should hear one announcement about the
 * state of the account's data, not three competing ones.
 *
 * Dismissal is keyed on WHAT is wrong, not on a flag: dismissing "points failed" must not also
 * silence a later "history failed". The signature changes, so the banner comes back.
 */

function HydrationBanner() {
  const { hydrationFailures, sessionsTruncated, pendingSync, rejectedSessions, retrySync, reload } =
    useTimer();

  const [dismissed, setDismissed] = useState(null);

  const failureNames = hydrationFailures.map((failure) => failure.label);
  const rejectedCount = rejectedSessions.length;

  // What the banner is currently about. Dismissal sticks only while this stays the same.
  const signature = [
    failureNames.join(','),
    sessionsTruncated ? 'capped' : '',
    pendingSync,
    rejectedCount,
  ].join('|');

  const hasSomethingToSay =
    failureNames.length > 0 || sessionsTruncated || pendingSync > 0 || rejectedCount > 0;

  if (!hasSomethingToSay || dismissed === signature) return null;

  return (
    <div className="app-banner" role="status">
      <div className="app-banner__lines">
        {failureNames.length > 0 && (
          <p className="app-banner__line">
            We could not load {listNames(failureNames)}. Showing what we already have.{' '}
            <button type="button" className="app-banner__action" onClick={reload}>
              Retry
            </button>
          </p>
        )}

        {sessionsTruncated && (
          <p className="app-banner__line">
            Showing your most recent sessions — you have more history than this view holds.
          </p>
        )}

        {pendingSync > 0 && (
          <p className="app-banner__line">
            {pendingSync} {pendingSync === 1 ? 'session is' : 'sessions are'} waiting to sync.{' '}
            <button type="button" className="app-banner__action" onClick={retrySync}>
              Retry now
            </button>
          </p>
        )}

        {rejectedCount > 0 && (
          <p className="app-banner__line">
            {rejectedCount} {rejectedCount === 1 ? 'session was' : 'sessions were'} refused by the
            server. {rejectedCount === 1 ? 'It is' : 'They are'} still listed in your history.
          </p>
        )}
      </div>

      <button
        type="button"
        className="app-banner__dismiss"
        onClick={() => setDismissed(signature)}
        aria-label="Dismiss this notice"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** "your tasks and your points" — a readable list, not a comma-joined array. */
function listNames(names) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default HydrationBanner;
