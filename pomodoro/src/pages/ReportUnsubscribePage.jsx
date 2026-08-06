import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { unsubscribeFromReports } from '../services/reports.js';
import '../styles/ReportTokenPage.css';

/*
 * ReportUnsubscribePage — the landing page for the unsubscribe link in every report email.
 *
 * PUBLIC, AND DELIBERATELY NOT BEHIND A GUARD, for the reason ReportConfirmPage gives: the link is
 * opened from an email, and an unsubscribe that first demands a sign-in is an unsubscribe that does
 * not work.
 *
 * UNLIKE CONFIRMATION, THIS WAITS FOR A CLICK. Turning something off is destructive and one link
 * preview away from happening by accident, so opening the page must change nothing. The true
 * one-click path is the `List-Unsubscribe-Post` header, which the mail client honours against the
 * API directly and never reaches this page (CONTRACT.md §26.5).
 *
 * The request is idempotent by contract — the unsubscribe token does not expire and a second click
 * answers 200 exactly like the first — so there is no "already unsubscribed" failure to render. A
 * link in a year-old email that errored would be a link that lied.
 */

function ReportUnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'idle' : 'missing');

  async function handleUnsubscribe() {
    if (state === 'working') return;

    setState('working');
    try {
      const result = await unsubscribeFromReports(token);
      setState(result.status === 'invalid' ? 'invalid' : 'done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="rtp">
      <main className="rtp-main">
        <div className="rtp-card">
          <h1 className="rtp-title">Stop email reports</h1>

          {(state === 'idle' || state === 'working' || state === 'error') && (
            <>
              <p className="rtp-text">
                We will stop sending your periodic focus report. Your account, your history, and
                your points are not affected, and you can turn reports back on from Settings.
              </p>

              {state === 'error' && (
                <p className="rtp-text rtp-text--alert" role="alert">
                  We could not reach the server. Nothing has changed — try again.
                </p>
              )}

              <button
                type="button"
                className="rtp-btn"
                onClick={handleUnsubscribe}
                disabled={state === 'working'}
              >
                {state === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
              </button>
            </>
          )}

          {state === 'done' && (
            <p className="rtp-text" role="status">
              Done — we will not email you any more reports.
            </p>
          )}

          {state === 'missing' && (
            <p className="rtp-text" role="alert">
              This link is incomplete. Open the unsubscribe link from one of your report emails, or
              turn reports off in Settings.
            </p>
          )}

          {state === 'invalid' && (
            <p className="rtp-text" role="alert">
              We could not read this link. You can turn reports off in Settings instead.
            </p>
          )}

          <Link to="/" className="rtp-link">
            Go to Evergrove
          </Link>
        </div>
      </main>
    </div>
  );
}

export default ReportUnsubscribePage;
