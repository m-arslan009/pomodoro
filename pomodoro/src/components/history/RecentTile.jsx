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
                {shown.map((s) => (
                  <tr key={s.clientSessionId}>
                    <td className="hp-recent__task">{s.taskTitle}</td>
                    <td>{formatDuration(s.actualDurationMs)}</td>
                    <td className="hp-recent__when">{formatWhen(s.endedAt)}</td>
                    <td>
                      <span className={`hp-badge hp-badge--${s.status}`}>
                        {s.status === 'completed' ? 'Completed' : 'Terminated'}
                      </span>
                    </td>
                  </tr>
                ))}
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
