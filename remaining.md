# Remaining Work — Pomodoro Focus & Gamification App

> Status tracker for cross-conversation continuity. Maps the current implementation
> against the phased plan in [`.claude/idea.md`](.claude/idea.md).
> **Phase 1 is complete.** This file focuses on **Phase 2 (gamification engine)** and
> **Phase 3 (title-gated features + statistics)**.
>
> _Last analyzed: 2026-07-22._
>
> **Progress update (2026-07-22):** the gating foundation now exists —
> `services/gamification.js` (`POINTS` + `TITLES` + pure functions),
> `hooks/useFeatureGate.js`, and a real `components/FeatureGate.jsx`
> (visible-but-disabled preview). Lifetime points are tracked in `storage.js` as a
> monotonic total (never regresses on penalties) via `getLifetimePoints`, without
> disturbing the timer's existing `{ points, streak }` writes. **All Settings-page
> features are done:** base theme toggle (always available) + gated theme editor
> (Anchor), background + custom labels (Pace Setter), and scheduling (Paragon),
> with appearance applied app-wide from `AppLayout`/`main.jsx`. History charts are
> gated behind Catalyst/Vanguard. **Timer Phase 2 is now complete:** the engine is
> wired to `services/gamification.js`, lifetime/balance are split, `TitleBadge`
> (rank + progress-to-next) shows in `PointsTile`, and crossing a threshold fires a
> new-title toast. _Still open:_ mounting `TitleBadge` app-wide in `AppLayout` and a
> standalone "Titles" section (Profile/Stats).

---

## TL;DR — the two structural gaps

1. **No `services/gamification.js`** — the plan's single source of truth for `POINTS`
   + `TITLES` and the pure functions (`applyCompletion`, `applyTermination`,
   `titlesFor`, `isFeatureUnlocked`) was never created. Point/streak/penalty logic
   lives **inline in `TimerPage.jsx`** instead (flagged for migration at
   `TimerPage.jsx:40`).
2. **No title/gating layer** — `hooks/useFeatureGate.js` was never created;
   `components/TitleBadge.jsx` and `components/FeatureGate.jsx` are **one-line
   placeholders**. Consequently the entire **Titles economy** and **all five
   title-gated features** are absent.

The points/streak/penalty *mechanics* work and persist. What's missing is everything
built on top of **lifetime points → titles → gated features**.

---

## Phase 2 — Gamification engine

### ✅ Done
- +100 on work completion, streak advance — `TimerPage.jsx` (`handleComplete`).
- +50 bonus every 3rd consecutive completion — `TimerPage.jsx`.
- −200 on terminate, balance floored at 0, streak reset — `TimerPage.jsx` (`handleTerminate`).
- Toast feedback on complete/terminate — `Notification`.
- Points + streak persisted across refresh — `storage.js` (`getGamification` /
  `saveGamification`, shape `{ points, streak }`).
- Points/streak UI — `components/timer/PointsTile.jsx` (score, streak, milestone
  dots, daily-session goal bar).

### ✅ Done (Timer page, 2026-07-22)
- **Lifetime points vs spendable balance split** — `TimerPage` now tracks a
  penalty-affected `balance` (the score) separate from monotonic `lifetimePoints`
  (drives titles); both persist, with the legacy `points`/`streak` fields kept for
  the History page.
- **Titles config + unlock logic** — `services/gamification.js` (`TITLES`,
  `titlesFor`, `applyCompletion`/`applyTermination`); `unlockedTitles` computed and
  stored.
- **Progress bar toward next title threshold** — real `components/TitleBadge.jsx`
  (current rank + progress-to-next with remaining lifetime points) rendered in
  `PointsTile`.
- **New-title-unlocked feedback** — `applyCompletion` reports crossed thresholds;
  crossing one fires a celebratory unlock toast naming the title.
- **Engine extraction** — inline point/streak/penalty math replaced by the service's
  pure functions in `handleComplete`/`handleTerminate`.

### ❌ Left behind
- **Current-title badge in the AppLayout shell** — `TitleBadge` now exists and shows
  on the dashboard (`PointsTile`), but is not yet mounted app-wide in `AppLayout`.
- **"Titles" section** listing all five with locked/unlocked state (planned for
  Profile or Stats).

**Verdict: Timer gamification complete.** The remaining titles-layer work is
surfacing (badge in the shell + a full Titles list) outside the Timer page.

---

## Phase 3 — Title-gated features + Statistics

### ✅ Done
- Baseline stats — `HistoryPage.jsx` + `services/history.js` (`summarize`): totals,
  completion rate, streak, focus minutes.
- Charts from real session history — `TrendTile` (AreaTrendChart), `ComparisonTile`
  (ComparisonBarChart), `OutcomeTile`, `RecentTile`.

### ⚠️ Partial / substituted
- **Dedicated `pages/StatsPage.jsx`** — not created; `HistoryPage` serves as the
  stats surface. Functionally covered, but not the named file/route from the plan.
  _(Decision needed: keep History as the stats surface, or add a StatsPage route.)_

### ✅ Done (History gating)
- **Catalyst → Time-utilization visualization** — the Focus-trend tile (`TrendTile`)
  is now gated behind Catalyst via `GatedTile` + `useFeatureGate`; while locked the
  interval control is hidden and the daily preview is inert.
- **Vanguard → Detailed graphical reports** — the Completed-vs-terminated tile
  (`ComparisonTile`) and Task-outcomes tile (`OutcomeTile`) are gated behind Vanguard
  through the same wrapper. The KPI summary and recent-sessions log stay ungated as
  the always-available baseline (the log doubles as the accessible data fallback).

### ❌ Left behind
- **`<FeatureGate feature="…">` wrapper** (visible-but-disabled preview + "Reach
  {Title} to unlock") — placeholder only.
- **`hooks/useFeatureGate.js` / `isFeatureUnlocked`** — not created.
- **Anchor → Theme editor** (custom CSS-variable theme, writes `settings.customTheme`)
  — missing. Settings only edits work/break durations; no base theme toggle either.
- **Pace Setter → Background image + custom labels** — no UI; `settings.backgroundImage`
  / `settings.customLabels` never written.
- **Paragon → Scheduling** (start time / schedule tasks) — no UI or data.
- **Gating mechanism** — no preview→interactive transition anywhere in the app.

**Verdict: ~25% done.** The statistics/charts surface is genuinely strong (arguably
exceeds the plan) but ships as always-on History rather than title-gated Stats. None
of the five gated features and no gating infrastructure exist.

---

## Per-page snapshot

| Page / module | Done | Left behind |
|---|---|---|
| **Timer** (`pages/TimerPage.jsx`) | Phase 1 + Phase 2 complete: engine wired to `services/gamification.js` (`applyCompletion`/`applyTermination`), lifetime-vs-balance split, `TitleBadge` (rank + progress-to-next) in `PointsTile`, new-title unlock toast | Mount `TitleBadge` app-wide in `AppLayout`; standalone "Titles" section |
| **History** (`pages/HistoryPage.jsx`) | Stats surface: KPIs + 4 chart/log tiles from real persisted data; **charts gated behind Catalyst/Vanguard** via `GatedTile` + `useFeatureGate` | Decide on separate `StatsPage` route |
| **Settings** (`pages/SettingPage.jsx`) | Phase 1 durations **+ base theme toggle, gated theme editor (Anchor), background + labels (Pace Setter), scheduling (Paragon)** — all done | — |
| **Profile** (`pages/ProfilePage.jsx`) | Editable account details + password change (beyond Phase 1) | Titles section; title badge |
| **`components/TitleBadge.jsx`** | Built: current title + progress-to-next-threshold bar (`styles/TitleBadge.css`), rendered in `PointsTile` on the dashboard | Mount app-wide in `AppLayout` |
| **`components/FeatureGate.jsx`** | Built: visible-but-disabled (`inert`) preview + "Reach {Title} to unlock" hint | — |
| **`services/gamification.js`** | Built: `POINTS` + `TITLES` config and pure functions (`titlesFor`, `currentTitle`, `nextTitle`, `progressToNext`, `isFeatureUnlocked`, `applyCompletion`, `applyTermination`); **now wired into the Timer** (`handleComplete`/`handleTerminate`) | — |
| **`hooks/useFeatureGate.js`** | Built: resolves `unlocked` + required title from lifetime points | — |

---

## Suggested build order

**Phase 2 first (Phase 3 gating depends on it):**
1. Create `services/gamification.js` — `POINTS` + `TITLES` constants and pure
   functions; split `lifetimePoints` (titles) from spendable `balance` (penalties) in
   `storage.js`.
2. Compute + persist `unlockedTitles` from lifetime points.
3. Build real `TitleBadge` (current title + progress-to-next-threshold), mount in
   `AppLayout`.
4. Add a "Titles" section (all five, locked/unlocked) + new-title toast.

**Then Phase 3:**
5. Build `FeatureGate` + `useFeatureGate` / `isFeatureUnlocked`.
6. Implement the five features: theme editor (Anchor), background + custom labels
   (Pace Setter), scheduling (Paragon) — all new; and **gate** the already-built
   time-utilization (Catalyst) and graphical reports (Vanguard).
7. Resolve History-vs-`StatsPage` decision.

> Charts: follow the **`dataviz` skill** before writing any new chart code.
