import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Suite D6 — reading the whole window (CONTRACT.md §16.6, §17.2, §17.3).
 *
 * `limit` caps a PAGE; the 180 days and 5 000 records cap the WINDOW. Issuing one request and
 * leaving `nextCursor` unread silently replaces the second bound with the first, which is how
 * History came to hold at most 100 sessions against a 3 600-record budget — the 7-day prune that
 * T1 deleted, re-implemented as a page size (defect F12).
 *
 * The defect it guards against is SILENT. Every chart still rendered, every total still looked
 * plausible, and only the empty wide-view buckets hinted that months were missing. So these tests
 * assert the count and the request sequence, not merely that something came back.
 *
 * Two levels: the services own the cursor loop (a cursor is a payload shape, and the slice knows
 * none), and the slice owns what a settled read does to state.
 */

vi.mock('../../services/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const { api } = await import('../../services/api.js');
const { fetchAllSessions, MAX_HYDRATION_PAGES } = await import('../../services/sessions.js');
const { fetchAllTasks } = await import('../../services/tasks.js');

function session(clientSessionId) {
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
  };
}

/** `pages` pages of `size` records each, the last one closing the cursor. */
function pagedSessions(pages, size = 100) {
  let issued = 0;
  return async (url) => {
    issued += 1;
    const sessions = Array.from({ length: size }, (_, i) => session(`s-${issued}-${i}`));
    return { sessions, nextCursor: issued < pages ? `cursor-${issued}` : null, url };
  };
}

describe('D6. Reading the whole window (services + hydration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('D6.1 follows nextCursor until the server runs out, and returns every record', async () => {
    vi.mocked(api.get).mockImplementation(pagedSessions(4));

    const { sessions, truncated } = await fetchAllSessions({ from: '2026-02-01T00:00:00.000Z' });

    // Four pages, not one. The single-page version returned 100 here and looked entirely healthy.
    expect(api.get).toHaveBeenCalledTimes(4);
    expect(sessions).toHaveLength(400);
    expect(truncated).toBe(false);
  });

  it('D6.2 asks for the largest page the API allows, and carries the cursor forward', async () => {
    vi.mocked(api.get).mockImplementation(pagedSessions(3, 2));

    await fetchAllSessions({ from: '2026-02-01T00:00:00.000Z' });

    const urls = vi.mocked(api.get).mock.calls.map(([url]) => url);

    // The window is a parameter of every page, not just the first — dropping it on page two would
    // quietly widen the read.
    expect(urls.every((url) => url.includes('from=2026-02-01'))).toBe(true);
    expect(urls.every((url) => url.includes('limit=100'))).toBe(true);

    // The first request carries no cursor; each later one carries the previous page's.
    expect(urls[0]).not.toContain('cursor=');
    expect(urls[1]).toContain('cursor=cursor-1');
    expect(urls[2]).toContain('cursor=cursor-2');
  });

  it('D6.3 stops at the record cap and says so rather than looping forever', async () => {
    // A server that never closes the cursor — the shape of an account that has outgrown the client.
    vi.mocked(api.get).mockImplementation(async () => ({
      sessions: [session(`s-${Math.random()}`)],
      nextCursor: 'always-more',
    }));

    const { truncated } = await fetchAllSessions({}, { maxPages: 3 });

    expect(api.get).toHaveBeenCalledTimes(3);

    /*
     * Reaching the cap is not an error, it is the IndexedDB (N7) trigger — and it is REPORTED, so
     * the banner can tell the user their view is bounded. A chart the user has silently outgrown
     * is a chart that lies.
     */
    expect(truncated).toBe(true);
  });

  it('D6.4 derives its cap from the 5 000-record storage bound', () => {
    // 5 000 / 100. If the storage bound moves this moves with it, and nothing else changes.
    expect(MAX_HYDRATION_PAGES).toBe(50);
  });

  it('D6.5 hands each page over as it arrives instead of holding them all back', async () => {
    vi.mocked(api.get).mockImplementation(pagedSessions(3, 2));

    const seen = [];
    await fetchAllSessions({}, { onPage: (page) => seen.push(page.length) });

    /*
     * At full volume this loop is ~36 sequential round trips. The dashboard has to fill in rather
     * than wait on the last of them, so pages are adopted one at a time.
     */
    expect(seen).toEqual([2, 2, 2]);
  });

  it('D6.6 pages the backlog too, so a long-lived to-do list is never cut off', async () => {
    let issued = 0;
    vi.mocked(api.get).mockImplementation(async () => {
      issued += 1;
      return {
        tasks: Array.from({ length: 100 }, (_, i) => ({
          id: `t-${issued}-${i}`,
          title: 'Thesis chapter 3',
          status: 'todo',
          estimatedPomodoros: null,
          createdAt: '2026-01-02T08:00:00.000Z',
          completedAt: null,
          updatedAt: '2026-01-02T08:00:00.000Z',
        })),
        nextCursor: issued < 2 ? 'more' : null,
      };
    });

    const { tasks } = await fetchAllTasks({ status: 'todo' });

    // An open task is a commitment, not history, so it is never out of window — and never off the
    // end of the first page either.
    expect(tasks).toHaveLength(200);
  });
});
