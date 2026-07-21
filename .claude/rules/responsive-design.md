## Break Points
- `small screen`: use 576px as reference point. when screen width is less then or equal to 576 implement small screen design.
- `medium screen`: use 768px as reference point. when screen widht is >567 and <= 786 implement medium screen design.
- `large screen`: when screen width >786, use large screen design

## objective: 
-  Build interfaces that remain readable, usable, and visually consistent
-  across mobile, tablet, laptop, and large desktop screens without hiding
-  essential functionality.

## approach:
- strategy: mobile-first
- rules:
    - Start with the smallest supported screen size.
    - Add layout enhancements as more screen space becomes available.
    - Follow the project's existing responsive strategy when one already exists.
    - Use the project's established breakpoints instead of creating arbitrary ones.
    - Avoid device-specific styling unless a real device limitation requires it.
    - Design based on available space and content needs, not specific device models.

## layout:
- containers:
    - Use fluid-width containers where practical.
    - Apply a sensible maximum width for large screens when needed for readability.
    - Keep consistent horizontal padding at each breakpoint.
    - Prevent content from touching the viewport edges.
    - Allow containers to shrink without causing horizontal overflow.

-  sizing:
    - Prefer relative and flexible sizing over fixed pixel widths.
    - Use percentages, minmax(), auto-fit, auto-fill, flexbox, or CSS grid where appropriate.
    - Use min-width and max-width intentionally.
    - Avoid fixed widths that break on narrow screens.
    - Avoid fixed heights for content that may wrap or grow.
    - Use min-height instead of fixed height when content length can vary.
    - Ensure child elements cannot force their parent beyond the viewport width.

-  composition:
    - Stack multi-column layouts vertically on narrow screens.
    - Increase the number of columns only when sufficient space is available.
    - Allow repeated items, cards, tags, actions, and navigation elements to wrap.
    - Preserve a clear visual hierarchy when the layout changes.
    - Keep related content and actions visually grouped at every screen size.
    - Avoid relying on absolute positioning for primary page structure.

-  overflow:
    - The page must not produce unintended horizontal scrolling.
    - Long content must wrap, truncate, scroll locally, or otherwise remain contained.
    - Wide tables should use an intentional responsive treatment.
    - Code blocks, charts, images, and data grids must not expand the page width.
    - Local horizontal scrolling may be used for inherently wide content.
    - Do not apply global overflow-x hidden merely to conceal layout defects.

## typography:
-  rules:
    - Keep body text readable at narrow widths.
    - Use responsive typography only when it improves readability.
    - Maintain comfortable line height and line length.
    - Allow headings, labels, and descriptions to wrap naturally.
    - Prevent long words, URLs, identifiers, and email addresses from breaking layouts.
    - Do not reduce text to an unreadable size to make content fit.
    - Preserve the intended heading hierarchy at every breakpoint.

## spacing:
-  rules:
    - Use the project's spacing scale consistently.
    - Reduce excessive whitespace on small screens.
    - Add more breathing room on larger screens where appropriate.
    - Keep spacing between related elements smaller than spacing between sections.
    - Ensure wrapped elements maintain consistent row and column gaps.
    - Avoid hard-coded margins that only work at one viewport width.

## images_and_media:
-  rules:
    - Make images and media responsive within their containers.
    - Preserve image aspect ratios.
    - Prevent images from exceeding their container width.
    - Use appropriately sized image assets for their rendered dimensions.
    - Reserve space for asynchronously loaded media to reduce layout shifts.
    - Crop media intentionally when fixed visual proportions are required.
    - Ensure important image content remains visible across aspect ratios.

## navigation:
-  rules:
    - Keep primary navigation discoverable on all supported screen sizes.
    - Use a compact navigation pattern when full navigation cannot fit.
    - Do not remove essential destinations on smaller screens.
    - Ensure collapsed navigation can be opened, used, and closed with touch and keyboard.
    - Keep the current page or active navigation state understandable.
    - Avoid navigation controls that overlap content.

## interactive_controls:
-  rules:
    - Keep buttons, links, inputs, menus, and other controls usable on touch devices.
    - Provide sufficient touch target size and spacing between adjacent controls.
    - Avoid interactions that depend exclusively on hover.
    - Keep primary actions visible and easy to reach.
    - Allow action groups to wrap or stack when horizontal space is limited.
    - Ensure labels remain understandable when controls change position.
    - Preserve visible focus states at every breakpoint.
    - Do not place important controls outside the visible viewport.

## forms:
-  layout:
    - Use a single-column form layout on narrow screens unless another structure is clearly better.
    - Place related fields in multiple columns only when adequate width is available.
    - Keep labels, inputs, help text, and validation errors visually associated.
    - Allow validation messages to wrap without shifting or breaking nearby fields.
    - Make form controls fill the available width when appropriate.
    - Stack submit and secondary actions when they cannot fit comfortably in one row.

-  behavior:
    - Keep entered values visible and editable after validation failures.
    - Ensure virtual keyboards do not permanently obscure critical actions.
    - Use input types and attributes that support appropriate mobile keyboards.
    - Avoid automatically focusing fields when it causes disruptive viewport movement.

## content_resilience:
-  test_data:
    - short text
    - long names
    - long unbroken text
    - long descriptions
    - translated or expanded text
    - empty values
    - missing optional content
    - large datasets
    - single-item collections
    - large numbers
    - validation errors
    - loading states
    - error states

-  rules:
    - Content length must not determine whether the layout works.
    - Empty states must remain visually complete and understandable.
    - Large collections should not make the interface unusable.
    - Dynamic content updates must not cause controls to become inaccessible.
    - Repeated content should wrap, paginate, scroll, or load progressively as appropriate.

## tables_and_large_datasets:
-  rules:
    - Choose a responsive strategy based on the importance of the data.
    - Preserve access to essential columns and actions.
    - Use local horizontal scrolling when the table cannot reasonably collapse.
    - Consider card or stacked-row presentations on narrow screens when appropriate.
    - Keep headers understandable while scrolling.
    - Do not hide critical information solely to make a table fit.
    - Paginate or progressively load large collections when appropriate.

## visibility:
-  rules:
    - Do not hide essential functionality on smaller screens.
    - Secondary content may be collapsed only when it remains discoverable.
    - Responsive changes must not change user permissions or available capabilities.
    - If content is moved into a menu, drawer, accordion, or tab, it must remain accessible.
    - Do not show different critical information to users solely because of viewport size.

## accessibility:
-  rules:
    - Preserve semantic structure when layouts change.
    - Maintain logical keyboard and reading order.
    - Ensure visual reordering does not create a confusing focus order.
    - Keep focus indicators visible and unobstructed.
    - Maintain readable color contrast across screen sizes and themes.
    - Respect reduced-motion preferences.
    - Ensure zoomed layouts remain usable.
    - Do not require precise pointer movement for essential interactions.

## responsive_states:
-  required_states:
    - loading
    - loaded
    - empty
    - partial_data
    - validation_error
    - server_error
    - unauthorized
    - forbidden
    - not_found
    - disabled

-  rules:
    - Verify every relevant state at narrow and wide viewport sizes.
    - Loading placeholders must fit the final layout.
    - Error messages must not overflow their containers.
    - Empty states must not rely on desktop-only spacing or positioning.
    - Disabled and loading controls must remain understandable on touch devices.

## breakpoints:
-  rules:
    - Reuse breakpoint values defined by the existing design system.
    - Introduce a new breakpoint only when content demonstrably requires it.
    - Avoid adding many narrowly separated breakpoints.
    - Test between breakpoints, not only at their exact boundary values.
    - Ensure the layout changes smoothly rather than working only at predefined widths.

## implementation_guidance:
-  css:
    - Prefer flexbox for one-dimensional alignment and wrapping.
    - Prefer CSS grid for structured two-dimensional layouts.
    - Use gap for spacing between flex and grid children where supported by the project.
    - Use clamp() for bounded responsive values when appropriate.
    - Use min(), max(), and minmax() when they simplify flexible sizing.
    - Apply box-sizing: border-box consistently.
    - Use overflow-wrap or word-break only where long content requires it.
    - Keep responsive styles close to the component or feature they affect.
    - Avoid high-specificity overrides created only to fix one viewport.

-  components:
    - Components must adapt to the width of their container, not only the browser viewport.
    - Reusable components must not assume they always appear in a full-width page.
    - Component variants should represent meaningful behavior, not arbitrary screen sizes.
    - Avoid duplicating separate mobile and desktop components unless behavior differs substantially.
    - Preserve component functionality when its container becomes narrow.

## verification:
-  viewport_categories:
    - narrow_mobile
    - standard_mobile
    - tablet
    - laptop
    - desktop
    - large_desktop

-  checks:
    - Verify there is no unintended page-level horizontal scrolling.
    - Verify text remains readable and does not overlap nearby content.
    - Verify navigation remains accessible.
    - Verify all essential functionality remains available.
    - Verify buttons and controls remain usable with touch.
    - Verify keyboard navigation and focus order.
    - Verify forms with validation messages.
    - Verify long and unbroken content.
    - Verify empty, loading, error, and large-data states.
    - Verify images and media remain contained.
    - Verify modals, dropdowns, popovers, and tooltips remain within the viewport.
    - Verify sticky and fixed elements do not cover content or actions.
    - Verify the interface at intermediate widths between breakpoints.
    - Verify portrait and landscape orientations where relevant.
    - Verify browser zoom and increased text size where supported.
    - Verify dark and light themes when both are available.

## acceptance_criteria:
  - The interface works on mobile, tablet, laptop, and desktop widths.
  - No essential action or information is unavailable on smaller screens.
  - No unintended horizontal page scrolling occurs.
  - Layouts adapt without overlapping, clipping, or inaccessible content.
  - Text remains readable without requiring horizontal scrolling.
  - Interactive controls remain usable with touch, mouse, and keyboard.
  - Long, empty, loading, error, and large-data states are handled.
  - Responsive behavior follows the existing design system and project conventions.
  - Responsive verification is completed for every meaningful UI change.
  - Accessibility requirements remain satisfied after responsive transformations.