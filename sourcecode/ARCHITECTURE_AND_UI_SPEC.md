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

The app should never depend on AI for frame-by-frame interaction. AI generates terrain. The local application renders and navigates terrain.

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

### 2.3 Agent Orchestration Layer

Responsibilities:

* seed mapping;
* query planning;
* source distillation;
* layer mapping;
* region explanation;
* prompt preset execution;
* Markdown generation;
* dictionary / Unicode interpretation if needed.

Design principle:
Agent output must be structured, inspectable, cancellable, and cacheable.

### 2.4 Playwright Scout Layer

Responsibilities:

* execute planned searches;
* retrieve pages;
* extract visible content and metadata;
* record source provenance;
* report failures;
* pass observations to Agent.

Design principle:
Playwright is a scout, not a browser UI replacement.

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

P2 implementation note:
The first durable store is an Electron-owned JSON workspace snapshot behind the preload bridge. It persists tabs, `TerrainScene` objects, viewport, selection, side tray items, and local generated notes. This is a small bridge to real product use, not the final source-cache database or full-text index.

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

* force simulation;
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

Dictionary entry knows:

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

P2 implementation note:
Manual source ingestion creates source-backed terrain from user-provided text or URL metadata before Playwright retrieval exists. The source enters the map as `SourceRef`, source-backed nodes, and `source_contains` relations. It must not appear as a ranked result list or chat answer.

## 7.3 Hyperlink Handling

MVP:

* hyperlink click opens system browser or new SeekStar tab depending on user setting.

Preferred product behavior:

* normal click: new SeekStar tab;
* modified click: system browser;
* context menu: open externally, copy link, inspect source, add to map.

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

* L-3 / L-2: constellation shape plus bubble lens.
* L-1 / L0: seed field and topic region clustered bubbles.
* L1 / L2: gradual handoff from bubbles into topic/source cards.
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

The renderer invokes `window.seekstar.scout.runPlan(tabId, plan)` through the preload bridge. The main process validates the request and returns a `ScoutRunResult` with `ScoutObservation` records. The current adapter is mock-only, but its location and contract match the future Playwright Scout role:

* renderer owns canvas state and UI response;
* Electron main owns Scout task orchestration;
* Scout returns observations, not terrain facts;
* source-backed terrain still requires explicit conversion;
* failures are represented as failed observations.

This keeps Playwright out of the renderer and prevents retrieval work from becoming browser navigation, search ranking, or direct map mutation.

### 8.5.5 Direct URL Playwright Scout Spike

P4.5 enables a narrow real Scout path for direct HTTP(S) URLs.

The renderer can route a direct URL through the command card into a `ScoutPlan`. The preload bridge sends that plan to the Electron main process. The main-process adapter uses Playwright Library to run a headless Chromium observation and returns structured `ScoutObservation` records.

P4.5 deliberately does not perform keyword search. If a candidate query is not a URL, it must not be sent to a search engine or rendered as results. It should remain mock, pending, or failed depending on the plan path.

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

P3.1 implements only the local structured job surface:

* completed mock cartographer jobs;
* generated `CartographerOutput` records;
* terrain patches added to `TerrainScene`;
* scout plans as candidate directions only.

P3.2 adds renderer-local lifecycle simulation:

* queued and running states;
* progress bands;
* cancellation before patch application;
* mock failure before patch application;
* completed jobs as the only patch-producing state.

It does not connect OpenAI, Playwright, real retrieval, cost accounting, tracing, external cancellation, worker orchestration, or source-backed AI claims.

P3.4 adds a mock Layer Cartographer action over the same boundary:

* selected terrain can request adjacent paths;
* output is a `TerrainPatch` containing generated questions, weak route nodes, and fog regions;
* the right inspector remains provenance and control surface only;
* the canvas remains the primary product surface.

This does not add model calls, Playwright retrieval, browser behavior, real search, or source-backed claims.

P3.5 adds generated questions and learning paths as terrain-producing jobs:

* `question_generator` creates generated next-question nodes from selected terrain;
* `learning_path_mapper` creates a mock path through orientation, evidence readiness, and fog;
* lasso selections, side-tray items, and selected nodes share the same job boundary;
* outputs are inspectable map patches, not chat answers.

This does not add model calls, retrieval, real citations, Markdown file writing, or source-backed synthesis.

P3.7 adds the cartographer output seed loop:

* generated cartographer terrain may expose seed creation only when marked `can_create_seed`;
* `created_from` records the origin node, layer, and label for backlink context;
* new tabs remain independent exploration universes;
* returning to origin uses backlink focus rather than browser history.

This does not add AI, Playwright, real search, real persistence changes, or factual promotion of generated terrain.

### 15.6.1 Deep Zoom Spine Prototype

The Deep Zoom Spine keeps `TerrainScene` as the renderer contract while proving recursive semantic depth.

* Layers L0-L10 are navigable in the semantic rail.
* Nodes may carry optional source ranges, token ranges, semantic breadcrumbs, zoom targets, seedability, and created-from refs.
* The renderer changes visible terrain by semantic layer instead of treating zoom as a visual-only scale.
* Text grain nodes use paragraph, sentence, word, character, and dictionary visual treatments.
* Seedable grains create independent tabs with backlinks, not browser history.

The prototype is mock-only. Real webpages, Playwright observations, AI cartography, dictionary lookup, and source-backed claims must attach to this spine later rather than bypassing it.

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
2. Unknown unknowns become fog regions.
3. Any grain of information can become a seed.
4. Zoom is semantic, not only visual.
5. Lasso and brush turn visual attention into AI context.
6. Web content becomes a navigable tile field.
7. Constellations make domains recognizable at a glance.
8. Markdown export turns exploration into knowledge assets.
9. Tabs are independent exploration universes.
10. Agent is a cartographer, not a chatbot.
