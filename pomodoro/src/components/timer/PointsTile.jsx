import TitleBadge from '../TitleBadge.jsx';

/*
 * PointsTile — top-right tile: the gamified productivity hub.
 *
 * Presentational: reflects the gamification tally maintained by TimerPage. Shows
 * the spendable point score (penalty-affected balance), the current title with a
 * progress bar toward the next threshold (driven by lifetime points, which never
 * regress), a daily progress bar toward a session goal, and a row of streak
 * "milestone" dots that glow as the +50 bonus interval (every `bonusEvery`
 * completions) is reached.
 */

function PointsTile({
  points,
  lifetimePoints,
  streak,
  completedCount,
  terminatedCount,
  lastDelta,
  dailyGoal,
  bonusEvery,
}) {
  const goalReached = Math.min(completedCount, dailyGoal);
  const progressPct = dailyGoal > 0 ? Math.round((goalReached / dailyGoal) * 100) : 0;
  // How far into the current bonus cycle the streak is (0..bonusEvery).
  const cycleFilled = streak === 0 ? 0 : ((streak - 1) % bonusEvery) + 1;
  const dots = Array.from({ length: bonusEvery }, (_, i) => i < cycleFilled);

  const deltaLabel = lastDelta > 0 ? `+${lastDelta}` : lastDelta < 0 ? `${lastDelta}` : '—';
  const deltaTone = lastDelta > 0 ? 'up' : lastDelta < 0 ? 'down' : 'flat';

  return (
    <section className="timer-tile points-tile" aria-labelledby="points-heading">
      <header className="timer-tile__head">
        <h2 id="points-heading" className="timer-tile__title">
          Momentum
        </h2>
        <span className={`points-tile__delta points-tile__delta--${deltaTone}`}>{deltaLabel}</span>
      </header>

      <p className="points-tile__score">
        <span className="points-tile__score-value">{points}</span>
        <span className="points-tile__score-unit">pts</span>
      </p>

      <TitleBadge lifetimePoints={lifetimePoints} />

      <dl className="points-tile__stats">
        <div className="points-tile__stat">
          <dt>Streak</dt>
          <dd>{streak}</dd>
        </div>
        <div className="points-tile__stat">
          <dt>Completed</dt>
          <dd>{completedCount}</dd>
        </div>
        <div className="points-tile__stat">
          <dt>Terminated</dt>
          <dd>{terminatedCount}</dd>
        </div>
      </dl>

      <div className="points-tile__goal">
        <div className="points-tile__goal-label">
          <span>Daily goal</span>
          <span>
            {goalReached}/{dailyGoal} sessions
          </span>
        </div>
        <div
          className="points-tile__bar"
          role="progressbar"
          aria-valuenow={goalReached}
          aria-valuemin={0}
          aria-valuemax={dailyGoal}
          aria-label="Daily focus sessions completed"
        >
          <span className="points-tile__bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="points-tile__milestones">
        <span className="points-tile__milestones-label">
          Next +50 bonus at {bonusEvery} in a row
        </span>
        <ul className="points-tile__dots" aria-hidden="true">
          {dots.map((filled, i) => (
            <li key={i} className={`points-tile__dot${filled ? ' points-tile__dot--on' : ''}`} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default PointsTile;
