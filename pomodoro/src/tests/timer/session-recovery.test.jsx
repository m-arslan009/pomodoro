import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite D1 — recovering a block the user was away for.
 *
 * The behaviour this replaces was the worst defect in the feature: a focus block interrupted by a
 * reload was silently voided, so someone who started 25 minutes of work and closed their laptop
 * came back to nothing. The obvious fix — crediting it automatically — is a worse one, because it
 * pays people for walking away.
 *
 * So the rule is: ask, and make sure BOTH answers produce a record. What must never happen is a
 * block that ran and left no trace, because History treats a missing record as proof the block
 * never happened.
 *
 * Integration level: the real TimerPage, the real timer hook, the real store and the real draft
 * storage, with only the HTTP calls mocked.
 */

vi.mock('../../services/tasks.js', () => ({
  fetchTasks: vi.fn(async () => ({ tasks: [], nextCursor: null })),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  TITLE_MAX_LENGTH: 120,
}));

vi.mock('../../services/sessions.js', () => ({
  recordSession: vi.fn(),
  fetchSessions: vi.fn(async () => ({ sessions: [], nextCursor: null })),
  fetchGamification: vi.fn(),
  HYDRATION_WINDOW_DAYS: 180,
}));

const { recordSession } = await import('../../services/sessions.js');
const { AuthTestProvider } = await import('../helpers/authTestContext.jsx');
const { default: TimerPage } = await import('../../pages/TimerPage.jsx');
const { getActiveSession, saveActiveSession } = await import('../../services/storage.js');

const WORK_MINUTES = 25;
const WORK_MS = WORK_MINUTES * 60 * 1000;
const NOW = new Date(2026, 0, 15, 9, 0, 0);

/** A draft as TimerPage writes it when a block starts. */
function draft({ startedOffsetMs, pausedAt = null, type = 'focus', accumulatedMs = 0 }) {
  const startedAt = new Date(NOW.getTime() + startedOffsetMs);
  return {
    clientSessionId: 'draft-block-1',
    taskId: 'task-1',
    taskTitle: 'Thesis chapter 3',
    type,
    startedAt: startedAt.toISOString(),
    plannedDurationMs: WORK_MS,
    endTime: new Date(startedAt.getTime() + WORK_MS).toISOString(),
    accumulatedMs,
    pausedAt,
  };
}

let store;

function renderTimerPage() {
  return render(
    <MemoryRouter>
      <AuthTestProvider
        settings={{ workMinutes: WORK_MINUTES, breakMinutes: 5 }}
        onStore={(created) => {
          store = created;
        }}
      >
        <TimerPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

const sessions = () => store.getState().timer.sessions;

describe('D1. Recovering an interrupted block (CONTRACT.md §19.2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(recordSession).mockResolvedValue({
      session: { clientSessionId: 'draft-block-1', id: 'server-1', pointsAwarded: 100 },
      gamification: { lifetimePoints: 100, pointsDelta: 100, newlyUnlocked: [] },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('D1.1 resumes a block that is still running without asking anything', () => {
    // Started five minutes ago; twenty still to go.
    saveActiveSession(draft({ startedOffsetMs: -5 * 60 * 1000 }));

    renderTimerPage();

    // Nothing was lost, so nothing is asked.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The countdown is live and carries the time that actually elapsed while away.
    expect(screen.getByRole('timer')).toHaveTextContent('20:00');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByText('Thesis chapter 3')).toBeInTheDocument();
  });

  it('D1.2 restores a paused block with its focused time intact', () => {
    saveActiveSession(
      draft({
        startedOffsetMs: -30 * 60 * 1000, // long past its end time...
        pausedAt: new Date(NOW.getTime() - 20 * 60 * 1000).toISOString(),
        accumulatedMs: 10 * 60 * 1000, // ...but only ten minutes were ever focused
      })
    );

    renderTimerPage();

    // A paused block is never "finished while you were away" — the clock was not running.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    // 25 planned − 10 focused: the twenty minutes spent paused were not consumed.
    expect(screen.getByRole('timer')).toHaveTextContent('15:00');
  });

  it('D1.3 asks about a block that ran out while away, and records it as completed if it was', async () => {
    saveActiveSession(draft({ startedOffsetMs: -40 * 60 * 1000 })); // ended 15 min ago

    renderTimerPage();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/finished while you were away/i);
    expect(dialog).toHaveTextContent('Thesis chapter 3');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Yes, I finished it/i }));
    });

    const [recorded] = sessions();
    expect(recorded).toMatchObject({
      clientSessionId: 'draft-block-1',
      status: 'completed',
      type: 'focus',
      actualDurationMs: WORK_MS,
      terminationReason: null,
    });

    // The draft is consumed, so a second reload cannot offer the same block again.
    expect(getActiveSession()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('D1.4 records the same block as interrupted when the user says they stepped away', async () => {
    saveActiveSession(
      draft({ startedOffsetMs: -40 * 60 * 1000, accumulatedMs: 6 * 60 * 1000 })
    );

    renderTimerPage();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /No, I stepped away/i }));
    });

    const [recorded] = sessions();
    // Still a record — discarding must not mean vanishing.
    expect(recorded).toMatchObject({
      clientSessionId: 'draft-block-1',
      status: 'terminated',
      terminationReason: 'interrupted',
    });
    // Credited only with the time we can actually vouch for, not the full block.
    expect(recorded.actualDurationMs).toBe(6 * 60 * 1000);
    expect(getActiveSession()).toBeNull();
  });

  it('D1.5 drops a draft too old for the server to accept, without asking', () => {
    // Eight days: past the seven-day window, so no answer the user gave could be recorded.
    saveActiveSession(draft({ startedOffsetMs: -8 * 24 * 60 * 60 * 1000 }));

    renderTimerPage();

    // Asking a question whose answer cannot be acted on is worse than not asking.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessions()).toEqual([]);
    expect(getActiveSession()).toBeNull();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
