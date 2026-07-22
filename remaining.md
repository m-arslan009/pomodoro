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
> with appearance applied app-wide from `AppLayout`/`main.jsx`. _Still open:_
> `TitleBadge` + titles section + new-title toast + full engine migration into the
> timer (Phase 2 UI), and gating the History charts behind Catalyst/Vanguard.

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

### ❌ Left behind
- **Lifetime points vs spendable balance split** — only a single `points` total
  exists; penalties reduce the same number titles should key off. Need
  `lifetimePoints` (never lost) separate from `balance` (penalty-affected).
- **Titles** — Anchor (1000), Pace Setter (2000), Catalyst (4000), Vanguard (8000),
  Paragon (16000). No `TITLES` config, no unlock logic, `unlockedTitles` not stored.
- **Current-title badge in AppLayout** — `TitleBadge.jsx` is a placeholder and is not
  rendered in `AppLayout`.
- **Progress bar toward next title threshold** — `PointsTile` has a *daily-session*
  bar, not a *title-threshold* bar.
- **"Titles" section** listing all five with locked/unlocked state (planned for
  Profile or Stats).
- **New-title-unlocked feedback** — no threshold-crossing detection.
- **Engine extraction** — move inline logic into `services/gamification.js` and wire
  its pure functions in (as the plan specifies).

**Verdict: ~50% done.** Mechanics solid; the entire titles layer (which Phase 3
depends on) is missing.

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
- **Catalyst → Time-utilization visualization** — data + charts exist
  (`focusMinutes`, `buildTimeline`) but are **always visible, not gated** behind the
  Catalyst title.
- **Vanguard → Detailed graphical reports** — rich charts exist on History but are
  **always on, not gated** behind Vanguard.

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
| **Timer** (`pages/TimerPage.jsx`) | Phase 1 complete; Phase 2 points/streak/penalty engine complete & persisted | Title badge; title-progress bar; extract engine to `services/gamification.js`; lifetime-vs-balance split |
| **History** (`pages/HistoryPage.jsx`) | Stats surface: KPIs + 4 chart/log tiles from real persisted data | Gate charts behind Catalyst/Vanguard; decide on separate `StatsPage` route |
| **Settings** (`pages/SettingPage.jsx`) | Phase 1 durations **+ base theme toggle, gated theme editor (Anchor), background + labels (Pace Setter), scheduling (Paragon)** — all done | — |
| **Profile** (`pages/ProfilePage.jsx`) | Editable account details + password change (beyond Phase 1) | Titles section; title badge |
| **`components/TitleBadge.jsx`** | — | Placeholder → build (current title + progress to next threshold), mount in `AppLayout` |
| **`components/FeatureGate.jsx`** | Built: visible-but-disabled (`inert`) preview + "Reach {Title} to unlock" hint | — |
| **`services/gamification.js`** | Built: `POINTS` + `TITLES` config and pure functions (`titlesFor`, `currentTitle`, `nextTitle`, `progressToNext`, `isFeatureUnlocked`, `applyCompletion`, `applyTermination`) | Wire `applyCompletion`/`applyTermination` into the timer (currently still inline) |
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
