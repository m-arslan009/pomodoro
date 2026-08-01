import { fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrendTile from '../../components/history/TrendTile.jsx';
import { AuthTestProvider, EMPTY_GAMIFICATION } from '../helpers/authTestContext.jsx';

/*
 * Suite C2.3 — an unlocked title-gated tile is fully live, not merely undimmed.
 *
 * Proves the other half of the "gated but previewable" rule: once the required title is earned, the
 * gate must hand the feature back whole — the chart body stops being withdrawn from interaction,
 * the lock affordance disappears, and the feature's OWN control returns in working order. "Restored
 * capability" is the business claim, so the control is exercised rather than merely counted.
 *
 * Integration level: the real TrendTile + GatedTile + useFeatureGate + gamification ladder.
 * TrendTile is used instead of a stub child because it is a genuine Catalyst-gated consumer whose
 * `meta` is the Daily/Weekly/Monthly interval selector — the thing a locked tile withholds and an
 * unlocked tile owes back.
 *
 * Fixtures go through the store because that is where useFeatureGate reads lifetime points from.
 * Two independent mounts rather than one live transition: what is under test here is the RESTORED
 * state of the tile, and the live transition itself is C3.1's subject.
 *
 * On `inert`: jsdom renders the attribute but does not implement its semantics, so an inert subtree
 * stays queryable and clickable there. The locked baseline is therefore asserted STRUCTURALLY
 * (attribute present) and the unlocked state by its absence; the click assertion below is
 * meaningful precisely because it happens outside any inert subtree.
 *
 * No ResizeObserver stub: useElementWidth bails out when the API is missing, so the chart measures
 * 0px and degrades to an empty wrapper. That is deliberate — the tile's gating contract is what is
 * under test, not its pixel geometry.
 */

// Ladder fact under test (services/gamification.js):
//   timeUtilization -> The Catalyst @ 4,000 lifetime points
const CATALYST = 'The Catalyst';
const THRESHOLD = 4000;

// A fixed *local* Thursday 09:00 so buildTimeline's clock-derived buckets are deterministic: the
// daily window opens at Mon Jan 12 − 3 days = Fri Jan 9 00:00, and the weekly window reaches back
// six Mondays to Dec 8 2025.
const NOW = new Date(2026, 0, 15, 9, 0, 0);

// Ended Mon Jan 5 — outside the 7-day daily window, inside the 6-week weekly one. So the same
// session list is empty as "Daily" and populated as "Weekly", which makes a change of interval
// observable in the tile body itself.
const STALE_SESSION = {
  clientSessionId: 's-stale',
  id: 'server-stale',
  taskId: 'task-1',
  taskTitle: 'Draft the retrospective',
  type: 'focus',
  status: 'completed',
  startedAt: new Date(2026, 0, 5, 8, 35, 0).toISOString(),
  endedAt: new Date(2026, 0, 5, 9, 0, 0).toISOString(),
  plannedDurationMs: 25 * 60 * 1000,
  actualDurationMs: 25 * 60 * 1000,
  terminationReason: null,
  pointsAwarded: 100,
  syncState: 'synced',
};

const EMPTY_RANGE_TEXT =
  'No completed sessions in this range yet. Finish a focus session to start your trend.';

function renderTile(lifetimePoints) {
  return render(
    <AuthTestProvider
      timer={{ gamification: { ...EMPTY_GAMIFICATION, lifetimePoints, balance: lifetimePoints } }}
    >
      <TrendTile sessions={[STALE_SESSION]} />
    </AuthTestProvider>
  );
}

// The lock chip carries no role, so it is located by exact className the way the sibling FeatureGate
// suite locates its chips. The tile body is a plain <div> and has to be reached through the
// container; everything else is accessible.
const byClass = (className) => (_, element) => element?.className === className;

function q(container) {
  const scope = within(container);
  const intervals = () => scope.queryByRole('group', { name: 'Trend interval' });
  return {
    body: () => container.querySelector('.hp-tile__viz'),
    intervals,
    interval: (label) => within(intervals()).getByRole('button', { name: label }),
    hint: () => scope.queryByRole('note'),
    lockChip: () => scope.queryByText(byClass('hp-lock-chip')),
    emptyRange: () => scope.queryByText(EMPTY_RANGE_TEXT),
  };
}

describe('Suite C2 — Unlocked feature restoration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('C2.3 — hands the interval control back in working order once The Catalyst is earned', () => {
    // Baseline, one point short of the title: the contrast that makes the unlocked assertions below
    // mean "restored", not just "rendered".
    const lockedView = renderTile(THRESHOLD - 1);
    const locked = q(lockedView.container);

    expect(locked.intervals()).toBeNull();
    expect(locked.body()).toHaveAttribute('inert');
    expect(locked.lockChip()).toHaveTextContent(CATALYST);
    expect(locked.hint()).toHaveTextContent(
      'Reach The Catalyst at 4,000 lifetime points to unlock — 1 to go.'
    );

    lockedView.unmount();

    // Exactly at the threshold — isFeatureUnlocked compares with >=, so the boundary itself must
    // already be live.
    const unlocked = q(renderTile(THRESHOLD).container);

    // The body is no longer withdrawn from pointer, keyboard, and AT access.
    expect(unlocked.body()).not.toHaveAttribute('inert');

    // The lock affordance is gone entirely — no chip, no unlock hint.
    expect(unlocked.lockChip()).toBeNull();
    expect(unlocked.hint()).toBeNull();

    // The feature's own control is back, with its full set of intervals and Daily selected, and it
    // sits outside the (now absent) inert subtree.
    expect(unlocked.intervals()).toBeInTheDocument();
    expect(unlocked.interval('Daily')).toHaveAttribute('aria-pressed', 'true');
    expect(unlocked.interval('Weekly')).toHaveAttribute('aria-pressed', 'false');
    expect(unlocked.interval('Monthly')).toHaveAttribute('aria-pressed', 'false');
    expect(unlocked.intervals().closest('[inert]')).toBeNull();

    // Actionable, not merely present: the seeded session is 10 days old, so the daily range is empty
    // until the interval actually changes.
    expect(unlocked.emptyRange()).toBeInTheDocument();

    fireEvent.click(unlocked.interval('Weekly'));

    // The selection moved...
    expect(unlocked.interval('Weekly')).toHaveAttribute('aria-pressed', 'true');
    expect(unlocked.interval('Daily')).toHaveAttribute('aria-pressed', 'false');
    expect(unlocked.interval('Monthly')).toHaveAttribute('aria-pressed', 'false');
    // ...and the tile re-bucketed its series, so the session now falls in range.
    expect(unlocked.emptyRange()).toBeNull();
  });
});
