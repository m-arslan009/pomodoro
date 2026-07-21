# Conventions — Coding Paradigms, Styling & Naming

Granular implementation and design rules. `CLAUDE.md` links here so the root file stays
lean; keep everything about *how code should be written* in this file.

## Language & paradigm
- **JavaScript only** (`.jsx`), never TypeScript.
- Keep components functional; keep hooks pure (respect `react/rules-of-hooks`).
- Centralize tunable constants (points, thresholds, titles) in one config module
  (`services/gamification.js`) so tuning is a one-line change.

## Styling
- **Plain CSS + CSS custom properties**, never Tailwind.
- Preserve the existing light/dark theming in `src/index.css`; the gated theme editor
  writes to the same CSS variables.
- Follow [`rules/responsive-design.md`](rules/responsive-design.md) — mobile-first,
  readable, and accessible across screen sizes.

## Data access
- All `localStorage` access goes through `services/storage.js`, never `localStorage`
  directly.
- Persistence keys are namespaced + versioned (e.g. `pomodoro.v1.*`).

## Linting
- Respect **oxlint** (`react/rules-of-hooks`, `react/only-export-components`).
- `npm run lint` and `npm run build` must pass before committing.

## Git & commits
- Follow [`rules/github.md`](rules/github.md): small scoped conventional commits
  (`<scope>: <short description>`), verify the build, stage only after user confirmation,
  never commit `node_modules`/secrets.

## Prompt logging
- Follow [`rules/prompt-recording.md`](rules/prompt-recording.md): log significant user
  prompts to `prompt.md`.
