import ComparisonBarChart from './charts/ComparisonBarChart.jsx';

/*
 * ComparisonTile — a daily grouped-bar view contrasting completed vs terminated
 * focus sessions across the last seven days, so momentum and slip-ups sit side
 * by side. A legend carries the two status roles; the chart never leans on
 * colour alone.
 *
 * UNGATED, for every account from its first session (CONTRACT.md §9.5). This was
 * a Vanguard-gated feature at 8,000 lifetime points — roughly 30 hours of focus
 * before a user could see how their completions compared with their slip-ups.
 */

const COMPLETED_COLOR = '#cfe6b4'; // forest --fg-accent (validated)
const TERMINATED_COLOR = '#e0736b'; // --timer-danger (validated)

/** `timeline` is the shared daily Bucket[] built once by HistoryPage (E5). */
function ComparisonTile({ timeline = [] }) {
  const hasData = timeline.some((d) => d.total > 0);

  return (
    <section className="hp-tile hp-comparison" aria-labelledby="hp-comparison-heading">
      <header className="hp-tile__head hp-tile__head--stacked">
        <div>
          <h2 id="hp-comparison-heading" className="hp-tile__title">
            Completed vs terminated
          </h2>
          <p className="hp-tile__subtitle">Daily sessions, last 7 days</p>
        </div>
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
      </header>

      <div className="hp-tile__viz">
        {hasData ? (
          <ComparisonBarChart
            data={timeline}
            completedColor={COMPLETED_COLOR}
            terminatedColor={TERMINATED_COLOR}
          />
        ) : (
          <p className="hp-empty">
            No sessions recorded in the last 7 days. Your completed and terminated blocks will
            compare here.
          </p>
        )}
      </div>
    </section>
  );
}

export default ComparisonTile;
