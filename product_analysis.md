# Evergrove — Strategic Product Analysis

## Context

Evergrove is a frontend-only React/Vite Pomodoro app (`pomodoro-frontend/`) with a points-and-titles
gamification layer. The implementation is genuinely finished — 7 real pages, 20 real components,
hand-rolled SVG charts, 9 test files, a working timestamp-based timer, consistent glassmorphic
design, real accessibility work (`inert` gating, `prefers-reduced-motion` in 10 places).
**This is not a scaffold problem. The engineering is ahead of the product thinking.**

This document challenges the product concept rather than the code. Direction confirmed with the
user: **internship deliverable now, real product later**; **the gamification spec is open to
redesign where justified**; **no backend now, but the data layer should be designed so one drops
in cleanly.**

The core finding: the app's motivational spine and its utility are wired against each other. The
fix is structural, not cosmetic, and it is cheaper to make now than at any later point.

---

## 1. What this product actually is today

Strip the framing away and Evergrove is: *a single-user Pomodoro timer that awards 100 points per
finished countdown, deducts 200 for honesty, and withholds its analytics until you've used it for
three weeks.*

That's the honest read. The parts worth defending:

- **The timer engine is correct.** Timestamp-derived remaining time (`usePomodoroTimer.js:69`)
  survives tab throttling — a real bug in many competitors. Test A1.3 asserts it.
- **The gamification service is well-factored.** `gamification.js` is pure, config-driven, and the
  lifetime/balance split is a genuinely smart piece of design.
- **Terminated sessions record real elapsed time** (`TimerPage.jsx:246`), not nominal. This is the
  most valuable and most under-exploited line in the codebase — see §6.
- **Accessibility is above the bar** for a project of this size.

The parts that don't survive scrutiny are all product decisions, and they're below.

---

## 2. The real problem, and who actually has it

The docs say the product helps "individuals doing daily focused work." That's not a segment, and
the feature set quietly targets two conflicting ones:

| Signal | Implied user |
|---|---|
| Points, titles, streaks, penalties | **Students / self-directed learners** — extrinsic progression resonates, low ability to self-regulate |
| Graphical reports, scheduling, time-utilization | **Knowledge professionals** — need records, planning, billability |

These want opposite products. Professionals find points patronising and want export and
integrations. Students want momentum and identity and will never open a "time utilization
breakdown."

**Recommendation: commit to self-directed learners** (students, bootcampers, thesis writers,
career-switchers). Reasoning: (a) it's the only segment where a points-and-titles economy is a
feature rather than an embarrassment; (b) the competitive set there — Forest, Study Together — is
beatable on diagnostics, which nobody in that space does; (c) it matches what's already built.

The real problem for that user is **not** "I need a timer." Timers are free and infinite. It is:
*"I sit down intending to focus and I don't know why it keeps failing."* Nothing in the product
currently answers that question. That gap is the opportunity.

---

## 3. The five structural problems

### 3.1 The gating map inverts value against effort — the single biggest flaw

The unlock ladder gates the product's core value proposition behind its longest wait.

Session math (`100n + 50·floor(n/3)`), at the default 25-minute focus block:

| Title | Threshold | Sessions | Focus hours | Realistic arrival\* | Unlocks |
|---|---:|---:|---:|---|---|
| The Anchor | 1 000 | 9 | 3.8 h | Week 1 | Theme colours |
| The Pace Setter | 2 000 | 18 | 7.5 h | Week 2 | Background + labels |
| The Catalyst | 4 000 | 35 | 14.6 h | **Week 3** | **Trend chart** |
| The Vanguard | 8 000 | 69 | 28.8 h | **Week 6** | **Reports** |
| The Paragon | 16 000 | 138 | 57.5 h | **Week 12** | **Scheduling** |

\* at ~12 sessions/week — already an optimistic, committed user.

Habit formation is won or lost in weeks 1–3. During that entire window the user's only feedback is
a number going up. The retrospective insight — the thing that would actually convince them the app
is working — arrives at week 3 at the earliest, and the *good* charts at week 6.

Meanwhile scheduling, a **day-one planning utility**, is behind 57 hours of focus. A user who needs
help starting must first demonstrate 138 successful starts. That is the definition of a mechanic
that helps only the people who don't need it.

Compare how games actually do this: World of Warcraft gates *mounts and transmog*, not the quest
log. Duolingo gates *streak freezes and outfits*, not your progress chart. **Cosmetics and flourish
are gated; the core feedback loop never is.** Evergrove has this exactly backwards.

There is also an accessibility problem hiding here: the theme editor is a **capability**, not a
cosmetic. A user who needs different contrast has to earn it with 3.8 hours of focus.

**Verdict: decouple progression from capability. Gate identity, never utility.**

### 3.2 The −200 penalty punishes honesty and is trivially avoidable

Four independent failures:

1. **It rewards the wrong behaviour.** The app cannot detect focus — only that a countdown reached
   zero. A user who walks away and lets it run gets **+100**. A user who honestly presses Terminate
   gets **−200 and a streak reset**. The system pays 300 points for dishonesty. Every measurement
   the app collects is corrupted by this incentive, which means the charts unlocked at Catalyst and
   Vanguard are charting a metric the economy taught the user to fake.
2. **It's avoidable by accident.** Timer state isn't persisted (§3.5), so hitting refresh voids the
   session with no record and no penalty. The penalty only lands on users who don't know this.
3. **It's behaviourally counterproductive.** Punishment produces avoidance of the *punisher*, not of
   the behaviour. Self-Determination Theory's over-justification effect is the specific risk:
   layering extrinsic points onto intrinsically-motivated work (your own studying) reliably erodes
   the intrinsic motivation. A bad day — two terminations — costs 400 points plus the streak; the
   rational response is to stop opening the app. This is sharply worse for the ADHD-adjacent users
   who most need a focus tool, where shame spirals are a known churn driver.
4. **The balance it deducts from is a currency with no sink.** `balance` can't buy anything. It is a
   number that goes down and does nothing. Loss without agency is just punishment.

**Verdict: remove the penalty. Replace termination with a one-tap reason capture** (see §6). This
also fixes the measurement integrity problem — the user now has a *reason* to report honestly,
because honesty buys them insight.

If the penalty must survive for spec reasons, the minimum viable fix is to give `balance` a sink
(streak freezes, grove cosmetics), so losing it is a trade-off rather than a scolding.

### 3.3 The app throws away the data its own value proposition depends on

Three self-contradictions, all confirmed in source:

- **`pruneSessions` deletes sessions older than 7 days** (`TimerPage.jsx:92`) — while
  `buildTimeline` builds **6 weekly and 6 monthly buckets** (`history.js:82-101`). The Weekly and
  Monthly views are structurally incapable of ever showing more than 7 days of data. **The reward
  for reaching The Vanguard at week 6 is a chart that is guaranteed to be mostly empty.** The most
  anticipated unlock in the product is designed to disappoint.
- **`SummaryTile` captions `gamification.balance` as "Lifetime points earned"** (`history.js:58` →
  `SummaryTile.jsx:41`). The headline number on the History page is the wrong number, mislabelled —
  in an app whose entire motivational spine is the lifetime/balance distinction.
- **Tasks expire after 24h** (`TimerPage.jsx:84`). Real work spans days. Silently marking a user's
  unfinished thesis chapter `expired` overnight is a mechanic that will actively annoy.

Deeper: **"lifetime points" live in `localStorage`.** Clearing browser data destroys months of
progress with no export, no warning, no recovery. A product whose core promise is permanent
accumulation stored it in the most volatile client store available. That contradiction is fatal to
trust the first time it bites someone.

### 3.4 Nothing brings the user back tomorrow

For a habit product this is the most consequential omission. There is:

- **No day-based streak.** The streak counts *consecutive sessions*, not consecutive days, and
  resets on a single termination. It doesn't reward returning, and it's brittle enough to cause the
  abandonment Duolingo invented Streak Freeze to prevent.
- **No notification or sound on session end.** The timer must be watched, which defeats it.
- **No reminders.** Scheduling — the one feature that *could* pull users back — is gated to week 12
  **and is inert**: `Scheduling.jsx` persists `settings.schedule` and nothing ever reads it. That's
  worse than not shipping it; the app makes a promise it silently breaks.
- **No daily ritual.** No "plan tomorrow," no end-of-day close-out.

Retention is the entire game for a habit app, and the product currently has zero retention
mechanics. Everything else in this document is secondary to this.

### 3.5 Two P0 functional breaks

- **Sign-up creates accounts that can never log in.** `SignUpPage` → `saveUser()` writes to
  `pomodoro.v1.users`; `LogInPage` → `verifyCredentials()` only ever checks the hardcoded `admin`
  account (`auth.js`). `getUsers()` is used *solely* for duplicate-checking. The first step of the
  funnel is a dead end by construction — and it's covered by passing tests, because the tests assert
  the two halves separately and never the join.
- **A refresh mid-session silently voids it.** No record, no penalty, no notice. For a timer app
  this is the most visible defect in the product.

---

## 4. Competitive reality

| Product | Its actual moat | What Evergrove has instead |
|---|---|---|
| **Forest** (100M+) | *Enforcement* — leaving the app kills your tree. Symbolic, immediate, visual. Real trees planted. | A number decreases. No enforcement, no symbolism, no stakes. |
| **Habitica** | A real economy — gold **buys** things; parties and quests make it social. | A currency with no sink and no other humans. |
| **Duolingo** | Day-streaks + freezes + leagues. Social comparison is the strongest retention lever known. | No day-streak, no freeze, no social. |
| **Pomofocus / Focus To-Do** | Free, frictionless, reports included from minute one. | Same features, gated for 3–6 weeks. |
| **Toggl / RescueTime** | The analytics *are* the product; passive capture; export. | Analytics gated; 7-day retention; no export. |
| **Sunsama** ($20/mo) | The daily planning ritual. | No ritual. |

**Uncomfortable conclusion: Evergrove currently has no differentiator.** It is a competent Pomodoro
timer whose one distinguishing feature — gamification — is the weakest available form of it (points
without a sink, punishment without agency, cosmetic unlocks without an audience).

Note what every winner above has in common: **their gamification is either social or enforcing.**
Solo, non-enforcing cosmetic rewards — exactly what Evergrove built — are the one variant with no
evidence behind it. A theme colour nobody else sees is not a reward.

---

## 5. Where the idea is genuinely strong

Being fair, three things are real assets:

1. **The title names are excellent.** The Anchor / Pace Setter / Catalyst / Vanguard / Paragon read
   as *identity*, not score. Identity-based motivation ("I'm the kind of person who focuses")
   outperforms point-based motivation decisively. This is the strongest thing in the spec and it's
   currently wasted as a key into a feature-flag table.
2. **The lifetime/balance split** is genuinely well-designed — earned status never regresses. Keep
   it; it's the right instinct even though `balance` currently has nothing to do.
3. **The forest/grove metaphor** is coherent and underused. "Plant your focus, watch your progress
   grow" promises a living thing that accumulates. The app delivers a number in a glass box.

---

## 6. The recommended repositioning

> **From focus *scorekeeper* to focus *diagnostic*.**
> Every other app tells you how much you focused. Evergrove tells you **why you stopped**.

This is buildable with no backend, it's differentiated, and the enabling data is *already being
captured* — `TimerPage.jsx:246` records true elapsed time on termination and then throws the insight
away.

Three mechanics, in value order:

**A. Termination reason capture.** Replace the penalty with four buttons on Terminate:
*Interrupted · Wrong task · Finished early · Out of energy.* One tap, zero friction, dismissible.
This converts the product's biggest liability into its biggest asset:

- Termination becomes **virtuous** — honesty now buys insight, fixing the incentive corruption in
  §3.2.
- It produces attribution data nobody else has: *"You abandon most often ~7 minutes in, on tasks
  created the same day, after 3pm."* That sentence is worth more than every chart in the app.
- It reframes the app from judge to mirror — the correct posture for the ADHD-adjacent users who
  need it most.

**B. Estimation calibration.** Ask "how many pomodoros?" when creating a task; compare to actual.
Almost nobody does this well, and it builds a genuine **skill** — the user gets better at predicting
their own work. That's SDT *competence*, an intrinsic motivator that doesn't decay the way points
do.

**C. The daily close-out.** A 30-second end-of-day review: what got done, what didn't, what's
tomorrow. This is the retention ritual — the reason to come back — and it's what Sunsama charges
$20/month for.

Keep the five titles. Change what they mean: **titles mark identity and unlock grove cosmetics
(tree species, seasons, grove skins) — never capability.** The metaphor already supports it, and
it's the honest version of the cosmetic ladder that's there now.

---

## 7. Feature triage

### MUST-HAVE — ship before anything else

| # | Item | Why |
|---|---|---|
| M1 | **Ungate the analytics.** Trend, comparison, and outcome charts visible from session one. | §3.1. Gating the core feedback loop during habit formation is the product's central error. Delete the `timeUtilization` / `graphicalReports` gates. |
| M2 | **Ungate theme editor, backgrounds, labels, scheduling.** | Capability, not reward. Theming is an accessibility concern (§3.1). |
| M3 | **Fix sign-up → login.** Route `verifyCredentials` through `getUsers()`; store a salted hash, never plaintext. Add the integration test the current suite is missing. | §3.5. P0 — the funnel's first step is broken. |
| M4 | **Persist timer state.** Write `{phase, endTime, activeTaskId}` to storage; rehydrate on mount; resolve stale in-flight blocks on return. | §3.5. P0 for a timer app, and it closes the penalty-evasion hole. |
| M5 | **Stop deleting data.** Remove `pruneSessions`' 7-day window; cap by count (~5000) instead. Change task expiry from 24h to carry-over with an "aging" hint. | §3.3. Weekly/Monthly charts are currently unpopulatable. |
| M6 | **Fix the lifetime/balance mislabel.** `summarize()` must return `lifetimePoints` for the caption that claims it. | §3.3. The headline number is wrong. |
| M7 | **Export / import JSON.** One button each. | §3.3. Without it "lifetime" is a lie, and it's the migration path to a backend. |
| M8 | **Session-end sound + `Notification` API.** | §3.4. A timer you must watch isn't a timer. |
| M9 | **Day-streak + one monthly streak freeze.** Replace session-streak as the headline metric. | §3.4. The single highest-leverage retention mechanic available. |
| M10 | **Remove the −200 penalty; add reason capture.** | §3.2 / §6A. Fixes incentives and unlocks the differentiator. |

*Reasoning for the cut line:* M1–M10 are all either broken promises, data destruction, or the
absence of any reason to return. None add surface area — M1, M2, M5, M10 **remove** code. This phase
should make the app smaller.

### NICE-TO-HAVE — the differentiator

| # | Item | Why |
|---|---|---|
| N1 | **Focus insight panel** — patterns derived from reason data ("you abandon most at ~7 min, after 3pm"). | §6A. The actual moat. Needs ~2 weeks of M10 data before it says anything, so it follows. |
| N2 | **Estimation calibration** — estimate vs. actual pomodoros per task. | §6B. Builds real skill; near-unserved by competitors. |
| N3 | **Daily close-out ritual.** | §6C. The return trigger. |
| N4 | **Long break every 4 pomodoros.** | Actual Pomodoro canon, currently absent. `DAILY_GOAL = 4` is hardcoded and unrelated to it. |
| N5 | **Titles → grove cosmetics** (tree species, seasons). | §6. The honest version of the cosmetic ladder; finally uses the metaphor. |
| N6 | **`AppProvider` (Context + `useReducer`).** | Restores the locked decision `TimerPage` violated. Fixes cross-page staleness and the mount-only `useFeatureGate`. Do it **after** M1–M2, when there's less gating state left to hold. |
| N7 | **Migrate localStorage → IndexedDB behind the existing `storage.js` facade.** | Removes the quota ceiling once history isn't pruned. `storage.js` is already the sole I/O boundary — this is a contained change. |
| N8 | **Design-token consolidation + `index.css` cleanup.** | Tokens live on `.app-shell`, so public pages redeclare them; boilerplate `#root { width: 1126px }` is worked around with four `:has()` overrides. Real debt. |

### FUTURE CONSIDERATIONS

| # | Item | Gate on |
|---|---|---|
| F1 | **Backend + real accounts** (Supabase/Firebase), sync, cross-device. | The data layer designed in N7 makes this a swap, not a rewrite. Do it when someone asks for their data on a second device. |
| F2 | **Social layer** — shared groves, focus rooms, leagues. | The strongest retention lever (Duolingo, Focusmate) but *requires* F1. This, not points, is what would make gamification actually work. |
| F3 | **Enforcement** — site blocking / focus mode. | Forest's real moat. Needs a browser extension; out of scope for a web app but the honest long-term answer to "does this actually help?" |
| F4 | **Calendar integration.** | Only once scheduling is real (M2 makes it visible; it still needs implementing). |
| F5 | **Team/classroom mode.** | The monetisation path if this becomes a product. Needs F1 + F2. |

**Explicitly recommended for removal:** the −200 penalty (M10); the 24h task expiry and 7-day prune
(M5); all five feature gates (M1–M2); and `balance` as a displayed metric unless it gets a sink.
The app is better with less.

---

## 8. Implementation sequence

**Phase A — stop the bleeding (M3, M4, M5, M6).** Correctness only, no new surface.
Files: `services/auth.js`, `services/storage.js`, `pages/LogInPage.jsx`, `hooks/usePomodoroTimer.js`,
`pages/TimerPage.jsx` (`reconcileTasks` / `pruneSessions`), `services/history.js:58`.

**Phase B — ungate (M1, M2).** Largely deletion. Remove `<FeatureGate>` / `<GatedTile>` wrappers
from `SettingPage.jsx`, `TrendTile.jsx`, `ComparisonTile.jsx`, `OutcomeTile.jsx`. Keep
`FeatureGate.jsx`, `GatedTile.jsx`, and `useFeatureGate.js` in place — they're well-built and Phase
D reuses them for cosmetics. Reduce `TITLES[].feature` to cosmetic keys.

**Phase C — retention (M8, M9, M10, M7).** Sound + `Notification` API in `usePomodoroTimer`;
day-streak in `gamification.js` (extend the existing pure functions — don't fork them); reason
capture as a new `components/timer/TerminateReason.jsx` feeding a `reason` field on the session
record; export/import in `SettingPage`.

**Phase D — differentiate (N1, N2, N3, N5).** Insight panel on History reading the `reason` data;
estimate field on `AddTask`; close-out ritual; cosmetic ladder.

**Phase E — architecture (N6, N7, N8).** `AppProvider`, IndexedDB behind `storage.js`, token
consolidation. Deliberately last: doing it before B means restructuring state that's about to be
deleted.

*Internship framing note:* Phases A–C are the strongest possible deliverable narrative — "I audited
my own spec, found that it gated the core value proposition and punished honest reporting, and
removed both." Demonstrating the judgment to **delete** a spec'd feature reads far stronger than
shipping five more.

---

## 9. Verification

Per phase, from `pomodoro-frontend/`:

1. `npm run lint && npm test && npm run build` — must stay green throughout.
2. **M3:** sign up a new user → log out → log in with those credentials → lands on `/timer`. Add a
   test asserting the sign-up→login join (the gap the current suite has).
3. **M4:** start a session → refresh mid-block → timer resumes at correct remaining time; leave the
   tab for 10 minutes → time is wall-clock accurate (extends existing test A1.3).
4. **M5/M6:** seed >30 days of sessions via storage → History Weekly/Monthly views populate; the
   hero figure matches `lifetimePoints`, not `balance`.
5. **M1/M2:** fresh profile, 0 points → every chart and every Settings section is interactive.
   Existing gate tests (`feature-gate.test.jsx`, `gated-tile.test.jsx`) must be **rewritten**, not
   deleted — repoint them at the cosmetic gates.
6. **M9/M10:** terminate a session → no point loss, reason prompt appears, session records the
   reason; miss a day → freeze consumed, streak intact.
7. **M7:** export → clear all site data → import → points, titles, history, settings all restored.
8. Responsive check at ≤576 / 577–768 / >768 per `.claude/rules/responsive-design.md`, plus keyboard
   traversal, for every changed surface.

---

## 10. The one-line summary

**The engineering is strong; the product logic is inverted.** Evergrove currently withholds its most
useful features from the users who need them most, punishes the honest reporting its own data
depends on, deletes the history its charts require, and gives nobody a reason to return tomorrow.
Fix those four and it's a good focus app. Add the *why did you stop* diagnostic and it's the only
one of its kind.
