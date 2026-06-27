# SeekStar Architecture and UI Design Specification

Version: 0.1
Scope: Design-level architecture, no implementation code

## 1. Architecture Thesis

SeekStar should be designed as a 2.5D cognitive exploration system.

The architecture must separate:

* rendering;
* interaction;
* agent reasoning;
* web retrieval;
* storage;
* local search;
* export;
* security.

The app should never depend on AI for frame-by-frame interaction. AI generates and organizes terrain. The local application renders, caches, validates, and navigates terrain.

The core runtime metaphor is a telescope:

```text
Telescope operation
  -> typed exploration event
  -> scene / data-pool / object-pool mutation
  -> subscribed rendering and inspector surfaces
  -> optional Scout or Cartographer job when the event needs external observation or synthesis
```

Zooming changes semantic depth. Panning explores same-layer adjacency. Selection, lasso, brush, keyword promotion, and edge movement are product events before they are UI callbacks. The renderer should be able to keep the user moving through active and cached terrain without asking AI for every frame.

AI Cartographer is the primary terrain producer for macro exploration, topic/source orientation, recursive seed bootstrap, orphan context reconstruction, and same-layer frontier expansion. DataService is the validation and loading layer for AI-proposed URLs, source candidates, pages, PDFs, images, and future file snapshots. AI should not drive animation or pointer-level behavior, but it should actively fill and extend the map.

### 1.1 Continuous Telescope State

The active `TerrainScene.viewport` tuple (`x`, `y`, `zoom`, `layer`) is the telescope state. L0, L1, L2, and L3 are not nested boxes or isolated canvases; they are focal bands over one continuous semantic terrain. Zooming changes semantic scale while preserving world coordinates. Panning changes the observed neighborhood at the current scale.

Generation should respect that continuity. A Cartographer request should receive compact focus anchors, nearby same/upper-band anchors, the viewport center, movement direction, and chunk coordinates. It should fill the terrain around the current lens position instead of rebuilding a separate child universe for every clicked node.

When the user zooms back out after moving inside L2 or L3, the app should resolve the nearest meaningful upper-band region at the current viewport and reveal that parent context. If no parent region exists yet, upward synthesis writes the missing context back into the existing scene. A new orphan/recursive tab is reserved for genuinely unparented entries such as an external hyperlink, direct URL, file, or Deep Lens grain promoted into a new seed.

AI calls are terrain synthesis jobs, not frame-loop operations. The renderer handles pointer math, absorption animation, panning, zooming, hit testing, and layer interpolation locally. AI may be invoked after a typed event needs new semantic material, source replacement, or upward/downward synthesis.

## 2. Recommended High-level Architecture

### 2.1 Electron Host Layer

Responsibilities:

* desktop app lifecycle;
* window management;
* tab shell;
* workspace management;
* security boundaries;
* local file and cache access;
* coordination between UI, Agent, and Playwright;
* app-level settings.

Design notes:

* remote web content should not be allowed to control privileged app APIs;
* internal app UI should be isolated from fetched pages;
* external links may initially open in system browser;
* later internal browsing must use strict isolation.

### 2.2 Renderer / Canvas Layer

Responsibilities:

* infinite XY canvas;
* cognitive lens;
* Z-axis layer opacity;
* tile layout;
* node rendering;
* constellation rendering;
* lasso;
* brush;
* hit testing;
* camera controls;
* hover cards.

Design principle:
The renderer receives structured scene data. It does not ask AI how to draw every frame.

P5.1-P5.9 implementation note:
The renderer shell subscribes to exploration state through `useExplorationSession`, while core scene mutation, object-pool derivation, Scout planning, and Pixi projection now live in `@seekstar/constellation-engine`. See `docs/architecture/p5-9-service-contracts-and-constellation-engine.md`.

P5.2-P5.11 implementation note:
The runtime has a typed event entry and derived object pool. `selection.changed`, `viewport.changed`, `layer.changed`, and `scout.observations.appended` wrap the scene mutation helpers in the Constellation Engine. `ExplorationObjectPool` indexes the active scene for canvas, inspector, search, and source-conversion subscribers. The canonical layer model lives in `@seekstar/core-schema/src/semanticLayers.ts`; Star Gallery, Tile Field, and Text Grain are focal bands over the L0-L11 12Level semantic spine, not a replacement for it.

P5.12 implementation note:
`WorkspacePersistenceCoordinator` now lives in the Constellation Engine and owns workspace hydrate/persist merge rules through a storage port. Desktop React still subscribes to scene state and Electron bridge events, but it no longer hand-builds workspace snapshots or decides latest-snapshot merge behavior.

Scout job implementation note:
`ScoutJobCoordinator` now lives in the Constellation Engine and owns Scout plan execution/writeback rules through a Scout port. This includes failed observations, anchored/frontier placement, direct URL hyperlink intake into source-backed L3 terrain, and user-confirmed observation-to-source conversion.

Tab session implementation note:
`TabSessionCoordinator` now lives in the Constellation Engine and owns open, close, reorder, and activate tab-session transactions through Storage and App Framework tab runtime ports. React applies prepared transactions to local state, then commits them through the coordinator, keeping the ordering rules for close tombstones and runtime activation outside component code.

Tab runtime boundary note:
Only the shell renderer may register, activate, reorder, or otherwise mutate the Electron tab runtime. Docked and detached tab renderers may hydrate their own `TerrainScene` from workspace changes, but they must not call runtime registration paths that can activate another tab. This prevents workspace change propagation from turning into active-tab ping-pong between the default New Seek tab and newly created seed tabs.

Workspace activation note:
When the shell renderer receives an external workspace change, it must respect the snapshot's `active_tab_id` instead of preferring the shell's stale current tab. Runtime tab renderers still hydrate against their fixed `runtimeTabId`. This keeps "create seed as new tab" from briefly activating the new runtime tab and then being pulled back to the tab that issued the command.

Tab close persistence note:
Closing a tab removes its scene from workspace before closing the Electron runtime entry. If a closed tab renderer has a stale locked-tab autosave in flight, `createPersistableWorkspaceSnapshot` treats absence from the latest workspace snapshot as a close tombstone and refuses to recreate the scene. This keeps a deleted tab from reappearing as a leftover scene at the bottom of the tab list.

P5.13 implementation note:
The telescope closure now has a shared `SourceSnapshot` protocol in `@seekstar/core-schema`. Scout observations can carry final URL, content type, visible text, outlinks, media candidates, and source type into the Constellation Engine. Source terrain ingestion stores the snapshot and uses profile-based text-grain materialization instead of demo-sized caps. The Pixi Runtime Adapter exposes a pure tile absorption transition helper; desktop plays the animation first, then commits `tile.absorption.entered` so Electron live surfaces mount only after the semantic absorption state is real.

P5.14 implementation note:
Direct `http`/`https` command input is a real source intake path, not a keyword seed fallback. Adding a URL to the current Seek or opening it as a new Seek runs Scout through `ScoutJobCoordinator.ingestDirectUrlSource`; successful source candidates become source-backed L3 webpage/document tiles, while failed Scout runs remain failed observations and do not fabricate live tiles. Default New Seek local L3 placeholders have no `sourceUrl` and therefore do not enter browser absorption.

P5.15 implementation note:
Main content projection is now a first-class runtime contract. `TerrainPixiProjection.mainContent` distinguishes domain gallery, source intake pending/failed, real source tile field, browser absorption, text grain, and empty source field. `TerrainTileSurface` is generated only for L3 source-backed webpage/document nodes with a `sourceUrl`; local placeholders stay semantic terrain and cannot mount thumbnails or live browser surfaces. Asynchronous direct URL Scout writeback uses target-tab scene persistence: if the target tab is absent from the latest workspace snapshot, the stale writeback is discarded instead of resurrecting the tab.

P5.15 module validation note:
`scripts/module-smoke.mjs` is the current cross-module harness. It verifies `@seekstar/scout-service` Playwright snapshot capture, desktop `ScoutWorkerRuntime` direct URL observation, `ScoutJobCoordinator` source-backed L3 ingestion, Pixi `source_tile_field` projection, and App Shell workspace hydrate. The public variant also verifies `frontier_web_search` through the desktop Scout worker. During validation, hydrate fallback overwrite and brittle search parsing were fixed so module boundaries can be tested independently rather than only through the full Electron UI.

P5.16 DataService note:
Web discovery and source observation are now separate protocols. `SearchCandidate` records come from search providers or page-outlink providers and remain candidate observations. `SourceObservationResult` records come from source observer/extractor providers and may carry a `SourceSnapshot`. The default DataService registry lives in `@seekstar/scout-service`; Electron Scout workers validate IPC and delegate to that package instead of maintaining duplicate search/extraction logic. Browser-mediated DuckDuckGo/Bing search remains a development provider, while API-backed providers such as Brave, Tavily, Exa, Google CSE, extractor services, and future SQLite/FTS cache providers can register behind the same boundary without changing React, Pixi, or Constellation Engine terrain semantics.

P5.17 Content Provider note:
The DataService registry is now settings-driven. `@seekstar/core-schema` owns the built-in provider catalog and `SeekStarSettings.content_providers` persists activation, priority, languages, URL-only domains, and key-reference metadata. Default active discovery uses arXiv, GitHub, Wikipedia, Wikidata, and a low-priority local Playwright browser-assisted fallback. Zhihu and Runoob are built in as disabled URL-only providers: they may discover candidate URLs when enabled, but they do not extract page bodies or fabricate source-backed terrain during search. Electron passes the current provider settings into each Scout utility-process run, so the UI edits provider availability without coupling React to provider implementation details.

P5.18 Main Content Usability note:
Keyword discovery introduced a formal L3 `source_candidate_field` in Pixi. Those historical candidate status cards showed provider provenance and candidate URLs, but they were always separate from real `TerrainTileSurface` entries and were never synchronized to live browser surfaces. Direct URL Scout must return source evidence before any candidate becomes a source-backed L3 webpage/document tile. The current MVP keeps this distinction and routes unverified candidates through Source review/recovery instead of the main Tile Field.

P6 AI Cartographer and Level Runtime note:
P6 changes the mainline from DataService-driven candidate discovery to AI Cartographer-driven terrain generation. Supra Macro, L0, L1, and L2 terrain is primarily generated and organized by AI. L3 is stricter: AI may propose source candidates and orientation material, but only DataService-successful observations become source-backed Tile Field surfaces. The fixed L0-L11 12Level spine remains the P5 compatibility layer, but the user-facing target moves toward a modular Level Runtime: Supra Macro, L0 Star Gallery, L1 Topic Field, L2 Source Orientation, L3 Tile Field, Deep Lens, and Recursive Seed. See `docs/architecture/p6-ai-cartographer-and-level-runtime-redesign.md`.

Current MVP override:
Candidate observations and any legacy candidate-surface concept are queue/status surfaces, not live browser/document tiles. The main canvas may show a lightweight candidate/status overlay and the right sidebar may show Source review, but the Pixi Tile Field must only create real tile surfaces for source-backed L3 webpage/document/PDF/image nodes.

These events are the telescope operation protocol. Viewport movement may reveal same-layer frontiers. Layer changes move between macro orientation, source-backed tile surfaces, and text-grain detail. Selection and lasso create addressable regions that can be inspected, promoted, exported, or passed to AI only when the user asks for interpretation.

P5.6 implementation note:
The Electron host now owns the first Chrome-like tab runtime boundary. `TabRuntimeManager` stores `TabRecord` metadata, WebContentsView instances, session partition strings, detached tab windows, workspace folders, crash records, and cache budgets. Renderer tab controls call the runtime through the preload bridge, while `TerrainScene` remains the per-tab durable exploration snapshot. The first `WorkspaceStore` boundary remains JSON-backed so SQLite/FTS can be introduced through a migration ADR instead of leaking file shape into the renderer. See `docs/architecture/p5-6-app-framework-tab-runtime.md`.

P5.7 implementation note:
The main observatory shell now provides a dock rectangle instead of rendering the active telescope tab itself. Electron main docks the active tab `WebContentsView` into that rectangle with `runtimeSurface=docked`; detached windows reload the same tab surface with `runtimeSurface=detached`. This is the first main-window crash-isolation boundary: shell UI and tab UI are separate renderer surfaces, while `WorkspaceStore` and `TabRuntimeManager` remain host-owned.

P5.8 implementation note:
Renderer-local Cartographer and region action preview behavior has been removed from the product path. Selection, seed creation, source intake, Playwright Scout observations, and source conversion remain; explanation, distillation, learning paths, comparison, and export must return only through future real service boundaries. The canvas renderable-object decision is moving behind a PixiJS projection boundary so React shell code no longer owns core presentation filtering.

P5.9 implementation note:
The corrected high-level module boundary is now App Electron Framework, Constellation Engine, Scout/DataService, AI Service, and Storage/Cache Service. The Constellation Engine is split into Constellation Core and Pixi Runtime Adapter. `@seekstar/constellation-engine` owns telescope events, object pools, workspace schema revision 61, semantic lens mapping, Scout planning, and Pixi projection data. `@seekstar/scout-service`, `@seekstar/ai-service`, and `@seekstar/storage-service` define independently testable service contracts with CLI harnesses. Electron remains the app framework and service host rather than the owner of terrain semantics.

P5.10 implementation note:
Seed scene scaffolding, source snapshot ingestion, source-backed text-grain terrain construction, heuristic candidate extraction, and Pixi interaction math now live in `@seekstar/constellation-engine`. The desktop renderer consumes these through engine exports and dispatches `source.snapshot.ingested` instead of constructing terrain locally. The engine also exposes pure TypeScript service ports for Scout, AI, Storage, and source snapshot services.

### 2.3 Agent Orchestration Layer

Responsibilities:

* AI Cartographer terrain generation;
* seed bootstrap;
* same-layer chunk expansion;
* upward context inference;
* downward semantic decomposition;
* source-candidate proposal;
* source-candidate replacement after DataService failures;
* region explanation and navigation;
* prompt preset execution;
* right-sidebar map chat and operation planning.

Design principle:
Agent output must be structured, inspectable, cancellable, cacheable, and independently testable per level/module. AI output may become primary map terrain after schema validation; source-backed status still requires DataService observation or a trusted local/file snapshot.

### 2.4 Playwright Scout Layer

Responsibilities:

* validate AI-proposed source candidates;
* execute provider-backed candidate discovery when requested;
* retrieve pages;
* extract visible content and metadata;
* record source provenance;
* report failures;
* pass observations back to the level runtime and AI agent as tool results.

Design principle:
Playwright is a scout and browser observer, not the whole web-search architecture and not a browser UI replacement.

Scout may be triggered by telescope events, direct URL intake, source-anchored outlink exploration, AI tool calls, or chunk preloading. It returns structured observations into the data pool. It must not drive animation, decide meaning, or directly create source-backed terrain.

P5.16 implementation note:
The Scout/DataService module has a provider registry. Search providers produce `SearchCandidate` records only. Source observer providers produce `SourceSnapshot` records or explicit failure. Constellation Engine converts snapshots into source-backed terrain through typed events; search candidates remain Scout observations until selected or observed.

### 2.5 Local Data Layer

Responsibilities:

* workspaces;
* tabs;
* nodes;
* relations;
* layers;
* source snapshots;
* local indexes;
* annotations;
* AI outputs;
* exports;
* trails.

Design principle:
Everything visible in the canvas should be reconstructable from stored structured data.

The data layer owns the durable pool of scenes, sources, observations, generated outputs, selections, and trails. Derived object pools may be rebuilt from it and subscribed to by canvas, inspector, local search, side tray, export, and future reading surfaces.

P2 implementation note:
The first durable store is an Electron-owned JSON workspace snapshot behind the preload bridge. It persists tabs, `TerrainScene` objects, viewport, selection, side tray items, and local notes. This is a small bridge to real product use, not the final source-cache database or full-text index.

P5.6 implementation note:
The JSON store is now hidden behind the `WorkspaceStore` interface in the Electron host. Runtime tab records, folders, settings, and development reset paths are host-owned concerns exposed only through narrow preload APIs. The renderer should not depend on JSON filenames, storage paths, or future SQLite table shapes.

### 2.6 Search and Index Layer

Responsibilities:

* local per-tab search;
* local workspace search later;
* fuzzy keyword search;
* full-text search;
* match highlighting;
* source-to-canvas position mapping.

Design principle:
Search inside a tab should be immediate and should move the camera to matched positions.

## 3. Research-first Architecture Requirement

Before custom-building major infrastructure, the team must perform a short library review.

Required decision record format:

* subsystem name;
* problem;
* existing libraries checked;
* official documentation checked;
* performance constraints;
* interaction constraints;
* chosen option;
* reason;
* rejection reasons;
* fallback plan.

Subsystems requiring decision records:

* canvas renderer;
* infinite canvas interactions;
* graph layout;
* force layout;
* tile layout;
* local search;
* fuzzy search;
* vector search if used;
* HTML parsing;
* dictionary / Unicode lookup;
* annotation tools;
* AI orchestration;
* Playwright retrieval;
* tab architecture;
* state management;
* persistence;
* Markdown export.

## 4. Candidate Library Categories

This section is not a final technology decision. It is a search checklist.

### 4.1 Canvas Rendering

Evaluate:

* PixiJS-style GPU renderer;
* custom Canvas 2D;
* SVG for smaller scenes;
* WebGL graph renderers.

Decision criteria:

* node count;
* text rendering quality;
* lasso hit testing;
* zoom smoothness;
* layer opacity performance;
* integration with React UI;
* support for custom shaders or lens effect if needed.

### 4.2 Infinite Canvas / Annotation

Evaluate:

* tldraw-style infinite canvas SDK;
* whiteboard libraries;
* custom interaction layer over GPU renderer.

Decision criteria:

* lasso support;
* brush support;
* custom shapes;
* camera controls;
* performance;
* ownership of data model;
* ability to integrate with semantic Z-axis.

### 4.3 Graph Layout

Evaluate:

* Cytoscape.js-style graph system;
* Sigma.js / Graphology-style graph rendering and model;
* D3 Force;
* ELK.js;
* custom constellation layout.

Decision criteria:

* force-directed layout;
* non-overlap;
* relation rendering;
* thousands of nodes;
* deterministic layout;
* semantic axes;
* custom constellation constraints.

### 4.4 Local Search

Evaluate:

* Fuse.js-style fuzzy search;
* MiniSearch-style full-text search;
* local database FTS;
* hybrid index.

Decision criteria:

* per-tab indexing;
* match location;
* fuzzy tolerance;
* Chinese / Japanese / English tokenization;
* text range mapping;
* update performance;
* memory usage.

### 4.5 Agent Orchestration

Evaluate:

* simple application-owned orchestration;
* Agents SDK-style orchestration;
* workflow graph tools;
* custom job queue.

Decision criteria:

* tool calling;
* state;
* cancellation;
* tracing;
* cost tracking;
* retry policy;
* structured output validation;
* multi-agent handoff only when needed.

## 5. Multi-search and Multi-tab Design

## 5.1 Search Types

SeekStar has several distinct search modes. They must not be conflated.

### Global seed search

Purpose:
Create a new exploration universe.

Input:
Any text.

Output:
New tab, L0 seed, generated semantic map.

### Current tab search

Purpose:
Find existing content inside current tab.

Input:
Keyword or phrase.

Output:
Highlighted matches, result card list, camera jump.

### Web expansion search

Purpose:
Fetch new external sources for current map.

Input:
Current node, fog region, selected cluster, or user prompt.

Output:
New source nodes added to current map.

### Selection search

Purpose:
Search inside selected region.

Input:
Lasso selection plus keyword.

Output:
Matches only inside selection.

### Dictionary search

Purpose:
Define word, character, Unicode, or phrase.

Input:
Text grain.

Output:
Dictionary, usage, translation, seed options.

### Workspace search

Future:
Search across all tabs, exports, notes, and cached sources.

## 5.2 Search Modal Behavior

When user types in top bar, the modal card should show:

Primary actions:

1. Use as new exploration seed.
2. Search within current tab.

Secondary actions:
3. Search web and add to current map.
4. Ask about current viewport.
5. Search saved workspace.
6. Search selected region if selection exists.
7. Translate / define if text is short.

The modal should not assume user intent.

## 5.3 Search Result Card

For current-tab search, show:

* keyword;
* number of matches;
* grouped by layer;
* snippet;
* source title;
* position;
* match type;
* click-to-camera action.

Match types:

* title;
* summary;
* source body;
* annotation;
* AI output;
* dictionary entry.

## 5.4 Tab Rules

New tab is created when:

* user chooses new seed;
* user clicks content hyperlink;
* user drags keyword to “new tab” zone;
* user chooses “open selection as map”;
* user duplicates current tab.

New tab must not inherit:

* camera history;
* local search history;
* transient selections;
* AI job queue.

New tab may inherit:

* backlink;
* selected seed text;
* source context;
* user-chosen collection items.

## 6. Infinite Z-axis Protocol

## 6.1 Core Idea

Every content grain can be zoomed into, and every grain can become a seed.

This creates a semantic recursion loop:
domain → topic → source → document → paragraph → sentence → word → character → Unicode → dictionary → new seed → domain.

## 6.2 Required Orientation System

To prevent disorientation, every layer must display:

* current layer name;
* parent;
* current seed;
* breadcrumb;
* back-to-source action;
* scale indicator;
* trail marker.

## 6.3 Layer Transition Rules

Zoom in:

* fade parent layer;
* increase child layer opacity;
* preserve anchor point;
* show transition label;
* avoid sudden re-layout.

Zoom out:

* collapse children into parent summaries;
* fade child layer;
* show parent constellation or grid;
* preserve user trail.

## 6.4 Text Layer Rules

Text layers must preserve source mapping.

Paragraph knows:

* source page;
* section;
* text range.

Sentence knows:

* paragraph;
* text range.

Word knows:

* sentence;
* token range;
* language guess.

Character knows:

* word;
* code point;
* glyph display form.

Unicode / dictionary grain knows:

* originating word or character;
* language;
* definitions;
* usage if available.

## 7. HTML Content Plane Design

## 7.1 Tile Field

When entering document level, render pages as non-overlapping tiles.

Tile types:

* webpage;
* article;
* PDF snapshot later;
* local document later;
* Markdown;
* AI-generated brief;
* dictionary entry.

Layout:

* infinite XY plane;
* grid-like packing;
* no overlap;
* visual density controlled by zoom;
* source cards at high level;
* text blocks at close level.

P5.11 tile field contract:

* The default target density is 25 visible tiles per viewport, configurable from Settings.
* Tile placement should support asymmetric Windows 10 Phone-style live tile blocks and Windows 11 task-view-style live surfaces, not uniform search-result cards.
* The Pixi projection should expose tile bounds, focus state, visibility state, loading priority, and absorption progress.
* Off-viewport tiles must not load embedded webpage/document renderers. They keep only metadata, thumbnails, and source state.
* Near-viewport tiles may prewarm lightweight snapshots if cache budget allows.
* The renderer may load full webpage/document content only for visible or focused tiles.

## 7.2 Tile Internal Zoom

Each tile has its own scale of detail:

* collapsed card;
* source summary;
* section list;
* paragraph wall;
* sentence rows;
* phrase / word layer;
* character layer.

The global camera controls outer scale. The tile controls internal detail based on effective scale.

Browser absorption mode:

* When a focused L3 tile reaches more than 80% of viewport area, the telescope animation snaps it to the center and matches it to the viewport.
* Clicking the focused tile triggers the same animation without requiring more wheel zoom.
* In absorbed mode, the embedded webpage/document surface owns scroll and primary pointer handling.
* SeekStar must keep a minimal top exit label visible: "Click exit browser mode to keep exploring downward".
* Exiting browser mode returns wheel ownership to the telescope and continues semantic descent into section, paragraph, sentence, phrase, word, character, Unicode/dictionary, or new seed layers.
* The App Electron Framework owns the embedded web surface lifecycle and security boundary.
* The Constellation Engine owns the semantic state transition, tile focus, absorption threshold, target layer intent, and follow-up service requests.
* The Pixi Runtime Adapter owns projection data and animation geometry, not webpage DOM behavior.

Implementation note:
`TerrainScene.runtime` is the canonical owner of focused tile and browser absorption session state. React may mirror selection for UI controls, but it must not be the source of truth for browser absorption. The Electron tile surface manager subscribes to projection/runtime state and materializes thumbnails or live `WebContentsView` surfaces accordingly.

Hyperlink implementation note:
Links activated inside an absorbed tile create a new tab, run direct URL Scout with that tab id, convert the resulting observation into source-backed terrain, and set the new scene's initial layer to L3. Storage Service workspace change notifications propagate the saved source-backed terrain to docked and detached tab renderers without forcing a tab refresh.

Direct URL command note:
The command composer uses the same source-backed intake contract for direct URLs. `Add URL to current Seek` ingests into the current scene; `Open URL as new Seek` creates an active independent tab, then hydrates it with the observed L3 tile. Both paths preserve command/backlink provenance and keep AI out of the frame-level navigation loop.

P5.15 source command note:
The direct URL command now writes an initial pending Scout observation to the target tab before the network observation starts. Completion updates the same target tab scene. If the tab is absent from the latest workspace snapshot before the Scout result returns, Storage discards the stale source writeback.

P2 implementation note:
Manual source ingestion creates source-backed terrain from user-provided text or URL metadata before Playwright retrieval exists. The source enters the map as `SourceRef`, source-backed nodes, and `source_contains` relations. It must not appear as a ranked result list or chat answer.

## 7.3 Hyperlink Handling

MVP:

* hyperlink click opens system browser or new SeekStar tab depending on user setting.

Preferred product behavior:

* normal click: new SeekStar tab;
* modified click: system browser;
* context menu: open externally, copy link, inspect source, add to map.

Absorbed tile behavior:

* normal hyperlink activation opens a new SeekStar tab at the absorbed L3 webpage/document tile level;
* the origin tab keeps backlink context;
* the new tab does not inherit scroll history or browser history;
* if the linked page enters as an orphan tile, upward exploration can ask AI Service for a structured parent summary, topic, source orientation, or missing context patch;
* AI-created parent context must remain marked generated or agent-inferred until source-backed material confirms it.

New hyperlink tab:

* independent history;
* backlink to origin;
* origin snippet saved;
* source type marked as hyperlink-derived.

## 8. Constellation Design

## 8.1 Purpose

Constellations allow far-zoom domain recognition through shape.

They should reduce text overload and support pre-attentive recognition.

## 8.2 Shape Levels

Far:

* icon skeleton visible;
* stars merge into shape;
* labels minimal.

Middle:

* skeleton fades;
* major clusters appear;
* main nodes become readable.

Near:

* skeleton almost gone;
* semantic relations dominate;
* content cards visible.

Deep:

* no icon;
* only actual content structure.

## 8.3 Shape Constraint Rule

The system should blend visual shape and semantic truth.

Possible weighting:

* far zoom: high shape weight;
* middle zoom: mixed;
* near zoom: high semantic weight.

This prevents the constellation from distorting meaning at close range.

## 8.4 Star Roles

Main stars:

* high-importance concepts;
* authority sources;
* bridge nodes;
* anchor points.

Background stars:

* long-tail sources;
* supporting notes;
* weakly related items.

Fog stars:

* possible but unexplored directions.

## 8.5 Macro Lens Gallery Interaction

Macro semantic layers use a bubble gallery lens instead of ordinary rounded cards.

Layer responsibilities:

* L0: domain Star Gallery, configurable seed pool, constellation identity, and bubble lens.
* L1: topic bubbles and adjacent unknown frontiers.
* L2: source clusters hand off from macro orientation into content intake.
* L3 and deeper: document tiles and text grains; macro bubbles are no longer primary.

The constellation algorithm owns coarse semantic shape, region identity, and rough adjacency. The bubble gallery lens owns macro visual density, local magnification, edge shrink/fade, and the tactile feeling of drifting through a field. The handoff between them must preserve semantic truth: visual packing may help orientation, but it must not invent relations.

P4.6 pauses the long-press fracture sequence. Macro exploration now favors telescope movement: dragging the viewport near the edge of the current macro layer may trigger same-layer frontier discovery.

The renderer controls every movement frame. AI agents and Playwright must not drive real-time animation.

Playwright may be triggered when frontier discovery begins, but it is still only the Scout. It returns structured observations such as pending, observed, failed, duplicate, retrieved title, URL, snippet, retrieved time, and source type. It does not decide meaning, rank results, or create source-backed facts directly.

Resolved scout bubbles must pass through structured terrain conversion before becoming durable nodes. Observed candidates must preserve provenance, retrieved time, source state, and failure or duplicate status where applicable.

### 8.5.1 Scout Observation Contract

P4.1 introduces `ScoutObservation` as the boundary between a scout plan and durable terrain.

The Scout observation layer records pending, observed, source-candidate, failed, duplicate, and expired states. It may include query, title, URL, snippet, source type, retrieved time, failure reason, and duplicate linkage.

Observations are not map facts. They are evidence intake records. A future conversion step must decide which observed candidates become `SourceRef` entries and source-backed terrain. Playwright may later populate this contract, but it must not rank results, summarize meaning, or mutate the canvas directly.

### 8.5.2 Observation To Source Conversion

P4.2 adds the explicit conversion step from observation intake to durable terrain.

Only `source_candidate` and `observed` observations may be converted. The user must confirm the conversion. The conversion creates a `SourceRef`, source-backed terrain nodes, and `source_contains` relations using the existing source terrain adapter. The original observation is marked `converted`.

This keeps provenance honest: Scout observation is intake, source-backed terrain is a user-confirmed map artifact. Later real Playwright retrieval should populate the same observation contract before conversion.

### 8.5.3 Scout Provenance Trace

P4.3 preserves the conversion trace after an observation becomes terrain.

Converted sources may store `created_from_observation_id`, while generated source-backed nodes may keep node-level `created_from` context. The inspector should surface the Scout origin inside the source evidence card so the user can distinguish:

* the original Scout observation;
* the explicit user conversion;
* the resulting source-backed terrain.

The trace does not promote observations automatically and does not let Playwright mutate map facts directly. It is a provenance rail that future real Scout retrieval must use.

### 8.5.4 Electron Scout Adapter Boundary

P4.4 places Scout execution behind the Electron observatory boundary.

The renderer invokes `window.seekstar.scout.runPlan(tabId, plan)` through the preload bridge. The main process validates the request and returns a `ScoutRunResult` with `ScoutObservation` records. The current adapter is Playwright-backed and keeps source observations separate from source-backed terrain until user confirmation:

* renderer owns canvas state and UI response;
* Electron main owns Scout task orchestration;
* Scout returns observations, not terrain facts;
* source-backed terrain still requires explicit conversion;
* failures are represented as failed observations.

This keeps Playwright out of the renderer and prevents retrieval work from becoming browser navigation, search ranking, or direct map mutation.

### 8.5.5 Direct URL Playwright Scout Spike

P4.5 enables a narrow real Scout path for direct HTTP(S) URLs.

The renderer can route a direct URL through the command card into a `ScoutPlan`. The preload bridge sends that plan to the Electron main process. The main-process adapter uses Playwright Library to run a headless Chromium observation and returns structured `ScoutObservation` records.

P4.5 deliberately does not perform keyword search. If a candidate query is not a URL, it must not be sent to a search engine or rendered as results. It should remain a typed failed or unavailable observation unless a real Scout mode supports that input.

The Playwright adapter may collect:

* final URL;
* page title;
* a bounded visible-text snippet;
* content-derived source type;
* retrieval timestamp;
* failure reason.

It must not decide semantic meaning, create terrain nodes, control animation frames, or open a browser UI.

### 8.5.6 Real Telescope + GPU Star Map

P4.6 makes PixiJS the primary terrain renderer.

React owns the desktop shell, inspector, command routing, and source conversion controls. PixiJS owns the high-volume canvas: star bubbles, relation lines, Scout candidate stars, camera pan/zoom, and lasso coordination.

Scout observation records may now include `layer`, `position_hint`, `frontier_id`, `discovery_mode`, and `confidence`. These fields let the renderer place observations as candidate stars without promoting them to facts.

Frontier discovery modes:

* `direct_url`: observe one URL.
* `frontier_web_search`: observe candidate web sources for the current edge direction.
* `page_outlinks`: observe candidate links from a source-backed page.

No mode may render a ranked search-results surface. Observed candidates remain Scout intake until explicit conversion.

### 8.5.7 Source-Anchored Linked Frontier

P4.7 connects `page_outlinks` to the source evidence inspector.

When a selected source-backed node has a URL, the inspector may offer `Scout linked frontier`. The renderer sends a `page_outlinks` `ScoutPlan` through the preload bridge. Electron main runs Playwright, observes outgoing links from the confirmed page, and returns `ScoutObservation` records. The renderer positions those observations as candidate stars around the source node on the current semantic layer.

This keeps source expansion spatial: a confirmed source becomes a telescope anchor, not a browser tab or link list. The observations remain pending evidence intake until explicit conversion creates `SourceRef` and source-backed terrain.

## 9. UI Panels and Layout Details

Visual direction for the P0 shell is defined in `UI_STYLE_GUIDE.md`.

The intended tone is dark observatory, cognitive cartography, and blue-accented technical calm. Avoid neon sci-fi, generic dashboard styling, chatbot-first layout, browser-clone chrome, and loud gradient UI. Node states must visually distinguish seed, topic, provenance, fog, generated, inferred, selected, and active states without making unsourced content look source-backed.

## 9.1 Top Bar

P0 uses an integrated desktop title bar, a central map workbench, and a bottom command composer.

The native Windows title frame should be hidden through Electron-supported title bar customization. Window controls should remain native where possible. The application title bar may show lightweight navigation and menu labels, while the workbench header holds the active exploration universe, current layer, and job state. The command composer lives at the bottom of the workbench and routes intent; it must not become a chat-first surface.

### Title bar identity

The integrated title bar must show a centered, non-interactive product identity line:

```text
SeekStar  AI Explorer lens
```

- `SeekStar` is the product name.
- `AI Explorer lens` names the current exploration mode: an AI-assisted observatory lens over cognitive terrain, not a browser tab title or chat header.
- The line is horizontally centered in the title bar and must remain visually centered even when left navigation, menus, or native window controls change width.
- It must not steal click targets from draggable chrome or native minimize/maximize/close controls.
- Independent exploration tab titles remain in the left observatory sidebar and workbench header; they must not replace this global identity line.

Visual rules are defined in `UI_STYLE_GUIDE.md` under **Title Bar Brand**.

Workbench header must include:

* current seed;
* breadcrumb;
* Agent job indicator;
* settings.

Command composer placeholder should not pressure users to be precise.

Recommended placeholder:
“输入一个方向、问题、词语、链接，或在当前星图中搜索”

## 9.2 Left Tool Rail

P0 uses a left observatory sidebar instead of only a narrow tool rail. It should hold:

* new field search;
* search current map affordance;
* favorites / saved seed concepts;
* independent exploration tabs;
* compact canvas tools.

Compact tool order:

1. Pointer.
2. Pan.
3. Lens / zoom.
4. Lasso.
5. Brush.
6. Eraser later.
7. Note later.
8. Connect later.

Tool rail should show active tool clearly.

## 9.3 Right Inspector Panel

Panel modes:

* Overview;
* Inspect;
* AI;
* Sources;
* Dictionary;
* Collection;
* Export;
* Jobs.

### Overview

Shows:

* current tab title;
* seed;
* current layer;
* visible clusters;
* fog regions;
* suggested next moves.

### Inspect

Shows selected node details:

* title;
* type;
* summary;
* source;
* confidence;
* tags;
* relations;
* actions.

### AI

Shows:

* prompt box;
* preset prompts;
* generated responses;
* citations;
* regenerate;
* save;
* export.

### Sources

Shows:

* source list;
* retrieval time;
* source type;
* reliability hints;
* duplicate status.

### Dictionary

Shows:

* selected word / character;
* language;
* definitions;
* translations;
* Unicode info;
* usage;
* create seed action.

### Collection

Shows:

* dragged items;
* seed candidates;
* selected sources;
* compare basket;
* export basket.

### Jobs

Shows:

* active Agent calls;
* Playwright scout tasks;
* queued expansions;
* failed tasks;
* cancel / retry.

## 9.4 Bottom Bar

Must include:

* current scale;
* current semantic layer;
* selected count;
* visible node count;
* source count;
* cache state;
* warnings.

Optional:

* mini trail timeline;
* cost indicator;
* latency indicator.

## 9.5 Floating Cards

### Hover Card

Shows:

* node title;
* short summary;
* source;
* type;
* quick actions.

### Search Action Card

Shows after typing in top bar:

* new seed tab;
* search current tab;
* search web into map;
* ask current viewport;
* translate/define when applicable.

### Lasso Action Card

Shows after selection:

* selected items count;
* selected source count;
* preset prompts;
* custom question field;
* confirm.

## 10. Side Tray Design

The side tray is not just bookmarks.

It is a temporary cognitive workbench.

Zones:

* Save.
* Use as seed.
* Compare.
* Export.
* Ask AI.
* Learning path.

Drag behaviors:

* drag word to seed zone: create seed candidate;
* drag source to export zone: include in Markdown;
* drag cluster to ask zone: prepare selection prompt;
* drag two regions to compare zone: enable comparison.

MVP:

* save;
* use as seed;
* export.

## 11. Prompt System

## 11.1 Preset Prompt Groups

### Understanding

* Explain this.
* Summarize this.
* Explain like I am new to the field.
* Explain as an expert.

### Language

* Translate.
* Define.
* Show Unicode / dictionary.
* Explain usage.

### Learning

* Generate learning path.
* Show prerequisites.
* Make flashcards later.
* Create practice questions later.

### Research

* Find key sources.
* Find contradictions.
* Find missing context.
* Expand nearby unknowns.

### Creation

* Turn into outline.
* Turn into Markdown brief.
* Turn into project ideas.
* Turn into next questions.

## 11.2 Prompt Context Rules

AI prompt context should include:

* selected nodes;
* selected text;
* brush weights;
* current layer;
* parent context;
* source snippets;
* user question;
* output mode.

It should not include:

* entire workspace by default;
* private notes unless selected;
* unrelated tabs unless user chooses.

## 12. Data Persistence

Must persist:

* workspace;
* tabs;
* nodes;
* relations;
* layers;
* camera positions;
* tab histories;
* source cache;
* local search index metadata;
* annotations;
* lasso selections;
* brush strokes;
* generated AI outputs;
* exports;
* backlinks.

Should persist later:

* replayable trails;
* user preference profile;
* custom prompt presets;
* visual themes;
* dictionary cache.

## 13. Trust and Explainability UI

Every generated item should expose:

* source-backed or AI-generated;
* confidence;
* why it appears here;
* relation type;
* last updated;
* original source if available.

Fog region labels must be honest:

* “Likely adjacent field”
* “Weakly inferred”
* “Needs sources”
* “Emerging topic”
* “Unexplored from this tab”

Do not label fog as fact.

## 14. MVP Implementation Priorities

Priority 1:

* app shell;
* tab model;
* canvas;
* seed map;
* local search;
* source cards;
* lasso explain;
* side panel;
* source-backed Markdown.

Priority 2:

* HTML tile plane;
* paragraph / sentence / word zoom;
* word as seed;
* brush attention;
* hyperlink new tab;
* fog expansion.

Priority 3:

* constellation shapes;
* Unicode / dictionary deep zoom;
* advanced graph layout;
* workspace-wide search;
* trail replay.

Priority 4:

* collaboration;
* plugin system;
* cloud sync;
* full browser replacement.

## 15. Additional Design Issues to Resolve

### 15.1 Visual density

Need a density controller:

* sparse;
* balanced;
* dense;
* labels off;
* labels on hover;
* labels always visible for main stars.

### 15.2 Motion sickness

Need reduced motion:

* disable smooth fly;
* reduce lens distortion;
* use fade instead of travel.

### 15.3 Reading mode

Some users will need a conventional reading panel.

Reading mode should:

* show selected source as normal text;
* keep canvas context;
* allow word selection;
* allow return to map.

### 15.4 Minimap

A minimap should eventually show:

* current viewport;
* explored area;
* fog regions;
* tab origin;
* trail path.

### 15.5 Trail system

A trail records exploration:

* seed;
* movements;
* zoom layers;
* selections;
* generated outputs;
* saved items.

Trail can later become:

* Markdown report;
* presentation outline;
* learning log;
* research notebook.

### 15.6 Cost and latency visibility

Agent calls should show:

* queued;
* running;
* completed;
* failed;
* cancelled.

Later:

* estimated cost;
* token usage;
* cache hit.

P5.9 removes the earlier local Cartographer prototype path from the architecture baseline.

Agent calls now belong behind `@seekstar/ai-service`. If no configured provider exists, the service returns an explicit unavailable status instead of fabricating output. Any future Cartographer result must be structured, cancellable, cacheable, and validated before it can mutate `TerrainScene`.

The semantic deep-zoom spine remains part of the product model, but the owner is now the Constellation Engine rather than renderer-local prototype logic.

### 15.7 Empty states

SeekStar must avoid a blank-box feeling.

Empty states should offer:

* daily sky;
* recent trails;
* seed suggestions;
* local saved collections;
* examples of exploratory starts.

### 15.8 Failure states

If search fails:

* show what was searched;
* show why it failed if known;
* offer alternate queries.

If AI output is weak:

* mark low confidence;
* offer refine, search more, or explain differently.

If source is unavailable:

* keep metadata if allowed;
* mark source inaccessible.

## 16. Strongest Product Differentiators

1. The input box is no longer the center of cognition.
2. Unseen questions become fog regions.
3. Any grain of information can become a seed.
4. Zoom is semantic, not only visual.
5. Lasso and brush turn visual attention into AI context.
6. Web content becomes a navigable tile field.
7. Constellations make domains recognizable at a glance.
8. Markdown export turns exploration into knowledge assets.
9. Tabs are independent exploration universes.
10. Agent is a cartographer, not a chatbot.
