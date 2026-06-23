# SeekStar Desktop App

This app is the Electron observatory for the P0 mock exploration prototype.

The first screen is an explorable semantic canvas, not a chat window, generic browser, or ranked search-results page.

## Current P0 Surface

- default 16:9 desktop window target: 1600x900, with a 1280x720 minimum;
- integrated Electron title bar with native window controls;
- left observatory sidebar for new field search, favorites, independent exploration tabs, and Lucide-based canvas tool icons;
- center 2D/2.5D semantic canvas consuming `TerrainScene`;
- bottom command composer that routes text into new seed or current-tab local search actions;
- right inspector for overview, selected node details, and local search result support;
- side tray selection basket for local mock context;
- bottom status strip for layer, selected count, visible nodes, source count, and job state;
- renderer overlay splash during startup.

## Boundaries

- Electron owns window lifecycle, security boundaries, and the narrow preload bridge.
- Renderer owns immediate local interaction, canvas presentation, selection, and mock tab state.
- Playwright scout will later retrieve and observe external content.
- Cartographer will later produce structured terrain and explanations.
- Local data layer will later persist everything needed to reconstruct visible maps.

## Current Mock Scope

The app currently renders local mock `TerrainScene` data with:

- one opening exploration tab;
- mock generated and inferred terrain nodes;
- fog regions for unknown space;
- local-only current-tab search;
- selectable nodes and inspector updates;
- pan, wheel zoom, and rectangular mock lasso selection;
- pointer-mode empty canvas dragging for immediate map panning;
- cursor-anchored wheel zoom over the centered canvas world;
- canvas-local viewport controls for fit map, focus selection, and reset view;
- semantic layer rail for L0/L1/L2 orientation;
- centered selection action card after lasso selection;
- lightweight relation lines rendered from existing `TerrainScene.relations`;
- relation click inspection for type, endpoints, source state, confidence, and explanation;
- compact node hover previews that show existing terrain metadata only;
- source-readiness overview that distinguishes source-backed, generated, inferred, weak, and fog nodes;
- per-tab in-memory side tray items;
- local generated side-tray action previews for explain, compare, and export;
- mock seed tab creation in memory.

No real AI, Playwright retrieval, persistence, graph layout, graph analysis, relation layout/routing, freeform lasso, brush, browser navigation, source-backed explanation, or real Markdown export is implemented yet.

## P1 Closure

P1 closes as a usable mock exploration prototype. It proves the local interaction loop before real data work begins:

- orient on a map;
- pan and semantic zoom;
- select, lasso, inspect, and save regions;
- create independent mock seed tabs;
- inspect provenance state without treating mock terrain as sourced fact.

The next phase should begin real product capability at the data boundary: local persistence and source-backed terrain ingestion.
