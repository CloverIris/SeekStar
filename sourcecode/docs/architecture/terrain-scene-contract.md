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

## P2.1-P2.3 Local Source Terrain Contract

P2 starts real product capability at the data boundary while preserving the map-first interaction model.

- Electron owns local workspace snapshot persistence through a narrow preload bridge.
- The renderer saves and restores active tab, `TerrainScene` objects, viewport, selection, side tray items, and local generated notes.
- The first source ingestion path is manual user-provided text or URL metadata.
- Manual source ingestion creates a `SourceRef`, a source-backed `source` node, source-backed excerpt nodes, and `source_contains` relations.
- Source-backed nodes are added to the current map near the current viewport; they do not appear as a ranked result list.
- Manual ingestion does not call AI, does not use Playwright, does not claim web retrieval, and does not generate summaries.
- Source readiness in the inspector must continue to distinguish source-backed terrain from generated, inferred, weak, and fog terrain.

## P2.4 Source Inspector Contract

P2.4 deepens source-backed terrain inspection without changing the map-first model.

- Source-backed nodes may carry `source_id` to link directly to `SourceRef`.
- Selecting a source-backed node shows source evidence in the inspector: source type, URL if present, retrieval/manual timestamp, reliability hints, quote or snippet, and typed evidence relations.
- Source nodes show mapped excerpt nodes as camera targets so the user can move from source card to evidence terrain.
- The inspector displays existing source metadata only. It does not summarize with AI, fetch pages, open an internal browser, or turn source evidence into a ranked results page.
- Generated, inferred, weak, and fog nodes remain visually and semantically distinct from source-backed nodes.

## P2.5 Source-aware Local Search Contract

P2.5 expands current-tab local search across source-backed terrain while keeping results secondary to the canvas.

- Local search scans terrain title, summary, tags, type, quotes, source title, source URL, source snippet, and reliability hints.
- Results include match type, layer, source state, snippet, and source title when available.
- Clicking a result selects and focuses the matched terrain node; it does not create a new tab or open a browser.
- Results remain in scene order rather than becoming a ranked search product surface.
- This is still an in-memory exact metadata/snippet search. It does not implement Fuse, MiniSearch, SQLite FTS, Playwright retrieval, or AI source distillation.

## P2.6 Source-backed Seed Tab Contract

P2.6 lets a source-backed node or excerpt become a new independent exploration universe.

- Source evidence cards expose "Use as new exploration seed" for source-backed terrain.
- The new tab is created from the selected source node or excerpt title.
- The new tab uses `source_mode: "selection"` and stores `parent_backlink` with origin tab, node, source ID, label, and excerpt when available.
- The new tab does not inherit previous tab camera, local search query, transient selection, or side effects.
- The generated terrain in the new tab remains marked generated/inferred/fog until real cartographer and scout work populate source-backed nodes.
- This implements recursive seeding from source-backed content without opening a browser, calling AI, or turning the source inspector into a chat prompt.

## P2.7 Backlink Navigation Contract

P2.7 makes source-backed seed tabs reversible without adopting browser history.

- Tabs created from source-backed terrain show an Origin backlink panel.
- "Focus origin" switches back to the origin tab, selects the origin node, and moves the origin tab viewport to that node.
- The action clears transient search and selection action UI in the active renderer state.
- This is not browser back/forward navigation and does not merge tab histories.
- If the origin tab or node is missing, the action does nothing rather than fabricating an origin.

## P2 Closure: Local Source-backed Exploration Contract

P2 closes as the first real local data boundary for SeekStar.

- The app can persist and restore a local exploration universe through an Electron-owned workspace snapshot.
- User-provided sources can enter the current map as source-backed terrain.
- Source-backed terrain can be inspected, searched, used as a new independent seed, and traced back to its origin.
- The canvas remains primary: source ingestion, search, seed creation, and backlink focus all resolve to terrain nodes and camera movement.
- P2 still intentionally avoids AI cartography, Playwright retrieval, browser navigation, durable database indexing, real graph layout, freeform brush, and real Markdown export.

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
- Durable database-backed source cache.
- Graph layout.
- Graph analysis.
- Freeform lasso or polygon selection.
- Brush behavior.
- Real Markdown export.
- Source-backed region explanation.
- Playwright source retrieval.
- AI source distillation.
- Browser navigation.

## Design Rule

Mock nodes must remain visibly generated, inferred, weak, or fog. They must not look like source-backed facts.
