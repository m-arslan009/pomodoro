/*
 * outbox.js — the bounded queue of finished sessions that have not reached the server.
 *
 * WHY THIS EXISTS. A finished focus block is 25 minutes of the user's life that already happened.
 * Losing it because the wifi dropped at the wrong second is the one failure this feature cannot
 * have, so finalization is local and unconditional, and delivery is a separate concern that
 * retries. Everything else in the app is online-only; this is the exception, and it is the
 * exception because the data is irreplaceable rather than merely inconvenient to re-enter.
 *
 * TASK EDITS DELIBERATELY DO NOT QUEUE. A task is a line of text retyped in three seconds; a
 * queue for it would need operation ordering, tombstones and provisional-id rewriting — a sync
 * engine, to protect something the user can simply type again (CONTRACT.md §17.7).
 *
 * The queue is bounded and FIFO. An unbounded one would grow silently until it exhausted the
 * storage quota, at which point it would fail to save the very records it exists to protect.
 */

import { recordSession } from './sessions.js';
import { getOutbox, saveOutbox } from './storage.js';

/** Oldest entries are dropped past this. 50 sessions is several days of heavy use. */
export const OUTBOX_LIMIT = 50;

/** Everything currently queued, oldest first. */
export function peek() {
  return getOutbox();
}

export function size() {
  return getOutbox().length;
}

/**
 * Queue a finalized record for delivery.
 *
 * Deduplicated by `clientSessionId`, so enqueueing the same block twice — a recovery racing a
 * normal finalize, say — cannot produce two attempts at one record.
 */
export function enqueue(session) {
  if (!session?.clientSessionId) return getOutbox();

  const queue = getOutbox().filter((item) => item.clientSessionId !== session.clientSessionId);
  queue.push(session);

  // Oldest first out. A queue this full means delivery has been broken for a long time, and the
  // newest records are the ones the user is most likely to still care about.
  const bounded = queue.slice(-OUTBOX_LIMIT);
  saveOutbox(bounded);
  return bounded;
}

/** Drop one record by client id, whatever its outcome. */
export function remove(clientSessionId) {
  const queue = getOutbox().filter((item) => item.clientSessionId !== clientSessionId);
  saveOutbox(queue);
  return queue;
}

export function clear() {
  saveOutbox([]);
}

/**
 * Attempt delivery of everything queued, oldest first.
 *
 * Three outcomes per record, and the distinction between the last two is the whole design:
 *
 *   delivered — the server stored it (or already had it: a repeated clientSessionId answers 200
 *               with the original record, so a retry is success and not an error).
 *   rejected  — the server refused it on the merits (4xx). Retrying cannot help, so it leaves the
 *               queue, but it is RETURNED so the caller can keep and surface it. A record the
 *               server will never accept must still not vanish silently.
 *   deferred  — the network or the server failed (5xx, or no answer at all). It stays queued.
 *
 * Stops at the first deferral rather than working through the rest: if the connection is down,
 * the remaining requests will fail too, and ordering is preserved for free.
 *
 * @returns {Promise<{delivered: Array, rejected: Array, remaining: number}>}
 */
export async function flush() {
  const delivered = [];
  const rejected = [];

  for (const queued of getOutbox()) {
    try {
      const { session, gamification } = await recordSession(queued);
      delivered.push({ session, gamification, clientSessionId: queued.clientSessionId });
      remove(queued.clientSessionId);
    } catch (error) {
      // 4xx: the server has decided. Anything else is a failure of delivery, not of the record.
      const isRefusal = error?.status >= 400 && error?.status < 500;

      if (!isRefusal) break;

      rejected.push({
        clientSessionId: queued.clientSessionId,
        detail: error?.detail ?? error?.message ?? 'The server rejected this session.',
      });
      remove(queued.clientSessionId);
    }
  }

  return { delivered, rejected, remaining: size() };
}
