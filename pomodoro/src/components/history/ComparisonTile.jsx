import ComparisonBarChart from './charts/ComparisonBarChart.jsx';
import GatedTile from './GatedTile.jsx';

/*
 * ComparisonTile — a daily grouped-bar view contrasting completed vs terminated
 * focus sessions across the last seven days, so momentum and slip-ups sit side
 * by side. A legend carries the two status roles; the chart never leans on
 * colour alone.
 *
 * This detailed graphical report is a Vanguard-gated feature: while locked,
 * GatedTile renders it as an inert, dimmed preview behind an unlock hint.
 */

const COMPLETED_COLOR = '#cfe6b4'; // forest --fg-accent (validated)
const TERMINATED_COLOR = '#e0736b'; // --timer-danger (validated)

/** `timeline` is the shared daily Bucket[] built once by HistoryPage (E5). */
function ComparisonTile({ timeline = [] }) {
  const hasData = timeline.some((d) => d.total > 0);

  const legend = (
    <ul className="hp-legend">
      <li className="hp-legend__item">
        <span className="hp-legend__swatch hp-legend__swatch--good" aria-hidden="true" />
        Completed
      </li>
      <li className="hp-legend__item">
        <span className="hp-legend__swatch hp-legend__swatch--bad" aria-hidden="true" />
        Terminated
      </li>
    </ul>
  );

  return (
    <GatedTile
      feature="graphicalReports"
      className="hp-comparison"
      headingId="hp-comparison-heading"
      title="Completed vs terminated"
      subtitle="Daily sessions, last 7 days"
      meta={legend}
    >
      {hasData ? (
        <ComparisonBarChart
          data={timeline}
          completedColor={COMPLETED_COLOR}
          terminatedColor={TERMINATED_COLOR}
        />
      ) : (
        <p className="hp-empty">
          No sessions recorded in the last 7 days. Your completed and terminated blocks will compare
          here.
        </p>
      )}
    </GatedTile>
  );
}

export default ComparisonTile;
