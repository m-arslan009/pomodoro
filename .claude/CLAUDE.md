# CLAUDE.md — Project Governance & Map

> Entry point Claude Code reads first. Its job is to *govern* and *map* the repository — not
> document it exhaustively. Granular rules live in `rules/` (progressive disclosure) so this
> file stays a short, stable table of contents.

## Repository shape
A **monorepo** with one directory per deployable and all governance at the root. The two
packages are developed independently and must stay independently buildable, so they can be
split into separate Git repositories later without untangling anything.

| Package | What it is | Status |
|---|---|---|
| `pomodoro-frontend/` | Vite 8 + React 19 SPA (JavaScript/JSX) | Built and tested |
| `pomodoro-backend/` | Backend service | Empty placeholder — no stack chosen |

There is **no root `package.json` and no workspace tool**, deliberately: npm/pnpm workspaces
would couple the two packages and work against the eventual repo split.

## Product overview
A Pomodoro-technique focus app that helps users work through daily tasks and stay motivated
via a points-and-titles gamification system.

- **Timer:** default 25 min focus / 5 min break, both adjustable; start, pause/resume,
  restart, terminate.
- **Tasks ↔ sessions:** every session links to a task and is recorded as `completed` or
  `terminated`, with history and statistics.
- **Gamification:** points per session drive a **lifetime**-points economy; crossing
  doubling thresholds unlocks titles, each of which unlocks a previewable, gated feature.
- **Personalization:** editable profile, focus/break durations, and theme.

Significant prompts are logged in [`../prompt.md`](../prompt.md).

## Commands
Run from the package directory, never from the repository root.

### `pomodoro-frontend/`
| Task  | Command                |
|-------|------------------------|
| Setup | `npm install`          |
| Run   | `npm run dev`          |
| Build | `npm run build`        |
| Lint  | `npm run lint`         |
| Test  | `npm test`             |
| Cover | `npm run test:coverage` |

> Gate before committing: `npm run lint && npm test && npm run build`.

### `pomodoro-backend/`
No commands yet — the package is empty.

## Directory architecture
```
.claude/                 <- governance for the whole repo (single source of truth)
├── CLAUDE.md            <- this file
├── agents/              <- subagent definitions (shared, stack-agnostic)
└── rules/               <- discovered recursively; see the scope table below
    ├── shared/          <- always loaded, applies to both packages
    ├── frontend/        <- loads only when touching pomodoro-frontend/**
    └── backend/         <- loads only when touching pomodoro-backend/**
pomodoro-frontend/       <- the Vite + React app
├── .gitignore           <- Node/Vite build + tooling artifacts
└── src/
    ├── main.jsx         <- entry: BrowserRouter > App
    ├── App.jsx          <- route definitions for every page
    ├── components/      <- shared UI + timer/, history/, history/charts/, settings/ groups
    ├── pages/           <- one file per view: Landing, LogIn, SignUp, Timer, History,
    │                       Profile, Setting
    ├── hooks/           <- usePomodoroTimer, useFeatureGate, useElementWidth
    ├── services/        <- storage, auth, gamification, history, validation, appearance
    ├── styles/          <- plain CSS, one file per page/component
    ├── tests/           <- Vitest suites: auth/, backlog/, feature-lock/, timer/, setup.js
    └── assets/          <- images and static assets
pomodoro-backend/        <- backend service (empty)
└── .gitignore           <- stack-agnostic starter
.gitignore               <- repo-wide only: OS/editor junk, secrets, Claude-local settings
netlify.toml             <- deploy config; base = "pomodoro-frontend"
prompt.md                <- log of significant user prompts (repo-wide)
project_idea.md          <- original product plan
product_analysis.md      <- product critique and roadmap
```

## Rules and their scope (progressive disclosure)
All rules live in this one `.claude/` directory. Frontend and backend rules carry a `paths:`
frontmatter glob, so they load **only** when Claude works with files in that package;
`shared/` rules have no glob and load every session.

| File | Scope | Loads |
|---|---|---|
| [`rules/shared/change-discipline.md`](rules/shared/change-discipline.md) | Shared | Always |
| [`rules/shared/github.md`](rules/shared/github.md) | Shared | Always |
| [`rules/shared/prompt-recording.md`](rules/shared/prompt-recording.md) | Shared | Always |
| [`rules/frontend/general-coding.md`](rules/frontend/general-coding.md) | Frontend | `pomodoro-frontend/**` |
| [`rules/frontend/convention.md`](rules/frontend/convention.md) | Frontend | `pomodoro-frontend/**` |
| [`rules/frontend/locked_decisions.md`](rules/frontend/locked_decisions.md) | Frontend | `pomodoro-frontend/**` |
| [`rules/frontend/responsive-design.md`](rules/frontend/responsive-design.md) | Frontend | `pomodoro-frontend/**` |
| [`rules/backend/backend-rules.md`](rules/backend/backend-rules.md) | Backend | `pomodoro-backend/**` |

**Adding a rule:** put it in `shared/` only if it is true for both packages with no
rewording. Otherwise put it in `frontend/` or `backend/` and give it the matching `paths:`
glob. Never copy a rule into two files.

## Subagents
Defined in [`agents/`](agents/); delegate to them with the Agent tool when the task matches.
All three are stack-agnostic and serve both packages — `test-creator`'s UI-specific guidance
is conditional and simply does not apply to backend work.

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
