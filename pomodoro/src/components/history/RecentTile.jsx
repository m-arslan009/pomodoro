import { useMemo, useState } from 'react';

/*
 * RecentTile — the raw session records behind the charts, newest first, as a
 * compact table that scrolls locally instead of widening the tile. It doubles as
 * the accessible table view for the charts above. Status is a badge, never colour
 * alone.
 *
 * PAGED IN CHUNKS OF 50 (edge case E4). The store now holds a rolling 180 days
 * rather than the 7 it used to, so a steady user reaches several thousand records
 * — and this tile rendered every one of them into the DOM. The cap is not a
 * limit on what is kept, only on what is mounted at once; "Show more" reveals the
 * next batch, and the header always states the true total so nothing looks lost.
 */

const PAGE_SIZE = 50;

/*
 * The one-tap reason captured when a block is terminated, in the user's words rather than the
 * wire's. Showing it costs a span and closes the loop on an answer the user already gave — it is
 * NOT the deferred Focus insight panel (N1), which reads ACROSS reasons and says something the user
 * does not already know (CONTRACT.md §21).
 *
 * DELIBERATELY NOT IMPORTED from services/sessions.js, even though that module owns the enum: a
 * History component may not import a service, transitively or otherwise (§17.4). This is the seam
 * doing its job rather than a lapse — History renders a value it was handed on the record, and does
 * not reach for the module that defines it. An unrecognised value renders readably instead of
 * vanishing, so a reason added server-side degrades rather than disappears.
 */
const REASON_LABELS = {
  interrupted: 'interrupted',
  wrong_task: 'wrong task',
  finished_early: 'finished early',
  out_of_energy: 'out of energy',
};

function reasonLabel(reason) {
  if (!reason) return null;
  return REASON_LABELS[reason] ?? String(reason).replace(/_/g, ' ');
}

/*
 * A record's delivery state (§17.5, edge case E1). `synced` draws nothing: the overwhelming majority
 * of rows are synced, and a badge on all of them would be noise that makes the two that matter
 * harder to see.
 *
 * `rejected` is the one this exists for. The store has always kept refused records — but it drew
 * them identically to delivered ones, so "kept and surfaced" was true in the state and false on the
 * screen, which is the same outcome as dropping them (defect F15).
 */
const SYNC_BADGES = {
  pending: { label: 'Pending', hint: 'Not delivered to the server yet' },
  rejected: { label: 'Rejected', hint: 'The server refused this record' },
};

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDuration(ms) {
  const minutes = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 60000));
  return `${minutes} min`;
}

function RecentTile({ sessions }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const ordered = useMemo(
    () =>
      [...sessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()),
    [sessions]
  );

  const shown = ordered.slice(0, visible);
  const remaining = ordered.length - shown.length;

  return (
    <section className="hp-tile hp-recent" aria-labelledby="hp-recent-heading">
      <header className="hp-tile__head">
        <h2 id="hp-recent-heading" className="hp-tile__title">
          Recent sessions
        </h2>
        <span className="hp-tile__meta">{ordered.length}</span>
      </header>

      {ordered.length === 0 ? (
        <p className="hp-empty">
          No sessions logged yet. Completed and terminated focus blocks will list here.
        </p>
      ) : (
        <>
          <div className="hp-recent__scroll">
            <table className="hp-recent__table">
              <caption className="hp-visually-hidden">
                Recent focus sessions with task, length, time and status
                {remaining > 0 ? ` — showing the ${shown.length} most recent of ${ordered.length}` : ''}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Length</th>
                  <th scope="col">When</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const sync = SYNC_BADGES[s.syncState];
                  const reason = s.status === 'terminated' ? reasonLabel(s.terminationReason) : null;

                  return (
                    <tr key={s.clientSessionId}>
                      <td className="hp-recent__task">{s.taskTitle}</td>
                      <td>{formatDuration(s.actualDurationMs)}</td>
                      <td className="hp-recent__when">{formatWhen(s.endedAt)}</td>
                      <td>
                        <span className={`hp-badge hp-badge--${s.status}`}>
                          {s.status === 'completed' ? 'Completed' : 'Terminated'}
                        </span>
                        {reason && <span className="hp-recent__reason"> · {reason}</span>}
                        {sync && (
                          /*
                           * Text, not colour alone, and the detail the server gave is the
                           * accessible description rather than a tooltip nobody on a touch device
                           * can reach.
                           */
                          <span
                            className={`hp-badge hp-badge--sync hp-badge--${s.syncState}`}
                            title={s.rejectionDetail ?? sync.hint}
                          >
                            {sync.label}
                            <span className="hp-visually-hidden">
                              {' — '}
                              {s.rejectionDetail ?? sync.hint}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {remaining > 0 && (
            <button
              type="button"
              className="hp-recent__more"
              onClick={() => setVisible((count) => count + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
              <span className="hp-visually-hidden"> recent sessions, {remaining} remaining</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default RecentTile;
