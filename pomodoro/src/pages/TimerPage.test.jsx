import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite A3 — what a resolved block writes, and what it deliberately leaves alone.
 *
 * The three rules under test all say the same thing from different directions: a SESSION and a TASK
 * are different nouns. Finishing one pomodoro does not finish the work, abandoning one block does
 * not abandon the work, and a break is not work at all. The previous build got all three wrong —
 * completing a pomodoro marked the whole task done, terminating marked it abandoned, and breaks
 * were never recorded — which meant a multi-day task vanished from the backlog after twenty-five
 * minutes.
 *
 * Integration level: the real TimerPage, the real timer hook, the real tiles and the real store,
 * with only the HTTP calls mocked. Records are asserted against the store rather than the DOM where
 * the DOM only shows a rounded "N min".
 */

vi.mock('../services/tasks.js', () => ({
  fetchTasks: vi.fn(async () => ({ tasks: [], nextCursor: null })),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  TITLE_MAX_LENGTH: 120,
}));

vi.mock('../services/sessions.js', () => ({
  recordSession: vi.fn(),
  fetchSessions: vi.fn(async () => ({ sessions: [], nextCursor: null })),
  fetchGamification: vi.fn(),
  HYDRATION_WINDOW_DAYS: 180,
}));

const { recordSession } = await import('../services/sessions.js');
const { AuthTestProvider } = await import('../tests/helpers/authTestContext.jsx');
const { default: TimerPage } = await import('./TimerPage.jsx');

const WORK_MINUTES = 2;
const BREAK_MINUTES = 1;
const WORK_MS = WORK_MINUTES * 60 * 1000;
const BREAK_MS = BREAK_MINUTES * 60 * 1000;

// A fixed *local* 09:00 so seeded fixtures and everything produced by the run land on the same
// calendar day in any timezone — the dashboard filters its log by the local day.
const START_TIME = new Date(2026, 0, 15, 9, 0, 0);

// Integration renders advance hundreds of ticks; jsdom needs more headroom than the 5 s default.
const TEST_TIMEOUT_MS = 20000;

function todoTask(id, title) {
  return {
    id,
    title,
    status: 'todo',
    estimatedPomodoros: null,
    createdAt: START_TIME.toISOString(),
    completedAt: null,
    updatedAt: START_TIME.toISOString(),
  };
}

let store;

function renderTimerPage(tasks = []) {
  return render(
    <MemoryRouter>
      <AuthTestProvider
        settings={{ workMinutes: WORK_MINUTES, breakMinutes: BREAK_MINUTES }}
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
const logTile = () => screen.getByRole('region', { name: /Today.s Log/ });

const sessions = () => store.getState().timer.sessions;
const tasks = () => store.getState().timer.tasks;

// One phase boundary per act() so effects flush and the interval re-subscribes.
function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function bindTask(title) {
  const row = within(tasksTile()).getByText(title).closest('li');
  fireEvent.click(within(row).getByRole('button', { name: 'Focus' }));
}

function clickControl(name) {
  fireEvent.click(within(engineTile()).getByRole('button', { name }));
}

describe('A3. Session write-through on resolution (TimerPage integration)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
    vi.mocked(recordSession).mockImplementation(async (session) => ({
      session: { ...session, id: 'server-id', pointsAwarded: 100 },
      gamification: { lifetimePoints: 100, pointsDelta: 100, newlyUnlocked: [] },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it(
    'A3.1 records a completed block for the full duration and LEAVES the task in the backlog',
    () => {
      renderTimerPage([todoTask('task-1', 'Draft the report')]);

      bindTask('Draft the report');
      clickControl('Start');
      advance(WORK_MS);

      const focus = sessions().filter((s) => s.type === 'focus');
      expect(focus).toHaveLength(1);
      expect(focus[0]).toMatchObject({
        taskId: 'task-1',
        taskTitle: 'Draft the report',
        type: 'focus',
        status: 'completed',
        plannedDurationMs: WORK_MS,
        actualDurationMs: WORK_MS,
        terminationReason: null,
      });

      /*
       * THE POINT OF THIS TEST. A task spans as many pomodoros as it takes, so one completed block
       * resolves nothing — the task is untouched and still in the backlog.
       */
      expect(tasks()[0].status).toBe('todo');
      expect(tasks()[0].completedAt).toBeNull();
      expect(within(tasksTile()).getByText('Draft the report')).toBeInTheDocument();
      expect(within(tasksTile()).getByText('1 left')).toBeInTheDocument();

      // What the user sees in the log.
      const rows = within(logTile()).getAllByRole('row'); // [header, the block]
      expect(within(rows[1]).getByText('Draft the report')).toBeInTheDocument();
      expect(within(rows[1]).getByText(`${WORK_MINUTES} min`)).toBeInTheDocument();
      expect(within(rows[1]).getByText('Completed')).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'A3.2 requires a reason to terminate, records the elapsed time, and leaves the task alone',
    () => {
      renderTimerPage([todoTask('task-1', 'Refactor the parser')]);

      bindTask('Refactor the parser');
      clickControl('Start');
      advance(60 * 1000); // one minute into a two-minute block

      clickControl('Terminate');

      // Terminating costs no points, so the reason is the entire thing the product gets for it.
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Refactor the parser');
      expect(sessions()).toHaveLength(0); // nothing recorded until the reason is given

      act(() => {
        fireEvent.click(within(dialog).getByRole('button', { name: /Something interrupted me/i }));
      });

      const [recorded] = sessions();
      expect(recorded).toMatchObject({
        taskTitle: 'Refactor the parser',
        status: 'terminated',
        terminationReason: 'interrupted',
        actualDurationMs: 60 * 1000, // the work actually done, not the nominal two minutes
      });
      expect(recorded.actualDurationMs).not.toBe(WORK_MS);

      // Giving up on a BLOCK is not giving up on the WORK.
      expect(tasks()[0].status).toBe('todo');
      expect(within(tasksTile()).getByText('Refactor the parser')).toBeInTheDocument();

      const rows = within(logTile()).getAllByRole('row');
      expect(within(rows[1]).getByText('1 min')).toBeInTheDocument();
      expect(within(rows[1]).getByText('Terminated')).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'A3.3 records a break as its own interval but never counts it as focus',
    () => {
      renderTimerPage([todoTask('task-1', 'First block')]);

      bindTask('First block');
      clickControl('Start');
      advance(WORK_MS); // work → break

      expect(within(logTile()).getByText('1')).toBeInTheDocument();

      advance(BREAK_MS); // the break reaches 00:00

      // Every path out of a running interval produces a record, breaks included — that is what
      // lets a missing record prove a block never happened.
      const all = sessions();
      const breaks = all.filter((s) => s.type === 'break');
      expect(breaks).toHaveLength(1);
      expect(breaks[0]).toMatchObject({ type: 'break', status: 'completed' });

      /*
       * But a break is not work. Letting it through the aggregates would roughly double every
       * figure the product reports, so Today's Log still shows exactly one row.
       */
      expect(within(logTile()).getAllByRole('row')).toHaveLength(2); // header + one focus block
      expect(within(logTile()).getByText('1')).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'A3.4 keeps a block that could not be delivered, and says so rather than losing it',
    () => {
      vi.mocked(recordSession).mockRejectedValue(
        Object.assign(new Error('Network error'), { status: 0 })
      );

      renderTimerPage([todoTask('task-1', 'Write the abstract')]);

      bindTask('Write the abstract');
      clickControl('Start');
      advance(WORK_MS);

      const [recorded] = sessions();
      // The block happened, so the record exists whatever the network says.
      expect(recorded.status).toBe('completed');
      expect(recorded.syncState).toBe('pending');
      // Points are the server's to award; showing 0 here would be a claim the client cannot make.
      expect(recorded.pointsAwarded).toBeNull();

      expect(screen.getByText(/waiting to sync/i)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS
  );
});
