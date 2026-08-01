import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as outbox from '../services/outbox.js';
import * as sessionsService from '../services/sessions.js';
import * as tasksService from '../services/tasks.js';
import { logout, sessionCleared } from './authSlice.js';

/*
 * timerSlice — tasks, session history, and progression.
 *
 * ONE SLICE, NOT THREE. They are hydrated together, cleared together, and mutated by one event:
 * recording a session appends history, may complete nothing, and always returns new totals. Three
 * slices would need a shared thunk to keep them consistent, which is one slice wearing a disguise.
 *
 * THE COUNTDOWN IS NOT HERE. `phase`, `status` and `remainingMs` change once a second and are read
 * by a single component; in Redux they would dispatch some 1,500 actions per session for no
 * subscriber. Real-time execution stays local to usePomodoroTimer, and this slice holds only what
 * outlives the block (CONTRACT.md §18).
 *
 * Like the other slices, it owns state transitions only — every request is delegated to a service,
 * so this file knows no endpoints and no payload shapes.
 */

/**
 * @typedef {import('../services/tasks.js').Task} Task
 * @typedef {import('../services/sessions.js').Session} Session
 */

/** Zeros, so every consumer can read totals before the first fetch resolves. */
const EMPTY_GAMIFICATION = {
  balance: 0,
  lifetimePoints: 0,
  currentDayStreak: 0,
  longestDayStreak: 0,
  currentSessionRun: 0,
  streakFreezesAvailable: 0,
  unlockedTitles: [],
};

/**
 * Hydration is FOUR reads, and their outcomes are tracked separately (§17.3 rule 5).
 *
 * Awaiting them as one all-or-nothing unit meant a slow `GET /gamification` could empty a dashboard
 * that had already received six months of sessions — a partial outage rendered as total data loss
 * (defect F13). Each resource now succeeds or fails on its own, and the shell's banner names the one
 * that failed instead of declaring the page broken.
 */
const EMPTY_RESOURCE = { status: 'idle', error: null };

const RESOURCES = ['sessions', 'backlog', 'resolved', 'gamification'];

function emptyHydration() {
  return {
    sessions: { ...EMPTY_RESOURCE },
    backlog: { ...EMPTY_RESOURCE },
    resolved: { ...EMPTY_RESOURCE },
    gamification: { ...EMPTY_RESOURCE },
  };
}

const initialState = {
  tasks: [],
  sessions: [],
  gamification: EMPTY_GAMIFICATION,
  /** Per-resource hydration outcome. The banner reads this; `status` below is its roll-up. */
  hydration: emptyHydration(),
  /** True when the §17.2 record cap stopped the session loop short of the full window. */
  truncated: false,
  /**
   * The roll-up of `hydration`, kept because the task tile and the banner both want one answer to
   * "is anything still in flight, and did anything fail?".
   */
  status: 'idle',
  error: null,
  /**
   * The last task write that failed, in the user's language.
   *
   * SEPARATE FROM `error`, which is the hydration roll-up: `rollUp` overwrites that field on every
   * hydration outcome, so a rollback message parked there would be erased by the next read — and
   * the banner reads `hydration`, not `error`, so nothing rendered it in the first place. A silent
   * rollback is indistinguishable from a button that does nothing.
   */
  taskError: null,
};

/** Recompute the roll-up after any per-resource change. Loading wins, then error, then ready. */
function rollUp(state) {
  const outcomes = RESOURCES.map((key) => state.hydration[key]);

  if (outcomes.some((resource) => resource.status === 'loading')) state.status = 'loading';
  else if (outcomes.some((resource) => resource.status === 'error')) state.status = 'error';
  else if (outcomes.every((resource) => resource.status === 'ready')) state.status = 'ready';
  else state.status = 'idle';

  state.error = outcomes.find((resource) => resource.error)?.error ?? null;
}

const thunkOptions = { serializeError: /** @type {(error: unknown) => any} */ ((error) => error) };

/** A locally-minted id for a task that has not been created server-side yet. */
function provisionalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isProvisional(id) {
  return typeof id === 'string' && id.startsWith('local-');
}

/**
 * Upsert sessions by `clientSessionId`, server record winning on every field.
 *
 * Order-independent by construction, so an outbox flush landing after hydration cannot corrupt
 * anything, and "queued offline here, signed in there" resolves itself with no special case.
 */
function mergeSessions(existing, incoming, syncState = 'synced') {
  const byClientId = new Map(existing.map((session) => [session.clientSessionId, session]));

  for (const session of incoming) {
    const previous = byClientId.get(session.clientSessionId);
    byClientId.set(session.clientSessionId, {
      ...previous,
      ...session,
      // The server has no opinion on sync state — it is ours, and it is the only field we keep.
      syncState,
    });
  }

  return [...byClientId.values()].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );
}

/**
 * Upsert tasks by `id`, server row winning.
 *
 * Merge rather than replace, for the same reason sessions merge: the backlog read and the windowed
 * read overlap on open tasks inside the window, and they may resolve in any order. An optimistic
 * row still in flight keeps its local fields until its own request answers.
 */
function mergeTasks(existing, incoming) {
  const byId = new Map(existing.map((task) => [task.id, task]));
  for (const task of incoming) byId.set(task.id, { ...byId.get(task.id), ...task });
  return [...byId.values()];
}

/** The reason a settled read failed, in the user's language rather than the transport's. */
function reasonFor(settled, fallback) {
  return settled.status === 'rejected' ? (settled.reason?.message ?? fallback) : null;
}

/* ------------------------------------------------------------- Thunks -- */

/**
 * Fetch everything the Timer and History need, once per sign-in.
 *
 * Two task reads rather than one, because they answer different questions and only one of them is
 * time-bounded: every open task regardless of age, plus everything resolved inside the window the
 * charts cover. A single call with a window that quietly did not apply to one status would be a
 * parameter that lies.
 *
 * EVERY LIST READ RUNS TO EXHAUSTION. The services own the cursor loop — a cursor is a payload
 * shape, and this slice knows none (§18) — and each page is dispatched the moment it lands, so the
 * dashboard fills in rather than waiting on the last of ~36 round trips.
 *
 * SETTLED, NOT ALL. One failed read must never discard another's success: the reads answer four
 * different questions and only the failed one is unanswered.
 */
export const hydrateTimer = createAsyncThunk(
  'timer/hydrate',
  async (_arg, { dispatch }) => {
    const from = new Date(
      Date.now() - sessionsService.HYDRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const onTasks = (tasks) => dispatch(tasksPageLoaded(tasks));

    const [sessions, backlog, resolved, gamification] = await Promise.allSettled([
      sessionsService.fetchAllSessions(
        { from },
        { onPage: (page) => dispatch(sessionsPageLoaded(page)) }
      ),
      tasksService.fetchAllTasks({ status: 'todo' }, { onPage: onTasks }),
      tasksService.fetchAllTasks({ from }, { onPage: onTasks }),
      sessionsService.fetchGamification(),
    ]);

    return { sessions, backlog, resolved, gamification };
  },
  thunkOptions
);

/**
 * Deliver a finished record.
 *
 * Queued FIRST, then sent. If the request fails on the network the record is already safe, and if
 * it succeeds it leaves the queue — so there is no window in which a finished block exists only in
 * a promise that might reject.
 */
export const recordSession = createAsyncThunk(
  'timer/recordSession',
  async (session, { rejectWithValue }) => {
    outbox.enqueue(session);

    try {
      const result = await sessionsService.recordSession(session);
      outbox.remove(session.clientSessionId);
      return result;
    } catch (error) {
      // 4xx means the server has decided; it will never accept this record, so stop retrying it
      // but keep it visible rather than dropping it silently.
      if (error?.status >= 400 && error?.status < 500) {
        outbox.remove(session.clientSessionId);
        return rejectWithValue({
          clientSessionId: session.clientSessionId,
          rejected: true,
          detail: error?.detail ?? error?.message ?? 'The server rejected this session.',
        });
      }

      // Anything else is a delivery failure. It stays queued and is retried later.
      return rejectWithValue({ clientSessionId: session.clientSessionId, rejected: false });
    }
  },
  thunkOptions
);

/** Retry everything queued. Dispatched on mount, when the browser comes back online, and after a record. */
export const flushOutbox = createAsyncThunk('timer/flushOutbox', async () => outbox.flush());

export const createTask = createAsyncThunk(
  'timer/createTask',
  async ({ title }) => tasksService.createTask({ title }),
  thunkOptions
);

export const updateTask = createAsyncThunk(
  'timer/updateTask',
  async ({ id, patch }) => tasksService.updateTask(id, patch),
  thunkOptions
);

export const deleteTask = createAsyncThunk(
  'timer/deleteTask',
  async ({ id }) => {
    await tasksService.deleteTask(id);
    return { id };
  },
  thunkOptions
);

/* ------------------------------------------------------------- Slice -- */

function clearTimer(state) {
  state.tasks = [];
  state.sessions = [];
  state.gamification = EMPTY_GAMIFICATION;
  state.hydration = emptyHydration();
  state.truncated = false;
  state.status = 'idle';
  state.error = null;
  state.taskError = null;
}

const timerSlice = createSlice({
  name: 'timer',
  initialState,
  reducers: {
    /**
     * Adopt a finalized record immediately, before the server has seen it.
     *
     * The record is real the moment the block ends — that is what makes History able to treat a
     * missing record as proof the block never happened. `pointsAwarded` stays null until the
     * server answers, and is rendered as "—" rather than 0: zero is a claim, and only the server
     * may make it (§14.3 rule 1).
     */
    sessionFinalized(state, action) {
      state.sessions = mergeSessions(state.sessions, [action.payload], 'pending');
    },

    /*
     * One page of the hydration read, adopted the moment it lands.
     *
     * Progressive rather than batched: at full volume the session loop is ~36 sequential requests,
     * and holding six months of charts back until the last one returns would be a spinner where a
     * filling dashboard belongs. Upserting by key makes page order irrelevant, which is the same
     * property that already lets a late outbox flush land safely (E11).
     */
    sessionsPageLoaded(state, action) {
      state.sessions = mergeSessions(state.sessions, action.payload);
    },

    tasksPageLoaded(state, action) {
      state.tasks = mergeTasks(state.tasks, action.payload);
    },

    /** The user has read the rollback message. */
    taskErrorCleared(state) {
      state.taskError = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(hydrateTimer.pending, (state) => {
        state.hydration = emptyHydration();
        for (const key of RESOURCES) state.hydration[key].status = 'loading';
        state.truncated = false;
        rollUp(state);
      })
      .addCase(hydrateTimer.fulfilled, (state, action) => {
        /*
         * Records were merged page by page as they arrived; what settles here is only the OUTCOME
         * of each read. Merge, never replace: a record queued offline that the server has never
         * seen survives hydration, and one the server HAS seen is promoted to 'synced'.
         */
        const { sessions, backlog, resolved, gamification } = action.payload;

        state.hydration.sessions = {
          status: sessions.status === 'fulfilled' ? 'ready' : 'error',
          error: reasonFor(sessions, 'We could not load your session history.'),
        };
        state.hydration.backlog = {
          status: backlog.status === 'fulfilled' ? 'ready' : 'error',
          error: reasonFor(backlog, 'We could not load your tasks.'),
        };
        state.hydration.resolved = {
          status: resolved.status === 'fulfilled' ? 'ready' : 'error',
          error: reasonFor(resolved, 'We could not load your resolved tasks.'),
        };
        state.hydration.gamification = {
          status: gamification.status === 'fulfilled' ? 'ready' : 'error',
          error: reasonFor(gamification, 'We could not load your points.'),
        };

        if (gamification.status === 'fulfilled') state.gamification = gamification.value;

        // A bounded view the user is not told about is a chart that lies (§17.2).
        state.truncated = sessions.status === 'fulfilled' && sessions.value.truncated;

        rollUp(state);
      })
      .addCase(hydrateTimer.rejected, (state, action) => {
        /*
         * `allSettled` does not reject, so reaching here means the thunk itself threw. Whatever is
         * already in the slice stays: a failed hydration is not an empty History, and showing an
         * empty chart to someone with months of history would be worse than the defect it replaced.
         */
        const error = action.error?.message ?? 'We could not load your history.';
        for (const key of RESOURCES) state.hydration[key] = { status: 'error', error };
        rollUp(state);
      })

      .addCase(recordSession.fulfilled, (state, action) => {
        state.sessions = mergeSessions(state.sessions, [action.payload.session]);
        state.gamification = action.payload.gamification;
      })
      .addCase(recordSession.rejected, (state, action) => {
        const info = action.payload;
        if (!info?.clientSessionId) return;

        const session = state.sessions.find((s) => s.clientSessionId === info.clientSessionId);
        if (!session) return;

        // Rejected records are kept and surfaced, never dropped. Deferred ones stay pending.
        if (info.rejected) {
          session.syncState = 'rejected';
          session.rejectionDetail = info.detail;
        }
      })

      .addCase(flushOutbox.fulfilled, (state, action) => {
        for (const { session } of action.payload.delivered) {
          state.sessions = mergeSessions(state.sessions, [session]);
        }
        for (const { clientSessionId, detail } of action.payload.rejected) {
          const session = state.sessions.find((s) => s.clientSessionId === clientSessionId);
          if (session) {
            session.syncState = 'rejected';
            session.rejectionDetail = detail;
          }
        }
        // The last delivery carries the freshest totals.
        const last = action.payload.delivered.at(-1);
        if (last?.gamification) state.gamification = last.gamification;
      })

      /*
       * Task mutations are optimistic triples: mutate on `pending`, adopt the server's row on
       * `fulfilled`, put the previous value back on `rejected`. Rollback is a reducer concern so
       * that no component has to remember to undo its own optimism.
       *
       * A task is the user's own text, so rendering it before the server agrees is honest —
       * unlike points, which are a claim the server can contradict.
       */
      .addCase(createTask.pending, (state, action) => {
        state.taskError = null;
        state.tasks.push({
          id: provisionalId(),
          title: action.meta.arg.title,
          status: 'todo',
          estimatedPomodoros: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
          updatedAt: new Date().toISOString(),
          pending: true,
          requestId: action.meta.requestId,
        });
      })
      .addCase(createTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex((task) => task.requestId === action.meta.requestId);
        if (index >= 0) state.tasks[index] = action.payload;
        else state.tasks.push(action.payload);
      })
      .addCase(createTask.rejected, (state, action) => {
        state.tasks = state.tasks.filter((task) => task.requestId !== action.meta.requestId);
        state.taskError = action.error?.message ?? 'We could not add that task.';
      })

      .addCase(updateTask.pending, (state, action) => {
        state.taskError = null;
        const task = state.tasks.find((item) => item.id === action.meta.arg.id);
        if (!task) return;
        task.previous = { ...task };
        task.pending = true;
        Object.assign(task, action.meta.arg.patch);
        // Keep the pairing honest while optimistic, so the UI never shows a completed task with
        // no completion time.
        if (action.meta.arg.patch.status !== undefined) {
          task.completedAt =
            action.meta.arg.patch.status === 'completed' ? new Date().toISOString() : null;
        }
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex((task) => task.id === action.payload.id);
        if (index >= 0) state.tasks[index] = action.payload;
      })
      .addCase(updateTask.rejected, (state, action) => {
        const index = state.tasks.findIndex((task) => task.id === action.meta.arg.id);
        if (index < 0) return;

        // 404 means it is already gone — deleted on another device. Converge silently: telling
        // someone the thing they wanted gone is gone is not information.
        if (action.error?.status === 404) {
          state.tasks.splice(index, 1);
          return;
        }

        const { previous } = state.tasks[index];
        if (previous) state.tasks[index] = { ...previous };

        /*
         * The row is back where it started, which is the honest outcome — but a rollback nobody is
         * told about looks exactly like a button that does nothing, and two different buttons that
         * both do nothing look like the same button.
         */
        state.taskError = action.error?.message ?? 'We could not save that change.';
      })

      .addCase(deleteTask.pending, (state, action) => {
        state.taskError = null;
        const task = state.tasks.find((item) => item.id === action.meta.arg.id);
        if (task) task.removing = true;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter((task) => task.id !== action.payload.id);
      })
      .addCase(deleteTask.rejected, (state, action) => {
        const index = state.tasks.findIndex((task) => task.id === action.meta.arg.id);
        if (index < 0) return;

        // Already deleted elsewhere. The user's intent is satisfied either way.
        if (action.error?.status === 404) {
          state.tasks.splice(index, 1);
          return;
        }

        delete state.tasks[index].removing;
        state.taskError = action.error?.message ?? 'We could not delete that task.';
      })

      /* Everything here belongs to an account, so it leaves with the account. */
      .addCase(sessionCleared, clearTimer)
      .addCase(logout.fulfilled, clearTimer)
      .addCase(logout.rejected, clearTimer);
  },
});

export const { sessionFinalized, sessionsPageLoaded, tasksPageLoaded, taskErrorCleared } =
  timerSlice.actions;
export default timerSlice.reducer;
