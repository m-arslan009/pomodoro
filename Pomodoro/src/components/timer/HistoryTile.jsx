/*
 * HistoryTile — bottom-right tile: the day's processed-block stream.
 *
 * Renders today's finished focus blocks newest-first as a compact table, with a
 * status badge that visually distinguishes Completed (forest accent) from
 * Terminated (crimson). New rows are appended in real time by TimerPage the
 * moment a session ends. The table scrolls locally on narrow widths instead of
 * widening the page.
 */

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000)
  return `${minutes} min`
}

function HistoryTile({ entries }) {
  return (
    <section className="timer-tile history-tile" aria-labelledby="history-heading">
      <header className="timer-tile__head">
        <h2 id="history-heading" className="timer-tile__title">
          Today’s Log
        </h2>
        <span className="history-tile__count">{entries.length}</span>
      </header>

      {entries.length === 0 ? (
        <p className="history-tile__empty">
          No blocks yet today. Your completed and terminated sessions will appear here.
        </p>
      ) : (
        <div className="history-tile__scroll">
          <table className="history-tile__table">
            <caption className="timer-visually-hidden">
              Processed focus blocks for today
            </caption>
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Length</th>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="history-tile__task">{entry.taskTitle}</td>
                  <td>{formatDuration(entry.durationMs)}</td>
                  <td>{formatTime(entry.endedAt)}</td>
                  <td>
                    <span
                      className={`history-badge history-badge--${entry.status}`}
                    >
                      {entry.status === 'completed' ? 'Completed' : 'Terminated'}
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

export default HistoryTile
