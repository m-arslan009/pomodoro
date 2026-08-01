import { useMemo, useState } from 'react';
import AreaTrendChart from './charts/AreaTrendChart.jsx';
import { buildTimeline } from '../../services/history.js';

/*
 * TrendTile — completed-focus-sessions over time, with a Daily / Weekly /
 * Monthly segmented control that re-buckets the same session history. Owns the
 * interval as local UI state and derives the series with buildTimeline.
 *
 * UNGATED, for every account from its first session (CONTRACT.md §9.5). This was
 * a Catalyst-gated feature: below 4,000 lifetime points the interval control was
 * withheld and the chart rendered as a dimmed, `inert` preview. Withholding the
 * core feedback loop for ~15 hours of focus delivered it to users who had already
 * built the habit and denied it to the ones building it — §9.4's "gate identity,
 * never utility", applied to the surface product_analysis.md §3.1 wrote it about.
 */

const COMPLETED_ACCENT = '#cfe6b4'; // forest --fg-accent (validated)

const INTERVALS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function TrendTile({ sessions, dailyTimeline }) {
  const [range, setRange] = useState('daily');

  const series = useMemo(() => {
    // The daily timeline is built once by the page and shared with the comparison
    // tile, so the default range costs no second pass over the sessions (E5).
    const timeline =
      range === 'daily' && dailyTimeline ? dailyTimeline : buildTimeline(sessions, range);
    return timeline.map((b) => ({ label: b.label, value: b.completed }));
  }, [sessions, range, dailyTimeline]);

  const hasData = series.some((d) => d.value > 0);

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

      <div className="hp-tile__viz">
        {hasData ? (
          <AreaTrendChart
            data={series}
            accent={COMPLETED_ACCENT}
            unit="sessions"
            gradientId="hp-trend-gradient"
          />
        ) : (
          <p className="hp-empty">
            No completed sessions in this range yet. Finish a focus session to start your trend.
          </p>
        )}
      </div>
    </section>
  );
}

export default TrendTile;
