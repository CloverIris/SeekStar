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
- mock seed tab creation in memory;
- P2 local workspace snapshot persistence through Electron user data;
- P2 manual source ingestion that adds source-backed terrain nodes and `source_contains` relations to the map;
- P2 source evidence inspector for source metadata, snippets, reliability hints, and mapped excerpt navigation;
- P2 source-aware current-tab search across terrain metadata, source snippets, quotes, and reliability hints;
- P2 source-backed nodes can create independent seed tabs with backlink context;
- P2 origin backlinks can focus the original source-backed node across tabs.

No real AI, Playwright retrieval, database-backed source cache, graph layout, graph analysis, relation layout/routing, freeform lasso, brush, browser navigation, source-backed AI explanation, or real Markdown export is implemented yet.

## P1 Closure

P1 closes as a usable mock exploration prototype. It proves the local interaction loop before real data work begins:

- orient on a map;
- pan and semantic zoom;
- select, lasso, inspect, and save regions;
- create independent mock seed tabs;
- inspect provenance state without treating mock terrain as sourced fact.

The next phase should begin real product capability at the data boundary: local persistence and source-backed terrain ingestion.

## P2.1-P2.3 Boundary

P2.1-P2.3 adds the first real data boundary:

- restore and save the current local exploration universe;
- add a manual source excerpt from the inspector;
- convert that source into source-backed terrain cards on the canvas;
- keep generated, inferred, weak, fog, and source-backed states visibly distinct.

Manual source ingestion is not Playwright retrieval and not AI distillation.

## P2.4 Boundary

P2.4 deepens source-backed inspection:

- selected source-backed nodes show source evidence instead of only generic node metadata;
- source cards expose URL, source type, manual timestamp, reliability hints, quote/snippet, and typed evidence relations;
- mapped excerpt links move the camera within the terrain.

This is not a browser view, AI summary, source distiller, or search results page.

## P2.5 Boundary

P2.5 upgrades current-tab local search:

- searches source-backed quotes, source snippets, source titles, URLs, and reliability hints;
- result cards show match type, layer, source state, and source title;
- clicking a result selects/focuses the terrain node.

This is not web search, ranking infrastructure, AI retrieval, or a full-text index.

## P2.6 Boundary

P2.6 adds recursive seeding from source-backed terrain:

- source evidence cards can create a new exploration seed tab;
- the new tab stores a backlink to the origin tab, node, source, and excerpt;
- the new tab starts with independent mock terrain and does not inherit prior camera/search/selection state.

This is not browser navigation, AI seed mapping, or Playwright retrieval.

## P2.7 Boundary

P2.7 adds backlink navigation:

- source-derived tabs can focus their origin tab and source-backed node;
- origin focus updates selection and viewport in the origin tab;
- transient search state is cleared during the jump.

This is not browser back/forward and does not merge tab histories.

## P2 Closure

P2 closes the first source-backed local exploration loop:

- persist and restore the local exploration universe;
- add manual sources into the map as source-backed terrain;
- inspect source evidence and mapped excerpts;
- search current-tab source metadata and snippets;
- turn source-backed terrain into an independent seed tab;
- focus back to the origin source-backed node through backlink context.

The next phase should introduce real cartographer/scout boundaries carefully, starting with explicit job state and source distillation contracts before any external retrieval is allowed into the map.
