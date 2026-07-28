# Rule: GitHub Workflow & Commit Guidelines

## Context & Objective
This rule governs how and when Claude Code interacts with Git/GitHub, formats commit messages, and determines the correct target directory for pushing code.


## 2. When to Commit & Push
Avoid massive, single commits at the end of a session, and avoid committing broken code. Commit code when a distinct, functional unit of work is completed.

### Commit Triggers
*   **Feature Completion:** A single feature or endpoint is fully implemented and verified.
*   **Successful Bug Fix:** A bug is resolved, and tests pass.
*   **Refactoring:** Code structure is improved without changing behavior (ensure tests still pass).
*   **Documentation updates:** Significant changes to READMEs, architecture notes, or API docs.

### Golden Rules
*   **Never** commit code that breaks the build or fails core unit tests.
*   **Never** stage or commit sensitive files (e.g., `.env`, credentials, local build artifacts). Always verify `.gitignore` is respected.

## 3. Meaningful Commit Message Guidelines
All commit messages must follow a purposeful, semantic structure so the history remains clean and scannable. 

### Format
Use the conventional commit format: `<scope>: <short description>`

In this monorepo, prefer a scope that names the area within a package (`timer:`, `auth:`,
`api:`). Add the package prefix only when a commit could otherwise be ambiguous
(`frontend/timer:`, `backend/api:`). Do not mix changes to `pomodoro-frontend/` and
`pomodoro-backend/` in one commit — keep each package's history independently readable so
the two can be split into separate repositories later.

Keep the subject line short and focused on the actual change. Do not turn it into a paragraph, and do not add unrelated details such as tool names, editor names, or agent commentary.


### Examples of Good vs. Bad Messages
- *Bad:* `fixed bug`, `updates`, `done with feature`
- *Good:* `auth: resolve JWT expiration mismatch in token validation`
- *Good:* `db: implement Prisma schema models for user profile linking`
- *Good:* `api: document query parameters for the search endpoint`

## 4. Automation Workflow Step-by-Step
When instructed to "push the code", follow this exact operational sequence:

1. **Verify State:** Run `git status` to see modified files.
2. **Display & Prompt:** Display all uncommitted/unstaged files clearly to the user and explicitly ask which files they want to commit.
3. **Targeted Stage:** Stage only the specific files specified by the user (ranging from a single file, a custom subset, or all files) using `git add <files>`.
4. **Commit:** Craft a structured, meaningful commit message based on the guidelines above (`git commit -m "scope: description>"`).
5. **Push:** Execute the push command targeting the appropriate active branch and remote repository.