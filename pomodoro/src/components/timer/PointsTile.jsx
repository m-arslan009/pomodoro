import { memo } from 'react';
import StreakFreezeStatus from '../StreakFreezeStatus.jsx';
import TitleBadge from '../TitleBadge.jsx';

/*
 * PointsTile — top-right tile: the gamified productivity hub.
 *
 * Presentational: reflects the gamification tally maintained by TimerPage.
 *
 * IT RENDERS LIFETIME POINTS (CONTRACT.md §14.3 rule 2). Lifetime is what drives
 * the title ladder and what never decreases, so it is the number that means
 * something to a player. `balance` exists in the model only so a future spending
 * sink can arrive without a migration; while nothing subtracts, the two are equal
 * and showing both would be showing the same number twice.
 *
 * THE TWO STREAKS ARE DIFFERENT THINGS (§14.2). `dayStreak` — consecutive days
 * with a completed session — is the one worth celebrating, so it gets the stat
 * slot. `sessionRun` is internal to the economy and surfaces only as the milestone
 * dots, because its whole job is to say "one more for +50".
 *
 * STREAK PROTECTION SITS WITH THE STREAK (§14.6). The freeze panel goes directly
 * under the stats grid rather than in a corner of its own: a freeze count means
 * nothing except in relation to the day streak it protects, and this is the tile
 * that owns the day streak. It is also the surface that knows whether the points
 * read is loading or failed, so it is the one that can render those states.
 *
 * Memoised: it re-renders once a session, but sits beside a countdown that used to
 * push new props at it four times a second (defect F6).
 */

function PointsTile({
  lifetimePoints,
  dayStreak,
  sessionRun,
  completedCount,
  terminatedCount,
  lastDelta,
  dailyGoal,
  bonusEvery,
  streakFreeze,
  onRetryStreakFreeze,
  onDismissStreakFreeze,
}) {
  const goalReached = Math.min(completedCount, dailyGoal);
  const progressPct = dailyGoal > 0 ? Math.round((goalReached / dailyGoal) * 100) : 0;
  // How far into the current bonus cycle the run is (0..bonusEvery).
  const cycleFilled = sessionRun === 0 ? 0 : ((sessionRun - 1) % bonusEvery) + 1;
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
        <span className="points-tile__score-value">{lifetimePoints.toLocaleString()}</span>
        <span className="points-tile__score-unit">pts</span>
      </p>

      <TitleBadge lifetimePoints={lifetimePoints} />

      <dl className="points-tile__stats">
        <div className="points-tile__stat">
          <dt>Day streak</dt>
          <dd>{dayStreak}</dd>
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

      <StreakFreezeStatus
        status={streakFreeze?.status}
        available={streakFreeze?.available ?? 0}
        spent={streakFreeze?.spent ?? 0}
        dayStreak={dayStreak}
        onRetry={onRetryStreakFreeze}
        onDismiss={onDismissStreakFreeze}
      />

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

export default memo(PointsTile);
