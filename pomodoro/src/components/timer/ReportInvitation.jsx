import { useEffect, useState } from 'react';
import {
  REPORT_FREQUENCIES,
  fetchReportSubscription,
  updateReportFrequency,
} from '../../services/reports.js';

/*
 * ReportInvitation — the one-time offer of email reports, for accounts that were never asked.
 *
 * Accounts created before this feature existed have no subscription row, and neither do accounts
 * created through Google, because the OAuth callback has no form to answer (CONTRACT.md §23.0
 * consequence 2). `status: 'unasked'` is how the server says so, and this card is the only thing
 * that renders on it.
 *
 * IT ASKS ONCE, AND EVERY WAY OUT IS A STORED ANSWER — including "No thanks", which stores
 * `declined`. There is deliberately no dismiss ✕: a ✕ that only sets local state would bring the
 * card back on the user's next device, and one that stored `declined` would be a ✕ that silently
 * answered a question on their behalf. Three labelled buttons say what each one does, and Settings
 * can change any of them later.
 *
 * It lives here rather than on History for one hard reason: HistoryPage may not reach the network,
 * even transitively (§17.4), and this card does. The import-boundary suite would fail on it. The
 * Timer dashboard is also where the account lands after signing in, which is the only place an
 * invitation reaches someone who never opens the other pages.
 */

function ReportInvitation() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState('');

  /*
   * One small read per mount, and no cache. A module-level "already asked" flag would spare the
   * request for the accounts that answered long ago, but it is a mutable global that outlives the
   * component and the lint rules refuse it — correctly, since the answer can change from Settings
   * in another tab and a stale flag would hide a card that should be back.
   */
  useEffect(() => {
    let active = true;

    fetchReportSubscription()
      .then((subscription) => {
        if (active && subscription.status === 'unasked') setVisible(true);
      })
      /*
       * A failed read means the card does not appear. That is the right failure: this is an offer,
       * not something the user is waiting for, and an error banner about a feature they have never
       * heard of would be noise on the page they came here to focus on.
       */
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  async function answer(frequency) {
    if (saving) return;

    setSaving(true);
    try {
      const next = await updateReportFrequency(frequency);

      if (frequency === 'none') {
        setVisible(false);
        return;
      }

      /*
       * Staying on screen for one beat to report what happened, rather than vanishing. An
       * unverified address has a confirmation email on its way and the user has to act on it — a
       * card that disappeared would take that instruction with it (§23.0 L3).
       */
      setOutcome(
        next.requiresConfirmation
          ? 'Almost there — open the link we just emailed you and your reports will start.'
          : `Done. Your ${frequency} report is on its way from now on.`
      );
    } catch {
      setOutcome('That did not save. You can turn reports on from Settings whenever you like.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <section className="timer-tile report-invite" aria-labelledby="report-invite-heading">
      <h2 id="report-invite-heading" className="report-invite__title">
        Want your progress by email?
      </h2>

      {outcome ? (
        <p className="report-invite__text" role="status">
          {outcome}
        </p>
      ) : (
        <>
          <p className="report-invite__text">
            We can send you a PDF summary of your focus sessions — what you completed, how long you
            focused, and how your streak is going.
          </p>

          <div className="report-invite__actions">
            {REPORT_FREQUENCIES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`timer-btn${option.key === 'none' ? '' : ' timer-btn--primary'}`}
                disabled={saving}
                onClick={() => answer(option.key)}
              >
                {option.key === 'none' ? 'No thanks' : option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default ReportInvitation;
