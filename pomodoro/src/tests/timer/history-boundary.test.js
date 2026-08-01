import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Suite D4 — History's independence from the backend.
 *
 * History has no API of its own and makes no network call: it renders the records the Timer
 * already fetched and derives every view through the pure helpers in services/history.js. That is
 * the architecture, not an implementation detail — it is why there are no /stats endpoints and no
 * rollup tables to keep in step with the event log, and why the page has neither a spinner nor a
 * failure mode of its own.
 *
 * A rule that is only written down is a rule that erodes. One innocuous-looking import — a shared
 * helper that happens to reach api.js — would undo it silently, and nothing else in the suite would
 * notice, because everything would still work. It would just have quietly become a page that
 * fetches.
 *
 * So this walks the real import graph rather than asserting on behaviour.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Where History lives. Every one of these is a public entry point into the feature. */
const ENTRY_POINTS = [
  'pages/HistoryPage.jsx',
  'components/history/SummaryTile.jsx',
  'components/history/TrendTile.jsx',
  'components/history/ComparisonTile.jsx',
  'components/history/OutcomeTile.jsx',
  'components/history/RecentTile.jsx',
];

/**
 * Modules History must not reach, even transitively.
 *
 * `api.js` is the network itself; the three services are the modules that use it. `storage.js` is
 * here too: History reading persisted state directly would re-couple it to a storage shape the
 * Timer owns, which is the same mistake in a different direction.
 */
const FORBIDDEN = /services[\\/](api|tasks|sessions|outbox|storage)\.js$/;

/**
 * The shared application shell, and the one deliberate exception.
 *
 * AppLayout is the signed-in chrome every page renders inside — nav, avatar, sign-out. It reaches
 * the network through useAuth, and it always has: HistoryPage could reach api.js through
 * AppLayout -> useAuth -> settingsSlice before the Timer had an API at all.
 *
 * That is not the coupling §17.4 exists to prevent. The rule is that HISTORY does not fetch its own
 * data — that it has no loading state, no failure mode, and no endpoint of its own. Being wrapped
 * in a shell that knows how to sign you out does not make it a page that fetches.
 *
 * So the walk stops here, and D4.3 below pins the exception down: the shell must be the ONLY way a
 * networked module is reachable, so a history component importing a service directly still fails.
 */
const SHELL = 'components/AppLayout.jsx';

const IMPORT_RE = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;

function resolveImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  if (existsSync(base) && !base.endsWith('.css')) return base;
  for (const ext of ['.js', '.jsx']) {
    if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

/**
 * Every module reachable from `entry`, mapped to the chain that got there.
 * `stopAt` names modules that are recorded but not descended into.
 */
function reachableFrom(entry, { seen = new Map(), stopAt = [] } = {}) {
  const barriers = stopAt.map((path) => resolve(SRC, path));
  const stack = [[entry, [entry]]];

  while (stack.length > 0) {
    const [file, chain] = stack.pop();
    if (seen.has(file)) continue;
    seen.set(file, chain);
    if (barriers.includes(file)) continue;

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, match[1]);
      if (target && !target.endsWith('.css')) stack.push([target, [...chain, target]]);
    }
  }

  return seen;
}

function describeChain(chain) {
  return chain.map((file) => relative(SRC, file).replace(/\\/g, '/')).join('\n    -> ');
}

describe('D4. History is backend-agnostic (CONTRACT.md §17.4)', () => {
  it('D4.1 reaches no module that talks to the API or to persistence', () => {
    const reachable = new Map();
    for (const entry of ENTRY_POINTS) {
      const absolute = resolve(SRC, entry);
      expect(existsSync(absolute), `${entry} should exist`).toBe(true);
      reachableFrom(absolute, { seen: reachable, stopAt: [SHELL] });
    }

    const violations = [...reachable.entries()]
      .filter(([file]) => FORBIDDEN.test(file))
      .map(([, chain]) => describeChain(chain));

    expect(
      violations,
      violations.length > 0
        ? `History reached a networked module:\n    ${violations.join('\n\n    ')}`
        : ''
    ).toEqual([]);

    // A guard on the guard: if the walk stopped finding anything, the assertion above would pass
    // vacuously and this suite would go quietly useless.
    expect(reachable.size).toBeGreaterThan(10);
  });

  it('D4.2 aggregates through services/history.js, which is itself pure', () => {
    const historyService = resolve(SRC, 'services/history.js');
    const reachable = reachableFrom(historyService);

    // The seam only holds if the aggregation layer is genuinely free-standing: History is allowed
    // to depend on it precisely because it depends on nothing.
    expect([...reachable.keys()].filter((file) => FORBIDDEN.test(file))).toEqual([]);
    expect(reachable.size).toBe(1);
  });

  it('D4.3 reads its data from selectors that are themselves free of services', () => {
    /*
     * The reason selectors live in their own module rather than beside the thunks. If History
     * imported them from timerSlice.js, it would pull in the thunks and through them the API —
     * so the boundary would hold only by everyone continuing to be careful.
     */
    const selectors = resolve(SRC, 'store/timerSelectors.js');
    const reachable = reachableFrom(selectors);

    expect([...reachable.keys()].filter((file) => FORBIDDEN.test(file))).toEqual([]);
  });

  it('D4.4 owes its only networked path to the shared shell, not to anything of its own', () => {
    /*
     * Pins down the D4.1 exception. Without the shell in the graph there must be no route to the
     * network at all — so if a history component ever imports a service directly, or the shell
     * stops being the single exception, this fails.
     */
    const page = resolve(SRC, 'pages/HistoryPage.jsx');

    const withoutShell = reachableFrom(page, { stopAt: [SHELL] });
    expect([...withoutShell.keys()].filter((file) => FORBIDDEN.test(file))).toEqual([]);

    // And the exception is real rather than theoretical: the shell genuinely does reach the API,
    // which is why it has to be named explicitly instead of quietly passing.
    const withShell = reachableFrom(page);
    expect([...withShell.keys()].filter((file) => FORBIDDEN.test(file)).length).toBeGreaterThan(0);
  });
});
