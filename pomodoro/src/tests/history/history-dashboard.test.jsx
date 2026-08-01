import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

/*
 * Suite D7 — what the History dashboard actually says (CONTRACT.md §17.1, §17.4, §17.5, E1).
 *
 * The page makes no network call and has no loading or failure state of its own: it renders the
 * store unconditionally and derives every view through the three pure helpers. So these tests seed
 * a store and read the screen — there is nothing to mock, which is the architecture working.
 *
 * Two rules are load-bearing here and neither had a test:
 *   - every field of `Summary` is rendered, because a field with no consumer is how the shape
 *     starts lying about what History shows (defect F14);
 *   - a record's DELIVERY state is drawn, because keeping a rejection the user never sees is the
 *     same outcome as dropping it (defect F15).
 */

const { AuthTestProvider } = await import('../helpers/authTestContext.jsx');
const { default: HistoryPage } = await import('../../pages/HistoryPage.jsx');

function session(clientSessionId, overrides = {}) {
  return {
    clientSessionId,
    id: `srv-${clientSessionId}`,
    taskId: 'task-1',
    taskTitle: 'Thesis chapter 3',
    type: 'focus',
    status: 'completed',
    startedAt: '2026-07-31T09:00:00.000Z',
    endedAt: '2026-07-31T09:25:00.000Z',
    plannedDurationMs: 1500000,
    actualDurationMs: 1500000,
    terminationReason: null,
    pointsAwarded: 100,
    syncState: 'synced',
    ...overrides,
  };
}

function task(id, status) {
  return {
    id,
    title: `Task ${id}`,
    status,
    estimatedPomodoros: null,
    createdAt: '2026-07-28T08:00:00.000Z',
    completedAt: status === 'completed' ? '2026-07-29T08:00:00.000Z' : null,
    updatedAt: '2026-07-29T08:00:00.000Z',
  };
}

const GAMIFICATION = {
  balance: 1250,
  lifetimePoints: 1250,
  currentDayStreak: 6,
  longestDayStreak: 11,
  currentSessionRun: 2,
  streakFreezesAvailable: 0,
  unlockedTitles: ['anchor'],
};

function renderHistory(timer = {}) {
  return render(
    <MemoryRouter>
      <AuthTestProvider timer={{ gamification: GAMIFICATION, ...timer }}>
        <HistoryPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

const overview = () => within(screen.getByRole('region', { name: 'Overview' }));
const recent = () => within(screen.getByRole('region', { name: 'Recent sessions' }));

describe('D7. The History dashboard', () => {
  it('D7.1 renders every field of the Summary shape', () => {
    renderHistory({
      sessions: [
        session('a'),
        session('b'),
        session('c', { status: 'terminated', terminationReason: 'interrupted', pointsAwarded: 0 }),
      ],
      tasks: [task('t1', 'completed'), task('t2', 'todo'), task('t3', 'abandoned')],
    });

    const tile = overview();

    expect(tile.getByText('1,250')).toBeInTheDocument();
    expect(tile.getByText(/Lifetime points earned/i)).toBeInTheDocument();

    /*
     * The DISPLAYED streak is the day streak, and it is the retention mechanic — it was computed on
     * every render and shown nowhere, while `longestDayStreak` was fetched from the server for a
     * tile that never mentioned it.
     */
    expect(tile.getByText(/Current streak/i)).toBeInTheDocument();
    expect(tile.getByText('6')).toBeInTheDocument();
    expect(tile.getByText(/best 11/i)).toBeInTheDocument();

    // The three task statuses are three numbers, matching the outcome chart beside them.
    for (const label of ['Completed tasks', 'Open tasks', 'Abandoned tasks']) {
      expect(tile.getByText(label)).toBeInTheDocument();
    }

    // "Incomplete tasks" lumped open and abandoned together, which is the disagreement this fixed.
    expect(tile.queryByText(/Incomplete tasks/i)).not.toBeInTheDocument();
  });

  it('D7.2 counts focus time from terminated blocks in the headline figure', () => {
    renderHistory({
      sessions: [
        session('a', { actualDurationMs: 25 * 60 * 1000 }),
        session('b', {
          status: 'terminated',
          terminationReason: 'out_of_energy',
          actualDurationMs: 20 * 60 * 1000,
          pointsAwarded: 0,
        }),
      ],
    });

    // The caption reads "min focused", not "min completed", so it must be literally true.
    expect(overview().getByText('45 min focused')).toBeInTheDocument();
  });

  it('D7.3 marks an undelivered record as pending rather than showing it as filed', () => {
    renderHistory({
      sessions: [session('queued', { id: null, syncState: 'pending', pointsAwarded: null })],
    });

    const row = recent().getByRole('row', { name: /Thesis chapter 3/ });

    // A session completed offline is real, counted, and honestly labelled — not hidden, and not
    // presented as though the server has it.
    expect(within(row).getByText('Pending')).toBeInTheDocument();
  });

  it('D7.4 surfaces a refused record, with the reason the server gave', () => {
    renderHistory({
      sessions: [
        session('refused', {
          syncState: 'rejected',
          rejectionDetail: 'That time range overlaps a session you have already recorded.',
        }),
      ],
    });

    const row = recent().getByRole('row', { name: /Thesis chapter 3/ });

    /*
     * The store has always KEPT refused records. It drew them identically to delivered ones, so
     * "kept and surfaced" was true in the state and false on the screen — which is the same outcome
     * as dropping them, reached more expensively.
     */
    expect(within(row).getByText('Rejected')).toBeInTheDocument();
    expect(within(row).getByText(/overlaps a session/i)).toBeInTheDocument();
  });

  it('D7.5 says why a block ended early, using the answer the user already gave', () => {
    renderHistory({
      sessions: [
        session('ended', {
          status: 'terminated',
          terminationReason: 'wrong_task',
          pointsAwarded: 0,
        }),
      ],
    });

    const row = recent().getByRole('row', { name: /Thesis chapter 3/ });

    expect(within(row).getByText('Terminated')).toBeInTheDocument();
    expect(within(row).getByText(/wrong task/i)).toBeInTheDocument();
  });

  it('D7.6 caps the mounted rows but never hides how many there are', () => {
    const sessions = Array.from({ length: 60 }, (_, i) =>
      session(`s-${i}`, { endedAt: new Date(Date.UTC(2026, 6, 1, 9, i)).toISOString() })
    );

    renderHistory({ sessions });

    const tile = recent();

    // The cap is on what is MOUNTED, not on what is kept: the header states the true total, so
    // nothing looks lost, and "Show more" reveals the next batch.
    expect(tile.getByText('60')).toBeInTheDocument();
    expect(tile.getAllByRole('row')).toHaveLength(51); // 50 records + the header row
    expect(tile.getByRole('button', { name: /Show 10 more/i })).toBeInTheDocument();
  });

  it('D7.7 renders the dashboard with no notice of its own when a read has failed', () => {
    renderHistory({
      sessions: [session('local-only', { syncState: 'pending' })],
      status: 'error',
      error: 'We could not load your history.',
    });

    /*
     * Loading and failure belong to hydration, and the notice about them belongs to the shell that
     * owns hydration (§17.4). A Retry button rendered here would have to dispatch a thunk, which
     * would drag the API into this page's import graph and undo the one rule the feature is defined
     * by. So the page renders what it has, unconditionally.
     */
    expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument();
    expect(recent().getByRole('row', { name: /Thesis chapter 3/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sign in again to refresh/i)).not.toBeInTheDocument();
  });

  it('D7.8 tells an empty account apart from a bounded one', () => {
    renderHistory({ sessions: [], tasks: [] });

    expect(recent().getByText(/No sessions logged yet/i)).toBeInTheDocument();
    expect(overview().getByText('0 min focused')).toBeInTheDocument();
  });
});
