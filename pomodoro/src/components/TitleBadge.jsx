import { currentTitle, progressToNext } from '../services/gamification.js';
import '../styles/TitleBadge.css';

/*
 * TitleBadge — the player's current rank and progress toward the next title.
 *
 * Presentational: given the LIFETIME point total (which never regresses on a
 * terminate penalty — see services/gamification.js), it names the highest title
 * earned and renders a progress bar toward the next threshold, plus how many
 * lifetime points remain. Once every title is earned the bar reads as complete.
 *
 * TITLES ARE IDENTITY, NOT ACCESS (CONTRACT.md §9.5). A title used to unlock one
 * previewable feature, so this badge doubled as a hint of what was about to open
 * up. Nothing is gated by points any more — the copy below says "top rank"
 * rather than "all features unlocked" because the latter would promise a payload
 * that no longer exists. The cosmetic ladder (N5) is what gives it one back.
 */
function TitleBadge({ lifetimePoints = 0 }) {
  const title = currentTitle(lifetimePoints);
  const { next, percent, remaining } = progressToNext(lifetimePoints);
  const rank = title ? title.name : 'Unranked';

  return (
    <section className="title-badge" aria-label="Title progress">
      <div className="title-badge__head">
        <span className="title-badge__rank">{rank}</span>
        <span className="title-badge__next">{next ? `Next · ${next.name}` : 'Max rank'}</span>
      </div>

      <div
        className="title-badge__bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={next ? `Progress toward ${next.name}` : 'All titles earned'}
      >
        <span className="title-badge__bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="title-badge__meta">
        {next
          ? `${remaining.toLocaleString()} lifetime pts to ${next.name}`
          : 'Every title earned — you are at the top rank.'}
      </p>
    </section>
  );
}

export default TitleBadge;
