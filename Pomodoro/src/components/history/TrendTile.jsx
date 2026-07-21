import { useMemo, useState } from 'react'
import AreaTrendChart from './charts/AreaTrendChart.jsx'
import { buildTimeline } from '../../services/history.js'

/*
 * TrendTile — completed-focus-sessions over time, with a Daily / Weekly /
 * Monthly segmented control that re-buckets the same session history. Owns the
 * interval as local UI state and derives the series with buildTimeline.
 */

const COMPLETED_ACCENT = '#cfe6b4' // forest --fg-accent (validated)

const INTERVALS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

function TrendTile({ sessions }) {
  const [range, setRange] = useState('daily')

  const series = useMemo(() => {
    const timeline = buildTimeline(sessions, range)
    return timeline.map((b) => ({ label: b.label, value: b.completed }))
  }, [sessions, range])

  const hasData = series.some((d) => d.value > 0)

  return (
    <section className="hp-tile hp-trend" aria-labelledby="hp-trend-heading">
      <header className="hp-tile__head hp-tile__head--stacked">
        <div>
          <h2 id="hp-trend-heading" className="hp-tile__title">
            Focus trend
          </h2>
          <p className="hp-tile__subtitle">Completed sessions per period</p>
        </div>
        <div className="hp-segment" role="group" aria-label="Trend interval">
          {INTERVALS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`hp-segment__btn${range === opt.key ? ' hp-segment__btn--active' : ''}`}
              aria-pressed={range === opt.key}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {hasData ? (
        <AreaTrendChart
          data={series}
          accent={COMPLETED_ACCENT}
          unit="sessions"
          gradientId="hp-trend-gradient"
        />
      ) : (
        <p className="hp-empty">
          No completed sessions in this range yet. Finish a focus session to start
          your trend.
        </p>
      )}
    </section>
  )
}

export default TrendTile
