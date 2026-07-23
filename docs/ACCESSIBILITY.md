# Accessibility

The extension targets WCAG 2.2 AA where practical. It uses semantic landmarks
and headings, labelled icon buttons, keyboard-operable tabs and dialogs,
visible focus, non-color status text, practical pointer targets, and live
regions for important draft and research state.

Layouts are tested at the 320 px minimum without page-level horizontal scroll
and remain usable at 200% zoom. Secondary metrics collapse before player
identity, position, or score. Reduced-motion preferences disable nonessential
transitions, and cached content prevents disruptive full-screen loading.

Automated Playwright checks run axe and fail on serious or critical findings.
Keyboard, responsive, dark-theme, and visual-regression behavior are part of
the extension release gate.
