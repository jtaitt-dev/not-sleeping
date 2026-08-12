# UI Design System

Not Sleeping follows Sleeper's rendered product language while remaining an
independent extension. Reference values are measured from the signed-in Sleeper
predraft and draft-room pages; no Sleeper-owned font files, artwork, or source
code are redistributed.

## Foundations

- Body and dense data use bundled Lato 400/700. Navigation, headings, tabs, and
  buttons use bundled Poppins 500/600/700. Both packages are OFL-1.1.
- The shared type scale is 9, 10, 11, 12, 13, 14, 16, 18, 22, and 40 px.
  Authenticated measurement found 9 px status metadata on Predraft, 10 px
  position metadata in the draft room, 11 px pick labels, 12 px panel rows,
  and 14 px player names. The 9 px token is reserved for non-actionable
  predraft microcopy; draft surfaces use 10 px or larger.
- The spacing scale is 4, 8, 12, 16, 20, 24, and 32 px.
- Page, alternate, card, raised, hover, and draft-board surfaces are stepped by
  lightness. Borders are subordinate and never provide the only depth cue.
- Teal `#00ceb8` is the primary action and selected-state color. Position,
  success, warning, danger, research, and on-clock colors are semantic tokens.
- Radii are 6, 10, 14, and pill. Shadows are reserved for elevated overlays.

The canonical values live in `src/styles/tokens.css`. Every side-panel, popup,
and options-page stylesheet consumes the same tokens.

## Measured geometry

- Navigation and standard controls: 40 px
- Compact buttons: 32 px
- Player rows: 44 px
- Statistical player rows: 52 px with 32 px avatars
- Team roster rows: 64 px with 42×32 px slot tiles and 32 px avatars
- Draft cells: 132 × 50 px
- Small, medium, and large icons: 14, 18, and 24 px
- Modal width: at most 520 px with a 16 px viewport gutter
- Drawer width: at most 440 px
- Bottom sheet: at most 78 vh / 720 px

These dimensions preserve Sleeper's scan rhythm without copying the reference
site's forced desktop shrink at 320–390 px. The extension reflows at narrow
widths because a side panel must remain operable.

## Components and states

Buttons, icon buttons, compact tabs, badges, player avatars, metric clusters,
surfaces, skeletons, empty states, inline errors, dialogs, drawers, and league
navigation share the same color, typography, focus, disabled, hover, active,
loading, and error behavior. Draft recommendations never bypass deterministic
eligibility; AI presentation is an optional bounded layer.

All interactive controls have a visible focus ring and accessible name. Motion
is limited to 100–260 ms state transitions and is removed for
`prefers-reduced-motion` or the extension's reduced-motion setting.

## Responsive policy

At 600 px the full data hierarchy is available. At 480 px secondary columns
collapse. At 360 px cards become single-column, five primary navigation items
remain visible, and Players remains reachable from More. At 320 px the draft
recommendation, on-clock state, player identity, position, and action controls
remain readable and usable. Recommendation names wrap rather than ellipsize,
and position remains in the compact metadata when the standalone badge hides.
