import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setAuthTokenAccessor } from '../../services/api.js';
import { fetchGamification, fetchSessions, recordSession } from '../../services/sessions.js';
import { createTask, deleteTask, fetchTasks, updateTask } from '../../services/tasks.js';

/*
 * Suite E — services/sessions.js and services/tasks.js, the Timer's half of the HTTP boundary.
 *
 * SCOPE NOTE. Every other Timer suite doubles these two modules out, which means the wire contract
 * itself — method, URL, query string, exact request body, envelope unwrapping, error shape — is
 * asserted nowhere else. If a field name drifts from the API, this is the only suite that notices;
 * the mocked ones would keep passing while the app talked to a server that no longer understood it.
 *
 * fetch is replaced with a double, so no network is touched. Assertions are written against
 * CONTRACT.md §16.1–§16.7 rather than against the current implementation.
 */

/** A minimal Response stand-in — only the members services/api.js actually reads. */
function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
  };
}

/** A 204, which carries no body at all. */
function noContent() {
  return { ok: true, status: 204, headers: { get: () => null } };
}

/** An RFC 9457 problem document, shaped as the API's exception filter renders one. */
function problem(status, title, detail, errors) {
  return respond(status, { type: 'about:blank', title, status, detail, errors });
}

/** A finalized record as timerSlice holds it — client-only fields included. */
const RECORD = {
  clientSessionId: '018f-block-1',
  id: null,
  taskId: '018f-task-1',
  taskTitle: 'Thesis chapter 3',
  type: 'focus',
  status: 'completed',
  startedAt: '2026-01-15T08:35:00.000Z',
  endedAt: '2026-01-15T09:00:00.000Z',
  plannedDurationMs: 1500000,
  actualDurationMs: 1500000,
  terminationReason: null,
  pointsAwarded: null,
  syncState: 'pending',
  rejectionDetail: null,
};

const TASK = {
  id: '018f-task-1',
  title: 'Thesis chapter 3',
  status: 'todo',
  estimatedPomodoros: null,
  createdAt: '2026-01-15T08:00:00.000Z',
  completedAt: null,
  updatedAt: '2026-01-15T08:00:00.000Z',
};

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Module-level plumbing: left wired, it would leak a token into the next test in this file.
  setAuthTokenAccessor(() => null);
});

const callArgs = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index];
  return { url, init, body: init?.body ? JSON.parse(init.body) : undefined };
};

describe('Suite E1 — Recording and reading sessions', () => {
  it('E1.1 — POSTs exactly the fields the API accepts, and no client-only ones', async () => {
    fetchMock.mockResolvedValue(
      respond(201, { session: { ...RECORD, id: 'server-1' }, gamification: {} })
    );

    await recordSession(RECORD);

    const { url, init, body } = callArgs();
    expect(url).toBe('/api/v1/sessions');
    expect(init.method).toBe('POST');

    /*
     * toEqual, not toMatchObject: the point is what is ABSENT. `syncState`, `id`, `pointsAwarded`
     * and `rejectionDetail` are the client's own bookkeeping — sending `pointsAwarded` in
     * particular would be the client proposing its own score, which is the one thing §14.3 rule 1
     * exists to prevent.
     */
    expect(body).toEqual({
      clientSessionId: '018f-block-1',
      taskId: '018f-task-1',
      taskTitle: 'Thesis chapter 3',
      type: 'focus',
      status: 'completed',
      startedAt: '2026-01-15T08:35:00.000Z',
      endedAt: '2026-01-15T09:00:00.000Z',
      plannedDurationMs: 1500000,
      actualDurationMs: 1500000,
      terminationReason: null,
    });
  });

  it('E1.2 — carries the bearer token, so a record is attributed to the signed-in account', async () => {
    setAuthTokenAccessor(() => 'test-access-token');
    fetchMock.mockResolvedValue(respond(201, { session: RECORD, gamification: {} }));

    await recordSession(RECORD);

    // Ownership is a query constraint on the server (ADR-010), so the token is the ONLY thing
    // saying whose session this is — no route accepts a user id.
    expect(callArgs().init.headers.Authorization).toBe('Bearer test-access-token');
    expect(callArgs().body.userId).toBeUndefined();
  });

  it('E1.3 — treats a replayed record as success and adopts the server totals', async () => {
    // A retried flush answers 200 with the ORIGINAL record rather than 201.
    const stored = { ...RECORD, id: 'server-1', actualDurationMs: 1499000, pointsAwarded: 100 };
    fetchMock.mockResolvedValue(
      respond(200, { session: stored, gamification: { lifetimePoints: 100 } })
    );

    const result = await recordSession(RECORD);

    // Not an error: a duplicate delivery is the outbox working, not failing.
    expect(result.session).toEqual(stored);
    expect(result.gamification).toEqual({ lifetimePoints: 100 });
    // The server clamped the duration; the caller adopts its number, not the one it sent.
    expect(result.session.actualDurationMs).toBe(1499000);
  });

  it('E1.4 — builds the history query from the params it was given, omitting the empty ones', async () => {
    fetchMock.mockResolvedValue(respond(200, { sessions: [], nextCursor: null }));

    await fetchSessions({ from: '2026-01-01', to: undefined, cursor: null, limit: 100 });

    // An empty `cursor=` is not the same as no cursor: the server would read it as a page token.
    expect(callArgs().url).toBe('/api/v1/sessions?from=2026-01-01&limit=100');
    expect(callArgs().init.method).toBe('GET');

    fetchMock.mockClear();
    await fetchSessions();

    // No params at all means no question mark — the server's own 180-day default applies.
    expect(callArgs().url).toBe('/api/v1/sessions');
  });

  it('E1.5 — reports an unreachable server as a network failure, distinguishably', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await recordSession(RECORD).catch((caught) => caught);

    /*
     * The outbox branches on exactly this: a network failure is retried forever, while a 4xx is a
     * verdict and the record is marked rejected. Collapsing the two would either discard records
     * the server never saw or retry a rejection until the end of time.
     */
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.isNetworkError).toBe(true);
  });

  it('E1.6 — reads progression from its own endpoint and unwraps the envelope', async () => {
    const gamification = { lifetimePoints: 4200, balance: 4200, unlockedTitles: ['The Anchor'] };
    fetchMock.mockResolvedValue(respond(200, { gamification }));

    await expect(fetchGamification()).resolves.toEqual(gamification);
    expect(callArgs().url).toBe('/api/v1/gamification');
    expect(callArgs().init.method).toBe('GET');
  });
});

describe('Suite E2 — Task CRUD over the wire', () => {
  it('E2.1 — lists tasks unfiltered by default and by status on request', async () => {
    fetchMock.mockResolvedValue(respond(200, { tasks: [TASK], nextCursor: null }));

    await expect(fetchTasks()).resolves.toEqual({ tasks: [TASK], nextCursor: null });
    // Unfiltered on purpose: hydration counts every status so the outcome breakdown is complete.
    expect(callArgs().url).toBe('/api/v1/tasks');

    fetchMock.mockClear();
    await fetchTasks({ status: 'todo' });

    expect(callArgs().url).toBe('/api/v1/tasks?status=todo');
  });

  it('E2.2 — creates a task and returns the row, not the envelope', async () => {
    fetchMock.mockResolvedValue(respond(201, { task: { ...TASK, title: 'Write the abstract' } }));

    const created = await createTask({ title: 'Write the abstract' });

    const { url, init, body } = callArgs();
    expect(url).toBe('/api/v1/tasks');
    expect(init.method).toBe('POST');
    expect(body).toEqual({ title: 'Write the abstract' });
    // The id is the server's to mint, and the optimistic row is replaced by this one.
    expect(created).toMatchObject({ id: '018f-task-1', title: 'Write the abstract' });
  });

  it('E2.3 — PATCHes only what changed and never sends a derived field', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        task: { ...TASK, status: 'completed', completedAt: '2026-01-15T10:00:00.000Z' },
      })
    );

    const updated = await updateTask('018f-task-1', { status: 'completed' });

    const { url, init, body } = callArgs();
    expect(url).toBe('/api/v1/tasks/018f-task-1');
    expect(init.method).toBe('PATCH');
    /*
     * `completedAt` is derived by the server from `status`. A client able to set it independently
     * could claim a task was finished at a time it was not — and the statistics are built from
     * exactly these timestamps.
     */
    expect(body).toEqual({ status: 'completed' });
    expect(body.completedAt).toBeUndefined();
    // It comes BACK, though: the server's timestamp is what the store adopts.
    expect(updated.completedAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('E2.4 — deletes by id and tolerates the empty 204 body', async () => {
    fetchMock.mockResolvedValue(noContent());

    await expect(deleteTask('018f-task-1')).resolves.toBeUndefined();

    expect(callArgs().url).toBe('/api/v1/tasks/018f-task-1');
    expect(callArgs().init.method).toBe('DELETE');
  });

  it('E2.5 — unpacks a validation failure into per-field messages', async () => {
    fetchMock.mockResolvedValue(
      problem(422, 'Validation failed', 'The request body is invalid.', [
        { field: 'title', message: 'Title must be 120 characters or fewer.' },
      ])
    );

    const error = await createTask({ title: 'x'.repeat(200) }).catch((caught) => caught);

    // Already keyed by field, so the form drops it straight beside the input it belongs to instead
    // of parsing a problem document itself.
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ title: 'Title must be 120 characters or fewer.' });
  });

  it('E2.6 — reports a task that is gone as a 404 the caller can converge on', async () => {
    // Deleted in another tab, or never owned by this account — ADR-010 makes those indistinguishable
    // on purpose, so neither one leaks whether the row exists.
    fetchMock.mockResolvedValue(problem(404, 'Not found', 'That task no longer exists.'));

    const error = await updateTask('018f-gone', { title: 'Renamed' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
  });
});
