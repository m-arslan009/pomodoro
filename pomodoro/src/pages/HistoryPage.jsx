import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import AppLayout from '../components/AppLayout.jsx';
import SummaryTile from '../components/history/SummaryTile.jsx';
import TrendTile from '../components/history/TrendTile.jsx';
import ComparisonTile from '../components/history/ComparisonTile.jsx';
import OutcomeTile from '../components/history/OutcomeTile.jsx';
import RecentTile from '../components/history/RecentTile.jsx';
import { summarize, taskOutcomes, buildTimeline } from '../services/history.js';
import { selectFocusSessions, selectGamification, selectTasks } from '../store/timerSelectors.js';
import '../styles/HistoryPage.css';

/*
 * HistoryPage — the focus record, as a responsive grid of tiles.
 *
 * HISTORY MAKES NO NETWORK CALL, AND HAS NO BACKEND OF ITS OWN. It reads the records the Timer
 * already fetched and derives every view through the three pure helpers in services/history.js.
 * That is the whole architecture: History's contract is the shape of an AGGREGATE — a Summary, a
 * Bucket[], an Outcome[] — not the shape of a session, so it knows nothing about where the records
 * behind them came from (CONTRACT.md §17.1, §17.4).
 *
 * This is why there are no /stats endpoints and no rollup tables. A statistics API would be a
 * second source of truth to keep in step with the event log, and it would put a spinner and a
 * failure mode on a page that currently has neither.
 *
 * The import list is load-bearing: nothing here reaches services/api.js, any service that does, or
 * any slice thunk — even transitively. Selectors come from their own module for exactly that
 * reason.
 *
 * Loading and failure belong to HYDRATION, not to History — and since they belong to hydration, the
 * notice about them belongs to the SHELL, which owns hydration. This page therefore has no status
 * branch at all: it renders the store unconditionally, and AppLayout's banner says what is missing,
 * names the read that failed, and offers the retry (§17.4).
 *
 * That is not a tidy-up. A retry has to dispatch a thunk, so a Retry button rendered here would drag
 * services/api.js into this page's import graph and undo the one rule the feature is defined by.
 * The banner moved so that both halves of §17.4 could be true at once.
 *
 * The daily timeline is built ONCE and shared: the trend chart at its default range and the
 * comparison chart both want it, and each used to walk the full session list for identical output
 * (edge case E5).
 */

function HistoryPage() {
  // Focus intervals only — breaks are recorded but are not work (E12).
  const sessions = useSelector(selectFocusSessions);
  const tasks = useSelector(selectTasks);
  const gamification = useSelector(selectGamification);

  const summary = useMemo(
    () => summarize(sessions, tasks, gamification),
    [sessions, tasks, gamification]
  );
  const outcomes = useMemo(() => taskOutcomes(tasks), [tasks]);
  const dailyTimeline = useMemo(() => buildTimeline(sessions, 'daily'), [sessions]);

  return (
    <AppLayout>
      <div className="history-page">
        <header className="history-page__head">
          <h1 className="history-page__title">History</h1>
          <p className="history-page__subtitle">
            Your focus record — points, sessions, and how your tasks resolved.
          </p>
        </header>

        <div className="history-dashboard">
          <SummaryTile summary={summary} />
          <TrendTile sessions={sessions} dailyTimeline={dailyTimeline} />
          <ComparisonTile timeline={dailyTimeline} />
          <OutcomeTile outcomes={outcomes} />
          <RecentTile sessions={sessions} />
        </div>
      </div>
    </AppLayout>
  );
}

export default HistoryPage;
