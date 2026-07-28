import { useMemo } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import SummaryTile from '../components/history/SummaryTile.jsx';
import TrendTile from '../components/history/TrendTile.jsx';
import ComparisonTile from '../components/history/ComparisonTile.jsx';
import OutcomeTile from '../components/history/OutcomeTile.jsx';
import RecentTile from '../components/history/RecentTile.jsx';
import { getSessions, getTasks, getGamification } from '../services/storage.js';
import { summarize, taskOutcomes } from '../services/history.js';
import '../styles/HistoryPage.css';

/*
 * HistoryPage — aggregates the persisted focus history into a responsive grid of
 * glassmorphic tiles. It reads the same records the timer writes (sessions,
 * tasks, gamification) once on mount and derives every view through the pure
 * helpers in services/history.js, so the page itself stays declarative.
 *
 * Layout: a single vertically-prioritised column on mobile (summary first),
 * balancing into a two-column grid from 992px where the summary header and the
 * recent-sessions log span the full width and the two charts share a row.
 */

function HistoryPage() {
  // Snapshot storage on mount; the timer owns writes and retention (7-day window).
  const sessions = useMemo(() => getSessions(), []);
  const tasks = useMemo(() => getTasks(), []);
  const gamification = useMemo(() => getGamification(), []);

  const summary = useMemo(
    () => summarize(sessions, tasks, gamification),
    [sessions, tasks, gamification]
  );
  const outcomes = useMemo(() => taskOutcomes(tasks), [tasks]);

  return (
    <AppLayout>
      <div className="history-page">
        <header className="history-page__head">
          <h1 className="history-page__title">History</h1>
          <p className="history-page__subtitle">
            Your focus record over the last week — points, sessions, and how your tasks resolved.
          </p>
        </header>

        <div className="history-dashboard">
          <SummaryTile summary={summary} />
          <TrendTile sessions={sessions} />
          <ComparisonTile sessions={sessions} />
          <OutcomeTile outcomes={outcomes} />
          <RecentTile sessions={sessions} />
        </div>
      </div>
    </AppLayout>
  );
}

export default HistoryPage;
