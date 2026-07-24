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
