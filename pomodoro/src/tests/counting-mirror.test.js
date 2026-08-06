import { describe, expect, it } from 'vitest';
import { summarize } from '../services/history.js';
import { COUNTING_VECTORS } from './fixtures/counting-vectors.js';

/*
 * THE OTHER HALF OF THE MIRROR (CONTRACT.md §24.1).
 *
 * `src/tests/fixtures/counting-vectors.js` is byte-for-byte identical to
 * `backend/test/fixtures/counting-vectors.ts`, and the backend asserts the same expectations against
 * its own fold in `src/domain/report-aggregation.spec.ts`.
 *
 * WHY BOTH SIDES ASSERT THE SAME NUMBERS. The email report is computed on the server and the History
 * dashboard is computed here, in two languages, in two npm packages with no shared workspace to put
 * one implementation in. Nothing but these vectors stops the two drifting — and the failure mode is
 * not a crash, it is a user opening a PDF that says 12 sessions next to a page that says 13, with no
 * way to tell which is lying.
 *
 * This is the same discipline §13.4/§15 already apply to `TITLES`, pointed at the aggregate
 * definitions instead.
 *
 * If a vector fails here and passes on the backend, `services/history.js` is the side that moved.
 */

describe('shared counting vectors — History side', () => {
  it.each(COUNTING_VECTORS.map((vector) => [vector.name, vector]))('%s', (_name, vector) => {
    const summary = summarize(vector.sessions, [], vector.gamification);

    expect(summary.completedSessions).toBe(vector.expected.completedSessions);
    expect(summary.terminatedSessions).toBe(vector.expected.terminatedSessions);
    expect(summary.totalSessions).toBe(vector.expected.totalSessions);
    expect(summary.focusMinutes).toBe(vector.expected.focusMinutes);
    expect(summary.completionRate).toBe(vector.expected.completionRate);

    // Rule 3: LIFETIME points, never the balance. One vector gives them different values so that
    // returning the wrong field is a failure here rather than a surprise when a sink ships (F5).
    expect(summary.points).toBe(vector.expected.points);
  });
});
