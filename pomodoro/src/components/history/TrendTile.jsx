import { useMemo, useState } from 'react';
import AreaTrendChart from './charts/AreaTrendChart.jsx';
import GatedTile from './GatedTile.jsx';
import { buildTimeline } from '../../services/history.js';

/*
 * TrendTile — completed-focus-sessions over time, with a Daily / Weekly /
 * Monthly segmented control that re-buckets the same session history. Owns the
 * interval as local UI state and derives the series with buildTimeline.
 *
 * Time-utilization is a Catalyst-gated feature: while locked, GatedTile hides the
 * interval control and renders the daily preview inert, so the trend can only be
 * explored once the title is earned.
 */

const COMPLETED_ACCENT = '#cfe6b4'; // forest --fg-accent (validated)

const INTERVALS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function TrendTile({ sessions }) {
  const [range, setRange] = useState('daily');

  const series = useMemo(() => {
    const timeline = buildTimeline(sessions, range);
    return timeline.map((b) => ({ label: b.label, value: b.completed }));
  }, [sessions, range]);

  const hasData = series.some((d) => d.value > 0);

  const control = (
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
  );

  return (
    <GatedTile
      feature="timeUtilization"
      className="hp-trend"
      headingId="hp-trend-heading"
      title="Focus trend"
      subtitle="Completed sessions per period"
      meta={control}
    >
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
    </GatedTile>
  );
}

export default TrendTile;
