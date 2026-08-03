import StreakFreezeStatus from '../StreakFreezeStatus.jsx';

/*
 * SummaryTile — the high-level KPI header. A hero point figure anchors the tile,
 * with the day streak beside it, the five status metrics in an auto-fitting grid
 * so they never crowd at intermediate widths, and a completion-rate bar. Fluid
 * type keeps every value legible from mobile up.
 *
 * IT RENDERS EVERY FIELD OF `Summary` (CONTRACT.md §17.1). That is a rule, not a
 * layout preference: the shape is fixed at the seam precisely so a field cannot be
 * computed and then quietly dropped, which is how the day streak came to be
 * calculated on every render and shown nowhere, and how `longestDayStreak` was
 * fetched from the server for a tile that never mentioned it (defect F14).
 *
 * The task counts are the same three buckets OutcomeTile draws, so the tile and
 * the chart beside it cannot disagree about the same tasks.
 *
 * STREAK PROTECTION IS SHOWN AS A COUNT ONLY (§14.6). The panel's loading, error
 * and just-consumed states belong to hydration, and hydration belongs to the shell
 * (§17.4) — this page has no status branch by design, so handing it one here would
 * reintroduce exactly what §17.4 removed. The Timer's PointsTile renders those
 * states; here the count travels inside `Summary` like the two streaks it protects.
 */

function SummaryTile({ summary }) {
  const {
    points,
    currentDayStreak,
    longestDayStreak,
    streakFreezesAvailable,
    completedSessions,
    terminatedSessions,
    completedTasks,
    openTasks,
    abandonedTasks,
    completionRate,
    focusMinutes,
  } = summary;

  const kpis = [
    { label: 'Completed sessions', value: completedSessions, tone: 'good' },
    { label: 'Terminated sessions', value: terminatedSessions, tone: 'bad' },
    { label: 'Completed tasks', value: completedTasks, tone: 'good' },
    { label: 'Open tasks', value: openTasks, tone: 'muted' },
    { label: 'Abandoned tasks', value: abandonedTasks, tone: 'bad' },
  ];

  return (
    <section className="hp-tile hp-summary" aria-labelledby="hp-summary-heading">
      <header className="hp-tile__head">
        <h2 id="hp-summary-heading" className="hp-tile__title">
          Overview
        </h2>
        <span className="hp-tile__meta">{focusMinutes} min focused</span>
      </header>

      <div className="hp-summary__hero">
        <div>
          <p className="hp-summary__score">
            <span className="hp-summary__score-value">{points.toLocaleString()}</span>
            <span className="hp-summary__score-unit">pts</span>
          </p>
          <p className="hp-summary__score-caption">Lifetime points earned</p>
        </div>

        {/*
          The DISPLAYED streak is the day streak (§14.2) — consecutive days with at least one
          completed session. The session run that fires the +50 bonus is internal and belongs to
          PointsTile's milestone dots, not here.
        */}
        <div className="hp-summary__streak">
          <p className="hp-summary__streak-value">
            {currentDayStreak}
            <span className="hp-summary__streak-unit">
              {currentDayStreak === 1 ? ' day' : ' days'}
            </span>
          </p>
          <p className="hp-summary__score-caption">
            Current streak
            {longestDayStreak > 0 && (
              <span className="hp-summary__streak-best"> · best {longestDayStreak}</span>
            )}
          </p>
        </div>
      </div>

      <StreakFreezeStatus available={streakFreezesAvailable} dayStreak={currentDayStreak} />

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
  );
}

export default SummaryTile;
