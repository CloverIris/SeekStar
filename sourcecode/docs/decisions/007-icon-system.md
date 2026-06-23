# 007: Shell Icon System

Status: Accepted for P1 shell refinement
Date: 2026-06-22
Subsystem: Desktop shell iconography

## Problem

The left observatory sidebar and canvas tools used text glyphs as temporary icons. P1 needs real icons that fit the Codex-like technical shell without adding a full UI framework or changing product behavior.

## Research Checked

- Lucide React official docs:
  - https://lucide.dev/guide/react
  - https://lucide.dev/guide/react/getting-started
- Fluent UI React documentation:
  - https://react.fluentui.dev/

Lucide React provides standalone React icon components that render optimized inline SVG, support `size`, `color`, and `strokeWidth` props, and can be imported one icon at a time. The official docs describe the package as tree-shakable and licensed under ISC.

## Chosen Approach

- Use `lucide-react` inside `@seekstar/desktop`.
- Import only the icons used by the shell, sidebar, and canvas tools.
- Keep icon styling CSS-driven through `currentColor` and the existing design tokens.
- Keep icons as orientation aids, not as browser chrome or dashboard decoration.

## Rejected Approaches

- Hand-rolled SVGs:
  - Rejected because they would create inconsistent local icon work.
- Icon fonts:
  - Rejected because inline SVG components are easier to style, tree-shake, and inspect.
- Full component framework:
  - Rejected because P1 only needs shell iconography, not a UI reset.

## Implementation Notes

The first P1 icon pass covers:

- window navigation controls;
- new field search and current-map search entries;
- favorites and settings;
- canvas tools: Pointer, Pan, Lasso, and disabled Brush;
- exploration tab markers and close affordances.

This does not add new search, browser navigation, persistence, AI, Playwright, or graph behavior.
