# Prompt Log

## Initialize React project

`Title`: Initialize React project with Vite (JavaScript, custom CSS)

`User prompt`: Initialize the React project in this directory. Use JavaScript instead of TypeScript and custom CSS not Tailwind CSS. Analyze package.json and initialize the required dependencies. Create folder structure such that src contains folders: 1. components 2. pages 3. styles 4. services.

## Initialize git repo and push boilerplate

`Title`: Initialize git, configure .gitignore, and push boilerplate to Pomodoro remote

`User prompt`: Initialize the git repo. Repository link: https://github.com/m-arslan009/Pomodoro.git. Lift the .gitignore file from Pomodoro/ and place it here. Update the .gitignore file and push the initialized boilerplate to the repository. Also remove the Pomodoro/.git remote to avoid conflicts while pushing.

## Pomodoro focus & gamification web app spec

`Title`: Build frontend-only Pomodoro app with sessions, history, points, and title-gated features

`User prompt`: Create a frontend-only website based on the Pomodoro technique (default 25 min work / 5 min break, both extendable) to help users complete daily tasks and focus for a user-specified time. Users record daily completed tasks and see previous records. Users can pause/resume, restart, and terminate a session; each session is recorded with a status of either successfully completed or terminated. Users can view previous history with statistics. On completing a session, the user earns points (e.g. 100 per successful session); completing 3 consecutive sessions grants a 50 bonus; terminating penalizes the user (e.g. deduct 200). At specific point limits the user earns titles — 1. The Anchor 2. The Pace Setter 3. The Catalyst 4. The Vanguard 5. The Paragon — with the gap between consecutive titles doubling (e.g. first at 1000, next at 2000, and so on). Each new title unlocks a new feature: (1) edit app theme, (2) update background image and add custom labels, (3) visualize time utilization, (4) a more detailed graphical report, (5) schedule tasks / set a start time. Users can edit their profile as well as working time, break time, and theme.

## Scaffold pages and components with routing

`Title`: Scaffold empty pages/components, wire routing, add landing/sign-up/sign-in pages with "Coming Soon"

`User prompt`: Create empty files for pages and components. Connect them via routing. Also create a landing page, sign up page, and sign in page, and only add the text "Coming Soon".

## Refactor CLAUDE.md into modular governance template

`Title`: Refactor CLAUDE.md into a generic onboarding template with progressive disclosure

`User prompt`: Refactor the root .claude/CLAUDE.md file into a generic, highly efficient onboarding template that can be easily adapted for any project, adhering to its core purpose of governance and project mapping rather than verbose documentation. Remove all hardcoded, project-specific details, personal configurations, and lengthy rule lists. Implement a progressive disclosure strategy: extract specific coding paradigms, styling choices, and naming rules into a separate .claude/convention.md file, and move rigid architectural choices or unchangeable tech stack constraints into a separate .claude/locked_decisions.md file. In the generic CLAUDE.md, retain sections defining the fundamental purpose of the file while leaving clean placeholders for a brief project overview, a standardized table for core terminal commands (build, test, lint, run), an outline for directory architecture, and explicit markdown links directing the AI to reference the new external sub-files.

## Forest-themed responsive landing page

`Title`: Build responsive forest-themed landing page with header and main section

`User prompt`: Create a responsive landing page with a cohesive forest-themed aesthetic (deep forest greens, earthy moss tones, warm wood accents, clean off-white backgrounds). Two main parts: a Header and a Main Section. Header: at the top, the left side features the website's name preceded by a leaf icon; the right side houses two buttons, "Sign Up" and "Log In", wired to a routing system directing to /signup and /login. Main Section: displays the website's name, an engaging punchline, and a brief 2-to-3 line paragraph on the app's core purpose. Responsive rules: on medium and large screens the header buttons stay top-right; on small screens (mobile) the two buttons disappear from the header, shift to the main section below the descriptive text, and stack vertically with full/adjusted width for mobile-friendly tapping.

## Responsive, accessible Sign Up page with validation services and toasts

`Title`: Build Sign Up page with service-layer validation, toast notifications, and localStorage persistence

`User prompt`: Implement a fully responsive and accessible Sign Up page based on the landing page theme. Fields: First Name, Last Name, Email, Username, Password, Confirm Password, plus a primary "Sign Up" button and a textual redirect link to the Login page. Abstract all form validation logic into dedicated helper functions inside src/services/. Enforce rigorous rules: valid email format; password at least 8 characters with a mix of letters, numbers, and special characters; Confirm Password must exactly match Password. Instantly display descriptive, localized errors beneath the specific failing field. Manage component states for loading, validation-error, and form success. Build a reusable notification component in src/components/ for global toast alerts: green success on successful registration, red error on failure, yellow warning for security/high-risk input states. As a frontend-only app with no backend, store non-sensitive user profile info in browser localStorage; on successful sign-up, save the data and redirect the user to the Login page.

## Responsive, accessible Log In page with hardcoded auth and toast

`Title`: Build Log In page validating against a single hardcoded profile with global toast on failure

`User prompt`: Implement a fully responsive and accessible Login page based on the theme implemented in the Signup page (refer SignUpPage.css in src/pages). Fields: Username and Password, a primary "Log In" button, and a textual redirect link back to the Sign Up page. Because this implementation is strictly frontend-only with no backend or live API, validate entered credentials exclusively against a complete, single hardcoded user profile (username: admin, password: [REDACTED]) utilized consistently across all subsequent pages. Do not highlight individual input fields or display inline error messages under the fields when authentication fails; instead manage component states matching the loading and success behaviors of the Sign Up page and use the reusable notification component in src/components/ to trigger a global toast stating the username or password is incorrect when credentials do not match. On successful login, immediately redirect the user to the Dashboard page. Place LogInPage.css inside src/styles.

## Responsive, accessible navigation layout with sidebar and mobile overlay

`Title`: Build responsive forest-themed navigation — desktop split-screen sidebar and mobile top-header overlay

`User prompt`: Implement a fully responsive and accessible Navigation layout utilizing the established forest-themed aesthetic that adapts fluidly across device sizes. On medium and large screens, the navigation must display as a persistent, fixed-width vertical sidebar docked on the left, forming a split-screen structure with the main page content flowing dynamically on the right. This vertical sidebar must be divided cleanly into three distinct sections: the top section showcasing the website's name accompanied by a leaf icon, the middle section housing a vertically stacked list of primary navigation links with appropriate spacing gaps between each option, and the lower section strictly anchored to the absolute bottom containing a "Log Out" button that triggers a session clearance and routes the user back to the public Landing Page. For large screens, no global top header will be displayed, allowing individual pages to manage their own local headers if required. On small screens (mobile), the vertical sidebar must be hidden by default and a persistent, non-scrollable top header must be introduced across all internal pages. This mobile header will remain fixed in place (uncaught by both vertical and horizontal viewport scrolling) and must contain a website name asset with its leaf icon alongside a dedicated menu icon on the far left that toggles the vertical navigation options into view as a cleanly aligned, single-column vertical overlay with generous click/tap gaps.

## Timer page as a 2×2 glassmorphic dashboard

`Title`: Build responsive Timer page as a four-tile dashboard (engine, points, tasks, history) with real-time sync

`User prompt`: Implement a modern, fully responsive Timer page structured around a balanced two-by-two dashboard grid containing exactly four primary tiles, following a sleek glassmorphic design (deep translucent background, significant backdrop blur, crisp ultra-thin low-opacity border, soft deep ambient drop shadows) with a clear, distinct visual gap between all four tiles so the ambient background shows through the gutters. Use high-contrast accent colors for badges, active states, and critical buttons. The top-left tile is the core state-driven timer engine: a prominent large countdown that shows remaining session time while a work session runs and transitions to the remaining break time the moment the session finishes; beneath it five state-aware control buttons — Start, Pause, Resume, Restart, Terminate — that conditionally show, hide, or disable based on the timer's lifecycle phase (e.g. show Resume only when paused, hide Start once a session has begun). The remaining three tiles keep the page synchronized: the top-right is a gamified productivity hub showing point statistics, a daily progress bar, and micro-indicators that glow to reflect milestones; the bottom-left is an active daily backlog listing only today's tasks not yet started or completed, with clean hover states and quick-action toggles; the bottom-right is a historical stream rendering a chronological log/table of all processed blocks for the day, visually distinguishing Completed from Terminated sessions. State changes in the timer tile must immediately update the points tile and append logs to the history tile in real time.

## History page as a responsive glassmorphic performance dashboard

`Title`: Build responsive History page aggregating performance records into glassmorphic KPI and chart tiles

`User prompt`: Implement a modern, fully responsive History page that aggregates a user's historical performance records and current productivity status using a clean layout of four to five glassmorphic tiles, following the foresty theme. The dashboard must use a flexible layout that renders as a balanced grid on desktop with generous gaps between components, while collapsing into a single, vertically prioritized column on mobile. Textually and graphically present current user status metrics—accumulated points, completed tasks, completed sessions, incomplete tasks, and terminated sessions—distributed across specialized tiles. Feature a high-level summary tile presenting key textual KPIs using fluid typography that never crowds the container on intermediate screen sizes, paired with premium interactive charts (glassmorphic area, line, or comparative bar graphs using vibrant, low-opacity glowing accent lines) to map and compare progress over daily, weekly, or monthly intervals. Every tile must adhere to the design language: deep translucent backgrounds, intense backdrop blur, a crisp ultra-thin low-opacity border, soft ambient drop shadows, and ample internal breathing room so labels, legends, and lists scale down smoothly without clipping or congestion toward the mobile breakpoint.

## Settings page — editable timer durations

`Title`: Repurpose Stats page into a foresty glassmorphic Settings page for editing session and break durations

`User prompt`: Implement the setting page. Change the current page src/pages/StatsPage.jsx to src/pages/SettingPage.jsx and also update the routes. This page allows the user to edit time duration for session and break for now. Later when implementing phase 2 and phase 3 the setting page will be updated as moving further. Keep the foresty and glassmorphic theme.

## Profile page — view and edit account details and password

`Title`: Implement editable, foresty glassmorphic Profile page (name, username, password; email fixed)

`User prompt`: implement profilepage so that user can not only see his or her information but can edit or change as well including password. email does not change. keep the theme remain forest and glassmorphic

## Implement Phase 2 & 3 Settings-page features

`Title`: Build title-gated Settings features (theme editor, background + labels, scheduling) and gating foundation

`User prompt`: read remaining.md file and implement what we have left to implement in setting page so far. follow rules and conventions.

## Gate History charts behind their unlockable titles

`Title`: Implement the remaining History-page gating (time-utilization → Catalyst, graphical reports → Vanguard)

`User prompt`: read remaining.md and check what we have left behind for historyPage and implement the missing functionality. also log the prompt in detail about what you have done in prompt.md as well. follow the rules and conventions discuss in their respected markdown files.


## Wire the gamification engine and titles into the Timer page

`Title`: Implement the Timer page's remaining title/gamification functionality from remaining.md

`User prompt`: read remaining.md file and check what remain to implement in TimerPage and by following the rules and convention implement the missing functionalities.


## Implement protected routing (public vs authenticated pages)

`Title`: Implement protected routing

`User prompt`: now implement protected routing. user can not navigate to main application before login. landing page, sign up and login page are publically available while the remaining pages should be protected. once the user logged in he or she won't be allowed to navigate to public pages until user logged out.


## Replace oxlint with ESLint

`Title`: Migrate linting from oxlint to ESLint

`User prompt`: Completely set up and verify ESLint in this project — detect the project type, install eslint with the latest standard recommended configs/plugins matching the stack, create a flat config (eslint.config.js), run linting on the source, auto-fix issues, and do a final clean check. (On confirmation of the conflict with the locked oxlint decision, chose to replace oxlint with ESLint.)

## Configure Prettier

`Title`: Configure Prettier code formatting

`User prompt`: Configure Prettier in this React project following current best practices. Install Prettier as a dev dependency. Create a `.prettierrc.json` with semicolons, single quotes, tab width of 2 spaces, spaces instead of tabs, `trailingComma: "es5"`, `printWidth: 100`, `bracketSpacing: true`, `arrowParens: "always"`, `endOfLine: "lf"`. Create a `.prettierignore` excluding node_modules, dist, build, coverage, package-lock.json and other generated artifacts. Add npm scripts `"format": "prettier . --write"` and `"format:check": "prettier . --check"`, preserving existing scripts. Verify with `npx prettier --version`, run `format:check`, format if needed, and re-check. Do not modify application logic — only add configuration and perform formatting.

## Add a test-creator subagent

`Title`: Create the `test-creator` subagent and reference it in CLAUDE.md

`User prompt`: Create the directory `.claude/agents` if it does not exist, then create `.claude/agents/test-creator.md` with frontmatter `name: test-creator`, a description stating it "reviews a component specified by the main agent, checks whether existing tests cover the required behavior, and creates only the missing focused tests", and `tools: Read, Grep, Glob, Bash, Write, Edit`. Write the agent instructions with these responsibilities. Role: the main agent will provide the component, file, function, hook, route, or feature to test, relevant file paths, added or edited code, expected behavior and acceptance criteria, user interactions, inputs, outputs, errors, or side effects, and any bug, regression, or directly affected dependency; treat the main agent's expected behavior as the primary source of truth; when paths are missing, locate the component and its tests using repository search; infer only minor missing details from the implementation, types, nearby code, and existing tests; report material ambiguities instead of inventing behavior. Workflow: identify the exact component and behavior to test along with relevant props, inputs, events, state, outputs, side effects, changed code, and directly affected dependencies; inspect the provided files and Git changes (`git diff`, `git diff --staged`) when useful; search for and inspect existing tests before creating new ones; identify and consider all relevant edge cases including unusual inputs, boundary conditions, and failure scenarios; decide whether existing tests meaningfully verify the requested observable behavior, since executing changed code without asserting the result is not sufficient; for UI components consider only relevant scenarios such as rendering and conditional states, props and defaults, user interactions and state changes, validation, loading/success/empty/error states, callbacks, navigation, API interactions, accessibility, edge cases and regressions, and directly affected parent or child behavior; if existing tests are sufficient, do not add duplicate tests, do not modify tests unnecessarily, and report which tests already cover the behavior; if coverage is incomplete, add the smallest necessary set of focused tests, include a regression test for bug fixes, and test related components only when their behavior is directly affected. Test-writing rules: follow the repository's existing test framework, structure, naming, utilities, fixtures, mocks, and assertion style; prefer public, user-visible behavior over implementation details; for UI tests prefer roles, labels, visible text, and accessible names, use the project's existing user-event utilities, assert rendered output, state changes, callbacks, navigation, or side effects, mock only external boundaries when necessary, and never mock the component under test; each test must verify one clear behavior, have a descriptive name, use meaningful assertions, be deterministic, and avoid duplicate coverage and unnecessary mocks; prefer modifying an existing relevant test file and create a new test file only when necessary. Scope restrictions: the agent may edit only test files, test fixtures, factories, and helpers, and test snapshots or test configuration when strictly required; the agent must not edit production code, fix or refactor the component, change expected behavior, remove, skip, disable, or weaken tests, make unrelated changes, or add tests outside the scope provided by the main agent. Test execution: do not run tests — a separate test-runner agent will execute them; you may inspect scripts and configuration to determine the correct test command. Final report: return the requested component and behavior, files inspected, whether existing coverage was sufficient, tests added or modified or `none`, behaviors covered, related components or dependencies considered, the exact focused test command and broader suite command when relevant, and assumptions or ambiguities. The goal is to create the smallest reliable set of tests that proves the behavior requested by the main agent. Do not create the test-runner or code-editor agents. Then refer the agent in CLAUDE.md.

## Add a test-runner subagent

`Title`: Create the `test-runner` subagent and reference it in CLAUDE.md

`User prompt`: Create `.claude/agents` if it does not exist, then create `.claude/agents/test-runner.md` with frontmatter `name: test-runner`, the description "Runs focused component tests, reports precise failures, and does not modify code or tests", and `tools: Read, Grep, Glob, Bash`. Write concise instructions with these rules. Role: the main agent will provide the component or behavior being tested, expected behavior, relevant source and test files, tests created or identified by the test-creator agent, and a focused test command when available; the test-runner must only run tests, analyze results, and report findings, and must never fix or edit anything. Workflow: read the task details from the main agent; run the smallest relevant test command first; if no command is provided, inspect project scripts and test configuration to find the correct command; use single-run or non-watch mode; if focused tests pass, run a broader relevant suite only when requested or clearly appropriate; do not run the entire repository suite unless explicitly requested or no focused option exists; do not repeatedly rerun the same failure unless checking possible flakiness. Failure reporting: for every failure report the command executed, exit code, failing test file and test name, expected result, actual result, error or assertion message, relevant stack trace and line numbers, and whether the failure is reproducible; classify the likely cause when evidence supports it as a production code failure, incorrect or outdated test, mock/fixture/setup issue, environment/dependency/configuration issue, flaky or timing-related failure, or unclear; do not claim a definite root cause without evidence. Restrictions: the agent must not edit production code or tests, update snapshots, change fixtures, mocks, dependencies, or configuration, skip or weaken tests, run commands that intentionally modify files, or fix failures; a test passes only when the command exits with code `0`; no tests found, skipped tests, crashes, timeouts, or setup failures must not be reported as success. Final report: return the component tested, commands executed, pass or fail result and test counts, detailed failures or `none`, likely failure classification, broader suite result or `not run`, files generated or modified by commands or `none`, and the recommended next step — production failure → code-editor agent, broken test → test-creator agent, environment issue → main agent. Do not create or modify the other agents. Then refer the agent in CLAUDE.md.

## Add a code-editor subagent

`Title`: Create the `code-editor` subagent and reference it in CLAUDE.md

`User prompt`: Create `.claude/agents` if it does not exist, then create `.claude/agents/code-editor.md` with frontmatter `name: code-editor`, the description "Applies the exact production-code fix requested by the main agent using test-runner failure evidence, with minimal scope and no test changes", and `tools: Read, Grep, Glob, Edit, Write, Bash`. Write concise instructions with these rules. Role: the main agent will provide the exact component, file, function, or code area to edit, the required behavior, the specific changes expected, test-runner results, failing tests, errors, and relevant line numbers, and any directly affected related components; treat the main agent's editing instructions as the source of truth and use test-runner output as evidence for the failure. Workflow: read the main agent's instructions and test-runner report; inspect the specified production code and directly related code; identify the smallest change that makes the code match the expected behavior; edit only the exact lines, functions, or components named by the main agent plus directly related code that must change for the fix to work correctly; preserve existing APIs and behavior unless the main agent explicitly requires a change; follow the repository's existing style, types, architecture, and patterns; handle relevant edge cases exposed by the failing tests. Restrictions: the agent must not edit tests, snapshots, fixtures, or mocks, change code only to bypass or weaken a test, modify unrelated files or components, perform unrelated refactoring, formatting, cleanup, or dependency changes, add fallback behavior that hides the real failure, expand scope beyond the main agent's instructions, run tests (the test-runner agent will verify the fix), or claim the issue is fixed before tests are rerun; if the requested fix requires changing additional related code, edit only what is strictly necessary and explain why; if the main agent's instructions conflict with the test evidence or are too ambiguous to make a safe change, report the conflict instead of guessing. Final report: return the files edited, the exact functions, components, or code sections changed, a summary of the change, why the change addresses the reported failure, any directly affected related code updated, assumptions or unresolved risks, and the focused test command the test-runner should run next. Then refer the agent in CLAUDE.md.

## Chain the three test subagents into one main-agent-driven loop

`Title`: Define the test-creator → test-runner → code-editor dependency and coordination workflow

`User prompt`: test-creator.md, test-runner.md and code-editor.md are all dependent on each other: when test-creator successfully creates or edits the test code, test-runner will test the newly created or updated test, and when it successfully reports the test result, code-editor comes into play. When test-creator successfully creates a test it moves on to create the next test, and only interrupts and comes back to a previously created test when the code is updated and it is mentioned that an existing test must be edited or a new test created. All three subagents will communicate via the main agent; the main agent will provide the required information to each subagent to successfully complete its task. Consider the subagent files and CLAUDE.md and edit them to get the required behavior.

## Write Suite A tests (dual-way timer & log state machine)

`Title`: Implement the test cases for the dual-way timer and log state machine

`User prompt`: Now write the test cases for Dual way timer and log state machine. Get the detail from test_plan.md file, and follow the flow we have defined in CLAUDE.md file.

## Write Suite B1 tests (backlog membership & timer binding)

`Title`: Implement Suite B test cases for B1 only, skipping B2

`User prompt`: Now write test cases for Suite B. Skip B2 and write test cases only for B1.

## Write Suite D tests (tier-based milestone & feature lock system)

`Title`: Implement Suite D only, following the CLAUDE.md testing workflow

`User prompt`: Read CLAUDE.md completely and strictly follow the required testing workflow, coding standards, naming conventions, and any project-specific rules before writing any tests. Then read test_plan.md thoroughly and identify every test that belongs to Test Suite D. Implement only Suite D, following the execution order and structure defined in CLAUDE.md. Before writing each test, understand the implementation being tested and verify the expected behavior from the source code rather than making assumptions. Write clear, isolated, deterministic Vitest tests using Testing Library where appropriate. Mock external dependencies, network requests, timers, browser APIs, and storage only when necessary, keeping mocks minimal and maintainable. Cover both success and failure paths, edge cases, and validation rules defined in test_plan.md. Do not modify application logic unless a genuine bug preventing testing is found; if one exists, explain it before making the smallest possible fix. After implementing Suite D, run the complete test suite, fix any failing tests or configuration issues, ensure all Suite D tests pass, verify no existing tests regress, and provide a concise summary of the implemented tests, coverage achieved, and any remaining items from test_plan.md that are intentionally not part of Suite D.

## Label test cases with their test-plan identifiers

`Title`: Label every test case exactly as specified in the test plan

`User prompt`: Ensure every test case is labeled exactly as specified in the test plan using the format A1.*, A2.*, A3.* (e.g., A1.1, A1.2, A2.1). The Suite A tests have already been implemented and are passing, so do not modify the test logic. Commit only the Suite A code and push it, and remove prompt.md from .gitignore so it is pushed as well.

## Write essential Vitest tests for the login service

`Title`: Test the frontend login service with a concise, high-value suite

`User prompt`: Analyse the frontend login service and write only the essential Vitest unit tests. Focus on testing the service's public behaviour rather than every possible edge case or internal implementation detail. Avoid redundant, overlapping, or defensive test cases that verify the same logic in multiple ways. Do not invent scenarios that are not supported by the current implementation. If a function performs simple validation or delegates to another utility, test only the observable behaviour instead of every invalid input combination. Aim for 5-8 high-value test cases that cover the core login workflow: successful login, invalid credentials, invalid or missing input (combine similar validation cases into a single test where appropriate), correct session persistence (if implemented), and one representative failure scenario (such as storage or API failure) only if the service explicitly handles it. Do not test browser APIs, JavaScript built-ins, or third-party libraries beyond verifying that they are called correctly. Keep the test suite concise, maintainable, and easy to understand. Prefer one well-written test over several nearly identical ones. Follow the project's existing test structure and naming conventions, and do not modify production code unless required for testability. Mock all external dependencies, including HTTP requests, localStorage/sessionStorage, cookies, and any other browser APIs used by the service, so that no real network requests are made. After writing the tests, run them, fix any failures, and ensure all login service tests pass without changing the intended behaviour of the application.

## Write essential Vitest tests for the sign-up service

`Title`: Test the frontend sign-up (registration) service with a concise, high-value suite

`User prompt`: Analyse the frontend Sign Up (Registration) Service and write only the essential Vitest unit tests. Focus on testing the service's public behaviour rather than every possible edge case or implementation detail. Avoid redundant or repetitive test cases that verify the same logic in different ways. Do not invent scenarios that are not supported by the current implementation. If validation is straightforward, combine similar invalid input cases into a single parameterized test instead of creating separate tests for each field. Aim for 5-8 high-value test cases that cover the core registration workflow: successful registration, duplicate user or email (if supported), invalid or missing required input, correct persistence of the registered user or profile (if implemented), and one representative failure scenario (such as storage or API failure) only if the service explicitly handles it. Verify that the service returns the expected result, stores data correctly (if applicable), and propagates or handles errors as designed. Do not test browser APIs, JavaScript built-ins, or third-party libraries beyond verifying that they are invoked correctly. Keep the test suite concise, maintainable, and easy to understand. Prefer one well-structured test over several nearly identical ones. Follow the project's existing test structure and naming conventions, and do not modify production code unless required for testability. After writing the tests, review the suite and remove any test that does not provide unique value or increases maintenance without improving confidence. The final test suite should be minimal while still providing strong confidence in the correctness of the sign-up service.

## Move authentication state to Redux Toolkit and integrate JWT

`Title`: Replace Context + useReducer with a Redux Toolkit auth slice

`User prompt`: On the frontend, integrate the backend using the correct API endpoints, remove all
mock authentication, and implement production-ready authentication state using **Redux Toolkit
(RTK)** (preferred over Context because the application will grow with user data, gamification,
achievements, settings, and future authenticated features). Create a clean auth slice with async
thunks for login, logout, authentication status, loading and error states, persist authentication
securely, automatically attach tokens to API requests, handle token expiry and unauthorised
responses, protect private routes, redirect users appropriately, display backend validation errors
using the existing UI, and ensure the application remains type-safe, modular, and maintainable.
Preserve the existing UI, styling, tests, and architecture wherever possible, update only what is
necessary, verify the complete login flow from submission to authenticated navigation, fix any
integration issues discovered during implementation, document all changes, and ensure both frontend
and backend remain synchronised with no hardcoded values or duplicate logic.

**Scope this prompt settled.** RTK replaces the locked "Context + `useReducer`, no external store"
decision, but for the **auth slice only** — timer, gamification, settings and history state stay
local and migrate as they grow. There was no mock authentication left to remove; the services
already called the real API. `hooks/useAuth.js` keeps its exact previous return shape, so no
consuming component changed. The access token lives in Redux memory only — never `localStorage`,
which the existing D1.5 test continues to enforce.

---

`Title`: Align the frontend with the stateless-JWT backend

`User prompt`: The backend authentication is already complete and should be treated as the source
of truth. Analyse the frontend against the existing backend API to identify missing integrations,
incomplete authentication features, broken flows, obsolete code, and dead ends. Implement only the
functionality required for a complete end-to-end authentication flow, keeping the solution as
simple and maintainable as possible. Avoid unnecessary abstractions, helper functions, custom
hooks, utility layers, premature optimisations, or features that are not required today. Prioritise
a working login flow, correct API integration, Redux Toolkit authentication state, protected
routes, token persistence, logout, validation, loading and error handling, unauthorised session
handling, and navigation. If the backend already supports registration or change-password and only
minimal frontend work is needed to make them functional, implement them; otherwise document what
remains for a later phase. Do not create, modify, or run test cases. Remove obsolete authentication
code and unnecessary complexity, but avoid unrelated refactoring.

**Decisions this prompt settled.** Two conflicts were surfaced and answered:

1. **"Token persistence" vs the locked memory-only rule.** With no refresh cookie, surviving a
   reload would require web storage, which `locked_decisions.md` forbids outright. The user chose
   to **keep the token memory-only**, accepting that a reload, a new tab, or a browser restart
   returns the user to `/login` even with hours left on the token.
2. **"Remove obsolete code" vs "do not modify tests."** Roughly eight frozen cases asserted the
   deleted `/auth/refresh` bootstrap and `credentials: 'include'`. The user chose to **remove the
   refresh machinery and update those tests**, overriding the no-tests instruction for the cases
   that encoded the dead contract.

**Scope.** Deleted `refresh()`, `logoutEverywhere()`, `bootstrapAuth`, `setAuthRefreshHandler` and
the single-flight 401 replay. Initial `status` is now `anonymous`; a 401 on a token-bearing request
clears the session and the route guards redirect. Registration and change-password were already
functional and needed no work beyond removing a false "other devices have been signed out" claim.

---

`Title`: Verify and complete core frontend authentication

`User prompt`: Focus only on the core frontend authentication functionality. Analyse the current
implementation, verify each feature works correctly, and complete any missing or incomplete pieces
before writing comprehensive tests. Verify and complete: Registration, Login, Logout, Client-side
form validation, API integration, Success and error handling, Loading states during API requests.
Fix only genuine bugs or missing functionality directly related to these features. Remove obsolete
authentication code and dead ends, but avoid unrelated refactoring. Do not implement advanced
features such as refresh tokens, silent re-authentication, remember-me, forgot/reset password,
email verification, social login, role-based permissions, profile management, or other
non-essential functionality unless already partially implemented and requiring only minimal work to
complete. After implementation, manually verify every authentication flow end-to-end against the
backend.

**Outcome.** Three genuine defects fixed: the client validation mirror was missing the server's
name (50) and email (320) maximum lengths, so those inputs passed the form and failed at the API;
`AppLayout.handleLogout` skipped its navigation and raised an unhandled rejection when the logout
request failed; and the Vite proxy comment still described the removed cookie model. Component
coverage was added for the login form and the sign-out button, neither of which had any. Every
flow was verified end to end through the Vite proxy against the running backend.

## Profile contract and phased implementation strategy

`Title`: Establish CONTRACT.md as the shared profile contract and define a phased, frontend-first workflow

`User prompt`: The profile analysis and implementation roadmap have already been completed and approved. Do not repeat the analysis or create another implementation plan. Instead, use the existing plan as the basis for execution.

Before implementing any profile changes, update CONTRACT.md to become the shared contract for the profile feature across both the frontend and backend repositories. Record all agreed profile decisions, including the data model, supported profile fields (including timezone), validation rules, API request/response contracts, authentication and ownership rules, error handling, frontend/backend responsibilities, state synchronisation expectations, implementation constraints, deferred features, and any relevant ADR references. This document should define the expected behaviour so both repositories remain consistent throughout development.

Also add an Implementation Strategy section describing how profile work will be executed: implement one phase at a time; complete the frontend portion first, then update the backend only as required to satisfy the agreed contract; after each phase, verify the complete flow before moving to the next; do not implement future phases until the current phase is complete and approved; any change to a feature, function, API, model, validation rule, or behaviour must be reflected in CONTRACT.md before implementation so both repositories stay aligned.

Do not implement any code in this step. Only update CONTRACT.md so it serves as the authoritative reference for all subsequent profile development.

## Phase 1 — frontend profile correctness

`Title`: Correct the frontend profile feature against CONTRACT.md, excluding avatar work

`User prompt`: Frontend Profile Correctness only. Follow the agreed CONTRACT.md and existing implementation plan. Do not modify the backend in this phase. Review the profile-related frontend files and compare them against the agreed contract. Implement only the required corrections to make the current profile feature correct, reliable, and consistent: ensure the profile form always reflects the latest authenticated user data; synchronise profile state after successful updates; refresh authenticated user data when required after profile changes; handle null, loading, or unauthenticated user states safely; ensure frontend validation and error handling match the expected backend responses; add timezone support in the profile UI if it is already defined and required by the contract; remove dead or obsolete profile-related code directly involved in these flows; correct inaccurate profile-related UI text.

Avatar/image scope: do not implement any avatar or image upload functionality in this phase. Maintain the current behaviour — if a user image already exists, continue displaying it; if no user image exists, continue showing user initials generated from the first and last name. Do not add image upload, image update, image storage, new components, API changes, or any avatar-related infrastructure.

Do not create or modify test cases in this phase. Do not introduce unrelated features, new API endpoints, UI redesigns, performance optimisations, or architectural changes. Avoid unnecessary abstractions, helper functions, comments, or unrelated refactoring.

## Phase 3 (frontend) — profile image upload/update

`Title`: Implement profile image upload and update on the frontend

`User prompt`: Implement the Profile Image Upload/Update Feature based on the previously completed frontend analysis and agreed profile architecture. Implement only the profile image update functionality.

Required functionality: users should be able to view their current profile image if available; select and upload a new profile image; replace/update their existing profile image; see the updated image immediately after a successful update; and continue using the existing initials fallback when no profile image exists.

Frontend requirements: add profile image update UI according to the existing design system; add image selection handling; show preview before saving if consistent with the current UX; handle upload/update loading states; disable conflicting actions while the update is processing; display meaningful success and error feedback; update local/authenticated user state after successful image update; ensure the profile page reflects the latest image without requiring a full page refresh.

API integration: extend the frontend API/service layer only where required — add the required image update request, use the correct request format for image transfer, and handle backend success and error responses consistently with existing authentication/profile APIs.

Constraints: do not redesign the profile page; do not modify unrelated authentication functionality; do not introduce unnecessary state management complexity; do not add external storage solutions or infrastructure; do not create test cases in this phase; do not add unrelated profile features.

## Phase 5 (frontend) — core profile test cases

`Title`: Implement frontend core profile test cases

`User prompt`: Implement Frontend Core Profile Test Cases according to the behaviour defined in CONTRACT.md. Focus only on testing the core profile functionality that has already been implemented. Do not create tests for planned, deferred, or future features.

Before adding new tests, review the existing profile-related test suite and identify any missing, outdated, duplicate, or incorrect tests. Update existing tests where necessary and add only the missing tests required to achieve reliable coverage of the implemented core functionality.

Cover: profile page renders correctly for an authenticated user; existing user information is loaded and displayed; profile image is displayed when available; user initials are displayed when no profile image exists; editing supported profile fields; timezone display and update (if implemented); client-side form validation; successful profile update flow; backend validation and API error handling; loading states while profile updates are in progress; submit button disabled during requests; authenticated user state is synchronised after a successful profile update; updated profile information is reflected in the UI; null, loading, and unauthenticated user states; profile data persistence after page refresh where applicable.

Do not create tests for: avatar upload/update if not yet implemented; planned or deferred profile features; backend functionality; end-to-end tests; non-core edge cases outside the current implementation.

Reuse existing test utilities and patterns wherever possible. Keep the test suite simple, maintainable, and aligned with the current implementation. Avoid duplicate tests, unnecessary abstractions, and excessive comments. Do not modify production code unless a genuine bug preventing the implemented functionality from working correctly is discovered.

## Phase 6 (frontend) — profile cleanup

`Title`: Remove temporary and frontend-only profile implementations now the backend is complete

`User prompt`: Clean up the frontend code related to the Profile feature by removing any temporary, mocked, placeholder, or frontend-only implementations that were introduced before the backend profile functionality was available. The backend implementation is now complete and should be treated as the source for all profile data and operations.

Focus only on files directly related to the profile feature. Identify and remove: mock profile data; fake API calls or simulated responses; temporary state or fallback logic used only during frontend development; hardcoded profile values; unused helper functions, services, constants, or components created solely for mocked behaviour; dead code, duplicate logic, and obsolete TODOs related to the profile feature.

Replace any remaining mocked behaviour with the existing backend API integration where necessary, while preserving the current user experience and application flow. Do not modify unrelated features, authentication logic, routing, UI design, or state management beyond what is required for the profile feature.

Keep the implementation simple, maintainable, and consistent with CONTRACT.md. Avoid unnecessary refactoring, abstractions, helper functions, or comments.

## Settings phase — feature analysis and planning

`Title`: Analyse and plan the Settings feature against CONTRACT.md

`User prompt`: Analyse `product_analysis.md`, `backend_architecture.md`, and `CONTRACT.md` to create the implementation plan for the Settings feature.

`CONTRACT.md` is the single source of truth for frontend-backend communication. Any feature behaviour, API contract, data model, validation rule, endpoint definition, or implementation decision must follow `CONTRACT.md`. If `product_analysis.md` or `backend_architecture.md` conflicts with `CONTRACT.md`, identify the conflict and recommend the required update instead of silently choosing an approach.

Do not implement any code, modify files, or create tests in this phase. The objective is only analysis, architectural review, and planning.

Do not blindly follow the existing implementation. Evaluate the best approach based on product requirements, current architecture, maintainability, simplicity, scalability where required, and consistency between frontend and backend. Identify what should be kept, updated, replaced, removed, and added.

Determine: what belongs inside Settings and what should remain part of Profile, Authentication, or other modules; which features are required for the current product version and which should be deferred; correct architectural decisions that should remain unchanged; decisions needing improvement; over-engineered or unnecessary functionality; missing requirements; conflicting requirements.

Define the frontend design plan (page structure, components, state management, data fetching/update flow, form handling, validation, loading states, success/error handling, required services/hooks/utilities) and identify existing files to reuse, files requiring modification, and new files to create.

Define the backend design plan, including for every Settings operation: HTTP method, complete endpoint URL, purpose, authentication requirement, request body/query parameters, response structure, validation rules, and possible error responses. Review the data model for required entities, fields, relationships, reusable models, and fields that should be removed or avoided.

Identify all required updates to `CONTRACT.md` before implementation: new endpoints, request/response contracts, data models, validation rules, frontend/backend responsibilities, error handling rules, and deferred features.

Create a phased execution plan where each phase includes goal, frontend tasks, backend tasks, contract updates required, files expected to change, dependencies, manual verification steps, and completion criteria. Implement one phase at a time; keep frontend and backend synchronized through `CONTRACT.md`; do not implement functionality that is already complete and correctly aligned; reuse existing functions, components, services, and patterns; only update code when it is incomplete, inconsistent, or violates the agreed architecture; complete frontend work first, then backend work required to support it; do not create tests during implementation planning; avoid unnecessary complexity, abstractions, comments, or unrelated refactoring; do not introduce features outside the agreed scope.

## Settings phase — record the contract

`Title`: Write the Settings contract as the shared reference

`User prompt`: write/update CONTRACT.md as a source of reference for both frontend and backend

## Reusable Claude Skills — analysis and first increment

`Title`: Introduce reusable Claude Skills for repetitive workflows

`User prompt`: Analyze our previous conversations and identify repetitive workflows that are performed frequently throughout this project. The goal is to reduce prompt size, improve consistency, and eliminate repeated instructions by introducing reusable Claude Skills.

Phase 1 — Analysis: identify recurring tasks that are performed repeatedly across multiple conversations, follow a predictable sequence of steps, require similar instructions every time, would significantly reduce tokens if encapsulated into a reusable skill, and are generic enough to work for future features. Do not propose skills for one-off or highly specific tasks. For each repetitive workflow provide: workflow name, why it is repetitive, typical sequence of actions, estimated frequency, estimated token savings, and priority (High / Medium / Low).

Phase 2 — Draft Skills: for each proposed skill include skill name, purpose, when Claude should invoke it, inputs, outputs, scope, responsibilities, things explicitly out of scope, dependencies on other `.claude` resources, and estimated prompt reduction. Keep every draft single-responsibility, token-efficient, generic, easy to compose with other skills, and independent whenever possible.

Candidate areas to recommend only if the conversation history justifies them: feature analysis and planning; contract-first development; frontend implementation workflow; backend implementation workflow; frontend/backend synchronization; verification before completion; cleanup and dead-code removal; architecture consistency review; test implementation workflow; documentation updates; prompt recording; phase-based implementation planning; manual verification checklist generation.

Deliverables: repetitive workflows; recommended skill hierarchy; draft specification for each skill; skills that should be merged; skills that should not be created because they would duplicate existing instructions; recommended implementation order (highest ROI first).

Do not create any skills yet. Do not create the `.claude/skills` directory yet. Do not create any skill files. Do not modify project code or documentation. Wait for explicit approval before implementing any skill.

Then, on approval: implement first increment (i.e. create skills that have priority: High).

## Settings phase — S1 frontend implementation

`Title`: Implement the frontend Settings feature for the approved phase only

`User prompt`: Implement the frontend Settings feature by following the existing project rules and using the available Claude Skills. This task is frontend only. Do not modify backend code, do not create or update test cases, and do not implement future phases or unapproved features. Stop after completing the current approved phase.

After implementation, provide a concise report listing the files created, modified, and removed, summarize the functionality completed, and mention any blockers or contract inconsistencies that require approval before proceeding.

## Settings phase — S3 frontend/backend integration

`Title`: Connect the Settings feature end-to-end against the contract's endpoints

`User prompt`: Analyze the updated CONTRACT.md and the existing frontend codebase to ensure the Settings feature is fully integrated with the backend. First, verify that every Settings-related endpoint defined in CONTRACT.md (including any endpoints that were added because they were previously missing) has a corresponding frontend API call. Identify any missing, outdated, or incorrect integrations. If the frontend is not calling one or more required endpoints, update the existing codebase to use the correct endpoints, HTTP methods, request/response payloads, authentication headers, and error handling as defined in the contract and implemented in the backend.

Reuse existing API clients, hooks, services, state management, and coding patterns wherever possible instead of introducing duplicate logic. Ensure all Settings functionality is connected end-to-end, the frontend and backend remain synchronized with the API contract, and document every integration change made, including any endpoints that were added or updated. Do not create or run any test cases unless explicitly requested by the user.

## Timer phase — T0 feature planning

`Title`: Produce a single authoritative Timer implementation plan from code and all documentation

`User prompt`: Analyze the existing Timer feature across the frontend codebase and all available project documentation (including previous analyses, architecture documents, implementation notes, and API contracts) to produce a single authoritative implementation plan. Do not assume the current implementation is correct simply because it already exists. Instead, compare the existing code with the documented requirements, resolve any conflicts by selecting the technically superior, more scalable, and more maintainable approach, and justify each decision. Identify inconsistencies, redundant logic, architectural issues, incorrect behavior, missing functionality, performance concerns, and edge cases, and propose the correct or updated implementation where necessary. If the current design is flawed, recommend the appropriate code or functional changes instead of preserving existing behavior. Where backend support is required, design or refine the necessary API endpoints, request/response contracts, validation rules, authentication requirements, and data models, ensuring they align with the overall project architecture. Verify that the frontend and backend can be fully synchronized using this plan, eliminate any contract mismatches, and define the source of truth for timer state, synchronization, persistence, recovery, and conflict resolution. The final output should serve as the implementation blueprint that both frontend and backend will follow.

## Timer phase — T0 redesign with History as a dependency

`Title`: Make History backend-agnostic by having Timer generate all the data it consumes

`User prompt`: Analyze and redesign the Timer feature with the History feature as a primary architectural dependency. Create an implementation plan in which the Timer is responsible for generating, finalizing, and exposing all data required by History so that the History feature remains as independent from the backend as possible. Design the system so that completed timer sessions automatically produce the data consumed by History, eliminating the need for History-specific backend APIs, business logic, or synchronization wherever feasible. The backend should only support the Timer's core responsibilities (such as persistence, synchronization, recovery, and user-specific state), while History should derive its information from Timer-generated session records rather than communicating with the backend directly. Resolve any conflicting designs by selecting the most scalable and maintainable approach, and recommend corrections where the current implementation is inefficient or incorrect. If backend changes or new endpoints are required to support this architecture, design them with the goal of keeping History completely backend-agnostic. Clearly define data flow, ownership, session lifecycle, storage strategy, synchronization rules, recovery behavior, edge cases, and frontend/backend responsibilities so that both codebases follow a single, efficient architecture with minimal coupling and no redundant backend interactions for the History feature.

## Timer phase — T2 scope expanded to Task CRUD

`Title`: Incorporate full task CRUD into the approved Timer plan

`User prompt`: Update the approved Timer feature implementation plan to incorporate Task CRUD operations. Design how users can create, view, update, delete, and manage focus tasks that represent the work they intend to complete during sessions. If the current plan requires architectural, data model, API contract, or synchronization changes to support task management, update the plan accordingly while preserving the previously approved design decisions. The result should be a revised implementation plan that seamlessly incorporates task CRUD functionality into the workflow and clearly defines frontend responsibilities, backend responsibilities, data flow, and any required endpoints or model changes before implementation begins.

## Timer phase — T1 frontend implementation

`Title`: Implement the Timer frontend against the approved plan and remove client-only persistence

`User prompt`: Implement the frontend of the Timer feature according to the approved implementation plan, using the plan as the single source of truth. Begin by analyzing the existing Timer implementation and identify reusable components, architectural issues, redundant logic, missing functionality, dead code, and obsolete files. Improve the current implementation where appropriate instead of rewriting it unnecessarily. Complete the full Timer workflow—including task selection, start, pause, resume, reset, skip, completion, auto-transition, session recovery, progress updates, and all other planned behaviors—while ensuring the UI, state management, and user experience align with the workflow. Remove any dead ends, unused files, unreachable code, legacy implementations, and temporary workarounds that are no longer needed. Eliminate all mocked or client-only persistence related to the Timer feature (such as localStorage, fake services, mock APIs, hardcoded data, or placeholder implementations) and replace it with the appropriate backend API integration. Update existing services, API clients, hooks, stores, contexts, shared models, and components to consume the backend as the single source of truth for timer-related data while preserving efficient client-side state where appropriate. Ensure the frontend remains fully synchronized with the backend API contract and approved architecture, reusing existing project patterns and avoiding duplicate logic. If backend endpoints or contracts differ from the approved plan, report the mismatch instead of introducing frontend workarounds. Do not create or run any test cases unless explicitly requested by the user.

## Timer phase — T4 frontend/backend integration

`Title`: Verify and complete the Timer frontend's integration with the backend API

`User prompt`: Inspect the frontend implementation of the Timer feature and verify that it correctly integrates with the backend API. Begin by analyzing the backend API contract and implementation to identify every Timer-related endpoint, then inspect the frontend to ensure each required endpoint is invoked correctly. Validate that the HTTP methods, endpoint URLs, request payloads, query/path parameters, authentication headers, response handling, error handling, and loading states all match the backend contract. Identify any missing API calls, incorrect endpoints, mismatched request or response models, redundant requests, client-side workarounds that should be handled by the backend, or unused backend endpoints. Update the frontend wherever necessary so it fully complies with the backend implementation, reusing existing API clients, services, hooks, stores, and project patterns instead of introducing duplicate logic. Ensure the frontend/backend responsibility split follows the approved architecture: the frontend manages real-time timer execution (start, pause, resume, reset, skip, countdown, and UI state), while the backend is called only for persistence-related operations such as active session recovery (if supported), completed sessions, terminated sessions, synchronization, and task-session association. Remove any obsolete mock services, placeholder implementations, or unnecessary client-side persistence related to backend-managed data.

## Timer phase — T5 frontend coverage

`Title`: Create the frontend test suite for the Timer feature

`User prompt`: Create test cases for the frontend of the Timer feature. Cover the behaviour the feature actually promises rather than the way it is currently written: the timer state machine and its phase transitions, the control affordances each phase offers, what a resolved block writes and what it deliberately leaves alone, backlog membership and task binding, the full task CRUD surface including the distinction between deleting and abandoning a task, the hydration and sync states the dashboard can be in, recovery of a block interrupted by a reload, the outbox's delivery and retry rules, the store's optimistic mutations and rollback, the History import boundary, and the HTTP wire contract of the timer services. Treat the approved plan and CONTRACT.md as the source of truth for expected behaviour, not the existing implementation — where an existing test encodes a rule the product has since reversed, repoint the test at the rule that now holds and record why it changed. Report any production defect the tests uncover instead of adjusting the test to accommodate it. Run only the suites the change impacts, never the full suite, and finish with lint and build clean.

## History phase — H0 audit and contract amendment

`Title`: Audit the History feature against the approved architecture

`User prompt`: Analyze the History feature across the frontend, backend, CONTRACT.md, approved architecture, and implementation plans to verify whether it requires any updates, modifications, refactoring, or additional functionality. Do not assume the current implementation is correct simply because it already exists. Instead, compare the implementation against the approved architecture, where the Timer feature is the single source of truth for session data and the History feature derives its information from persisted Timer sessions with minimal backend-specific logic. Identify any inconsistencies, architectural conflicts, missing functionality, redundant code, inefficient data flow, UI/UX issues, performance concerns, or obsolete implementations. Verify that the frontend correctly consumes the available Timer session data without requiring unnecessary History-specific APIs or business logic. If new backend endpoints, frontend changes, data transformations, pagination, filtering, searching, grouping, statistics, or other improvements are genuinely required, recommend and justify them. Remove or refactor dead code, legacy implementations, mock data, and unused files where appropriate. Provide a detailed assessment covering correct functionality, issues to fix, recommended improvements, missing features, required frontend or backend modifications, API contract changes, and a prioritized implementation plan before making any code changes. Do not implement anything until the analysis and recommendations have been reviewed and approved.

`Title`: Record the approved History analysis in the contract

`User prompt`: Update the CONTRACT.md for the History feature based on the approved analysis and architecture.

Rulings given during this prompt, each resolving a Gate-0 decision the analysis raised:
- The hydration retry banner is owned by the shell (`AppLayout`), not by History, resolving the conflict between §17.4's retry requirement and its import boundary.
- `terminationReason` is rendered inline on terminated rows in `RecentTile`; the deferred Focus insight panel (N1) is unaffected.
- `summarize().focusMinutes` counts all focus time, terminated blocks included, not completed sessions only.
- `summarize()` splits `incompleteTasks` into separate `openTasks` and `abandonedTasks` counts so the summary and the outcome chart agree.

## History phase — H1–H4 frontend implementation

`Title`: Implement the approved History fixes, frontend only

`User prompt`: Implement the approved fixes, improvements, and recommendations identified during the History feature analysis recorded in CONTRACT.md. Implement only the frontend changes and document any backend dependencies that cannot yet be completed. Refactor the existing History feature where necessary to resolve architectural issues, remove redundant or dead code, improve maintainability, and align the implementation with the approved design. Update the UI, state management, data flow, API integration, filtering, sorting, searching, grouping, pagination, session presentation, error handling, loading states, empty states, and overall user experience wherever required by the approved recommendations.

## History phase — coverage

`Title`: Cover the History feature with tests

`User prompt`: Create new test cases or reuse existing ones if required for the History feature.

## Un-gate the History/Analytics charts

`Title`: Remove feature gating from Analytics/History so the charts are available to every user from session one

`User prompt`: Analyze the existing Analytics/History UI and compare it against the approved product architecture and CONTRACT.md. The original design gated analytics features behind lifetime-point thresholds, but the approved product direction changed to make these features available to every user from the beginning of their journey. Verify that the implementation follows this approved architecture. If the analytics, charts, task outcomes, trends, and related insights are already accessible to all users, remove all remaining feature-gating artifacts, including lock icons, locked badges (e.g., The Catalyst, The Vanguard), "Reach X lifetime points to unlock" messages, conditional rendering based on points, and any obsolete gating logic. Refactor the code to eliminate dead or unused feature-unlocking mechanisms while preserving the underlying achievement/title system for profile progression if it still exists. If, after reviewing the approved architecture and documentation, the decision is instead to retain feature gating, then restore a complete and consistent gating implementation so that features remain inaccessible until the required point thresholds are reached. Do not leave the application in a partially gated state.

Resolution given during this prompt, after the audit found the documents said the opposite:
The audit reported that `CONTRACT.md` §9.4 and §22 and `locked_decisions.md` all retained the
History gates, and that the shipped implementation matched them. The user overrode that record:
"Remove all remaining feature-gating UI elements from the Analytics and History pages, including
lock badges, lock icons, and 'Reach X lifetime points to unlock' messages, since these features are
now available to all users by design. Also remove any obsolete gating logic associated with these
elements while preserving the underlying achievement/title system if it is still used elsewhere in
the application."

Recorded as a supersession in `.claude/locked_decisions.md` and as §9.5 + phase H5 in `CONTRACT.md`.

## Task action workflow — Focus feature

`Title`: Fix the task action workflow so Mark as Done and Give Up are distinct and resolved tasks leave the Focus list

`User prompt`: Investigate and fix the task action workflow in the Focus feature. There are three
related issues that need to be resolved: first, the Mark as Done and Give Up buttons currently
perform the same action even though they should update the task with different statuses (completed
vs. abandoned); second, after a task is marked as completed or terminate after focus, it incorrectly
remains visible in the Focus list instead of being removed immediately and shown only in its
appropriate history section. Analyze the frontend code to fix this issue. If it requires backend
analysis then mention it before moving into backend.

## Avatar removal — profile

`Title`: Implement avatar removal with a confirmation dialog and full state handling

`User prompt`: implement avatar removal feature by using existing avatart and profile architecture.
add avatar removal action and make sure it only available/visisble when user has removable custom
avatart. when user select remove avatar, open confirmation dialog box that explain what will be the
result of this action. allow the user to cancel this action without any change. on confirm, remove
the avatar by calling the correct API. handle all states such as success, loading, error, no
existing avatar. also make sure on loading, user won't be able to perfom confirm button. on success
close confirmation dialog box, on error keep the avatar untouch. there is new file you can also
refer about this feature which is Implementation_gap_report.md

## Streak Freeze — frontend display

`Title`: Expose Streak Freeze status in the frontend using existing gamification UI and state patterns

`User prompt`: Implement the frontend portion only of the Streak Freeze feature using the existing
gamification UI and state patterns. Do not modify backend code. Expose the user's Streak Freeze
status in the frontend and correctly handle all UI states based on data already provided by the
backend. Use the existing gamification/profile response fields for available freeze count, whether
a freeze was recently consumed or not, and current daily streak. Display the freeze status wherever
the current daily streak or gamification summary is already shown. Do not create a new page for
this feature. Handle all UI states (loading, no freeze available, freeze consumed, error).

## Streak Freeze — proceed despite the deferral, and record the supersession

`Title`: Ship the freeze display against the "streak freezes are deferred" clause, recording the supersession

`User prompt`: [Asked how to handle the collision with CONTRACT.md §14.2 "no logic reads it" and the
§21 deferral.] Proceed + record supersession — implement the frontend display, then amend
CONTRACT.md §14.2/§21 and add the supersession entry to locked_decisions.md noting the frontend now
reads the field while the backend consumption logic stays deferred.

## Streak Freeze — CONTRACT.md must carry the full backend picture

`Title`: Extend the implementation where the existing model falls short, and document what the backend will need

`User prompt`: [Asked how the "freeze consumed" state should work, given no such field exists on the
wire.] if the current implement is not enough to implement this feature, update the code and
implement it. and mention in CONTRACT.md so that when i implementing this feature in backend, it
must have full picture of what it needs to be updated

## Feature gating — remove the title-based unlocking system completely

`Title`: Remove title-based feature unlocking; every feature available to every authenticated user

`User prompt`: Remove the title-based feature unlocking system completely. All product features must
be available to every authenticated user regardless of title, level, points, streak, or gamification
progress. Use the appropriate project skills for conflict handling, contract updates, implementation,
verification, and testing. Do not bypass documented decisions silently.

[On the decision-conflict prompt: chose full removal across both projects — the gate component, hook,
helpers, and `TITLES[].feature` in both mirrors — and chose to keep titles themselves as identity and
progression.]

## Task Estimation — optional per-task pomodoro estimate, planning information only

`Title`: Implement Task Estimation on the existing architecture, with no effect on timer, scoring, or completion

`User prompt`: Implement the Task Estimation feature using the existing task, timer, history, and
gamification architecture. Do not redesign the task model or timer workflow. Allow users to
optionally estimate how many Pomodoro sessions a task will require before starting work. The
estimate is planning information only. It must not affect timer behavior, scoring, streaks, or task
completion logic.

## Legacy cleanup — remove dead code left from the frontend-only build

`Title`: Clean up legacy mocked, duplicated, unused, and dead frontend code

`User prompt`: Clean up all legacy mocked, duplicated, unused, and dead frontend code left from the
original frontend-only version of the application. The application now has a real backend. Remove
obsolete frontend implementations that previously simulated backend behavior, persistence,
authentication, gamification, tasks, sessions, history, settings, or user data.

## Session persistence — resume the session on startup

`Title`: Keep users signed in across reloads; bootstrap the session at startup and renew the access token transparently

`User prompt`: Update the application's authentication flow so users remain signed in and can resume
their session after refreshing or reopening the page. On application startup, check for an existing
authenticated session and, when the access token is missing or expired, automatically request a new
access token using the refresh token. Store the refresh token securely in an HttpOnly, Secure, and
SameSite cookie rather than localStorage, and keep the access token in memory where possible.

[Reverses the 2026-07-29 decision recorded under "Align the frontend with the stateless-JWT backend",
where the user chose to keep the token memory-only and accept that a reload returns the user to
`/login`. Raised as a decision conflict and confirmed: ADR-008 revision 3 reinstates the two-token
model. The access token stays in Redux memory only — that constraint is unchanged and the refresh
token is never readable by JavaScript. Restores `bootstrapAuth`, an initial `status: 'loading'`, and
single-flight refresh-on-401 with one replay — the machinery deleted on 2026-07-29.]

[Shipped as phase A2, after the backend endpoint existed — a deliberate deviation from CONTRACT.md
§10.1 rule 2 (frontend first), because `bootstrapAuth` against a missing route would have returned
404, and a 404 is not a 401, so the thunk would have resolved to anonymous by accident and the
frontend would have looked correct while testing nothing. Added `store/hydrate.js` so "a session has
begun" has one definition that a sign-in and a cold bootstrap cannot drift apart on; `authSlice`
starts at `'loading'` and gains `bootstrapAuth`, whose rejection clears to anonymous **without**
setting `error` or touching `loginStatus`, since an anonymous cold start is the ordinary case and
must not paint a failure on the login form. `api.js` gained `credentials: 'include'`, a third
injection point `setAuthRefreshHandler`, and single-flight refresh-on-401 with exactly one replay —
`api.js` still imports nothing from the store. The bootstrap is dispatched from `main.jsx` outside
React on purpose: `<StrictMode>` double-invokes effects, and with rotation the second call would
present a token the first had just rotated away, which the server reads as a replay and answers by
revoking every session — signing the user out on every page load, in development only. Browser
verification was not possible in this session; the single-flight bound, the one-replay bound, the
never-retry paths, the anonymous-401 rule and the bootstrap reducers were exercised directly against
the real modules instead.]

## Google sign-in — OAuth 2.0 + OpenID Connect

`Title`: Add OAuth 2.0 / OIDC provider sign-in alongside the existing password authentication

`User prompt`: Review the existing authentication system and prepare a detailed implementation plan
for adding OAuth 2.0 authentication to the application. Inspect the current frontend and backend
authentication flow, including login, logout, access-token handling, refresh-token handling, session
restoration, protected routes, user storage, API middleware, cookies, and environment configuration.
Determine whether OpenID Connect is also required for user authentication and identity information.
The plan should cover the recommended OAuth 2.0 authorization flow, preferably Authorization Code
Flow with PKCE where appropriate, the selected identity providers, redirect and callback routes,
state and nonce validation, PKCE generation and verification, secure token exchange, user profile
retrieval, account creation and linking, handling users with the same email address, access-token
and refresh-token storage, token rotation, session restoration after page reloads, logout and
provider revocation, protected API access, error handling, CSRF protection, XSS risks, cookie
security, required scopes, environment variables, database changes, and provider configuration.
Break the work into clear implementation phases with dependencies and acceptance criteria. Do not
generate or change application code until the plan has been reviewed and approved.

[Four decisions settled during planning: **backend-driven BFF flow** over SPA-side PKCE — the SPA
never sees a code, verifier, or provider token, so the locked memory-only rule is structurally
unreachable rather than merely respected; **Google only**; **auto-link an existing account only when
the provider asserts `email_verified: true`**; and **scope includes link/unlink management**, not
sign-in alone.]

[Collided with the deferral in ADR-008 and with this file's own 2026-07-29 entry, which recorded the
instruction *"do not implement … social login."* Raised as a decision conflict and confirmed.
Recorded as **ADR-008a** — a new ADR rather than an ADR-008 revision, because ADR-008's session
model is untouched. The frontend's entire contribution is an `<a href>` to a backend URL and a
query-parameter read on the way back: `api.js`, `authSlice.js`, `store/index.js`, `store/hydrate.js`,
`useAuth.js`, `main.jsx` and both route guards take **zero** changes, and no new route is needed
because `main.jsx` already bootstraps a session on every cold load.]

## Google sign-in — governance before implementation

`Title`: Update governance, architecture, contract, and prompt history before any OAuth code is written

`User prompt`: Review the complete OAuth 2.0 + OpenID Connect (Google) Implementation Plan. Do not
modify application code, frontend components, backend services, Prisma schema, migrations,
environment files, dependencies, or tests during this task. The objective is to update the project's
governance, architecture, contract, and prompt-history files so that the Google OAuth implementation
can begin without contradicting existing recorded decisions.

[Phase O0, executed as documentation only. `.claude/locked_decisions.md` gains a frontend
sign-in-methods row and the supersession entry; `CONTRACT.md` gains §1.5, §2.3, §3.2 and
§4.11–§4.17, with §4 preamble, §5, §6, §7.2, §9, §9.7, §10.2, §11, §12 and §21 amended. The new
§7.2 paragraph names the eight frontend files that must appear in **no** OAuth diff, so a phase that
touches one stops rather than proceeds.]

## Google sign-in — the frontend is a link and nothing more

`Title`: Frontend-only OAuth entry, with the client barred from every OAuth secret

`User prompt`: Work on the frontend only and do not modify the backend, session model,
refresh-token flow, access-token handling, route guards, authentication bootstrap, or
browser-storage behaviour. Preserve the existing password registration and login experience. The
OAuth flow is backend-driven, so the frontend must never receive, parse, store, or process a Google
authorization code, PKCE verifier, OAuth state, nonce, ID token, Google access token, or Google
refresh token, and it must not create an OAuth callback page or perform an AJAX-based
authorization-code exchange.

[Phase O3. Restates ADR-008a's client contract as a hard implementation constraint and adds one it
did not: **no AJAX code exchange**, which forecloses the shortcut of fetching the callback instead of
navigating to it — a fetch would swallow the redirect chain and the `Set-Cookie` at the end of it.
Delivered as `components/OAuthButtons.jsx` + its CSS and a query-parameter read on `LogInPage`;
`api.js`, `authSlice.js`, `store/index.js`, `store/hydrate.js`, `useAuth.js`, `main.jsx`,
`storage.js` and both route guards took zero changes, as §7.2 requires.]

## Periodic email reports — how users enable them (P3)

`User prompt`: Reports should not be automatically enabled. During signup, let new users choose:
Weekly, Monthly, or No email reports. Do not automatically subscribe existing users. Show existing
users a one-time in-app invitation. Provide controls in Settings. Include unsubscribe and
change-frequency links in every email.

[The frontend half of the email-reporting feature, planned as **phase R3** in `CONTRACT.md` §28.1.
Four surfaces, not one: a choice control on `SignUpPage` with **no preselection** (the third option,
"No email reports", is a real answer that gets stored — `status: 'declined'` — because "no row" has
to keep meaning *never asked* for the invitation to know when to appear); a control in `/setting`;
the one-time invitation card, which renders **only** on `status: "unasked"` from `GET /me/reports`;
and `/reports/confirm` + `/reports/unsubscribe` pages under `RequireGuest`, since both are opened
from an email on a device that may not be signed in.

Two consequences worth carrying into the work. **Google-created accounts never see the signup
choice** — `SignUpPage` is the password path only, and an account created inside the OAuth callback
has no form to answer; those accounts meet the invitation instead. And **the confirm/unsubscribe
pages must POST, not act on load**: corporate mail scanners follow links in incoming mail, so a page
that consumed its single-use token on mount would be consumed by the scanner before the human
clicked. R2 (backend) lands before R3, which is a recorded deviation from §10.1 rule 2 — the failure
paths here (expired token, re-used token, decline vs silence) are not falsifiable against a mock.]
