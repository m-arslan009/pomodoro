import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimerPage from './TimerPage.jsx';
import { AuthTestProvider } from '../tests/helpers/authTestContext.jsx';
import {
  getGamification,
  getSessions,
  getTasks,
  saveGamification,
  saveSessions,
  saveTasks,
} from '../services/storage.js';

/*
 * Suite A3 — log write-through on session resolution.
 *
 * Integration level: the real timer hook, the real tiles, and the real storage
 * service, wired together by TimerPage. Proves that resolving a focus block
 * updates the log, the task record, and the economy in one go — a completion
 * records the full configured duration, a termination records the time actually
 * spent, and a break resolution records nothing at all.
 *
 * Task, session and economy fixtures are seeded through services/storage.js because TimerPage
 * hydrates from it in `useState` initializers, and the persisted records are read back for the
 * exact millisecond assertions the DOM only shows rounded ("N min").
 *
 * Durations are seeded through the store instead: preferences moved to the server
 * (CONTRACT.md §4.7), so AuthTestProvider preloads them the way login would.
 */

const WORK_MINUTES = 2;
const BREAK_MINUTES = 1;
const WORK_MS = WORK_MINUTES * 60 * 1000; // 120,000 ms
const BREAK_MS = BREAK_MINUTES * 60 * 1000; // 60,000 ms

// A fixed *local* 09:00 so the seeded fixtures and everything produced by the run
// land on the same calendar day in any timezone — the dashboard filters its log
// and backlog by the local day.
const START_TIME = new Date(2026, 0, 15, 9, 0, 0);

// Integration renders advance hundreds of 250 ms ticks, each re-rendering the
// whole dashboard; jsdom needs more headroom than the 5 s default.
const TEST_TIMEOUT_MS = 20000;

function isoAt(offsetMs) {
  return new Date(START_TIME.getTime() + offsetMs).toISOString();
}

function seed({ tasks = [], sessions = [] } = {}) {
  saveTasks(tasks);
  saveSessions(sessions);
  saveGamification({ points: 0, streak: 0, balance: 0, currentStreak: 0, lifetimePoints: 0 });
}

function todoTask(id, title) {
  return { id, title, status: 'todo', createdAt: isoAt(0) };
}

// AppLayout reads the signed-in account and the account's preferences from the store; this suite
// is about the timer, so both are supplied directly rather than through a real sign-in.
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
const logTile = () => screen.getByRole('region', { name: /Today.s Log/ });

// Everything that lands in storage, for before/after comparison.
function persisted() {
  return { sessions: getSessions(), tasks: getTasks(), gamification: getGamification() };
}

// One phase boundary per act() so effects flush and the interval re-subscribes
// before the next phase is advanced.
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

describe('A3. Log write-through on session resolution (TimerPage integration)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(START_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it(
    'A3.1 logs a completed focus block for the full configured duration and resolves its task',
    () => {
      seed({
        tasks: [todoTask('task-1', 'Draft the report')],
        sessions: [
          {
            id: 'earlier-block',
            taskTitle: 'Earlier block',
            durationMs: WORK_MS,
            endedAt: isoAt(-2 * 60 * 60 * 1000),
            status: 'completed',
          },
        ],
      });
      renderTimerPage();

      expect(within(logTile()).getByText('1')).toBeInTheDocument();

      bindTask('Draft the report');
      clickControl('Start');

      advance(WORK_MS); // the focus block reaches 00:00

      // Persisted record — the exact duration the DOM can only show rounded.
      const sessions = getSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        taskTitle: 'Draft the report',
        status: 'completed',
        durationMs: WORK_MS,
      });
      // Newest first: the new record was prepended, not appended.
      expect(sessions[1].id).toBe('earlier-block');

      // The bound task carries the outcome and a resolution timestamp.
      const [storedTask] = getTasks();
      expect(storedTask.status).toBe('completed');
      expect(storedTask.endedAt).toBe(isoAt(WORK_MS));

      // What the user sees: a new newest-first row in Today's Log, and the count.
      const rows = within(logTile()).getAllByRole('row'); // [header, newest, older]
      expect(within(rows[1]).getByText('Draft the report')).toBeInTheDocument();
      expect(within(rows[1]).getByText(`${WORK_MINUTES} min`)).toBeInTheDocument();
      expect(within(rows[1]).getByText('Completed')).toBeInTheDocument();
      expect(within(rows[2]).getByText('Earlier block')).toBeInTheDocument();
      expect(within(logTile()).getByText('2')).toBeInTheDocument();

      // The resolved task leaves the backlog...
      expect(within(tasksTile()).queryByText('Draft the report')).not.toBeInTheDocument();
      expect(within(tasksTile()).getByText('0 left')).toBeInTheDocument();

      // ...and nothing is bound any more: the engine falls back to its prompt
      // (rendered only when no active task resolves) and Start comes back
      // disabled once the auto-started break returns the page to idle.
      expect(within(engineTile()).getByText('Pick a task to begin')).toBeInTheDocument();

      advance(BREAK_MS);

      expect(within(engineTile()).getByRole('button', { name: 'Start' })).toBeDisabled();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'A3.2 logs a terminated focus block with the elapsed time, not the nominal duration',
    () => {
      seed({ tasks: [todoTask('task-1', 'Refactor the parser')] });
      renderTimerPage();

      bindTask('Refactor the parser');
      clickControl('Start');

      advance(60 * 1000); // one minute into a two-minute block

      clickControl('Terminate');

      const sessions = getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        taskTitle: 'Refactor the parser',
        status: 'terminated',
        durationMs: 60 * 1000, // totalMs − remainingMs, i.e. the work actually done
      });
      expect(sessions[0].durationMs).not.toBe(WORK_MS);

      const [storedTask] = getTasks();
      expect(storedTask.status).toBe('terminated');
      expect(storedTask.endedAt).toBe(isoAt(60 * 1000));

      // The log row shows the elapsed minute, not the nominal two.
      const rows = within(logTile()).getAllByRole('row'); // [header, the block]
      expect(within(rows[1]).getByText('Refactor the parser')).toBeInTheDocument();
      expect(within(rows[1]).getByText('1 min')).toBeInTheDocument();
      expect(within(rows[1]).getByText('Terminated')).toBeInTheDocument();

      expect(within(engineTile()).getByRole('button', { name: 'Start' })).toBeDisabled();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'A3.3 neither logs nor scores a break, whether it runs out or is terminated',
    () => {
      seed({
        tasks: [todoTask('task-1', 'First block'), todoTask('task-2', 'Second block')],
      });
      renderTimerPage();

      // (a) A break left to run to 00:00. Reaching a break requires completing a
      // focus block, which does write — so that write becomes the baseline.
      bindTask('First block');
      clickControl('Start');
      advance(WORK_MS);

      const afterFirstWork = persisted();
      expect(afterFirstWork.sessions).toHaveLength(1);

      advance(BREAK_MS); // the break reaches 00:00

      expect(persisted()).toEqual(afterFirstWork);
      expect(within(logTile()).getAllByRole('row')).toHaveLength(2); // header + one block
      expect(within(logTile()).getByText('1')).toBeInTheDocument();

      // (b) A break abandoned early.
      bindTask('Second block');
      clickControl('Start');
      advance(WORK_MS);

      const afterSecondWork = persisted();
      expect(afterSecondWork.sessions).toHaveLength(2);

      clickControl('Terminate'); // terminating during the break

      expect(persisted()).toEqual(afterSecondWork);
      expect(within(logTile()).getAllByRole('row')).toHaveLength(3); // header + two blocks
      expect(within(logTile()).getByText('2')).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS
  );
});
