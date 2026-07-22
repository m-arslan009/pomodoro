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

Implementation summary: the History charts existed but shipped always-on. Added a reusable `components/history/GatedTile.jsx` that reuses the already-built `useFeatureGate` hook + `gamification` service to render each chart tile as a normal card when unlocked, or as a dimmed, `inert`, previewable card with a lock chip and "Reach {Title} to unlock" hint when still locked. Wired `TrendTile` behind Catalyst (`timeUtilization`) with its interval control hidden while locked, and `ComparisonTile` + `OutcomeTile` behind Vanguard (`graphicalReports`). The KPI summary and recent-sessions log stay ungated as the always-available baseline, with the log serving as the accessible data fallback while charts are locked. Added scoped `.hp-tile__viz`, `.hp-lock-chip`, and `.hp-lock-hint` styles (plus reduced-motion handling) to HistoryPage.css. Lint and build pass.
