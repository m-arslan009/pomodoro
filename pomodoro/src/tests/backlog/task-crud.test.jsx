import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite B3 — editing and removing tasks.
 *
 * Before this existed the only thing a user could do to a task was tick it off, so a typo was
 * permanent and a mis-filed task could only be cleared by falsely marking it done — which quietly
 * inflated the completed-task count in their own statistics.
 *
 * The distinction the suite is built around is DELETE versus ABANDON. Deleting says "this was never
 * real" and removes it from the outcome chart; abandoning says "this was real and I stopped" and
 * keeps it there. That is what makes only one of them worth confirming.
 *
 * Integration level: the real TaskRow, TasksTile, ConfirmDialog and store, with the HTTP calls
 * mocked. Rollback and 404-convergence are covered at the slice level in suite D3 and are not
 * repeated here — this suite is about the affordances.
 */

vi.mock('../../services/tasks.js', () => ({
  fetchTasks: vi.fn(async () => ({ tasks: [], nextCursor: null })),
  fetchAllTasks: vi.fn(async () => ({ tasks: [], truncated: false })),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(async () => {}),
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

const START_TIME = new Date(2026, 0, 15, 9, 0, 0);

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

function session(clientSessionId, taskId) {
  return {
    clientSessionId,
    id: 'server-1',
    taskId,
    taskTitle: 'Thesis chapter 3',
    type: 'focus',
    status: 'completed',
    startedAt: new Date(START_TIME.getTime() - 60 * 60 * 1000).toISOString(),
    endedAt: new Date(START_TIME.getTime() - 35 * 60 * 1000).toISOString(),
    plannedDurationMs: 1500000,
    actualDurationMs: 1500000,
    terminationReason: null,
    pointsAwarded: 100,
    syncState: 'synced',
  };
}

let store;

function renderTimerPage(timer = {}) {
  return render(
    <MemoryRouter>
      <AuthTestProvider
        settings={{ workMinutes: 2, breakMinutes: 1 }}
        timer={timer}
        onStore={(created) => {
          store = created;
        }}
      >
        <TimerPage />
      </AuthTestProvider>
    </MemoryRouter>
  );
}

const tasksTile = () => screen.getByRole('region', { name: /Today.s Focus/ });
const engineTile = () => screen.getByRole('region', { name: 'Session' });
const rowFor = (title) => within(tasksTile()).getByText(title).closest('li');

describe('B3. Editing and removing tasks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
    vi.clearAllMocks();
    vi.mocked(tasksService.updateTask).mockImplementation(async (id, patch) => ({
      ...task(id, 'Thesis chapter 3'),
      ...patch,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('B3.1 renames a task in place and sends only the changed field', async () => {
    renderTimerPage({ tasks: [task('t-1', 'Thesis chapter 3')] });

    fireEvent.click(within(rowFor('Thesis chapter 3')).getByRole('button', { name: 'Rename' }));

    const input = screen.getByLabelText(/Rename/i);
    fireEvent.change(input, { target: { value: 'Thesis chapter 4' } });

    await act(async () => {
      fireEvent.submit(input.closest('form'));
    });

    // Only the title travels: `completedAt` is derived by the server from `status`, and a client
    // able to set it independently could claim a task was finished at a time it was not.
    expect(tasksService.updateTask).toHaveBeenCalledWith('t-1', { title: 'Thesis chapter 4' });
    expect(within(tasksTile()).getByText('Thesis chapter 4')).toBeInTheDocument();
  });

  it('B3.2 abandons a rename on Escape without sending anything', () => {
    renderTimerPage({ tasks: [task('t-1', 'Thesis chapter 3')] });

    fireEvent.click(within(rowFor('Thesis chapter 3')).getByRole('button', { name: 'Rename' }));

    const input = screen.getByLabelText(/Rename/i);
    fireEvent.change(input, { target: { value: 'Something I did not mean' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Without an escape hatch the only way out of the form is to commit, which makes a mistyped
    // rename feel like a trap.
    expect(tasksService.updateTask).not.toHaveBeenCalled();
    expect(within(tasksTile()).getByText('Thesis chapter 3')).toBeInTheDocument();
  });

  it('B3.3 moves a completed task out of the backlog, and reopening brings it back', async () => {
    renderTimerPage({ tasks: [task('t-1', 'Thesis chapter 3')] });

    await act(async () => {
      fireEvent.click(
        within(rowFor('Thesis chapter 3')).getByRole('button', { name: /Mark .* done/i })
      );
    });

    expect(tasksService.updateTask).toHaveBeenCalledWith('t-1', { status: 'completed' });
    expect(within(tasksTile()).getByText('0 left')).toBeInTheDocument();

    // Reachable again through the disclosure, and reversible — being wrong about finishing
    // something is not a state the API refuses to leave.
    fireEvent.click(within(tasksTile()).getByRole('button', { name: /Show resolved/ }));
    const resolved = rowFor('Thesis chapter 3');

    await act(async () => {
      fireEvent.click(within(resolved).getByRole('button', { name: 'Reopen' }));
    });

    expect(tasksService.updateTask).toHaveBeenLastCalledWith('t-1', { status: 'todo' });
    expect(within(tasksTile()).getByText('1 left')).toBeInTheDocument();
  });

  it('B3.4 confirms a delete and names the history it will unlink', async () => {
    renderTimerPage({
      tasks: [task('t-1', 'Thesis chapter 3')],
      sessions: [session('s-1', 't-1'), session('s-2', 't-1'), session('s-3', 'other-task')],
    });

    fireEvent.click(within(rowFor('Thesis chapter 3')).getByRole('button', { name: /Delete/i }));

    // Delete is the only irreversible action in the product, so the dialog says what is actually
    // lost rather than asking abstractly — and the count comes from data the client already holds,
    // so it costs no request.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/2 recorded sessions will keep this name/i);
    expect(dialog).toHaveTextContent(/points you earned are unaffected/i);
    expect(tasksService.deleteTask).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    });

    expect(tasksService.deleteTask).toHaveBeenCalledWith('t-1');
    expect(store.getState().timer.tasks).toEqual([]);
  });

  it('B3.5 lets a running block be renamed but not deleted or abandoned out from under itself', () => {
    renderTimerPage({ tasks: [task('t-1', 'Thesis chapter 3')] });

    fireEvent.click(within(rowFor('Thesis chapter 3')).getByRole('button', { name: 'Focus' }));
    fireEvent.click(within(engineTile()).getByRole('button', { name: 'Start' }));

    const row = rowFor('Thesis chapter 3');

    expect(within(row).getByRole('button', { name: /Delete/i })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Give up' })).toBeDisabled();

    // Renaming stays available: the running block took its own title snapshot when it started, so
    // a rename cannot disturb the record being built.
    expect(within(row).getByRole('button', { name: 'Rename' })).toBeEnabled();
  });
});
