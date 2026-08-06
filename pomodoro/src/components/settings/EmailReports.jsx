import { useEffect, useState } from 'react';
import {
  REPORT_FREQUENCIES,
  UNASKED_SUBSCRIPTION,
  fetchReportSubscription,
  updateReportFrequency,
} from '../../services/reports.js';
import { describeSaveFailure } from './saveFailure.js';

/*
 * EmailReports — the periodic report subscription, as a Settings section.
 *
 * The one section on this page that owns its own read. Every other card is handed a slice of
 * `/me/settings`, but a report subscription is not a preference in that sense: it lives in its own
 * table, carries delivery state the settings payload must never see, and is written through its own
 * endpoint (CONTRACT.md §23.1, §25.1). So this card fetches, and the page stays unaware.
 *
 * IT WORKS FOR EVERY AUTHENTICATED ACCOUNT, AND "NO SUBSCRIPTION" IS ITS ORDINARY CASE. A Google
 * account has never been offered the choice at all — the OAuth callback has no form to answer
 * (§23.0 consequence 2) — so `unasked` is the only state such an account can be in until it opens
 * this card. It is a state to render, not a failure to report; services/reports.js maps a missing
 * row onto it so a 404 can never surface here as "we could not load your preference".
 *
 * `none` is one of the three answers, not the absence of one. Choosing it stores `declined`, which
 * is what stops the Timer page's invitation coming back — "asked, said no" and "never asked" are
 * different states and only a stored answer tells them apart (§23.0 consequence 3).
 *
 * The status the server returns is adopted whole, never inferred. Choosing Weekly does not mean
 * reports are on: an address Evergrove has not verified lands in `pending_confirmation` with an
 * email on its way, and saying "Weekly reports are on" at that moment would be a lie the user only
 * discovers by waiting for a report that never comes (§23.0 L3, §25.2).
 */

/**
 * Which button reads as chosen, per stored state.
 *
 * `bounced` selects nothing on purpose. Reports being off is a consequence of failed delivery, not
 * an answer the user gave, and highlighting "No email reports" would put words in their mouth.
 * `paused` keeps the frequency highlighted for the mirror reason — the choice still stands, it is
 * only suspended.
 */
function selectedKey(subscription) {
  switch (subscription.status) {
    case 'declined':
    case 'unsubscribed':
      return 'none';
    case 'active':
    case 'paused':
    case 'pending_confirmation':
      return subscription.frequency ?? '';
    default:
      // 'unasked', 'bounced', and anything a later server version invents.
      return '';
  }
}

/**
 * What the stored state means, in the user's terms. Total by construction: every branch of the
 * documented enum answers, and the fallback covers a status this build has never heard of rather
 * than rendering an unexplained set of buttons.
 */
function describeStatus(subscription) {
  switch (subscription.status) {
    case 'unasked':
      return {
        tone: 'status',
        text: 'Email reports are not set up. Nothing is sent until you choose one of the options below.',
      };
    case 'pending_confirmation':
      return {
        tone: 'status',
        text: 'Almost there — check your inbox. We sent a link to confirm this is your address, and reports start once you open it. The link works once and expires after seven days.',
      };
    case 'active':
      return { tone: 'status', text: 'Email reports are on.' };
    case 'paused':
      return {
        tone: 'alert',
        text: 'Reports are paused — the last few could not be delivered to your address. Choose a frequency again to resume them.',
      };
    case 'declined':
    case 'unsubscribed':
      return { tone: 'status', text: 'Email reports are off. You can turn them on again here.' };
    case 'bounced':
      return {
        tone: 'alert',
        text: 'We could not deliver to your address, so reports were turned off. Check the address on your profile before turning them back on.',
      };
    default:
      return {
        tone: 'status',
        text: 'Choose how often you would like a report, or turn them off.',
      };
  }
}

/** How and when a chosen frequency actually arrives (§24.2, §27). */
const DELIVERY = {
  weekly:
    'Your weekly report covers Monday to Sunday and arrives on Monday morning, at 8am in your timezone.',
  monthly:
    'Your monthly report covers the previous calendar month and arrives on the 1st, at 8am in your timezone.',
};

function EmailReports({ onNotify }) {
  const [subscription, setSubscription] = useState(UNASKED_SUBSCRIPTION);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    fetchReportSubscription()
      .then((next) => {
        if (!active) return;
        setSubscription(next);
        setStatus('ready');
      })
      /*
       * Only a genuine failure reaches here — a missing row was already turned into `unasked` by
       * the service. So this branch means offline or a server fault, and saying so is correct.
       */
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  const selected = selectedKey(subscription);
  const notice = describeStatus(subscription);
  const isPending = subscription.status === 'pending_confirmation';

  /**
   * @param {'weekly'|'monthly'|'none'} frequency
   * @param {boolean} [resend] Re-send the confirmation for a frequency already chosen.
   */
  async function choose(frequency, resend = false) {
    if (status !== 'ready' || saving) return;
    // Re-picking the current answer is a no-op — except while a confirmation is outstanding, where
    // it is how a user who lost the email asks for another one (§25.2 rate-limits exactly this).
    if (frequency === selected && !resend) return;

    setSaving(true);
    try {
      const next = await updateReportFrequency(frequency);
      setSubscription(next);

      if (next.requiresConfirmation) {
        onNotify?.(
          'success',
          resend
            ? 'Sent — open the new link to start your reports.'
            : 'Almost there — open the link we just emailed you to start reports.'
        );
      } else if (frequency === 'none') {
        onNotify?.('success', 'Email reports are off.');
      } else {
        onNotify?.('success', `Your ${frequency} report is on.`);
      }
    } catch (error) {
      onNotify?.('error', describeSaveFailure(error, 'report preference'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-card" aria-labelledby="email-reports-heading">
      <div className="settings-card__head">
        <h2 id="email-reports-heading" className="settings-card__title">
          Email reports
        </h2>
        <p className="settings-card__hint">
          A summary of your focus sessions, sent to you as a PDF attachment. We only email you if
          you ask us to, and every report carries an unsubscribe link.
        </p>
      </div>

      {status === 'loading' && (
        <p className="settings-card__hint" role="status">
          Loading your report preference…
        </p>
      )}

      {status === 'error' && (
        <p className="settings-notice__text" role="alert">
          We could not reach the server, so we cannot show your report preference right now. Reload
          the page to try again — nothing has changed.
        </p>
      )}

      {status === 'ready' && (
        <>
          <p
            className="settings-card__hint reports-status"
            role={notice.tone === 'alert' ? 'alert' : 'status'}
          >
            {notice.text}
          </p>

          <div
            className="theme-segment reports-segment"
            role="group"
            aria-label="Email report frequency"
          >
            {REPORT_FREQUENCIES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`theme-segment__btn${
                  selected === option.key ? ' theme-segment__btn--active' : ''
                }`}
                aria-pressed={selected === option.key}
                disabled={saving}
                onClick={() => choose(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/*
           * The delivery detail belongs to a frequency that is actually configured. A declined or
           * never-asked account has nothing to describe, and describing it anyway would read as a
           * promise of mail nobody has asked for.
           */}
          {DELIVERY[selected] && (
            <p className="settings-card__hint reports-status">
              {DELIVERY[selected]} We skip any period where you did not record a focus session.
            </p>
          )}

          {isPending && (
            <button
              type="button"
              className="settings-btn settings-btn--ghost reports-resend"
              disabled={saving}
              onClick={() => choose(subscription.frequency, true)}
            >
              {saving ? 'Sending…' : 'Resend confirmation email'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default EmailReports;
