# CLAUDE.md — Project Governance & Map

> Entry point Claude Code reads first. Its job is to *govern* and *map* the project — not
> document it exhaustively. Granular rules live in the linked sub-files (progressive
> disclosure) so this file stays a short, stable table of contents.

## Project overview
A **frontend-only React web app** built around the Pomodoro technique that helps users
focus on daily tasks and stay motivated through a points-and-titles gamification system.

- **Timer:** default 25 min focus / 5 min break, both adjustable; start, pause/resume,
  restart, terminate.
- **Tasks ↔ sessions:** every session links to a task and is recorded as `completed` or
  `terminated`, with history and statistics.
- **Gamification:** points per session drive a **lifetime**-points economy; crossing
  doubling thresholds unlocks titles, each of which unlocks a previewable, gated feature.
- **Personalization:** editable profile, focus/break durations, and theme.

Full product plan lives in [`idea.md`](idea.md); significant prompts are logged in
[`../prompt.md`](../prompt.md).

## Commands
Run from the `Pomodoro/` app directory.

| Task  | Command         |
|-------|-----------------|
| Setup | `npm install`   |
| Run   | `npm run dev`   |
| Build | `npm run build` |
| Lint  | `npm run lint`  |

> No test runner is configured yet; `npm run build` is the current pass/fail gate.

## Directory architecture
```
.claude/                <- governance: this file, convention.md, locked_decisions.md,
│                          idea.md (product plan), rules/
Pomodoro/               <- the Vite + React app (run npm commands here)
└── src/
    ├── main.jsx        <- entry: BrowserRouter > App
    ├── App.jsx         <- route definitions for every page
    ├── components/     <- shared UI: AppLayout, Nav, FeatureGate, TaskPicker, TitleBadge
    ├── pages/          <- one file per view: Landing, SignIn, SignUp, Timer, History,
    │                      Stats, Profile
    ├── context/        <- AppProvider (Context + useReducer) — planned
    ├── hooks/          <- usePomodoroTimer, useFeatureGate — planned
    ├── services/       <- storage.js (localStorage), gamification.js (points/titles)
    ├── styles/         <- shared CSS
    └── assets/         <- images and static assets
prompt.md               <- log of significant user prompts (repo root)
```

## Reference rules (progressive disclosure)
Consult these before writing code or making structural decisions:

- **[`convention.md`](convention.md)** — coding paradigms, styling, naming, and
  git/prompt/responsive rules. *Read before writing or changing code.*
- **[`locked_decisions.md`](locked_decisions.md)** — settled architecture and tech-stack
  constraints. *Read before proposing structural changes.*
- **[`rules/`](rules/)** — task-specific workflow rules: **general-coding** (frontend
  guardrails — always applies), **github** (commits/push), **prompt-recording**
  (`prompt.md` logging), **responsive-design** (breakpoints). *Follow the one relevant to
  the task at hand.*
