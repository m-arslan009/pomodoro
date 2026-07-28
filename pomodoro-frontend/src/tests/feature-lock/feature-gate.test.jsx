import { render, within } from '@testing-library/react';
import FeatureGate from '../../components/FeatureGate.jsx';
import { saveGamification } from '../../services/storage.js';

/*
 * Suite C2/C3 — feature-lock enforcement.
 * (Formerly Suite D2/D3; renumbered to C after the points-engine suite was
 * dropped from the implemented set.)
 *
 * Proves the "gated but previewable" rule: a feature whose title has not been
 * earned still renders, but its body is genuinely withdrawn from interaction
 * rather than merely dimmed, it reports exactly which title unlocks it and how
 * far away that is, and it only becomes live on a mount that sees enough
 * lifetime points.
 *
 * Component level: the real FeatureGate + useFeatureGate + gamification ladder,
 * wrapped around a neutral stub child. FeatureGate's contract is generic over
 * its children, so the child here is a bare <button> — pulling in a real settings
 * panel would drag unrelated DOM and storage side effects into a lock test.
 *
 * Fixtures go through services/storage.js because useFeatureGate hydrates from it
 * in a `useState` initializer.
 *
 * On `inert`: jsdom renders the attribute but does not implement its semantics —
 * a control inside an inert subtree is still queryable, still focusable, and its
 * onClick still fires under fireEvent. So actuation is asserted STRUCTURALLY
 * (the attribute is on the body wrapper and the control sits inside that
 * subtree), which is the part the app actually owns; the blocking of pointer,
 * keyboard, and assistive tech is the browser's side of the contract. Asserting
 * "clicking a locked control does nothing" here would only be testing jsdom.
 */

// Ladder facts under test (services/gamification.js):
//   themeEditor -> The Anchor  @  1,000 lifetime points
//   scheduling  -> The Paragon @ 16,000 lifetime points
const THEME_EDITOR_TITLE = 'Theme editor';
const SCHEDULING_TITLE = 'Scheduling';
const DESCRIPTION = 'Recolour the forest palette to make the app your own.';
const CHILD_LABEL = 'Save palette';

function gate(feature, title) {
  return (
    <FeatureGate feature={feature} title={title} description={DESCRIPTION}>
      <button type="button">{CHILD_LABEL}</button>
    </FeatureGate>
  );
}

// saveGamification clamps `lifetimePoints` monotonically upward, so a total can
// be raised inside a test but never lowered without clearing storage first.
function seedLifetimePoints(points) {
  saveGamification({
    points,
    streak: 0,
    balance: points,
    currentStreak: 0,
    lifetimePoints: points,
  });
}

// The chips carry no role, so they are located the way TimerPage's tests locate
// classless nodes: by exact className. Everything else uses accessible queries;
// the body wrapper is a plain <div> and has to be reached through the container.
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('C2.1 — withdraws a locked feature from interaction while its heading stays readable', () => {
    seedLifetimePoints(0);
    const { container } = render(gate('themeEditor', THEME_EDITOR_TITLE));
    const ui = q(container);

    // Enforcement, not decoration: the body wrapper itself is inert...
    expect(ui.body()).toHaveAttribute('inert');
    // ...and the feature's own control is inside that subtree, which is what
    // makes a real browser refuse pointer, keyboard, and AT access to it.
    expect(ui.control().closest('[inert]')).toBe(ui.body());

    // The locked affordance is present and names the gate.
    expect(ui.lockChip()).toBeInTheDocument();
    expect(ui.lockChip()).toHaveTextContent('The Anchor');
    expect(ui.unlockedChip()).toBeNull();

    // Documented design intent: heading, description, and unlock hint live
    // outside the inert subtree so they stay readable and announced.
    expect(ui.heading(THEME_EDITOR_TITLE).closest('[inert]')).toBeNull();
    expect(ui.description().closest('[inert]')).toBeNull();
    expect(ui.hint().closest('[inert]')).toBeNull();
  });

  it('C2.2 — reports the required title, its threshold, and the points still to go', () => {
    seedLifetimePoints(0);
    const first = render(gate('themeEditor', THEME_EDITOR_TITLE));
    const anchor = q(first.container);

    expect(anchor.lockChip()).toHaveTextContent('The Anchor');
    expect(anchor.hint()).toHaveTextContent(
      'Reach The Anchor at 1,000 lifetime points to unlock — 1,000 to go.'
    );
    expect(anchor.hint().textContent).not.toMatch(/-\d/);
    first.unmount();

    // A second tier with a mid-ladder total, so the subtraction and the
    // thousands grouping are genuinely exercised: 16,000 - 4,500 = 11,500.
    seedLifetimePoints(4500);
    const second = render(gate('scheduling', SCHEDULING_TITLE));
    const paragon = q(second.container);

    expect(paragon.lockChip()).toHaveTextContent('The Paragon');
    expect(paragon.hint()).toHaveTextContent(
      'Reach The Paragon at 16,000 lifetime points to unlock — 11,500 to go.'
    );
    expect(paragon.hint().textContent).not.toMatch(/-\d/);
    second.unmount();

    // remaining = max(0, threshold - lifetimePoints) can never surface as a
    // negative countdown: at those same 4,500 points the 1,000-point tier is
    // reported as earned rather than as "-3,500 to go".
    const earned = q(render(gate('themeEditor', THEME_EDITOR_TITLE)).container);
    expect(earned.hint()).toBeNull();
    expect(earned.lockChip()).toBeNull();
  });
});

describe('Suite C3 — Unlock on remount', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('C3.1 — unlocks on the next mount, not on a re-render of the mounted tree', () => {
    seedLifetimePoints(0);
    const view = render(gate('themeEditor', THEME_EDITOR_TITLE));
    const locked = q(view.container);

    expect(locked.body()).toHaveAttribute('inert');
    expect(locked.lockChip()).toBeInTheDocument();

    // Cross the threshold in storage while the tree stays mounted.
    seedLifetimePoints(1200);
    view.rerender(gate('themeEditor', THEME_EDITOR_TITLE));

    // Intentional constraint, not an accepted defect: useFeatureGate reads
    // lifetime points once, in a `useState` initializer, because points only
    // ever change on the Timer page. A re-render of the same mounted tree
    // therefore keeps the decision taken at mount time.
    expect(locked.body()).toHaveAttribute('inert');
    expect(locked.lockChip()).toBeInTheDocument();
    expect(locked.hint()).toHaveTextContent('Reach The Anchor at 1,000 lifetime points to unlock');

    view.unmount();

    // A fresh mount re-reads storage and sees the earned title.
    const unlocked = q(render(gate('themeEditor', THEME_EDITOR_TITLE)).container);

    expect(unlocked.body()).not.toHaveAttribute('inert');
    expect(unlocked.control().closest('[inert]')).toBeNull();
    expect(unlocked.lockChip()).toBeNull();
    expect(unlocked.hint()).toBeNull();
    expect(unlocked.unlockedChip()).toHaveTextContent('Unlocked');
  });
});
