---
paths:
  - "pomodoro-backend/**"
---

# Backend Rules — `pomodoro-backend/`

**Status: no stack chosen yet.** This package is an empty placeholder. This file exists so
backend rules have one obvious home the moment work starts, and so the frontend's
conventions are not applied to backend code by default.

## What applies right now

Only the shared rules bind backend work today:

- [`../shared/change-discipline.md`](../shared/change-discipline.md) — scope, minimal
  changes, cross-package boundaries, verification and reporting.
- [`../shared/github.md`](../shared/github.md) — commit format and the push workflow.
- [`../shared/prompt-recording.md`](../shared/prompt-recording.md) — logging significant
  prompts to the repo-root `prompt.md`.

Nothing under `../frontend/` applies here. Those rules are scoped to
`pomodoro-frontend/**` and cover React, CSS, responsive layout, and browser accessibility —
none of which are backend concerns. Do not carry over the frontend's locked decisions
(localStorage persistence, plain CSS, JS-only, no TypeScript); they were chosen for a
browser-only app and are not backend constraints.

## What to add here once the stack is picked

Record decisions in this file (or split it into siblings in this directory) as they are
made — do not leave them implicit in code:

- Runtime, language, and framework; whether TypeScript is used.
- Project layout, and how routes/handlers, services, and data access are separated.
- Persistence: database, migration tool, and where schema lives.
- API contract style, versioning, and the standard error-response shape.
- Authentication and session strategy, and how it replaces the frontend's current
  localStorage-only auth.
- Configuration and secrets handling (`.env` layout, what belongs in `.env.example`).
- Test runner, test layout, and the focused test command the `test-runner` agent should use.
- Lint and format tooling, and the commands that gate a commit.

## Contract with the frontend

The frontend currently persists everything in the browser via
`pomodoro-frontend/src/services/storage.js` and authenticates in
`pomodoro-frontend/src/services/auth.js`. Those two modules are the seam a real backend
replaces. When that work starts, define the API contract first, then change the two sides
independently — the frontend must keep building and testing on its own throughout.
