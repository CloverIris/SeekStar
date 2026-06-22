# SeekStar Desktop App

This app will be the Electron observatory for P0.

The first screen should be an explorable semantic canvas, not a chat window, generic browser, or ranked search-results page.

## P0 Surface

- top bar with workspace name, tabs, command input, breadcrumb, and job state;
- left tool rail with pointer, pan, lasso, and brush;
- center 2D/2.5D semantic canvas;
- right panel for overview, inspect, AI output, sources, and collection;
- bottom status for layer, scale, selected count, visible nodes, source count, and warnings.

## Boundaries

- Electron owns workspace, tabs, security, persistence, permissions, and job coordination.
- Renderer owns interaction, canvas drawing, hit testing, lasso, brush, camera, and layer transitions.
- Playwright scout retrieves and observes external content.
- Cartographer produces structured terrain and explanations.
- Local data layer persists everything needed to reconstruct the visible map.

## First Implementation Target

Render a local fixture seed map with:

- one L0 seed;
- parent, sibling, and child concept nodes;
- source-card nodes with provenance fields;
- fog regions for unknowns;
- selectable nodes;
- basic lasso selection payload;
- side-panel inspection.

The current scaffold stops at the static shell and shared type boundary. Real canvas rendering,
search, scout retrieval, agent calls, and persistence remain future tasks.
