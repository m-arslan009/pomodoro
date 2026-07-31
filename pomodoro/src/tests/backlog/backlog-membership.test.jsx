import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimerPage from '../../pages/TimerPage.jsx';
import { AuthTestProvider } from '../helpers/authTestContext.jsx';
import { getTasks, saveGamification, saveSessions, saveTasks } from '../../services/storage.js';

/*
 * Suite B1 — backlog membership & timer binding.
 *
 * Integration level: the real TasksTile, AddTask, and timer hook wired together
 * by TimerPage. Proves the queue only ever surfaces unresolved work, that
 * selecting a task is what arms the engine, that a running block cannot be
 * re-pointed, and that a newly added task is born with the fields the expiry
 * engine depends on.
 *
 * Task, session and economy fixtures are seeded through services/storage.js because TimerPage
 * hydrates from it in `useState` initializers; records are read back from it for the field-level
 * assertions (id/status/createdAt) the DOM never shows.
 *
 * Durations are seeded through the store instead: preferences moved to the server
 * (CONTRACT.md §4.7), so AuthTestProvider preloads them the way login would.
 */

const WORK_MINUTES = 2;
const BREAK_MINUTES = 1;

// A fixed *local* 09:00 so seeded fixtures and anything created during the run
// land on the same calendar day in any timezone.
const START_TIME = new Date(2026, 0, 15, 9, 0, 0);

const HOUR_MS = 60 * 60 * 1000;

function isoAt(offsetMs) {
  return new Date(START_TIME.getTime() + offsetMs).toISOString();
}

function seed(tasks = []) {
  saveTasks(tasks);
  saveSessions([]);
  saveGamification({ points: 0, streak: 0, balance: 0, currentStreak: 0, lifetimePoints: 0 });
}

// Created an hour ago: inside both the 24h expiry window and the 7-day retention
// window, so reconcileTasks passes every fixture through untouched.
function task(id, title, status, extra = {}) {
  return { id, title, status, createdAt: isoAt(-HOUR_MS), ...extra };
}

// AppLayout reads the signed-in account and the account's preferences from the store; this suite
// is about the backlog, so both are supplied directly rather than through a real sign-in.
function renderTimerPage() {
  return render(
    <MemoryRouter>
      <AuthTestProvider settings={{ workMinutes: WORK_MINUTES, breakMinutes: BREAK_MINUTES }}>
        <TimerPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

const engineTile = () => screen.getByRole('region', { name: 'Session' });
const tasksTile = () => screen.getByRole('region', { name: /Today.s Focus/ });

// Each backlog row's binding control: "Focus" until bound, "Active" once bound.
function focusButton(title) {
  const row = within(tasksTile()).getByText(title).closest('li');
  return within(row).getByRole('button', { name: /^(Focus|Active)$/ });
}

function startButton() {
  return within(engineTile()).getByRole('button', { name: 'Start' });
}

function clickControl(name) {
  fireEvent.click(within(engineTile()).getByRole('button', { name }));
}

// The engine tile names its bound task, or prompts when nothing is bound.
function boundTaskText() {
  return within(engineTile()).getByText((_, element) => element?.className === 'timer-engine__task')
    .textContent;
}

describe('Suite B1 — Backlog membership & timer binding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('B1.1 — lists only unresolved tasks in Today’s Focus while retaining the resolved ones', () => {
    seed([
      task('t-1', 'Draft the report', 'todo'),
      task('t-2', 'Review the PR', 'completed', { endedAt: isoAt(-30 * 60 * 1000) }),
      task('t-3', 'Write the migration', 'terminated', { endedAt: isoAt(-20 * 60 * 1000) }),
      task('t-4', 'Answer the ticket', 'expired', { endedAt: isoAt(-10 * 60 * 1000) }),
      task('t-5', 'Plan the sprint', 'todo'),
    ]);
    renderTimerPage();

    const tile = within(tasksTile());

    // Only the two `todo` tasks are queued...
    expect(tile.getByText('Draft the report')).toBeInTheDocument();
    expect(tile.getByText('Plan the sprint')).toBeInTheDocument();
    expect(tile.getAllByRole('listitem')).toHaveLength(2);
    expect(tile.getByText('2 left')).toBeInTheDocument();

    // ...every resolved status is dequeued, regardless of how it resolved.
    expect(tile.queryByText('Review the PR')).not.toBeInTheDocument();
    expect(tile.queryByText('Write the migration')).not.toBeInTheDocument();
    expect(tile.queryByText('Answer the ticket')).not.toBeInTheDocument();

    // Dequeued is not deleted: all five records survive in the task record with
    // their outcome intact, so the stats layer can still read them.
    const stored = getTasks();
    expect(stored).toHaveLength(5);
    expect(stored.map((t) => t.status)).toEqual([
      'todo',
      'completed',
      'terminated',
      'expired',
      'todo',
    ]);
  });

  it('B1.2 — binds a selected task to the timer and enables Start', () => {
    seed([task('t-1', 'Draft the report', 'todo')]);
    renderTimerPage();

    // Before selection the engine has nothing to run.
    expect(boundTaskText()).toBe('Pick a task to begin');
    expect(startButton()).toBeDisabled();
    expect(
      within(engineTile()).getByText(/Select a task from Today.s Focus to enable Start/)
    ).toBeInTheDocument();

    fireEvent.click(focusButton('Draft the report'));

    // The task is now the active one — the row reports it and cannot re-select
    // itself, the engine names it, and Start is armed.
    const bound = focusButton('Draft the report');
    expect(bound).toHaveTextContent('Active');
    expect(bound).toHaveAttribute('aria-pressed', 'true');
    expect(bound).toBeDisabled();

    expect(boundTaskText()).toBe('Draft the report');
    expect(startButton()).toBeEnabled();
  });

  it('B1.3 — freezes task binding while a session is running or paused', () => {
    seed([task('t-1', 'Draft the report', 'todo'), task('t-2', 'Plan the sprint', 'todo')]);
    renderTimerPage();

    // Baseline: while idle, binding can be re-pointed freely.
    fireEvent.click(focusButton('Draft the report'));
    fireEvent.click(focusButton('Plan the sprint'));
    expect(boundTaskText()).toBe('Plan the sprint');

    fireEvent.click(focusButton('Draft the report'));
    expect(boundTaskText()).toBe('Draft the report');

    clickControl('Start');

    // Every binding control in the backlog is now non-actionable — the bound
    // row and the unbound one alike.
    const controls = within(tasksTile()).getAllByRole('button', { name: /^(Focus|Active)$/ });
    expect(controls).toHaveLength(2);
    controls.forEach((control) => expect(control).toBeDisabled());

    // And the attempt is genuinely inert, not merely styled as such: clicking
    // through leaves the running block bound to its own task.
    fireEvent.click(focusButton('Plan the sprint'));
    expect(boundTaskText()).toBe('Draft the report');

    // Pausing is not idle either — the block is still mid-flight.
    clickControl('Pause');
    expect(focusButton('Plan the sprint')).toBeDisabled();
    fireEvent.click(focusButton('Plan the sprint'));
    expect(boundTaskText()).toBe('Draft the report');

    // Resolving the block returns the queue to a bindable state.
    clickControl('Resume');
    clickControl('Terminate');

    expect(focusButton('Plan the sprint')).toBeEnabled();
    fireEvent.click(focusButton('Plan the sprint'));
    expect(boundTaskText()).toBe('Plan the sprint');
  });

  it('B1.4 — creates an expiry-trackable record when a task is added', () => {
    seed([]);
    renderTimerPage();

    const input = screen.getByLabelText('Add a task for today');
    const add = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(input, { target: { value: 'Draft the report' } });
    fireEvent.click(add);

    const [created] = getTasks();
    expect(created).toMatchObject({ title: 'Draft the report', status: 'todo' });
    // The two fields reconcileTasks keys off: a stable identity and a parseable
    // ISO creation stamp taken at the moment of creation.
    expect(created.id).toEqual(expect.any(String));
    expect(created.id).not.toBe('');
    expect(created.createdAt).toBe(START_TIME.toISOString());
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);

    // It is queued immediately, and a second task gets its own identity.
    fireEvent.change(input, { target: { value: 'Plan the sprint' } });
    fireEvent.click(add);

    const stored = getTasks();
    expect(stored).toHaveLength(2);
    expect(stored[1].id).not.toBe(stored[0].id);
    expect(stored[1]).toMatchObject({ title: 'Plan the sprint', status: 'todo' });

    expect(within(tasksTile()).getAllByRole('listitem')).toHaveLength(2);
    expect(within(tasksTile()).getByText('2 left')).toBeInTheDocument();
  });
});
