# UI

Grade the running app, and use the code to explain what you see. Visit every main screen at three
widths, phone (390 x 844), tablet (820 x 1180) and desktop (1440 x 900), in light and dark themes
if the app has both. Take a screenshot of each and cite it.

## Visual identity

- The look is recognizable and the same on every screen.
- Art, type and color fit the product and work together.
- Nothing looks like an untouched default component.

## Design system

- Colors, spacing, type and radii come from shared tokens. Search for hard-coded values outside
  the theme file and cite them.
- Screens reuse shared components instead of rebuilding them.
- Hover, pressed, disabled, focus and error states look the same everywhere.

## Responsive

- No horizontal scroll, clipped text or overlap at any width, in both orientations on phone and
  tablet.
- Touch targets are at least 44 px on touch layouts.
- Large screens use the space instead of stretching the phone layout.

## Accessibility

- Run axe-core on each screen if it can be installed, and cite its violations.
- Every control has a name and a role. The keyboard alone reaches and operates everything, with a
  visible focus.
- Contrast meets WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and controls.
- The app respects reduced motion and still works at 200% text zoom.
