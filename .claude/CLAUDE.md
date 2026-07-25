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

Significant prompts are logged in [`../prompt.md`](../prompt.md).

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
│                          rules/, agents/
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

## Subagents
Defined in [`agents/`](agents/); delegate to them with the Agent tool when the task matches.

The three test agents form one loop and **never talk to each other** — every handoff goes
through the main agent, which owns the state and briefs each agent with what it needs:

```
test-creator ──▶ test-runner ──▶ pass ──▶ next behavior (back to test-creator)
                      │
                      ├─ production failure ──▶ code-editor ──▶ test-runner (rerun)
                      ├─ outdated/incorrect test ──▶ test-creator (fix that test)
                      └─ environment/config issue ──▶ main agent
```

Sequencing: `test-creator` covers one behavior, reports, and moves on to the *next*
behavior — it revisits an already-written test only when the main agent tells it that
production code changed and that test must be updated or a new one added. `test-runner`
never edits; `code-editor` never edits tests and never runs them. Each agent's report is
the brief for the next one, so pass it along rather than re-deriving it.

- **[`test-creator`](agents/test-creator.md)** — given a component/behavior spec, checks
  whether existing tests already assert that behavior and writes only the smallest missing
  set of focused tests. Edits test files only (never production code) and does not run the
  tests. *Use when a change needs test coverage; provide the target files, the edited code,
  and the expected behavior.*
- **[`test-runner`](agents/test-runner.md)** — executes the focused test command, treats a
  non-zero exit (or no-tests/skipped/crash/timeout) as failure, and reports each failure
  with command, exit code, test name, expected vs actual, assertion message, and a likely
  cause. Read-only: never edits code, tests, snapshots, or config. *Use after
  `test-creator`; provide the component, expected behavior, test files, and test command.*
- **[`code-editor`](agents/code-editor.md)** — applies the smallest production-code change
  that makes the behavior correct, using the test-runner's failure evidence. Never edits
  tests, never weakens a test to pass, never runs the tests itself, and reports conflicts
  instead of guessing. *Use when `test-runner` reports a production failure; provide the
  code area, required behavior, and the failure report.*
