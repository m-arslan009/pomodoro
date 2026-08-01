import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite B1 — backlog membership and timer binding.
 *
 * Proves the queue surfaces only unresolved work, that resolved work stays REACHABLE rather than
 * being thrown away, that selecting a task is what arms the engine, and that a running block cannot
 * be re-pointed mid-flight.
 *
 * Integration level: the real TasksTile, TaskRow, AddTask and timer hook wired together by
 * TimerPage, with only the HTTP calls mocked. Tasks are seeded through the store because that is
 * where the page reads them from — they moved to the server, so a suite can no longer seed them by
 * writing to localStorage.
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
  recordSession: vi.fn(async (s) => ({
    session: { ...s, id: 'server-id', pointsAwarded: 100 },
    gamification: { lifetimePoints: 100, pointsDelta: 100, newlyUnlocked: [] },
  })),
  fetchSessions: vi.fn(async () => ({ sessions: [], nextCursor: null })),
  fetchAllSessions: vi.fn(async () => ({ sessions: [], truncated: false })),
  fetchGamification: vi.fn(),
  HYDRATION_WINDOW_DAYS: 180,
  TERMINATION_REASONS: ['interrupted', 'wrong_task', 'finished_early', 'out_of_energy'],
}));

const tasksService = await import('../../services/tasks.js');
const { AuthTestProvider } = await import('../helpers/authTestContext.jsx');
const { default: TimerPage } = await import('../../pages/TimerPage.jsx');

const WORK_MINUTES = 2;
const START_TIME = new Date(2026, 0, 15, 9, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

function task(id, title, status = 'todo', ageMs = 0) {
  const created = new Date(START_TIME.getTime() - ageMs).toISOString();
  return {
    id,
    title,
    status,
    estimatedPomodoros: null,
    createdAt: created,
    completedAt: status === 'completed' ? created : null,
    updatedAt: created,
  };
}

let store;

function renderTimerPage(tasks = []) {
  return render(
    <MemoryRouter>
      <AuthTestProvider
        settings={{ workMinutes: WORK_MINUTES, breakMinutes: 1 }}
        timer={{ tasks }}
        onStore={(created) => {
          store = created;
        }}
      >
        <TimerPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

const engineTile = () => screen.getByRole('region', { name: 'Session' });
const tasksTile = () => screen.getByRole('region', { name: /Today.s Focus/ });
const backlogTitles = () =>
  within(tasksTile())
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.tasks-tile__name')?.textContent.trim());

describe('B1. Backlog membership and timer binding', () => {
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

  it('B1.1 lists only open tasks, and keeps resolved ones reachable rather than discarding them', () => {
    renderTimerPage([
      task('t-1', 'Open work'),
      task('t-2', 'Finished work', 'completed', HOUR_MS),
      task('t-3', 'Given up on', 'abandoned', 2 * HOUR_MS),
    ]);

    expect(backlogTitles()).toEqual(['Open work']);
    expect(within(tasksTile()).getByText('1 left')).toBeInTheDocument();

    // Resolved work is COLLAPSED, not absent: reopening and deleting have to stay reachable, and a
    // completed task nobody can find again is indistinguishable from one that was lost.
    const disclosure = within(tasksTile()).getByRole('button', { name: /Show resolved \(2\)/ });
    expect(within(tasksTile()).queryByText('Finished work')).not.toBeInTheDocument();

    fireEvent.click(disclosure);

    expect(within(tasksTile()).getByText('Finished work')).toBeInTheDocument();
    expect(within(tasksTile()).getByText(/Given up on/)).toBeInTheDocument();
  });

  it('B1.2 arms the engine only once a task is selected', () => {
    renderTimerPage([task('t-1', 'Draft the report')]);

    // Nothing bound: Start is disabled and the tile says why.
    expect(within(engineTile()).getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(within(engineTile()).getByText('Pick a task to begin')).toBeInTheDocument();

    const row = within(tasksTile()).getByText('Draft the report').closest('li');
    fireEvent.click(within(row).getByRole('button', { name: 'Focus' }));

    expect(within(engineTile()).getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(within(engineTile()).getByText('Draft the report')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('B1.3 will not re-point a block that is already running', () => {
    renderTimerPage([task('t-1', 'First task'), task('t-2', 'Second task')]);

    const first = within(tasksTile()).getByText('First task').closest('li');
    fireEvent.click(within(first).getByRole('button', { name: 'Focus' }));
    fireEvent.click(within(engineTile()).getByRole('button', { name: 'Start' }));

    const second = within(tasksTile()).getByText('Second task').closest('li');
    const focusSecond = within(second).getByRole('button', { name: 'Focus' });

    expect(focusSecond).toBeDisabled();

    // Even if the control were actuated, the bound task does not change: the record being built
    // already carries the title it started with.
    act(() => {
      fireEvent.click(focusSecond);
    });
    expect(within(engineTile()).getByText('First task')).toBeInTheDocument();
  });

  it('B1.4 shows a newly added task at once and sends it to the server', async () => {
    let resolveCreate;
    vi.mocked(tasksService.createTask).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderTimerPage();

    fireEvent.change(screen.getByLabelText(/Add a task/i), {
      target: { value: '  Write the abstract  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Optimistic: a task is the user's own text, so showing it before the server agrees is honest.
    expect(within(tasksTile()).getByText('Write the abstract')).toBeInTheDocument();
    expect(within(tasksTile()).getByText(/saving/i)).toBeInTheDocument();

    // Trimmed at the boundary, so the server never sees the user's stray spaces.
    expect(tasksService.createTask).toHaveBeenCalledWith({ title: 'Write the abstract' });

    await act(async () => {
      resolveCreate(task('server-1', 'Write the abstract'));
    });

    expect(within(tasksTile()).queryByText(/saving/i)).not.toBeInTheDocument();
    expect(store.getState().timer.tasks[0].id).toBe('server-1');
  });

  it('B1.5 refuses to start a block against a task the server has not acknowledged yet', () => {
    // A task still in flight has a local id the API would reject, so the block must wait for the
    // real one. One round trip, so the state is momentary.
    vi.mocked(tasksService.createTask).mockReturnValue(new Promise(() => {}));

    renderTimerPage();

    fireEvent.change(screen.getByLabelText(/Add a task/i), { target: { value: 'Brand new task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const row = within(tasksTile()).getByText('Brand new task').closest('li');
    expect(within(row).getByRole('button', { name: 'Focus' })).toBeDisabled();
    expect(within(engineTile()).getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
