/*
 * RecentTile — the raw session records behind the charts, newest first, as a
 * compact table that scrolls locally instead of widening the tile. It doubles as
 * the accessible table view for the charts above. Status is a badge, never
 * colour alone.
 */

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function formatDuration(ms) {
  const minutes = Math.max(0, Math.round((Number.isFinite(ms) ? ms : 0) / 60000))
  return `${minutes} min`
}

function RecentTile({ sessions }) {
  const ordered = [...sessions].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  )

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
          No sessions logged in the last 7 days. Completed and terminated blocks
          will list here.
        </p>
      ) : (
        <div className="hp-recent__scroll">
          <table className="hp-recent__table">
            <caption className="hp-visually-hidden">
              Recent focus sessions with task, length, time and status
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
              {ordered.map((s) => (
                <tr key={s.id}>
                  <td className="hp-recent__task">{s.taskTitle}</td>
                  <td>{formatDuration(s.durationMs)}</td>
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
      )}
    </section>
  )
}

export default RecentTile
