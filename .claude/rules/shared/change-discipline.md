# Change Discipline — Applies to Every Package

Stack-agnostic guardrails for how much to change and when. These apply to
`pomodoro-frontend/`, `pomodoro-backend/`, and repo-level files alike.

> Extracted from the original frontend `general-coding.md` because none of it is
> frontend-specific. Frontend-only UI guardrails live in
> [`../frontend/general-coding.md`](../frontend/general-coding.md).

## Scope and Change Discipline
*   **Inspect Existing Patterns:** Inspect the existing implementation before creating new files or introducing new patterns.
*   **Minimal Changes:** Make the smallest maintainable change that satisfies the requested behavior.
*   **No Unrelated Refactoring:** Do not refactor unrelated code.
*   **File Integrity:** Do not rename, move, or delete existing files unless the task explicitly requires it.
*   **Follow Conventions:** Follow existing project conventions unless they are clearly unsafe or broken.
*   **Search Before Creating:** Search for an existing component, utility, service, hook, or pattern before creating a new one.
*   **Preserve Behavior:** Preserve existing behavior unless the requested change explicitly replaces it.

## Cross-package boundaries
*   Keep `pomodoro-frontend/` and `pomodoro-backend/` independently buildable — neither may
    import source files across the package boundary.
*   Each package owns its own dependency manifest, lockfile, and `.gitignore`.
*   Run package commands from inside that package directory, never from the repository root.
*   A change that spans both packages should state the contract (API shape, payloads, error
    cases) before either side is edited.

## Verification and reporting
*   Run the linting, type checking, and tests configured for the package you changed.
*   Do not update snapshots blindly to hide unintended changes.
*   Leave no debugging artifacts (console logs, temporary borders, scratch files) behind.
*   The final response must report: **changed files**, **verification results**, and any
    **unresolved risks**.
