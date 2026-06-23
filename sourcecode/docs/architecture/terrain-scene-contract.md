# TerrainScene Renderer Contract

Status: P0 mock interaction boundary
Date: 2026-06-22

## Purpose

`TerrainScene` is the first structured data boundary between SeekStar's future cartographer output and the renderer.

The renderer consumes a scene object that already contains tabs, layers, nodes, relations, sources, viewport state, selection state, agent job state, and metadata. It should not invent terrain locally inside UI components.

## Current Flow

The active monorepo root is `sourcecode/`. Paths below are relative to that directory.

The current desktop renderer imports a mock fixture:

```text
apps/desktop/src/renderer/src/fixtures/openingSkyScene.ts
```

That fixture exports `openingSkyScene`, a `TerrainScene` with generated and inferred conceptual nodes only. It contains no real search results and no fetched sources.

The renderer boundary is:

```text
apps/desktop/src/renderer/src/components/TerrainCanvas.tsx
```

`TerrainCanvas` receives a `TerrainScene` and renders simple positioned node cards. This is intentionally not a graph layout engine.

## Mock Interaction Flow

The P0 shell keeps interaction state in React memory only.

- The bottom command composer opens a local action card with two active routes: use text as a new mock exploration seed, or search within the current tab.
- New seed creates an independent mock `TerrainScene` with generated, inferred, weak, and fog nodes only.
- Current-tab search scans scene nodes by title, summary, tags, and type, then highlights matching nodes on the canvas and shows a secondary result panel.
- Clicking a node or local search result updates `SelectionState` in memory and shows node details in the inspector.
- Tab switching changes the active in-memory scene and clears transient command/search state.
- The startup splash is a renderer overlay, not a separate Electron splash window.

This flow is a prototype of orientation, not real retrieval.

## P1 Canvas Interaction Contract

P1 adds a renderer-local canvas interaction boundary without changing `@seekstar/core-schema`.

- `ViewportState` remains the camera contract: `x` and `y` are the world coordinate at the center of the visible canvas; `zoom` controls scale; `layer` reflects the current semantic zoom band.
- The renderer owns immediate pan, wheel zoom, and mock lasso draft state.
- The DOM canvas adapter converts between screen coordinates and world coordinates, then emits `ViewportState` and selected node IDs back to the app shell.
- The DOM world origin is anchored to the visible canvas center. CSS transforms must preserve the same coordinate model used by `screenToWorld` and `worldToScreen`.
- Wheel zoom anchors at the mouse position: the world point under the cursor before zoom should remain under the cursor after zoom.
- Lasso is rectangular for P1. It selects nodes whose `position_hint` point falls inside the lasso world rectangle.
- Search result focus reuses the same camera contract by moving the viewport center to the matched node position.
- P1 still does not generate deeper semantic content when zoom changes; it only updates orientation and layer emphasis.

## P1 Side Tray Mock Contract

The side tray is a renderer-local selection basket for P1.

- It stores selected node IDs from the active tab in memory only.
- It is scoped per exploration tab and does not persist across app restarts.
- It can capture a single selected node or a rectangular lasso selection.
- It records source states so generated, inferred, weak, and fog content remain visibly distinct from future source-backed content.

## P1.3 Mock Region Action Contract

P1.3 turns saved side-tray selections into local mock action previews.

- Explain, Compare, and Export are per-selection actions in the side tray.
- The actions do not call AI, do not read external sources, and do not write files.
- Each action creates an in-memory generated cartographer note in the inspector.
- The note is explicitly marked `generated` and `mock generated`.
- Export produces only a Markdown-shaped preview string in the inspector. It is not real Markdown export.
- Results are scoped to the active exploration tab and are not persisted.
- These previews exist to validate spatial selection flow before the real Region Explainer, citation chain, and Markdown export contracts are implemented.

## P1.4 Selection Action Card Contract

P1.4 adds a floating spatial action card after rectangular lasso selection.

- The card is centered in the canvas workbench so it cannot be clipped by the command composer, inspector edge, or canvas boundaries.
- It offers local actions for saving the selected region, creating mock explain/compare/export notes, and using the selected region as a new mock seed.
- It is a selection affordance, not a chat prompt and not a ranked search result.
- Mock explain/compare/export actions remain generated previews only.
- "Use region as new seed" creates an independent mock tab without inheriting camera/search history.
- The card is transient and disappears when the selection is cleared, the tab changes, or an action is taken.

## P1.5 Relation Rendering Contract

P1.5 renders lightweight relation lines from existing `TerrainScene.relations`.

- Relation lines connect nodes by their `position_hint` world coordinates.
- Relations without both endpoint nodes or endpoint positions are skipped.
- The renderer does not compute graph layout, force simulation, routing, bundling, or collision avoidance.
- Lines are visual orientation aids under the terrain cards; they are not a source of truth beyond the relation data.
- Relation styling reflects `source_state`: inferred and weak relations stay dashed or muted, while future source-backed relations may receive stronger provenance treatment.
- Selected or locally highlighted endpoint nodes may softly emphasize their connected relations.

## P1.6 Relation Inspection Contract

P1.6 makes rendered relations inspectable in the local UI.

- In Pointer mode, relation lines can be selected through a wider transparent hit target.
- Pan and lasso tools must not treat relation lines as primary interaction targets.
- Selecting a relation opens the right inspector with endpoint titles, relation type, source state, confidence, and explanation.
- Relation selection clears node selection and does not mutate relation data.
- The inspector displays existing `TerrainRelation` fields only; it does not call AI, infer new meaning, or fetch sources.
- This is a provenance and orientation affordance, not a graph analysis engine.

## P1.7 Canvas Preview And Drag Contract

P1.7 adds local map-browsing affordances without changing `@seekstar/core-schema`.

- In Pointer mode, dragging empty canvas space pans the viewport.
- Dragging a node or relation remains a selection/inspection interaction, not a pan gesture.
- Node hover previews display existing node metadata only: title, type, source state, confidence, relation count, and summary.
- Hover previews are local renderer UI. They do not call AI, fetch sources, or generate new terrain.
- Hover previews must not become search result cards or chat answers; they are lightweight terrain inspection hints.

## P1.8 Viewport Orientation Contract

P1.8 adds local viewport controls for map orientation without changing `@seekstar/core-schema`.

- Fit map computes a camera from existing node `position_hint` values and the visible canvas bounds.
- Focus selection computes a camera from selected node positions only.
- Reset view returns the active tab camera to the seed-field center with default zoom.
- These controls update `ViewportState` only. They do not move nodes, recompute layout, create search results, call AI, retrieve sources, or persist state.
- The controls are small canvas affordances. They must not become browser navigation, a ranked search surface, or a dashboard toolbar.

## P1 Closure: Semantic Orientation Contract

The final P1 shell adds semantic orientation affordances while keeping the app mock-only.

- The canvas shows a compact semantic layer rail for the active `TerrainScene.layers`.
- Clicking a layer rail item updates `ViewportState.zoom` and `ViewportState.layer`; it does not generate child content.
- The right overview panel shows source-readiness counts from existing node `source_state` values.
- Source readiness exists to prevent generated, inferred, weak, and fog terrain from being mistaken for source-backed facts.
- This closes the local exploration prototype boundary: seed tabs, local search, selection, lasso, side tray, mock cartographer notes, relation inspection, hover preview, viewport controls, and semantic layer orientation.
- The next phase should start real product capability at the data boundary: persistence and source-backed terrain ingestion.

## Future Flow

Future Agent outputs should be validated against the shared schema in `@seekstar/core-schema`, converted into `TerrainScene`, then handed to the renderer.

Expected future producers:

- seed mapper;
- source distiller;
- layer cartographer;
- region explainer outputs saved as generated terrain;
- local persistence rehydration.

## What This Does Not Implement Yet

- Real search.
- AI calls.
- Playwright retrieval.
- Local persistence.
- Graph layout.
- Graph analysis.
- Freeform lasso or polygon selection.
- Brush behavior.
- Real Markdown export.
- Source-backed region explanation.
- Source ingestion.
- Browser navigation.

## Design Rule

Mock nodes must remain visibly generated, inferred, weak, or fog. They must not look like source-backed facts.
