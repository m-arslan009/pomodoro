import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite B2 — what the dashboard says before, during and after a failed load.
 *
 * Tasks moved to the server, which introduced three states the client never had to render before:
 * not fetched yet, fetched and genuinely empty, and failed to fetch. The trap is that all three are
 * `tasks.length === 0`, so the naive rendering shows the same cheerful "add your first task" to
 * someone who has twenty open tasks and a dropped connection — telling them their work is gone.
 *
 * Every state here is therefore asserted for what it says AND for what it must not say, plus the
 * recovery action it offers. The same reasoning covers the pending-sync banner: an undelivered
 * record is not a lost one, and the user is entitled to be told which.
 *
 * Integration level: the real TimerPage, TasksTile and store, with only the HTTP calls mocked.
 */

vi.mock('../../services/tasks.js', () => ({
  fetchTasks: vi.fn(async () => ({ tasks: [], nextCursor: null })),
  fetchAllTasks: vi.fn(async () => ({ tasks: [], truncated: false })),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  TITLE_MAX_LENGTH: 120,
}));

vi.mock('../../services/sessions.js', () => ({
  recordSession: vi.fn(),
  fetchSessions: vi.fn(async () => ({ sessions: [], nextCursor: null })),
  fetchAllSessions: vi.fn(async () => ({ sessions: [], truncated: false })),
  // The whole progression object, as §16.7 defines it. A partial one is not a response the API can
  // produce, and standing one in here would be testing against a server that does not exist.
  fetchGamification: vi.fn(async () => ({
    balance: 0,
    lifetimePoints: 0,
    currentDayStreak: 0,
    longestDayStreak: 0,
    currentSessionRun: 0,
    streakFreezesAvailable: 0,
    unlockedTitles: [],
  })),
  HYDRATION_WINDOW_DAYS: 180,
  TERMINATION_REASONS: ['interrupted', 'wrong_task', 'finished_early', 'out_of_energy'],
}));

vi.mock('../../services/outbox.js', () => ({
  flush: vi.fn(async () => ({ delivered: [], rejected: [] })),
  peek: vi.fn(() => []),
  size: vi.fn(() => 0),
  enqueue: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  OUTBOX_LIMIT: 50,
}));

const tasksService = await import('../../services/tasks.js');
const sessionsService = await import('../../services/sessions.js');
const outbox = await import('../../services/outbox.js');
const { hydrateTimer } = await import('../../store/timerSlice.js');
const { AuthTestProvider } = await import('../helpers/authTestContext.jsx');
const { default: TimerPage } = await import('../../pages/TimerPage.jsx');

const START_TIME = new Date(2026, 0, 15, 9, 0, 0);

const INVITATION = /No tasks yet\. Add your first one below/i;

function task(id, title, status = 'todo') {
  const at = START_TIME.toISOString();
  return {
    id,
    title,
    status,
    estimatedPomodoros: null,
    createdAt: at,
    completedAt: status === 'completed' ? at : null,
    updatedAt: at,
  };
}

function pendingSession(clientSessionId) {
  return {
    clientSessionId,
    id: null,
    taskId: 'task-1',
    taskTitle: 'Thesis chapter 3',
    type: 'focus',
    status: 'completed',
    startedAt: new Date(START_TIME.getTime() - 60 * 60 * 1000).toISOString(),
    endedAt: new Date(START_TIME.getTime() - 35 * 60 * 1000).toISOString(),
    plannedDurationMs: 1500000,
    actualDurationMs: 1500000,
    terminationReason: null,
    pointsAwarded: null,
    syncState: 'pending',
  };
}

function renderTimerPage(timer = {}, onStore) {
  return render(
    <MemoryRouter>
      <AuthTestProvider settings={{ workMinutes: 25, breakMinutes: 5 }} timer={timer} onStore={onStore}>
        <TimerPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

/** The four per-resource hydration outcomes (§17.3 rule 5), all ready unless named otherwise. */
function hydration(overrides = {}) {
  const ready = { status: 'ready', error: null };
  return { sessions: ready, backlog: ready, resolved: ready, gamification: ready, ...overrides };
}

const tasksTile = () => screen.getByRole('region', { name: /Today.s Focus/ });

describe('B2. Hydration and sync states', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('B2.1 says the tasks are still loading rather than that there are none', () => {
    renderTimerPage({ status: 'loading' });

    const tile = within(tasksTile());
    expect(tile.getByText(/Loading your tasks/i)).toBeInTheDocument();

    // The invitation is a claim about the account, and nothing has answered yet.
    expect(tile.queryByText(INVITATION)).not.toBeInTheDocument();
  });

  it('B2.2 distinguishes a failed load from an empty one and offers a way back', async () => {
    renderTimerPage({ status: 'error', error: 'We could not load your history.' });

    const tile = within(tasksTile());
    expect(tile.getByText(/We could not load your tasks/i)).toBeInTheDocument();
    expect(tile.queryByText(INVITATION)).not.toBeInTheDocument();

    // Not a dead end: the retry re-issues the same hydration read, so a dropped connection costs a
    // click rather than a reload — and a reload would sign the user out (ADR-008). The read it
    // re-issues is the cursor-following one, which is what hydration actually calls.
    vi.mocked(tasksService.fetchAllTasks).mockClear();

    await act(async () => {
      fireEvent.click(tile.getByRole('button', { name: /Try again/i }));
    });

    expect(tasksService.fetchAllTasks).toHaveBeenCalled();
  });

  it('B2.3 tells someone who has finished everything apart from someone who has nothing', () => {
    const done = renderTimerPage({ status: 'ready', tasks: [task('t-1', 'Shipped it', 'completed')] });

    // An empty backlog with resolved work behind it is an achievement, not a blank slate.
    expect(within(tasksTile()).getByText(/Every task is done/i)).toBeInTheDocument();
    expect(within(tasksTile()).queryByText(INVITATION)).not.toBeInTheDocument();
    expect(within(tasksTile()).getByRole('button', { name: /Show resolved \(1\)/ })).toBeInTheDocument();

    done.unmount();

    // Only a genuinely empty, successfully loaded account gets the invitation.
    renderTimerPage({ status: 'ready', tasks: [] });

    expect(within(tasksTile()).getByText(INVITATION)).toBeInTheDocument();
    expect(within(tasksTile()).queryByRole('button', { name: /Show resolved/ })).not.toBeInTheDocument();
  });

  it('B2.4 counts the records the server has not taken yet and can retry them on demand', async () => {
    renderTimerPage({
      status: 'ready',
      tasks: [task('t-1', 'Thesis chapter 3')],
      sessions: [pendingSession('block-1'), pendingSession('block-2')],
    });

    /*
     * An undelivered record is not a lost one — it is already in the log and already counted. The
     * banner exists so the user knows the difference without having to guess from the points not
     * moving.
     */
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('2 sessions are waiting to sync.');

    // A flush is already attempted on mount, so the click is the second one.
    const flushesOnMount = vi.mocked(outbox.flush).mock.calls.length;

    await act(async () => {
      fireEvent.click(within(banner).getByRole('button', { name: /Retry now/i }));
    });

    expect(vi.mocked(outbox.flush).mock.calls.length).toBe(flushesOnMount + 1);
  });

  it('B2.5 keeps the countdown usable while the backlog is still loading', () => {
    renderTimerPage({ status: 'loading' });

    // The engine is local (§7.1) and owes nothing to the fetch, but Start stays disabled because a
    // block must be bound to a task — the honest reason, not "still loading".
    const engine = within(screen.getByRole('region', { name: 'Session' }));
    expect(engine.getByRole('timer')).toHaveTextContent('25:00');
    expect(engine.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(engine.getByText(/Add a task in Today.s Focus/i)).toBeInTheDocument();
  });

  it('B2.6 names the read that failed, and offers a retry the page itself could not', async () => {
    renderTimerPage({
      status: 'error',
      error: 'We could not load your history.',
      // Only the history read is unreachable. The tasks and the points answered.
      hydration: hydration({ sessions: { status: 'error', error: 'Network error' } }),
      tasks: [task('t-1', 'Thesis chapter 3')],
    });

    const banner = screen.getByRole('status');

    /*
     * "Something went wrong" tells a user nothing they can act on. The four reads answer four
     * different questions, and only one is unanswered — so the banner says which, and the other
     * three stay on screen rather than being retracted along with it.
     */
    expect(banner).toHaveTextContent(/could not load your session history/i);
    expect(banner).not.toHaveTextContent(/your tasks/i);

    // And the tile is not dragged down with it: the tasks loaded, so they are shown (E9, §17.3
    // rule 5) rather than replaced by a failure the backlog read never had.
    const tile = within(tasksTile());
    expect(tile.getByText('Thesis chapter 3')).toBeInTheDocument();
    expect(tile.queryByText(/We could not load your tasks/i)).not.toBeInTheDocument();

    /*
     * The retry lives HERE and nowhere else (§17.4). Dispatching hydration is what a retry means,
     * and History may not import a thunk — so a Retry button on that page would undo the one rule
     * the whole feature is defined by. The shell already owns hydration, so the shell offers it,
     * on every authenticated page at once.
     */
    vi.mocked(sessionsService.fetchAllSessions).mockClear();

    await act(async () => {
      fireEvent.click(within(banner).getByRole('button', { name: /^Retry$/i }));
    });

    expect(sessionsService.fetchAllSessions).toHaveBeenCalled();
  });

  it('B2.7 lets a notice be dismissed, but never silences a different one that follows', async () => {
    let store;
    renderTimerPage(
      {
        status: 'ready',
        hydration: hydration(),
        tasks: [task('t-1', 'Thesis chapter 3')],
        sessions: [pendingSession('block-1'), pendingSession('block-2')],
      },
      (created) => {
        store = created;
      }
    );

    expect(screen.getByRole('status')).toHaveTextContent('2 sessions are waiting to sync.');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Dismiss this notice/i }));
    });

    // Acknowledged, so it stops taking up the top of every page.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Now a genuinely different thing goes wrong: the history read fails.
    vi.mocked(sessionsService.fetchAllSessions).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await store.dispatch(hydrateTimer());
    });

    /*
     * Dismissal is keyed on WHAT is wrong, not on a boolean. A flag would mean the click that
     * acknowledged two queued records also swallowed the outage that arrived ten minutes later —
     * the banner would be permanently gone and the user permanently uninformed.
     */
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/could not load your session history/i);

    // The queued records are still queued, and still counted: nothing was dropped by the failure.
    expect(banner).toHaveTextContent('2 sessions are waiting to sync.');
  });
});
