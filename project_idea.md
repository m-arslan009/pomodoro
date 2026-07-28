# Plan: Pomodoro Focus & Gamification Web App (Frontend-Only)

## Context
The user wants a frontend-only React web app built around the Pomodoro technique (default 25 min focus / 5 min break, both adjustable). It helps users focus on daily tasks and stay motivated through a points-and-titles gamification system. Core needs:

- A timer with **start, pause/resume, restart, and terminate** controls.
- Every session is **linked to a task** and **recorded** with a status: `completed` or `terminated`.
- **History + statistics** of past sessions.
- A **points economy**: +100 per completed session, +50 bonus every 3 consecutive completions, −200 penalty on terminate.
- **Titles** unlocked at doubling thresholds (1000, 2000, 4000, 8000, 16000), each unlocking a new feature.
- **Feature gating** that is *previewable* (locked features are visible but disabled with a "Reach {Title} to unlock" hint).
- Editable profile + working/break durations + theme.

The project is a fresh Vite 8 + React 19 (JavaScript/JSX) boilerplate at `D:\Internship\pomodoro-frontend\` with empty `components/`, `pages/`, `styles/`, `services/` folders, plain CSS with a working light/dark theme (`src/index.css`), and oxlint. No routing, state, or storage yet — a clean slate.

### Decisions locked with the user
| Topic | Decision |
|---|---|
| Persistence | **Browser localStorage** |
| Sequencing | **Phased** (core → gamification → gated features) |
| Feature gating | **Gated but previewable** (visible-but-disabled with unlock hint) |
| Tasks ↔ sessions | **Session linked to a task** (pick/create task before starting) |
| Titles basis | **Lifetime points earned** (never lost to penalties) |
| Point balance floor | **Floor at zero** (never negative) |
| Streak rule | **Terminate resets streak**; +50 on every 3rd consecutive success |
| Navigation | **react-router-dom** with pages per view |

### Assumption to confirm at implementation
- Timer control semantics: **countdown reaching 0 = `completed`**; **Terminate = abandon early → recorded `terminated` + penalty**; **Restart = reset current focus interval to full (no penalty)**; **Pause/Resume = freeze/continue**. (The user listed both "stop" and "terminate"; treated as the same abandon action. Will confirm before building the timer.)

---

## Architecture

- **Routing:** add `react-router-dom`. Persistent `AppLayout` (top nav + points/title badge) wraps routes:
  - `/` — Timer (main)
  - `/history` — session history
  - `/stats` — statistics & reports
  - `/profile` — profile + settings
- **State:** React Context + `useReducer` (no external store needed for this size). One `AppProvider` composes settings, sessions, tasks, and gamification state, hydrated from localStorage on load and persisted on change.
- **Persistence layer:** `src/services/storage.js` — thin typed wrappers over `localStorage` (get/set/remove with JSON + try/catch + schema versioning key). All reads/writes go through this module, never `localStorage` directly.
- **Styling:** keep plain CSS + CSS custom properties (already themed). Shared tokens in `src/styles/`. Theme editor (gated) will write to the same CSS variables.

### localStorage schema (single namespace, versioned)
```
pomodoro.v1.user          -> { name, avatar?, createdAt }
pomodoro.v1.settings      -> { workMinutes:25, breakMinutes:5, longBreak?, theme:'system'|'light'|'dark',
                               customTheme?, backgroundImage?, customLabels? }
pomodoro.v1.tasks         -> [ { id, title, notes?, createdAt, status:'open'|'done', completedAt? } ]
pomodoro.v1.sessions      -> [ { id, taskId, taskTitle, plannedWorkMin, actualFocusMs,
                               startedAt, endedAt, status:'completed'|'terminated', pointsDelta } ]
pomodoro.v1.gamification  -> { lifetimePoints, balance, currentStreak, unlockedTitles:[] }
```

### Gamification config — single source of truth (`src/services/gamification.js`)
```js
export const POINTS = {
  sessionComplete: 100,
  consecutiveBonus: 50,
  consecutiveThreshold: 3,   // bonus on every 3rd consecutive success
  terminatePenalty: 200,     // subtracted; balance floors at 0
};
export const TITLES = [
  { key: 'anchor',     name: 'The Anchor',      threshold: 1000,  feature: 'themeEditor' },
  { key: 'paceSetter', name: 'The Pace Setter', threshold: 2000,  feature: 'backgroundAndLabels' },
  { key: 'catalyst',   name: 'The Catalyst',    threshold: 4000,  feature: 'timeUtilization' },
  { key: 'vanguard',   name: 'The Vanguard',    threshold: 8000,  feature: 'graphicalReports' },
  { key: 'paragon',    name: 'The Paragon',     threshold: 16000, feature: 'scheduling' },
];
```
- Values/thresholds are **configurable constants** here so tuning is a one-line change.
- Pure functions: `applyCompletion(state)`, `applyTermination(state)`, `titlesFor(lifetimePoints)`, `isFeatureUnlocked(state, featureKey)`. Titles derive from **lifetime** points; balance floors at 0; **terminate resets `currentStreak` to 0**.
- (Note: user's spellings "Catalist / Venguard" corrected to **Catalyst / Vanguard**; confirm if intentional.)

---

## Phase 1 — Core timer, tasks, sessions, history
Goal: a usable Pomodoro app with recording, no gamification yet.

- Install/config: add `react-router-dom`; set up `main.jsx` with `BrowserRouter` + `AppProvider`.
- `src/services/storage.js` — persistence wrappers.
- `src/context/AppContext.jsx` + `appReducer.js` — global state + hydration/persistence.
- `src/hooks/usePomodoroTimer.js` — **timestamp-based** countdown (compute remaining from `endTime` each tick to avoid drift and survive tab backgrounding); phases `work` → `break`; exposes `start, pause, resume, restart, terminate`, remaining ms, phase, isRunning.
- Pages/components:
  - `pages/TimerPage.jsx` — task picker/creator (required before start), circular countdown, controls, phase indicator.
  - `pages/HistoryPage.jsx` — list of session records (task, duration, status, date) with basic filter (all / completed / terminated) and simple counts.
  - `pages/ProfilePage.jsx` — edit name, work/break durations, base theme toggle (system/light/dark — always available).
  - `components/AppLayout.jsx` + `Nav` — shared shell.
- Session lifecycle: starting attaches selected task; reaching 0 on the work phase writes a `completed` record; terminate writes a `terminated` record. Store `actualFocusMs` for later stats.

**Verify:** `npm run dev`; start a session against a task, let a short (test-shortened) timer complete → appears in History as completed; terminate another → appears as terminated; refresh → data persists; edit durations in Profile → new sessions use them.

## Phase 2 — Gamification engine
Goal: points, streaks, penalties, titles, and their UI.

- Wire `services/gamification.js` pure functions into the reducer so session end updates `gamification` state atomically with the session record.
- On completion: +100, advance streak, +50 when `streak % 3 === 0`; recompute lifetime + unlocked titles; toast/feedback showing points earned and any new title.
- On terminate: −200 (floor 0), reset streak; feedback.
- UI: points + current title badge in `AppLayout`; a progress bar toward the next title threshold; a "Titles" section (e.g. on Profile or Stats) listing all five with locked/unlocked state.

**Verify:** complete sessions and watch points/streak/bonus accrue; reach 1000 lifetime → "The Anchor" unlocks and persists; terminate → −200, balance floors at 0, streak resets; titles never drop after penalties (lifetime basis).

## Phase 3 — Title-gated features (previewable) + Statistics
Goal: the five unlockable features, each visible-but-disabled until earned, plus the stats surface.

- `hooks/useFeatureGate.js` (or `isFeatureUnlocked`) + a `<FeatureGate feature="...">` wrapper that renders children when unlocked, else a disabled preview with "Reach {Title} to unlock".
- Features mapped to titles:
  1. **The Anchor → Theme editor:** customize CSS-variable color theme (writes `settings.customTheme`).
  2. **The Pace Setter → Background image + custom labels:** set a background image and rename/add labels.
  3. **The Catalyst → Time-utilization visualization:** focus-time breakdown (e.g. per day / per task).
  4. **The Vanguard → Detailed graphical reports:** richer charts on `pages/StatsPage.jsx`.
  5. **The Paragon → Scheduling:** set a start time / schedule tasks.
- `pages/StatsPage.jsx` — baseline stats always visible (totals, completion rate, streak); deeper visual reports (features 3 & 4) gated.
- Charts: **follow the `dataviz` skill** before writing any chart; likely add a lightweight lib (e.g. Recharts) or hand-rolled SVG — decided at Phase 3 start.

**Verify:** with points below a threshold, the matching feature shows a disabled preview + hint; after crossing the threshold it becomes interactive; theme editor changes apply live and persist; charts render from real session history.

---

## Files to create (representative)
- `src/main.jsx` (edit: add router + provider), `src/App.jsx` (replace boilerplate with `AppLayout` + routes)
- `src/services/storage.js`, `src/services/gamification.js`
- `src/context/AppContext.jsx`, `src/context/appReducer.js`
- `src/hooks/usePomodoroTimer.js`, `src/hooks/useFeatureGate.js`
- `src/components/AppLayout.jsx`, `Nav.jsx`, `Timer/*`, `TaskPicker.jsx`, `FeatureGate.jsx`, `TitleBadge.jsx`
- `src/pages/TimerPage.jsx`, `HistoryPage.jsx`, `StatsPage.jsx`, `ProfilePage.jsx`
- `src/styles/*` (tokens, shared)

## Cross-cutting
- Keep the existing plain-CSS + CSS-variable theming; do not introduce Tailwind.
- Respect oxlint rules (`react/rules-of-hooks`, `react/only-export-components`); keep hooks pure.
- Per project rules, `prompt.md` will get an entry for this significant product spec, and commits will follow `.claude/rules/github.md` (small scoped commits per functional unit), staging only after user confirmation.

## Verification (end-to-end, after all phases)
1. `cd D:\Internship\pomodoro-frontend && npm install && npm run dev`.
2. Create a task, run a (test-shortened) session to completion → History shows `completed`, points +100.
3. Complete 3 in a row → +50 bonus; terminate one → −200 (floored), streak resets.
4. Cross 1000 lifetime → "The Anchor" unlocks; theme editor becomes usable; below-threshold features show locked previews.
5. Refresh browser → all state (sessions, points, titles, settings) persists via localStorage.
6. `npm run build` succeeds; `npm run lint` (oxlint) is clean.
