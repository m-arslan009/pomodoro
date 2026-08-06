import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmReports } from '../services/reports.js';
import '../styles/ReportTokenPage.css';

/*
 * ReportConfirmPage — the landing page for the confirmation link in a report opt-in email.
 *
 * PUBLIC, AND DELIBERATELY NOT BEHIND A GUARD. The link is opened from an email, which means a
 * phone that has never signed in as often as the browser that requested it — so RequireAuth would
 * strand exactly the people who need it. RequireGuest would be worse: it bounces a signed-in user
 * to /timer, so anyone who happened to still be logged in could never confirm at all.
 *
 * IT POSTS; THE EMAIL LINK DOES NOT. Corporate mail scanners follow links in incoming mail, so a
 * GET that consumed the token would be spent by the scanner before the human ever clicked
 * (CONTRACT.md §25.3). The link opens this page; this page makes the request.
 *
 * It confirms on mount rather than behind a button, and that is the one place it differs from the
 * unsubscribe page. The consent action already happened — in Settings, at signup, and again by
 * opening this link — so a second click would be ceremony. Unsubscribing is destructive and gets
 * the button.
 *
 * An unknown, expired, or already-used token comes back 200 with `status: 'invalid'`, never a 404,
 * so that nobody can probe which tokens exist. There is one message for all three, for the same
 * reason.
 */

function ReportConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'working' : 'missing');
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;

    confirmReports(token)
      .then((subscription) => {
        if (!active) return;
        if (subscription.status === 'invalid') {
          setState('invalid');
          return;
        }
        setConfirmed(subscription);
        setState('confirmed');
      })
      .catch(() => {
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="rtp">
      <main className="rtp-main">
        <div className="rtp-card">
          <h1 className="rtp-title">Email reports</h1>

          {state === 'working' && (
            <p className="rtp-text" role="status">
              Confirming your address…
            </p>
          )}

          {state === 'confirmed' && (
            <p className="rtp-text" role="status">
              You are all set. Your {confirmed?.frequency === 'monthly' ? 'monthly' : 'weekly'}{' '}
              report will arrive at 8am your time, starting with your next full{' '}
              {confirmed?.frequency === 'monthly' ? 'month' : 'week'}.
            </p>
          )}

          {state === 'missing' && (
            <p className="rtp-text" role="alert">
              This link is incomplete. Open the most recent confirmation email we sent you, or turn
              reports on again from Settings.
            </p>
          )}

          {state === 'invalid' && (
            <p className="rtp-text" role="alert">
              This link has expired or has already been used. You can turn reports on again from
              Settings, and we will send a fresh one.
            </p>
          )}

          {state === 'error' && (
            <p className="rtp-text" role="alert">
              We could not reach the server. Check your connection and open this link again —
              nothing has changed yet.
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

export default ReportConfirmPage;
