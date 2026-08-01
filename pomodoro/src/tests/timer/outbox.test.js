import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite D2 — the delivery queue.
 *
 * A finished focus block is time the user has already spent; unlike everything else in the app it
 * cannot be re-entered if it is lost. This suite proves the queue keeps it through the two ways
 * delivery fails, and — just as importantly — that it does NOT keep retrying a record the server
 * has refused on the merits.
 *
 * Service level: the real outbox and the real storage gateway, with only the HTTP call mocked. The
 * queue's whole job is deciding what to do with the outcome of that call, so the call is the one
 * thing worth faking and everything around it is real.
 */

vi.mock('../../services/sessions.js', () => ({
  recordSession: vi.fn(),
  HYDRATION_WINDOW_DAYS: 180,
  TERMINATION_REASONS: ['interrupted', 'wrong_task', 'finished_early', 'out_of_energy'],
}));

const { recordSession } = await import('../../services/sessions.js');
const outbox = await import('../../services/outbox.js');

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
    syncState: 'pending',
    ...overrides,
  };
}

/** The shape the API answers a successful record with. */
function accepted(clientSessionId) {
  return {
    session: { ...session(clientSessionId), id: 'server-id', pointsAwarded: 100 },
    gamification: { lifetimePoints: 100, pointsDelta: 100, newlyUnlocked: [] },
  };
}

function refusal(status, detail = 'Sessions older than 7 days can no longer be recorded.') {
  return Object.assign(new Error(detail), { status, detail });
}

describe('D2. Delivery queue (services/outbox.js)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(recordSession).mockReset();
  });

  it('D2.1 keeps one entry per block, however many times the same block is queued', () => {
    outbox.enqueue(session('block-a'));
    outbox.enqueue(session('block-b'));
    // A recovery racing a normal finalize enqueues the same block twice.
    outbox.enqueue(session('block-a', { actualDurationMs: 999 }));

    const queued = outbox.peek();
    expect(queued.map((s) => s.clientSessionId)).toEqual(['block-b', 'block-a']);
    // The later enqueue wins, and there is still only one attempt pending for that block.
    expect(queued.find((s) => s.clientSessionId === 'block-a').actualDurationMs).toBe(999);
  });

  it('D2.2 delivers in order and empties as it goes', async () => {
    outbox.enqueue(session('block-a'));
    outbox.enqueue(session('block-b'));

    vi.mocked(recordSession).mockImplementation(async (s) => accepted(s.clientSessionId));

    const result = await outbox.flush();

    expect(result.delivered.map((d) => d.clientSessionId)).toEqual(['block-a', 'block-b']);
    expect(result.rejected).toEqual([]);
    expect(result.remaining).toBe(0);
    expect(outbox.peek()).toEqual([]);
  });

  it('D2.3 keeps a record the network could not deliver, and stops rather than hammering', async () => {
    outbox.enqueue(session('block-a'));
    outbox.enqueue(session('block-b'));

    // status 0 is api.js's "the network never answered".
    vi.mocked(recordSession).mockRejectedValue(refusal(0, 'We could not reach the server.'));

    const result = await outbox.flush();

    expect(result.delivered).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(outbox.peek()).toHaveLength(2);

    // One attempt, not two: if the connection is down the second request fails too, and trying
    // anyway would only delay the retry that might work.
    expect(recordSession).toHaveBeenCalledTimes(1);
  });

  it('D2.4 stops retrying a record the server refused, but reports it instead of dropping it', async () => {
    outbox.enqueue(session('too-old'));
    outbox.enqueue(session('block-b'));

    vi.mocked(recordSession).mockImplementation(async (s) => {
      if (s.clientSessionId === 'too-old') throw refusal(422);
      return accepted(s.clientSessionId);
    });

    const result = await outbox.flush();

    // Refused: no amount of retrying will change a 422, so it leaves the queue...
    expect(result.rejected).toEqual([
      {
        clientSessionId: 'too-old',
        detail: 'Sessions older than 7 days can no longer be recorded.',
      },
    ]);
    // ...but the caller is told, so it can be surfaced rather than silently disappearing.
    expect(result.delivered.map((d) => d.clientSessionId)).toEqual(['block-b']);
    expect(outbox.peek()).toEqual([]);
  });

  it('D2.5 survives a reload, because the queue is the thing that outlives the tab', () => {
    outbox.enqueue(session('block-a'));

    // A fresh read of storage, as a new document would do.
    expect(outbox.peek().map((s) => s.clientSessionId)).toEqual(['block-a']);
    expect(outbox.size()).toBe(1);

    outbox.clear();
    expect(outbox.peek()).toEqual([]);
  });

  it('D2.6 is bounded, and drops the oldest rather than failing to save the newest', () => {
    for (let i = 0; i < outbox.OUTBOX_LIMIT + 5; i += 1) {
      outbox.enqueue(session(`block-${i}`));
    }

    const queued = outbox.peek();
    expect(queued).toHaveLength(outbox.OUTBOX_LIMIT);
    // The five oldest are gone; the most recent — the ones the user still remembers — are kept.
    expect(queued[0].clientSessionId).toBe('block-5');
    expect(queued.at(-1).clientSessionId).toBe(`block-${outbox.OUTBOX_LIMIT + 4}`);
  });
});
