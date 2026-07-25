# Locked Decisions — Architecture & Tech Stack

Rigid architectural choices and unchangeable tech-stack constraints. These are settled;
do not revisit them without an explicit instruction to change direction.

## Tech stack
- **Vite 8** + **React 19** (JavaScript / JSX — no TypeScript)
- **react-router-dom 7**
- **ESLint** (flat config, `eslint.config.js`) for linting
- Plain CSS with CSS variables (light/dark theming in `src/index.css`)

## Locked decisions
| Topic | Decision |
|---|---|
| Persistence | Browser **localStorage** (namespaced + versioned, e.g. `pomodoro.v1.*`) |
| State | React **Context + `useReducer`** (one `AppProvider`); no external store |
| Routing | **react-router-dom** with one page per view |
| Titles basis | **Lifetime** points earned (never lost to penalties) |
| Balance floor | Floors at **0** |
| Streak rule | Terminate **resets** streak; +50 on every 3rd consecutive success |
| Styling | Plain **CSS + CSS custom properties** — **no Tailwind** |
| Sequencing | Phased: core → gamification → gated features |
