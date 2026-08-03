import { memo } from 'react';
import '../styles/StreakFreezeStatus.css';

/*
 * StreakFreezeStatus — how protected the day streak is, rendered wherever the day streak is
 * (CONTRACT.md §14.6). Shared rather than duplicated per surface: the five states, their copy and
 * their pluralisation are real behaviour, and two divergent copies of it would eventually disagree
 * about what "no freezes left" means.
 *
 * PRESENTATIONAL AND STORE-FREE, so it can sit in a Timer tile that knows hydration state and in a
 * History tile that deliberately does not (§17.4). The `status` prop is optional: given only a
 * count it derives available/none, which is all History can honestly say.
 *
 * IT SPEAKS ABOUT THE DAY STREAK ONLY (§14.2). A freeze protects `currentDayStreak`; it has no
 * bearing on `currentSessionRun`, which resets on a termination and is not what the copy here
 * refers to.
 *
 * Self-contained clamp sizing, like TitleBadge: it depends on the shell's --fg-* / --glass-* tokens
 * only, never on a host page's local type scale, so it drops into either dashboard unchanged.
 */

/** Tone per state. Never the sole carrier of meaning — every state also reads differently. */
const TONES = {
  loading: 'muted',
  error: 'bad',
  consumed: 'warn',
  available: 'good',
  none: 'bad',
};

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

/** The headline and supporting line for a state, in the user's language. */
function copyFor(status, { available, spent, dayStreak }) {
  const streakPhrase = `${dayStreak}-day streak`;

  switch (status) {
    case 'loading':
      return { headline: 'Streak protection', detail: 'Checking your freezes…' };

    case 'error':
      return {
        headline: 'Streak protection unavailable',
        detail: 'We could not load your freeze count.',
      };

    case 'consumed':
      return {
        headline: `${spent} streak ${plural(spent, 'freeze', 'freezes')} used`,
        detail:
          dayStreak > 0
            ? `A missed day was covered — your ${streakPhrase} is still going. ${available} ${plural(available, 'freeze', 'freezes')} left.`
            : `A missed day was covered. ${available} ${plural(available, 'freeze', 'freezes')} left.`,
      };

    case 'available':
      return {
        headline: `${available} streak ${plural(available, 'freeze', 'freezes')} ready`,
        detail:
          dayStreak > 0
            ? `Miss a day and one is spent to keep your ${streakPhrase} alive.`
            : 'Once you start a streak, a freeze covers one missed day.',
      };

    default:
      return {
        headline: 'No streak freezes left',
        detail:
          dayStreak > 0
            ? `A missed day will end your ${streakPhrase}.`
            : 'A missed day will reset your streak.',
      };
  }
}

function StreakFreezeStatus({
  status,
  available = 0,
  spent = 0,
  dayStreak = 0,
  onRetry = null,
  onDismiss = null,
}) {
  // Given no explicit status, the count is the only thing that can be said — which is exactly what
  // a surface with no hydration knowledge has to work with.
  const state = status ?? (available > 0 ? 'available' : 'none');
  const tone = TONES[state] ?? 'muted';
  const { headline, detail } = copyFor(state, { available, spent, dayStreak });

  return (
    /*
     * A live region, not a role toggled per state: the section mounts with the page, so its initial
     * content is not announced, and only a real transition — a freeze being spent, or the count
     * finally arriving — reaches the user.
     */
    <section
      className={`streak-freeze streak-freeze--${tone}`}
      aria-label="Streak freeze status"
      aria-live="polite"
      aria-busy={state === 'loading' || undefined}
    >
      <p className="streak-freeze__head">
        <span className="streak-freeze__dot" aria-hidden="true" />
        <span className="streak-freeze__headline">{headline}</span>
      </p>

      {state === 'loading' ? (
        <span className="streak-freeze__skeleton" aria-hidden="true" />
      ) : (
        <p className="streak-freeze__detail">{detail}</p>
      )}

      {state === 'error' && onRetry && (
        <button type="button" className="streak-freeze__action" onClick={onRetry}>
          Try again
        </button>
      )}

      {state === 'consumed' && onDismiss && (
        <button type="button" className="streak-freeze__action" onClick={onDismiss}>
          Got it
        </button>
      )}
    </section>
  );
}

export default memo(StreakFreezeStatus);
