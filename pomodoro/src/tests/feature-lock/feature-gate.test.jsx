import { act, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FeatureGate from '../../components/FeatureGate.jsx';
import { recordSession } from '../../store/timerSlice.js';
import { AuthTestProvider, EMPTY_GAMIFICATION } from '../helpers/authTestContext.jsx';

/*
 * Suite C2/C3 — feature-lock enforcement.
 *
 * Proves the "gated but previewable" rule: a feature whose title has not been earned still renders,
 * but its body is genuinely withdrawn from interaction rather than merely dimmed, it reports exactly
 * which title unlocks it and how far away that is, and it goes live the moment the points arrive.
 *
 * Component level: the real FeatureGate + useFeatureGate + gamification ladder, wrapped around a
 * neutral stub child. FeatureGate's contract is generic over its children, so the child here is a
 * bare <button> — pulling in a real settings panel would drag unrelated DOM into a lock test.
 *
 * Fixtures go through the store because that is where useFeatureGate reads lifetime points from.
 * They used to be seeded by writing to localStorage; points are the server's to award now
 * (CONTRACT.md §14.3 rule 1), so the client no longer has a local copy to seed.
 *
 * On `inert`: jsdom renders the attribute but does not implement its semantics — a control inside an
 * inert subtree is still queryable, still focusable, and its onClick still fires under fireEvent. So
 * actuation is asserted STRUCTURALLY (the attribute is on the body wrapper and the control sits
 * inside that subtree), which is the part the app actually owns; the blocking of pointer, keyboard,
 * and assistive tech is the browser's side of the contract. Asserting "clicking a locked control
 * does nothing" here would only be testing jsdom.
 */

// Ladder facts under test (services/gamification.js):
//   themeEditor -> The Anchor  @  1,000 lifetime points
//   scheduling  -> The Paragon @ 16,000 lifetime points
const THEME_EDITOR_TITLE = 'Theme editor';
const SCHEDULING_TITLE = 'Scheduling';
const DESCRIPTION = 'Recolour the forest palette to make the app your own.';
const CHILD_LABEL = 'Save palette';

let store;

function renderGate(feature, title, lifetimePoints) {
  return render(
    <AuthTestProvider
      timer={{ gamification: { ...EMPTY_GAMIFICATION, lifetimePoints, balance: lifetimePoints } }}
      onStore={(created) => {
        store = created;
      }}
    >
      <FeatureGate feature={feature} title={title} description={DESCRIPTION}>
        <button type="button">{CHILD_LABEL}</button>
      </FeatureGate>
    </AuthTestProvider>
  );
}

// The chips carry no role, so they are located the way TimerPage's tests locate classless nodes: by
// exact className. Everything else uses accessible queries; the body wrapper is a plain <div> and
// has to be reached through the container.
const byClass = (className) => (_, element) => element?.className === className;

function q(container) {
  const scope = within(container);
  return {
    body: () => container.querySelector('.feature-section__body'),
    control: () => scope.getByRole('button', { name: CHILD_LABEL }),
    heading: (title) => scope.getByRole('heading', { level: 2, name: title }),
    description: () => scope.getByText(DESCRIPTION),
    hint: () => scope.queryByRole('note'),
    lockChip: () => scope.queryByText(byClass('feature-chip feature-chip--locked')),
    unlockedChip: () => scope.queryByText(byClass('feature-chip feature-chip--unlocked')),
  };
}

describe('Suite C2 — Feature-lock enforcement', () => {
  it('C2.1 — withdraws a locked feature from interaction while its heading stays readable', () => {
    const { container } = renderGate('themeEditor', THEME_EDITOR_TITLE, 0);
    const ui = q(container);

    // Enforcement, not decoration: the body wrapper itself is inert...
    expect(ui.body()).toHaveAttribute('inert');
    // ...and the feature's own control is inside that subtree, which is what makes a real browser
    // refuse pointer, keyboard, and AT access to it.
    expect(ui.control().closest('[inert]')).toBe(ui.body());

    // The locked affordance is present and names the gate.
    expect(ui.lockChip()).toBeInTheDocument();
    expect(ui.lockChip()).toHaveTextContent('The Anchor');
    expect(ui.unlockedChip()).toBeNull();

    // Documented design intent: heading, description, and unlock hint live outside the inert
    // subtree so they stay readable and announced.
    expect(ui.heading(THEME_EDITOR_TITLE).closest('[inert]')).toBeNull();
    expect(ui.description().closest('[inert]')).toBeNull();
    expect(ui.hint().closest('[inert]')).toBeNull();
  });

  it('C2.2 — reports the required title, its threshold, and the points still to go', () => {
    const first = renderGate('themeEditor', THEME_EDITOR_TITLE, 0);
    const anchor = q(first.container);

    expect(anchor.lockChip()).toHaveTextContent('The Anchor');
    expect(anchor.hint()).toHaveTextContent(
      'Reach The Anchor at 1,000 lifetime points to unlock — 1,000 to go.'
    );
    expect(anchor.hint().textContent).not.toMatch(/-\d/);
    first.unmount();

    // A second tier with a mid-ladder total, so the subtraction and the thousands grouping are
    // genuinely exercised: 16,000 - 4,500 = 11,500.
    const second = renderGate('scheduling', SCHEDULING_TITLE, 4500);
    const paragon = q(second.container);

    expect(paragon.lockChip()).toHaveTextContent('The Paragon');
    expect(paragon.hint()).toHaveTextContent(
      'Reach The Paragon at 16,000 lifetime points to unlock — 11,500 to go.'
    );
    expect(paragon.hint().textContent).not.toMatch(/-\d/);
    second.unmount();

    // remaining = max(0, threshold - lifetimePoints) can never surface as a negative countdown: at
    // those same 4,500 points the 1,000-point tier is reported as earned rather than as
    // "-3,500 to go".
    const earned = q(renderGate('themeEditor', THEME_EDITOR_TITLE, 4500).container);
    expect(earned.hint()).toBeNull();
    expect(earned.lockChip()).toBeNull();
  });
});

describe('Suite C3 — Unlock on award', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('C3.1 — goes live on the response that awards the points, without a remount', () => {
    const view = renderGate('themeEditor', THEME_EDITOR_TITLE, 900);
    const ui = q(view.container);

    // A hundred points short.
    expect(ui.body()).toHaveAttribute('inert');
    expect(ui.lockChip()).toBeInTheDocument();
    expect(ui.hint()).toHaveTextContent('100 to go');

    /*
     * The award as the app actually receives it: the recorded-session response carries the new
     * totals, so the unlock arrives with the same message that earned it.
     */
    act(() => {
      store.dispatch(
        recordSession.fulfilled(
          {
            session: {
              clientSessionId: 'block-1',
              id: 'server-1',
              type: 'focus',
              status: 'completed',
              pointsAwarded: 150,
              syncState: 'synced',
            },
            gamification: {
              ...EMPTY_GAMIFICATION,
              lifetimePoints: 1050,
              balance: 1050,
              unlockedTitles: ['The Anchor'],
            },
          },
          'req-1',
          {}
        )
      );
    });

    /*
     * THE POINT OF THIS TEST (defect F7). The gate used to read lifetime points once, in a
     * mount-only initializer, so a title earned on the Timer page stayed invisible until something
     * happened to remount the gate — the app awarded a reward and then refused to admit it.
     * Subscribing to the store is what makes the unlock observable where it is earned.
     */
    expect(ui.body()).not.toHaveAttribute('inert');
    expect(ui.control().closest('[inert]')).toBeNull();
    expect(ui.lockChip()).toBeNull();
    expect(ui.hint()).toBeNull();
    expect(ui.unlockedChip()).toHaveTextContent('Unlocked');
  });
});
