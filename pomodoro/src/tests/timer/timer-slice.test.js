import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite D3 — the timer store.
 *
 * Proves the four state transitions that decide whether a user's data survives contact with an
 * unreliable network: hydration must not overwrite what has not been sent yet, an optimistic task
 * edit must be undone exactly when the server refuses it, a task deleted on another device must
 * disappear quietly rather than raising an error the user cannot act on, and a recorded session
 * must be visible before the server has scored it.
 *
 * Slice level: the real reducer and the real thunks with the two service modules mocked. The
 * thunks' job is turning a service outcome into a state transition, so the service is what gets
 * faked and the transition is what gets asserted.
 */

vi.mock('../../services/tasks.js', () => ({
  fetchTasks: vi.fn(),
  fetchAllTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  TITLE_MAX_LENGTH: 120,
}));

vi.mock('../../services/sessions.js', () => ({
  recordSession: vi.fn(),
  fetchSessions: vi.fn(),
  fetchAllSessions: vi.fn(),
  fetchGamification: vi.fn(),
  HYDRATION_WINDOW_DAYS: 180,
}));

const tasksService = await import('../../services/tasks.js');
const sessionsService = await import('../../services/sessions.js');
const timerModule = await import('../../store/timerSlice.js');

const {
  default: timerReducer,
  hydrateTimer,
  createTask,
  updateTask,
  deleteTask,
  recordSession,
  sessionFinalized,
} = timerModule;

function makeStore(preloaded) {
  return configureStore({
    reducer: { timer: timerReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
    ...(preloaded ? { preloadedState: { timer: preloaded } } : {}),
  });
}

const GAMIFICATION = {
  balance: 300,
  lifetimePoints: 300,
  currentDayStreak: 2,
  longestDayStreak: 4,
  currentSessionRun: 3,
  streakFreezesAvailable: 1,
  pointsDelta: 0,
  unlockedTitles: [],
  newlyUnlocked: [],
};

function session(clientSessionId, overrides = {}) {
  return {
    clientSessionId,
    id: null,
    taskId: 'task-1',
    taskTitle: 'Thesis chapter 3',
    type: 'focus',
    status: 'completed',
    startedAt: '2026-07-31T09:00:00.000Z',
    endedAt: '2026-07-31T09:25:00.000Z',
    plannedDurationMs: 1500000,
    actualDurationMs: 1500000,
    terminationReason: null,
    pointsAwarded: null,
    ...overrides,
  };
}

function task(id, overrides = {}) {
  return {
    id,
    title: 'Thesis chapter 3',
    status: 'todo',
    estimatedPomodoros: null,
    createdAt: '2026-07-28T08:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-07-28T08:00:00.000Z',
    ...overrides,
  };
}

function apiError(status, message = 'Request failed') {
  return Object.assign(new Error(message), { status, detail: message });
}

describe('D3. Timer store (store/timerSlice.js)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D3.1 keeps an unsent record through hydration, and adopts the server version of a sent one', async () => {
    const store = makeStore();

    // Two finished blocks that have not reached the server.
    store.dispatch(sessionFinalized(session('queued-offline')));
    store.dispatch(sessionFinalized(session('already-known', { endedAt: '2026-07-31T08:00:00.000Z' })));

    // The server has seen one of them, and clamped its duration. Records reach the store through
    // `onPage` now rather than the thunk's return value: hydration follows the cursor and adopts
    // each page as it lands, so the mock delivers its page the same way the service does.
    vi.mocked(sessionsService.fetchAllSessions).mockImplementation(async (_params, options = {}) => {
      const sessions = [
        session('already-known', {
          id: 'server-1',
          actualDurationMs: 900000,
          pointsAwarded: 100,
          endedAt: '2026-07-31T08:00:00.000Z',
        }),
      ];
      options.onPage?.(sessions);
      return { sessions, truncated: false };
    });
    vi.mocked(tasksService.fetchAllTasks).mockResolvedValue({ tasks: [], truncated: false });
    vi.mocked(sessionsService.fetchGamification).mockResolvedValue(GAMIFICATION);

    await store.dispatch(hydrateTimer());

    const { sessions } = store.getState().timer;
    const byId = Object.fromEntries(sessions.map((s) => [s.clientSessionId, s]));

    // The one the server has never seen survives, still pending. Replacing wholesale here would
    // silently destroy work that was waiting to be delivered.
    expect(byId['queued-offline'].syncState).toBe('pending');

    // The one it has seen is promoted, and the SERVER wins on every field — this is how the
    // clamp reaches History: the user sees 15 minutes, not the 25 they reported.
    expect(byId['already-known'].syncState).toBe('synced');
    expect(byId['already-known'].actualDurationMs).toBe(900000);
    expect(byId['already-known'].pointsAwarded).toBe(100);

    expect(store.getState().timer.gamification).toEqual(GAMIFICATION);
    expect(store.getState().timer.status).toBe('ready');
  });

  it('D3.2 keeps what it has when one read fails, and the other three still land', async () => {
    const store = makeStore();
    store.dispatch(sessionFinalized(session('local-only')));

    // Only the session history is unreachable. The tasks and the points are fine.
    vi.mocked(sessionsService.fetchAllSessions).mockRejectedValue(apiError(0, 'Network error'));
    vi.mocked(tasksService.fetchAllTasks).mockImplementation(async (_params, options = {}) => {
      const tasks = [task('task-1')];
      options.onPage?.(tasks);
      return { tasks, truncated: false };
    });
    vi.mocked(sessionsService.fetchGamification).mockResolvedValue(GAMIFICATION);

    await store.dispatch(hydrateTimer());

    const state = store.getState().timer;

    /*
     * The four reads settle independently. Awaiting them as one unit meant a single failure threw
     * away three successful answers — a partial outage rendered as total data loss, which is the
     * defect this replaced. Only the failed read is unanswered.
     */
    expect(state.hydration.sessions.status).toBe('error');
    expect(state.hydration.backlog.status).toBe('ready');
    expect(state.hydration.resolved.status).toBe('ready');
    expect(state.hydration.gamification.status).toBe('ready');

    expect(state.tasks).toHaveLength(1);
    expect(state.gamification).toEqual(GAMIFICATION);

    // Showing an empty chart to someone with months of history would be worse than showing a
    // partial one with a notice, so the locally-held record survives.
    expect(state.sessions).toHaveLength(1);

    // The roll-up still reports a problem, because one genuinely happened.
    expect(state.status).toBe('error');
  });

  it('D3.3 shows a new task immediately and takes it back only if the server refuses it', async () => {
    const store = makeStore();

    let resolve;
    vi.mocked(tasksService.createTask).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const inFlight = store.dispatch(createTask({ title: 'Write the abstract' }));

    // Optimistic: a task is the user's own text, so rendering it before the server agrees is
    // honest — unlike points, which are a claim the server can contradict.
    const optimistic = store.getState().timer.tasks;
    expect(optimistic).toHaveLength(1);
    expect(optimistic[0].title).toBe('Write the abstract');
    expect(optimistic[0].pending).toBe(true);
    expect(timerModule.isProvisional(optimistic[0].id)).toBe(true);

    resolve(task('server-id', { title: 'Write the abstract' }));
    await inFlight;

    const settled = store.getState().timer.tasks;
    expect(settled).toHaveLength(1);
    expect(settled[0].id).toBe('server-id');
    expect(settled[0].pending).toBeUndefined();
  });

  it('D3.4 rolls a failed rename back to the title it had before', async () => {
    const store = makeStore({
      tasks: [task('task-1', { title: 'Thesis chapter 3' })],
      sessions: [],
      gamification: GAMIFICATION,
      status: 'ready',
      error: null,
    });

    vi.mocked(tasksService.updateTask).mockRejectedValue(apiError(422, 'Give the task a name.'));

    await store.dispatch(updateTask({ id: 'task-1', patch: { title: 'Thesis chapter 4' } }));

    const [restored] = store.getState().timer.tasks;
    expect(restored.title).toBe('Thesis chapter 3');
    expect(store.getState().timer.error).toBe('Give the task a name.');
  });

  it('D3.5 converges silently when a task was already deleted on another device', async () => {
    const store = makeStore({
      tasks: [task('task-1'), task('task-2')],
      sessions: [],
      gamification: GAMIFICATION,
      status: 'ready',
      error: null,
    });

    vi.mocked(tasksService.deleteTask).mockRejectedValue(apiError(404, 'That task no longer exists.'));

    await store.dispatch(deleteTask({ id: 'task-1' }));

    // The row goes, and no error is raised: telling someone that the thing they wanted gone is
    // gone is not information.
    expect(store.getState().timer.tasks.map((t) => t.id)).toEqual(['task-2']);
    expect(store.getState().timer.error).toBeNull();
  });

  it('D3.6 shows a recorded session before it is scored, then adopts the server totals', async () => {
    const store = makeStore();
    const record = session('block-a');

    store.dispatch(sessionFinalized(record));

    const pending = store.getState().timer.sessions[0];
    expect(pending.syncState).toBe('pending');
    // Null, never 0: zero points is a claim, and only the server may make it.
    expect(pending.pointsAwarded).toBeNull();

    vi.mocked(sessionsService.recordSession).mockResolvedValue({
      session: { ...record, id: 'server-1', pointsAwarded: 150 },
      gamification: { ...GAMIFICATION, lifetimePoints: 450, pointsDelta: 150 },
    });

    await store.dispatch(recordSession(record));

    const synced = store.getState().timer.sessions[0];
    expect(synced.syncState).toBe('synced');
    expect(synced.pointsAwarded).toBe(150);
    expect(store.getState().timer.gamification.lifetimePoints).toBe(450);
  });

  it('D3.7 keeps a refused record visible instead of dropping it', async () => {
    const store = makeStore();
    const record = session('too-old');
    store.dispatch(sessionFinalized(record));

    vi.mocked(sessionsService.recordSession).mockRejectedValue(
      apiError(422, 'Sessions older than 7 days can no longer be recorded.')
    );

    await store.dispatch(recordSession(record));

    const [rejected] = store.getState().timer.sessions;
    expect(rejected.syncState).toBe('rejected');
    expect(rejected.rejectionDetail).toBe('Sessions older than 7 days can no longer be recorded.');
  });
});
