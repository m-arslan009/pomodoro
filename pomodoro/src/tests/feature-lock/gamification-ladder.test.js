import { TITLES, currentTitle, progressToNext, titlesFor } from '../../services/gamification.js';

/*
 * Suite C1/C4 — the title ladder in services/gamification.js.
 * (Formerly Suite D1/D4; renumbered to C after the points-engine suite was
 * dropped from the implemented set.)
 *
 * Unit level: these are pure functions of a lifetime-point total, so no DOM,
 * storage, or timers are involved. The suite proves the three rules the rest of
 * the app leans on: a threshold is reached *at* its value (not one point later),
 * tiers are earned cumulatively and strictly in order, and a rank's progress is
 * measured from the rung below it rather than from zero.
 *
 * Thresholds are read from the exported TITLES config instead of being restated
 * here, so re-balancing the economy re-points these tests rather than breaking
 * them.
 *
 * TITLES ARE IDENTITY, NOT ACCESS (CONTRACT.md §9.6). This suite once also
 * covered `isFeatureUnlocked` and asserted each title's `feature` key. Gating was
 * deleted outright on 2026-08-03 — no product surface is withheld from any
 * authenticated user — and the function and field went with it. What survives is
 * the ladder arithmetic, which still drives TitleBadge. C1.1's key assertion is
 * now what pins this mirror to backend/src/domain/gamification.ts (§14). Read
 * these cases as "the ladder resolves correctly", never as "these features are
 * locked" — nothing is.
 */

describe('Suite C1 — Threshold & tier ladder', () => {
  it('C1.1 — earns each title exactly at its threshold, never one point earlier', () => {
    // Guards the loops below against a vacuous pass, and pins the mirror: the
    // ladder is these five tiers, in this order, whatever the thresholds are
    // tuned to. The backend's TITLES must agree key-for-key (§14).
    expect(TITLES.map((title) => title.key)).toEqual([
      'anchor',
      'paceSetter',
      'catalyst',
      'vanguard',
      'paragon',
    ]);

    TITLES.forEach(({ key, threshold }) => {
      // One point short is still short — a partially earned rung grants nothing.
      expect(titlesFor(threshold - 1)).not.toContain(key);
      // The comparison is inclusive: landing exactly on the threshold promotes.
      expect(titlesFor(threshold)).toContain(key);
    });
  });

  it('C1.2 — earns every tier up to the reached one and no tier beyond it', () => {
    // 4000 lifetime points is exactly The Catalyst's rung: the three tiers at or
    // below it resolve as earned, and the two above it do not, even though the
    // user is well past the first threshold.
    //
    // Ascending order matters: the earned set is a prefix of the ladder, so a
    // higher tier can never leak in ahead of a lower one it outranks.
    expect(titlesFor(4000)).toEqual(['anchor', 'paceSetter', 'catalyst']);
    expect(titlesFor(4000)).not.toContain('vanguard');
    expect(titlesFor(4000)).not.toContain('paragon');
  });
});

describe('Suite C4 — Title resolution & progress', () => {
  it('C4.1 — resolves the earned title and measures progress from the previous rung', () => {
    // Below the first threshold there is no title at all — the null the badge
    // renders as "Unranked" — while the first rung is already the stated goal.
    expect(currentTitle(0)).toBeNull();
    expect(progressToNext(0)).toMatchObject({
      current: null,
      next: TITLES[0],
      percent: 0,
      remaining: TITLES[0].threshold,
    });

    // Still unranked one point short of the first rung, with exactly that one
    // point left to earn.
    expect(currentTitle(999)).toBeNull();
    expect(progressToNext(999)).toMatchObject({ current: null, next: TITLES[0], remaining: 1 });

    // Just promoted to The Anchor (1000): progress toward The Pace Setter
    // restarts at 0%, because it counts from the 1000 floor. Measured from zero
    // it would read 50%.
    expect(currentTitle(1000)).toBe(TITLES[0]);
    expect(progressToNext(1000)).toMatchObject({
      current: TITLES[0],
      next: TITLES[1],
      percent: 0,
      remaining: 1000,
    });

    // Mid-ladder at 3000: the highest *earned* title is The Pace Setter (2000),
    // not the next one in sight. percent = (3000 - 2000) / (4000 - 2000) = 50%,
    // whereas measuring from zero would read 75%.
    expect(currentTitle(3000)).toBe(TITLES[1]);
    expect(progressToNext(3000)).toMatchObject({
      current: TITLES[1],
      next: TITLES[2],
      percent: 50,
      remaining: 1000,
    });

    // At the top rung and beyond, the ladder is exhausted: there is nothing left
    // to progress toward, so the bar pins at 100% with nothing remaining.
    expect(currentTitle(16000)).toBe(TITLES[4]);
    expect(progressToNext(16000)).toEqual({
      current: TITLES[4],
      next: null,
      percent: 100,
      remaining: 0,
    });

    // Extra points past the top rung never regress or re-open the ladder.
    expect(currentTitle(25000)).toBe(TITLES[4]);
    expect(progressToNext(25000)).toEqual({
      current: TITLES[4],
      next: null,
      percent: 100,
      remaining: 0,
    });
  });
});
