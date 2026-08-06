import { useCallback, useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import Notification from '../components/Notification.jsx';
import TimerDurations from '../components/settings/TimerDurations.jsx';
import BaseTheme from '../components/settings/BaseTheme.jsx';
import ThemeEditor from '../components/settings/ThemeEditor.jsx';
import BackgroundLabels from '../components/settings/BackgroundLabels.jsx';
import EmailReports from '../components/settings/EmailReports.jsx';
import useSettings from '../hooks/useSettings.js';
import '../styles/SettingPage.css';

/*
 * SettingPage — user preferences, scoped to the forest .app-shell so it reuses the shared
 * glass/forest tokens (--fg-*, --glass-*) exactly like the Timer and History dashboards.
 *
 * Sections, top to bottom:
 *   - Timer durations — the two Pomodoro lengths.
 *   - Base theme — System / Dark colour scheme.
 *   - Theme editor — recolour the forest palette.
 *   - Background & labels — shell background + timer labels.
 *
 * Every section is available to every account: theming is a capability, not a reward, so none of
 * them is gated (CONTRACT.md §9.4).
 *
 * This page is composition and page-level state only. Persistence is the server (§4.7, §4.8) and
 * each section saves on its own action, PATCHing only the keys it owns — so two sections cannot
 * overwrite each other, which is why the endpoint is a PATCH rather than a PUT (§4.8). The
 * response is adopted wholesale; submitted values are never written into state, because the
 * server trims and normalises them.
 *
 * The page renders on defaults while the fetch is in flight and stays fully usable if it fails:
 * a partial PATCH cannot write defaults over a stored row, so editing after a failed read is
 * safe (§8.2).
 */

function SettingPage() {
  const { settings, status, saving, save, reload } = useSettings();
  const [notification, setNotification] = useState(null);

  // Shared toast channel for every section.
  const notify = useCallback((type, message) => setNotification({ type, message }), []);

  /*
   * Sections that hold a draft are remounted whenever the stored settings change, which re-seeds
   * their buffers from the new saved values. `updatedAt` moves on every successful save and when
   * the initial fetch resolves — the two moments a draft is stale — and never while the user is
   * typing, so an edit in progress is not interrupted.
   */
  const savedAt = settings.updatedAt ?? 'defaults';

  async function handleRetry() {
    try {
      await reload();
    } catch {
      // The slice already holds the failure and the banner below is still rendering it.
    }
  }

  return (
    <AppLayout>
      <Notification
        type={notification?.type}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />

      <div className="settings-page">
        <header className="settings-page__head">
          <h1 className="settings-page__title">Settings</h1>
          <p className="settings-page__subtitle">
            Tune how long you focus and rest, and personalize the app.
          </p>
        </header>

        <div className="settings-stack">
          {status === 'loading' && (
            <p className="settings-notice settings-notice__text" role="status">
              Loading your preferences…
            </p>
          )}

          {status === 'error' && (
            <div className="settings-notice settings-notice--error" role="alert">
              <p className="settings-notice__text">
                We could not load your saved preferences, so these are the defaults. Anything you
                save here will still be stored.
              </p>
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={handleRetry}
              >
                Try again
              </button>
            </div>
          )}

          <TimerDurations
            key={`durations-${savedAt}`}
            workMinutes={settings.workMinutes}
            breakMinutes={settings.breakMinutes}
            onSave={save}
            saving={saving}
            onNotify={notify}
          />

          <BaseTheme theme={settings.theme} onSave={save} saving={saving} onNotify={notify} />

          <ThemeEditor
            key={`palette-${savedAt}`}
            customTheme={settings.customTheme}
            onSave={save}
            saving={saving}
            onNotify={notify}
          />

          <BackgroundLabels
            key={`appearance-${savedAt}`}
            background={settings.background}
            labels={settings.labels}
            onSave={save}
            saving={saving}
            onNotify={notify}
          />

          {/*
           * The one section that is not part of /me/settings. It owns its own read and write
           * because a report subscription lives in its own table with delivery state the settings
           * payload must never carry (§23.1) — so it takes no settings props and is not remounted
           * by `savedAt`.
           */}
          <EmailReports onNotify={notify} />
        </div>
      </div>
    </AppLayout>
  );
}

export default SettingPage;
