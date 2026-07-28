---
paths:
  - "pomodoro-frontend/**"
---

# Frontend Development Rules & AI Coding Guardrails

**Scope:** `pomodoro-frontend/` only. The stack-agnostic scope and change-discipline rules
that used to open this file now live in
[`../shared/change-discipline.md`](../shared/change-discipline.md) and apply everywhere.

## Components and Reuse
*   **Meaningful Reuse:** Create reusable components for repeated meaningful UI patterns or behavior. Do not create a component solely to remove a few repeated lines.
*   **Single Responsibility:** Keep components focused on one clear responsibility.
*   **Composition Over Configuration:** Prefer composition over large components with many configuration flags.
*   **Component Splitting:** Split a component when it becomes difficult to understand, test, or reuse.
*   **No Duplicate Logic:** Do not duplicate UI or state logic across components.
*   **Descriptive Naming:** Use clear and descriptive names based on purpose, not visual position alone. Follow the project's established naming conventions.

## Responsive Design
*   **Multi-Screen Layouts:** Build layouts that work on mobile, tablet, and desktop screens. Start with a simple mobile layout unless the existing project follows another approach.
*   **No Fixed Widths:** Avoid fixed widths that cause horizontal scrolling. Use flexible containers, grids, wrapping, and responsive spacing.
*   **Readability & Sizing:** Ensure text remains readable at narrow widths. Ensure buttons and interactive controls remain usable on touch devices.
*   **Robust Content Testing:** Test UI layout variations with long names, long descriptions, empty values, and large datasets.
*   **No Hiding Essential Features:** Do not hide essential functionality on smaller screens.

## Accessibility (A11y)
*   **Semantic HTML:** Use semantic HTML elements whenever possible.
*   **Keyboard Usability:** Every interactive element must be usable with a keyboard. Provide visible keyboard focus states.
*   **Buttons vs Links:** Use buttons for actions and links for navigation.
*   **Form Labels:** Associate form inputs with labels. Add accessible names to icon-only controls.
*   **Alternative Text:** Provide meaningful alternative text for informative images. Use empty alternative text (`alt=""`) for purely decorative images.
*   **Color & Contrast:** Do not communicate information through color alone. Maintain readable color contrast.
*   **Structure & ARIA:** Preserve a logical heading hierarchy. Use ARIA only when semantic HTML cannot express the required behavior.
*   **Motion & Loading:** Respect the user's reduced-motion preference. Avoid animations that prevent or delay access to content. Announce important dynamic status changes when necessary.

## Client-Side Forms and Validation
*   **UI Error Handling:** Display validation errors near the relevant field. Preserve valid user input after a validation failure. Clearly indicate required fields.
*   **Submission Safeguards:** Disable duplicate submissions while a network request is in progress when appropriate. Handle loading, success, validation-error, server-error, and retry states within the UI.

## UI Styling and Design Consistency
*   **Design System First:** Follow the existing design system before adding new visual patterns. Reuse established spacing, typography, colors, radii, shadows, and interaction states.
*   **Semantic Themes:** Give colors semantic roles rather than using arbitrary values throughout the code. Ensure dark and light themes remain readable when both are supported.
*   **Alignment & Interactions:** Keep text left-aligned by default unless the design requires otherwise. Containers may be centered while their text remains left-aligned. Include hover, focus, active, disabled, loading, and error states for interactive controls.
*   **CSS Discipline:** Avoid excessive animation and decorative effects. Keep custom CSS local and purposeful. Do not use inline styles when the project has an established styling system, except for genuinely dynamic values.

## Performance
*   **Rendering Optimization:** Avoid repeated expensive calculations during rendering. Avoid unnecessary component rerenders.
*   **Resource Management:** Lazy-load large or noncritical features when it materially improves initial loading. Optimize images and provide appropriate dimensions. Avoid loading oversized images for small display areas.
*   **Layout Shift Prevention:** Prevent layout shifts (CLS) by reserving space for images and asynchronous content.
*   **Action Handling:** Debounce or throttle high-frequency actions (like scrolling or resizing inputs) when appropriate.
*   **Dependencies:** Keep client bundles and third-party dependencies as small as practical. Prefer native platform functionality over adding a dependency for trivial behavior.

## Frontend Error and State Handling
*   **State Coverage:** Account for loading, success, empty, partial, unauthorized, forbidden, not-found, and error states within the interface where relevant.
*   **UX Recovery:** Show users a clear recovery action when possible. Do not leave the interface indefinitely loading. Do not expose raw server/technical details directly to users.
*   **Safeguards:** Use error boundaries or equivalent safeguards for major client-side sections where appropriate. Preserve usable functionality when a secondary client request or optional feature fails.

## Frontend Testing and Verification
*   **Behavior Over Implementation:** Test UI behavior, not implementation details. Update or add tests when behavior changes.
*   **UI Verification:** Verify responsive behavior for meaningful UI changes. Verify keyboard behavior for interactive UI changes.
*   **Pipeline Compliance:** Run configured linting, type checking, and tests appropriate to the change. Do not update snapshots blindly to hide unintended layout changes.

---

## ✅ Completion Criteria
A layout or component change is strictly considered complete **only** when:
*   The requested UI behavior works.
*   Loading, empty, error, and dynamic states are explicitly handled visually.
*   Responsive layout and accessibility (A11y) requirements are fully satisfied.
*   No temporary layout testing borders remain in the workspace.
*   Unresolved **layout or browser-compatibility** risks are named explicitly.

The generic completion bar — run the package's linters and tests, leave no debugging
artifacts, and report changed files plus verification results — is in
[`../shared/change-discipline.md`](../shared/change-discipline.md) and is not repeated here.