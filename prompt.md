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
