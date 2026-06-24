# SeekStar Product Requirements Document

Version: 0.1
Status: Design draft
Product name: SeekStar / 寻星
Product type: Electron-based AI exploration browser
Primary mode: 2.5D infinite semantic canvas
Primary goal: Discover unknown unknowns before formal questioning

## 1. Product Summary

SeekStar is an AI-driven exploration browser that transforms search, web content, documents, language, and user selections into an infinite zoomable cognitive map.

Instead of asking the user to precisely describe intent in a blank search box, SeekStar lets the user begin with a seed, a question, a webpage, a daily topic, a selected word, or a lassoed region. The system then constructs a layered semantic field that can be panned, zoomed, selected, explained, expanded, and exported.

SeekStar’s core experience is:

> The user enters or encounters a vague direction. The system turns it into a navigable star field. The user zooms, drifts, selects, annotates, and discovers what they did not know they could ask.

## 2. Problem Statement

Traditional search and chat interfaces require users to already know what they want to ask.

This creates a cognitive bottleneck:

* users must know the right keywords;
* users must know the name of the field;
* users must already sense the boundary of the problem;
* long-tail content is buried;
* unexpected adjacent knowledge is hard to encounter;
* exploration history is not preserved as a first-class object.

SeekStar addresses this by replacing the empty input box as the dominant interface with a spatial, zoomable, AI-generated cognitive terrain.

## 3. Product Philosophy

Normative product philosophy, including Seek vs Search, existence-before-cognition, and the telescope constitution, lives in `PHILOSOPHY.md` (English) and `PHILOSOPHY.zh.md` (Chinese). This section summarizes product-facing implications.

### 3.1 From search to terrain

Search is not treated as a linear retrieval act. It is treated as navigation through terrain.

### 3.2 From answer to orientation

The first task of SeekStar is not to answer. It is to orient the user.

### 3.3 From list to constellation

Information is not rendered primarily as ranked results. It is rendered as stars, clusters, constellations, tiles, fog regions, trails, and text strata.

### 3.4 From reading to recursive seeding

Any information grain can become a new exploration seed:

* domain;
* topic;
* webpage;
* section;
* paragraph;
* sentence;
* phrase;
* word;
* character;
* Unicode code point;
* dictionary entry.

### 3.6 SeekStar, not SearchStar

SeekStar is named for exploration before precision. Search assumes the user already knows what to name. Seek assumes the user may only have a direction, fragment, or region worth inspecting. The product must help users discover what can be asked before the question is fully formed.

### 3.7 Existence before map completion

The map must combine two kinds of material:

* model-organized unknowns, fog, and adjacent possibilities;
* scout-observed webpages, papers, encyclopedia entries, and other source-backed objects that already exist in the world.

Scout observations are candidate stars until provenance and user confirmation promote them into durable terrain.

### 3.8 The telescope is the primary surface

The star map and its camera are the product center. Macro Star Gallery, document tile fields, and text-grain depth are focal-length changes of the same instrument. Panels and input surfaces support the telescope; they do not replace it.

## 4. Target Users

### 4.1 Exploratory learner

Needs:

* understand unfamiliar fields;
* discover what to learn next;
* build a learning path from fragments.

Pain:

* does not know what to search;
* gets overwhelmed by long result lists;
* loses context across tabs.

### 4.2 Researcher / student

Needs:

* map a topic;
* compare sources;
* build citations;
* find adjacent work;
* organize readings.

Pain:

* search results are linear;
* source chains are hard to track;
* notes are separated from web context.

### 4.3 Creator / developer / designer

Needs:

* explore ideas;
* connect concepts;
* find references;
* turn vague inspiration into structured direction.

Pain:

* chat answers are too direct;
* brainstorming is not spatial;
* useful side paths disappear.

### 4.4 Language learner / close reader

Needs:

* zoom from text into words, characters, Unicode, dictionaries, translation, and usage.

Pain:

* webpage reading and dictionary lookup are separated;
* unknown terms cannot easily become new exploration seeds.

## 5. Core Concepts

## 5.1 Workspace

A workspace contains tabs, maps, trails, saved selections, source caches, local annotations, exports, and settings.

## 5.2 Tab

A tab is an independent exploration universe.

Tab creation modes:

* new blank exploration;
* new seed tab from search input;
* new tab from selected keyword;
* new tab from word or character;
* new tab from hyperlink;
* new tab from saved collection;
* new tab from daily topic.

Rules:

* hyperlink-created tabs do not inherit previous tab history;
* every tab keeps its own camera history;
* every tab keeps its own local search index;
* every tab can have backlinks to parent tabs;
* tabs can be grouped later, but MVP only requires independent tabs.

## 5.3 Canvas

The canvas is infinite in X and Y. It supports Z-axis semantic depth.

X and Y define spatial relation inside the current layer. Z defines abstraction level.

## 5.4 Layer

A layer is a semantic depth, not a graphics-only zoom level.

Default layer ladder:

* L-3: global knowledge field;
* L-2: domain constellation;
* L-1: topic region;
* L0: seed keyword or seed question;
* L1: child / sibling / parent concept grid;
* L2: source cluster;
* L3: webpage / document tile;
* L4: HTML section;
* L5: paragraph block;
* L6: sentence block;
* L7: phrase or term;
* L8: word;
* L9: character;
* L10: Unicode code point;
* L11: dictionary entry;
* L12: selected term as a new seed.

The system must support deeper layers without redesigning the architecture.

## 5.5 Cognitive Lens

The visible canvas uses a lens effect:

* center region is larger, clearer, and more readable;
* edge region is smaller, dimmer, and more suggestive;
* center receives detailed labels;
* edge shows hints, fog, and adjacent possibilities.

The lens is both visual and semantic:

* the UI magnifies the center;
* the Agent prioritizes the center;
* the scout preloads near the edge.

### 5.5.1 Macro Lens Gallery

At macro layers, SeekStar should not look like a dashboard grid of rounded cards.

Layers L-3, L-2, L-1, and L0 may use an Apple Watch App Gallery-like bubble lens: colorful but restrained solid bubbles clustered in a dense field. The center of the viewport is larger, clearer, and more readable; the edge becomes smaller, dimmer, and eventually fades. This is a cognitive orientation surface, not decoration.

Macro bubbles are entry points for exploration when the user does not yet know what to ask. They may represent domains, topic regions, seed fields, fog regions, scout-pending regions, or constellation anchors. They must still preserve source state and confidence: source-backed, generated, weak, inferred, and fog content cannot look interchangeable.

P4.6 pauses long-press fracture. Macro discovery should instead feel like moving a telescope horizontally across a star field: when the user drifts near the edge of the current layer, Scout may request same-layer frontier observations and place new candidate stars near that edge. It must not turn into a ranked result list or chatbot answer.

## 5.6 Constellation

A constellation is a domain-level shape identity.

At far zoom, a domain may be represented by a recognizable icon-like constellation. Example: music may resemble a guitar; biology may resemble a DNA helix; chemistry may resemble a flask.

Rules:

* far zoom: shape identity dominates;
* middle zoom: shape begins to dissolve into clusters;
* close zoom: semantic structure dominates;
* near content level: shape identity disappears.

The constellation is a road sign, not the truth of the data.

Macro Lens Gallery and constellation layout work together:

* L-3 / L-2: constellation shape and bubble lens both dominate;
* L-1 / L0: clustered seed/topic bubbles dominate, while constellation structure remains as orientation;
* L1 / L2: bubbles transition into topic and source cards;
* L3 and deeper: document tiles and text grains replace macro bubbles as the primary visual form.

## 5.7 Tile Field

At webpage and document level, content appears as non-overlapping flat tiles on an infinite plane.

The tile field behaves like:

* Windows tiles;
* iOS Photos grid;
* infinite canvas;
* document wall.

Each tile can be zoomed internally. Page tiles contain sections; sections contain paragraphs; paragraphs contain sentences; sentences contain phrases; phrases contain words; words contain characters.

## 5.8 Side Tray

The side tray is a collection and action area.

Users can drag into it:

* nodes;
* selected text;
* words;
* characters;
* sources;
* generated summaries;
* lasso selections;
* prompt results;
* learning paths.

Side tray item modes:

* saved item;
* seed candidate;
* compare candidate;
* export item;
* prompt input item.

## 5.9 Lasso Selection

Lasso selection lets users select arbitrary regions.

Lasso can select:

* stars;
* clusters;
* tiles;
* text blocks;
* words;
* annotations;
* mixed content.

After lassoing, the user can:

* explain selection;
* summarize selection;
* translate selection;
* generate learning path;
* generate questions;
* expand nearby unknowns;
* export Markdown;
* create new tab from selection.

## 5.10 Brush Annotation

Brush lets users paint attention.

Brush strokes are not only visual annotations. They become priority signals for AI explanation.

Brush modes:

* highlight;
* question mark;
* important;
* confusing;
* connect;
* reject;
* custom color or label later.

MVP only requires freehand highlight and weighted selection.

## 6. Main User Flow

## 6.1 Startup Flow

1. User opens SeekStar.
2. App loads the latest workspace.
3. If no workspace exists, app shows an opening star field.
4. The opening star field may be based on:

   * daily latest information;
   * user-defined seed topics;
   * default exploration categories;
   * recently saved trails.
5. The top bar is visible but not dominant.
6. The user can immediately pan, zoom, search, or select.

Acceptance criteria:

* user can begin without typing;
* user can type if they want;
* opening field contains visible unknown regions;
* no empty white-page pressure.

## 6.2 Search Input Flow

The top search input accepts arbitrary text.

After text input, a modal card appears with at least two actions:

Action A: “Use as new exploration seed”

* creates a new tab;
* sets the text as L0;
* generates a new map;
* does not inherit previous tab history.

Action B: “Search within current tab”

* searches the current tab’s local content index;
* highlights matches on canvas;
* opens a keyword result card;
* shows keyword, snippet, source, layer, and position;
* clicking a result moves the camera to that location.

Future actions:

* “Ask about current viewport”;
* “Search web and add to current map”;
* “Compare with selected region”;
* “Translate selected content”;
* “Create learning path”.

## 6.3 New Tab from Keyword

1. User selects a word or phrase.
2. User drags it into the side tray or chooses “new seed tab”.
3. A new tab opens.
4. The selected term becomes L0.
5. The source context is preserved as backlink.
6. Agent generates parent, child, sibling, and adjacent domains.

Acceptance criteria:

* any selected term can become a seed;
* source context remains accessible;
* new tab has independent history.

## 6.4 Hyperlink Flow

1. User clicks a hyperlink inside content layer.
2. SeekStar opens a new exploration tab.
3. Original tab remains unchanged.
4. New tab stores backlink to origin.
5. System browser opening remains available as an explicit option.
6. MVP may open external browser first if internal hyperlink ingestion is not ready.

Acceptance criteria:

* hyperlink does not destroy current exploration;
* history is not inherited;
* backlink is retained.

## 6.5 Zoom into Webpage Content

1. User enters a source cluster.
2. Source cluster becomes webpage / document tile field.
3. User zooms into a tile.
4. Tile expands into HTML sections.
5. Sections expand into paragraphs.
6. Paragraphs expand into sentences.
7. Sentences expand into phrases / words.
8. Words expand into characters.
9. Characters expand into Unicode / dictionary layer.
10. Any term can become a new seed.

Acceptance criteria:

* source position remains traceable at every level;
* user can move back up without losing orientation;
* text remains readable at appropriate layers.

## 6.6 Lasso AI Flow

1. User selects lasso tool.
2. User circles one or more regions.
3. Selection preview appears.
4. User chooses preset or enters question.
5. User confirms.
6. AI returns response in side panel.
7. Response includes source references when source-backed.
8. User can save, export, regenerate, or use as new seed.

Acceptance criteria:

* selection can include mixed node and text types;
* AI response is grounded in selected content;
* user can inspect what was selected.

## 6.7 Brush + Prompt Flow

1. User uses brush to mark content.
2. Brush strokes become attention weights.
3. User enters question or preset.
4. AI prioritizes brushed regions.
5. Generated output notes which areas drove the answer.

Acceptance criteria:

* brush is visually persistent;
* brushed content can be collected;
* brush affects AI context.

## 7. Functional Requirements

## 7.1 Desktop Host

The app must:

* run as a desktop application;
* support multiple tabs;
* support persistent workspaces;
* support local caches;
* support offline inspection of previously loaded content where possible;
* separate application UI from remote web content.

## 7.2 Multi-tab System

The app must support:

* create tab from seed;
* create tab from hyperlink;
* create tab from selection;
* close tab;
* rename tab;
* duplicate tab later;
* tab search later;
* independent tab history;
* independent camera history;
* parent backlink.

MVP:

* create, close, switch, rename;
* independent history;
* hyperlink-created new tab.

## 7.3 Top Bar

The top bar contains:

* tab strip;
* search / command input;
* current layer breadcrumb;
* Agent job indicator;
* sync / save state;
* workspace name.

Search input behavior:

* accepts arbitrary text;
* opens modal action card;
* supports keyboard shortcuts;
* supports direct command prefix later.

## 7.4 Canvas

Canvas must support:

* pan;
* zoom;
* semantic Z-depth transition;
* node hit testing;
* tile hit testing;
* lasso;
* brush;
* drag to side tray;
* hover preview;
* click inspect;
* camera-to-result movement;
* minimap later.

## 7.5 Z-axis Layering

The system must:

* map zoom level to semantic layer;
* allow infinite conceptual depth;
* pre-render or cache adjacent layers where possible;
* fade layers in and out by opacity;
* avoid sudden teleportation;
* preserve breadcrumb;
* preserve parent context.

## 7.6 HTML Content Plane

At content layer, the system must:

* arrange pages / sections / blocks as non-overlapping tiles;
* support internal tile scale;
* support text selection;
* support keyword highlighting;
* support source location mapping;
* support links;
* support export;
* support dictionary layer.

## 7.7 Local Search

Within current tab, local search must:

* search titles;
* search summaries;
* search source snippets;
* search full text where available;
* search annotations;
* search generated outputs;
* show match list;
* move camera to selected match;
* highlight all visible matches.

MVP:

* keyword exact and fuzzy search across current tab data.

## 7.8 Web Search and Retrieval

The system must:

* generate search query sets;
* retrieve result pages;
* extract structured metadata;
* avoid duplicates;
* record retrieval time;
* store source references;
* mark failed retrieval;
* respect user permissions.

## 7.9 AI Agent Actions

Preset actions:

* explain selected region;
* summarize selected region;
* translate;
* generate learning path;
* generate questions;
* expand unknowns;
* compare selections;
* export Markdown;
* define word;
* show Unicode / dictionary info;
* create seed map.

## 7.10 Side Panel

The right side panel should support:

* node inspector;
* source inspector;
* selection summary;
* AI answer;
* Markdown preview;
* dictionary view;
* relation view;
* tab metadata;
* export controls.

## 7.11 Side Tray

The side tray should support:

* saved items;
* draggable seed candidates;
* current prompt context;
* selection basket;
* export basket;
* compare basket.

## 7.12 Export

Export should support:

* Markdown;
* selected sources;
* selected summaries;
* selection explanation;
* learning path;
* source links;
* canvas snapshot later.

MVP:

* Markdown export from selected region.

## 8. Non-functional Requirements

## 8.1 Performance

The app must feel immediate during:

* panning;
* zooming;
* lassoing;
* brushing;
* tab switching;
* local search highlighting.

AI tasks may take longer, but must be visible, cancellable, and non-blocking.

## 8.2 Cost

AI calls must be budget-aware.

Rules:

* use small models for classification and extraction when possible;
* use stronger models for explanation, synthesis, and complex mapping;
* cache Agent outputs;
* avoid reprocessing unchanged content;
* allow user to cancel or pause expansion;
* show job queue and rough cost later.

## 8.3 Trust

The app must:

* show source provenance;
* mark AI-generated nodes;
* mark inferred relations;
* distinguish source-backed content from generated interpretation;
* avoid presenting fog as fact.

## 8.4 Security

The app must:

* isolate remote content;
* avoid unsafe script execution;
* avoid disabling browser security features;
* open suspicious links externally or with warning;
* restrict filesystem access;
* separate user notes from fetched content;
* avoid silent upload of private content.

## 8.5 Accessibility

The app should support:

* keyboard navigation;
* readable zoom labels;
* reduced motion option;
* high contrast mode later;
* text list fallback later.

## 9. MVP Scope

## 9.1 MVP Must Have

* Electron desktop shell.
* Multi-tab exploration.
* Top command / search input with modal actions.
* New tab from seed.
* Search within current tab.
* 2D infinite canvas.
* Basic cognitive lens.
* Z-axis layer transitions.
* Initial semantic map from seed.
* Playwright-backed web retrieval.
* Source cards.
* Webpage / document tile plane.
* Zoom to paragraph / sentence / word at minimum.
* Word as new seed.
* Lasso selection.
* AI explanation from selection.
* Side panel.
* Side tray.
* Markdown export.
* Local persistence.

## 9.2 MVP Should Have

* Brush annotation.
* Unicode / dictionary panel.
* Fog region expansion.
* Basic constellation icon at domain level.
* Search result camera jump.
* Backlink between tabs.
* Agent job queue.
* Source confidence labels.

## 9.3 MVP Can Defer

* Full 3D.
* Real-time collaboration.
* Browser-like internal navigation for all links.
* Full citation manager.
* Account system.
* Cloud sync.
* Mobile support.
* Plugin marketplace.
* Advanced vector database.
* Complex multi-agent orchestration UI.
* Full webpage rendering inside canvas.
* Universal dictionary coverage.

## 9.4 P2 Current Implementation Boundary

P2 starts with real local product capability while keeping the map-first model:

* local workspace snapshot persistence for tabs, scenes, viewport, selections, side tray items, and generated notes;
* manual source ingestion from user-provided text or URL metadata;
* source-backed terrain nodes and `source_contains` relations added to the current map;
* source readiness counts that keep source-backed, generated, inferred, weak, and fog terrain distinct;
* source-backed nodes can become independent exploration seed tabs with backlinks to the origin source context.
* source-derived tabs can focus the original source-backed node across tabs without using browser history.

P2.1-P2.7 close the first local source-backed exploration loop. They still do not implement Playwright retrieval, AI source distillation, real graph layout, browser navigation, durable source-cache indexing, or real Markdown export.

## 9.5 P3 Current Implementation Boundary

P3.1 starts the AI cartographer surface as a structured local job boundary:

* cartographer jobs are visible in the right inspector and app status;
* region explain, source distill, and fog scout planning create mock completed jobs;
* outputs become generated / inferred / weak / fog terrain patches on the canvas;
* scout plans are only candidate directions and do not run Playwright;
* source-backed nodes remain the only factual terrain, while generated outputs stay marked.

P3.1 does not implement real AI calls, Playwright retrieval, real web search, browser navigation, source-backed AI claims, full job cancellation, cost accounting, or real Markdown export.

P3.2 adds a local mock job lifecycle:

* cartographer jobs move through queued, running, completed, cancelled, and failed states;
* only completed jobs add terrain patches and outputs to the map;
* cancelled and failed jobs remain inspectable but do not create facts or source-backed terrain;
* progress is a local UI affordance, not real token, cost, or network progress.

## 9.6 Deep Zoom Spine Prototype Boundary

The Deep Zoom Spine prototype makes the Z axis verifiable beyond L0-L2:

* mock layers run from L0 seed through L10 new seed loop;
* paragraph, sentence, phrase/word, character, and Unicode/dictionary grains render as distinct terrain forms;
* `zoom_target`, semantic breadcrumb, source range, token range, and seedability are explicit node metadata;
* seedable grains create independent mock tabs with origin backlinks;
* all deep zoom fixture content is generated/mock and must not look source-backed.

This stage does not implement AI, Playwright, real webpage content, browser navigation, real dictionary lookup, real search, or a new persistence system.

P3.3 improves the prototype without widening scope:

* mock cartographer jobs can be retried or rerun from failed, cancelled, or completed states;
* deep zoom shows muted parent/child ghost context for orientation;
* a compact mini-map summarizes the semantic spine and current layer.

These are local interaction affordances only, not real Agent execution, web retrieval, or search.

P3.4 adds the first mock Layer Cartographer pathing action:

* selected nodes can generate adjacent paths as structured terrain patches;
* outputs appear as generated questions, weak adjacent-route nodes, and fog regions;
* the action strengthens unknown-unknown discovery without turning the interface into chat or a ranked result list;
* no source-backed facts are created by this mock action.

This remains local-only and mock-only. It does not connect AI, Playwright, real search, browser navigation, or source-backed extraction.

P3.5 turns generated questions and learning paths into map terrain:

* lasso selections, side-tray items, and selected nodes can run mock question generation;
* selected terrain can produce a short mock learning path made of orientation, evidence-readiness, and fog-following nodes;
* generated questions are prompts for exploration, not answers;
* learning paths preserve source-state distinctions and do not invent evidence.

This remains local-only and mock-only. It does not implement real AI generation, Playwright retrieval, real citations, real Markdown export, or a search-results surface.

P3.7 closes the mock cartographer seed loop:

* generated questions, adjacent routes, scout-plan questions, learning-path steps, and fog edges can become new seed tabs;
* new tabs created from generated cartographer terrain preserve `created_from` / backlink context;
* lassoed or multi-node regions also preserve an origin backlink when used as a seed;
* new seed tabs remain independent exploration universes and do not inherit camera, search, or job history.

This does not make generated terrain source-backed, does not run AI, and does not perform retrieval.

## 9.7 P4 Preflight Visual Interaction Boundary

Before P4 connects real Playwright scouting, the macro visual interaction contract must be fixed:

* macro layers use a bubble lens gallery rather than normal dashboard cards;
* edge movement is the intended scout/fog-expansion gesture for macro terrain;
* the renderer owns every movement frame locally;
* Playwright may start during frontier discovery, but only returns structured scout observations;
* scout counts may influence candidate frontier stars, but they must not imply factual result counts;
* frontier stars must remain typed as pending, observed, failed, duplicate, source candidate, weak, or fog until provenance is available.

This preflight is a design contract only. It does not implement animation, Playwright retrieval, AI summarization, search ranking, or browser navigation.

## 9.8 P4.1 Scout Observation Contract

P4.1 starts the real business-function boundary by introducing Scout observations.

* `ScoutObservation` records what a future Playwright Scout saw or failed to see.
* Observations may be pending, observed, source candidate, failed, duplicate, or expired.
* Scout observations are not source-backed terrain by themselves.
* Running a scout plan may create observation records, but it must not create factual nodes or ranked results directly.
* Source-backed terrain still requires provenance conversion into `SourceRef`, source nodes, and typed relations.

The current P4.1 implementation may use local mock observations to validate the contract. It does not yet run Playwright, fetch pages, rank results, summarize content, or call AI.

## 9.9 P4.2 Observation To Source Terrain Conversion

P4.2 lets a user-confirmed Scout observation become source-backed terrain.

* Only `source_candidate` or `observed` observations can be converted.
* Conversion is explicit: the user chooses `Confirm as source terrain`.
* Conversion creates `SourceRef`, source-backed source/excerpt nodes, and `source_contains` relations.
* The original observation is marked `converted` to prevent repeated provenance intake.
* Converted terrain keeps reliability hints showing that this is currently a mock Scout observation, not real Playwright retrieval.

Scout still does not decide meaning. Conversion does not rank results, summarize pages with AI, or open a browser view.

## 9.10 P4.3 Scout Provenance Trace

P4.3 closes the local mock provenance loop between Scout intake and source-backed terrain.

* Converted `SourceRef` records may retain `created_from_observation_id`.
* Source-backed nodes created from an observation keep `created_from` context.
* The source evidence card shows the Scout origin, status, query, and observed time when present.
* This trace is informational provenance, not a claim that the current mock observation came from real retrieval.

This keeps the future Playwright path honest: external observations enter as intake records first, then become source-backed terrain only through explicit conversion.

## 9.11 P4.4 Electron Scout Adapter Boundary

P4.4 moves Scout execution behind an Electron-owned adapter boundary.

* The renderer sends a structured `ScoutRunRequest` containing the current tab and `ScoutPlan`.
* The Electron main process returns a `ScoutRunResult` containing `ScoutObservation` records.
* The current adapter is still mock-only and does not install or run Playwright.
* Adapter failures become failed observations instead of silent UI errors.
* The renderer remains map-first: observations enter the side inspector and can later be confirmed into source terrain.

Future real Playwright work must replace the adapter implementation behind this boundary. It must still return observations first and must not rank results, drive animation frames, decide meaning, or create source-backed terrain directly.

## 9.12 P4.5 Direct URL Playwright Scout Spike

P4.5 starts the real Scout path with the smallest safe retrieval case: direct HTTP(S) URL observation.

* The desktop app depends on Playwright Library in the Electron main process.
* The command card exposes `Scout direct URL` only when the input is a URL.
* The Playwright adapter opens the URL headlessly, reads page title and visible body text, and returns a `source_candidate` observation.
* Non-URL candidate queries are not converted into search-engine requests in this phase.
* Browser launch or page failures become failed observations.
* The observation must still be explicitly confirmed before it becomes source-backed terrain.

This is not a browser surface, not a ranked web search, and not AI summarization. It is the first narrow Scout probe behind the existing observation contract.

## 9.13 P4.6 Real Telescope + GPU Star Map

P4.6 starts the real telescope experience.

* The primary terrain canvas uses PixiJS instead of DOM node cards.
* Macro layers render as solid colored star bubbles.
* Moving the macro viewport near a layer edge triggers same-layer frontier discovery.
* Playwright Scout can perform direct URL, frontier web search, and page outlink observations.
* Frontier observations carry layer, position, frontier id, discovery mode, and confidence so they can render as candidate stars.
* Candidate stars are not facts and are not source-backed until explicit conversion.

This phase is aggressive about moving beyond mock visuals, but it still preserves SeekStar's core boundary: map over list, observations before facts, Playwright as Scout, and explicit source conversion.

## 9.14 P4.7 Source-Anchored Linked Frontier

P4.7 lets a source-backed node act as a telescope anchor.

* Source evidence cards may expose `Scout linked frontier` when the node has a confirmed `SourceRef` URL.
* The Electron Scout adapter uses Playwright `page_outlinks` mode to observe candidate links from that confirmed page.
* Returned links become same-layer Scout candidate stars positioned around the source node.
* Candidate stars are not facts, are not ranked results, and are not source-backed terrain until the user confirms conversion.

This improves the real discovery loop without adding browser navigation, chat, AI summarization, or automatic meaning decisions.

## 10. UI Layout

## 10.1 Global Layout

Default layout:

* top: tab strip + command/search bar + layer breadcrumb + job status;
* left: tool rail;
* center: infinite canvas;
* right: inspector / AI panel;
* bottom: status bar, scale indicator, timeline / trail later;
* floating: search modal card, lasso prompt card, hover previews.

## 10.2 Top Bar

Elements:

* app logo / workspace switcher;
* tab strip;
* new tab button;
* command input;
* search mode indicator;
* layer breadcrumb;
* Agent activity indicator;
* settings button.

Command input states:

* idle;
* text typed;
* action modal open;
* searching current tab;
* generating seed map;
* AI busy.

## 10.3 Left Tool Rail

Tools:

* pointer;
* pan;
* zoom;
* lasso;
* brush;
* eraser later;
* text note later;
* connect later;
* measure relation later.

MVP:

* pointer;
* pan;
* lasso;
* brush.

## 10.4 Right Panel

Panel tabs:

* Inspect;
* AI;
* Sources;
* Dictionary;
* Collection;
* Export.

MVP:

* Inspect;
* AI;
* Sources;
* Collection.

## 10.5 Bottom Status Bar

Displays:

* current layer;
* current scale;
* node count in viewport;
* selected count;
* source count;
* AI queue state;
* cache state;
* warning messages.

## 10.6 Modal Cards

Search modal:

* “Use as new exploration seed”
* “Search within current tab”
* optional recent seeds
* optional suggested completions

Lasso modal:

* selected count;
* prompt input;
* preset prompts;
* confirm / cancel.

Hover card:

* title;
* summary;
* source;
* confidence;
* quick actions.

## 10.7 Application Startup Splash

P0 ships a lightweight renderer overlay splash inside the main observatory shell.

Purpose:

* give the user immediate feedback that SeekStar is launching;
* avoid a blank or half-painted shell during renderer startup;
* keep startup quiet and local-only.

Visual design:

* full-shell overlay with dark matte background (`#0b0d12` range);
* one centered straight-edged telescope SVG mark in the middle;
* no progress bar, no marketing copy, no fake loading percentage;
* subtle icon breathing animation is allowed; avoid decorative gradients or spectacle.

Behavior:

* show overlay immediately when the renderer mounts;
* dismiss overlay on renderer idle when possible;
* hard timeout: **10 seconds**;
* if timeout is reached first, dismiss splash anyway;
* splash must not block interaction state initialization, preload registration, or future local data loading;
* no separate Electron splash window is maintained for P0.

Non-goals for P0 splash:

* branded motion trailer;
* update checks;
* login gate;
* blocking network requests;
* user-dismiss requirement.

## 11. Information Architecture

## 11.1 Workspace Object

Contains:

* workspace id;
* name;
* tabs;
* collections;
* settings;
* saved exports;
* source cache references;
* user trails.

## 11.2 Tab Object

Contains:

* tab id;
* title;
* seed;
* source mode;
* parent backlink;
* camera history;
* current layer;
* nodes;
* relations;
* local index;
* annotations;
* Agent runs;
* exports.

## 11.3 Source Object

Contains:

* URL or local reference;
* title;
* author if available;
* source type;
* retrieved time;
* extracted text;
* metadata;
* links;
* snippets;
* reliability hints.

## 11.4 Annotation Object

Contains:

* id;
* user action type;
* selected region;
* brush strokes;
* attached text;
* attached nodes;
* created time;
* linked AI outputs.

## 12. Success Metrics

## 12.1 Exploration Metrics

* user creates new seed from discovered content;
* user zooms across at least three layers;
* user uses lasso explanation;
* user follows a fog region;
* user saves or exports a selection;
* user returns to previous trail.

## 12.2 Quality Metrics

* generated map has source-backed nodes;
* relation types are explicit;
* duplicate sources are low;
* AI explanation references selected content correctly;
* user can understand current layer without reading documentation.

## 12.3 Performance Metrics

* panning and zooming remain smooth;
* local search returns quickly;
* tab switching is fast;
* AI jobs do not block UI;
* cached maps reload quickly.

## 13. Open Questions

1. Should constellation shapes be generated by Agent, selected from a fixed icon library, or both?
2. How far should MVP go into Unicode / dictionary depth?
3. Should local search be per-tab only or also workspace-wide?
4. Should web pages be stored as text snapshots, HTML snapshots, or both?
5. How should the app represent contradictions visually?
6. Should AI-generated fog regions be automatically expanded or only user-triggered?
7. Should daily topics be global news, user-selected areas, or local workspace-based?
8. How much browser behavior should be internal versus external system browser?
9. Should annotations be private by default even if sources are public?
10. What is the minimum acceptable citation format for generated Markdown?
