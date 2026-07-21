/*
 * SummaryTile — the high-level KPI header. A hero point figure anchors the tile,
 * with the four remaining status metrics (completed/terminated sessions,
 * completed/incomplete tasks) in an auto-fitting grid so they never crowd at
 * intermediate widths, plus a completion-rate bar. Fluid type keeps every value
 * legible from mobile up.
 */

function SummaryTile({ summary }) {
  const {
    points,
    completedSessions,
    terminatedSessions,
    completedTasks,
    incompleteTasks,
    completionRate,
    focusMinutes,
  } = summary

  const kpis = [
    { label: 'Completed sessions', value: completedSessions, tone: 'good' },
    { label: 'Terminated sessions', value: terminatedSessions, tone: 'bad' },
    { label: 'Completed tasks', value: completedTasks, tone: 'good' },
    { label: 'Incomplete tasks', value: incompleteTasks, tone: 'muted' },
  ]

  return (
    <section className="hp-tile hp-summary" aria-labelledby="hp-summary-heading">
      <header className="hp-tile__head">
        <h2 id="hp-summary-heading" className="hp-tile__title">
          Overview
        </h2>
        <span className="hp-tile__meta">{focusMinutes} min focused</span>
      </header>

      <div className="hp-summary__hero">
        <p className="hp-summary__score">
          <span className="hp-summary__score-value">{points.toLocaleString()}</span>
          <span className="hp-summary__score-unit">pts</span>
        </p>
        <p className="hp-summary__score-caption">Lifetime points earned</p>
      </div>

      <dl className="hp-summary__grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`hp-kpi hp-kpi--${kpi.tone}`}>
            <dt className="hp-kpi__label">
              <span className="hp-kpi__dot" aria-hidden="true" />
              {kpi.label}
            </dt>
            <dd className="hp-kpi__value">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <div className="hp-summary__rate">
        <div className="hp-summary__rate-label">
          <span>Completion rate</span>
          <span>{completionRate}%</span>
        </div>
        <div
          className="hp-bar"
          role="progressbar"
          aria-valuenow={completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Session completion rate"
        >
          <span className="hp-bar__fill" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
    </section>
  )
}

export default SummaryTile
