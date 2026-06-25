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

### 3.9 Three focal bands are SeekStar

SeekStar is the telescope and the star map together. The product should be understood as three continuous focal bands:

* **Star Gallery** is the macro / domain band. It is where domains, topic regions, fog, weak possibilities, and candidate stars become navigable before the user knows the right query.
* **Tile Field** is the content band. Confirmed webpages, documents, papers, encyclopedia entries, and source snapshots appear as full tile-based surfaces, not ranked result lists.
* **Text Grain** is the detail band. Sections, paragraphs, sentences, phrases, words, characters, Unicode detail, and dictionary entries are individually inspectable and seedable.

Zooming in means moving toward detail. Zooming out means recovering macro orientation. Horizontal movement means exploring adjacent existence and frontier possibilities on the same semantic layer. Clicking, lassoing, brushing, dragging, and viewport movement are telescope operations first; search and chat are supporting actions.

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

## 5.0 Product Surface Model

The product surface must stay map-first:

* the macro domain layer is experienced as Star Gallery;
* the content layer is experienced as a tile field of source-backed webpages and documents;
* the detail layer is experienced as clickable text grains, down to individual keywords, words, characters, and dictionary / Unicode detail.

Every visible object belongs to a scene, data pool, and derived object pool. Rendering surfaces subscribe to those structures. User actions pass through typed events that mutate objects or request Scout observations. The UI must not depend on AI to decide frame-by-frame interaction.

AI enters where organization, synthesis, explanation, or uncertain adjacent possibilities are needed. Heuristics, local source parsing, object pools, and Playwright Scout observations should carry as much of the ordinary exploration loop as possible before asking a model.

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

Canonical 12Level ladder:

* L0: 领域 / Star Gallery / seed pool;
* L1: 主题;
* L2: 来源;
* L3: 网页 / 文档 / PDF / 图片 tile;
* L4: 章节 / section;
* L5: 段落;
* L6: 句子;
* L7: 短语;
* L8: 词语 / keyword;
* L9: 字符;
* L10: Unicode / 字典;
* L11: selected grain as a new exploration seed.

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

Layers L0 and L1 use a dense Star Gallery bubble lens: colorful but restrained solid bubbles clustered in a semantic field. The center of the viewport is larger, clearer, and more readable; the edge becomes smaller, dimmer, and eventually fades. This is a cognitive orientation surface, not decoration.

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

* L0: domain seed pool, constellation shape, and bubble lens dominate;
* L1: topic bubbles and adjacent unknown frontiers dominate;
* L2: source clusters hand off from Star Gallery into content intake;
* L3 and deeper: document tiles and text grains replace macro bubbles as the primary visual form.

## 5.7 Tile Field

At webpage and document level, content appears as non-overlapping flat tiles on an infinite plane.

The tile field behaves like:

* Windows 10 Phone live tiles: asymmetric blocks, clear grouping, and strong scan rhythm;
* Windows 11 task view: many live surfaces visible at once without becoming a ranked result list;
* an infinite canvas;
* a document wall.

Each tile can be zoomed internally. Page tiles contain sections; sections contain paragraphs; paragraphs contain sentences; sentences contain phrases; phrases contain words; words contain characters.

Tile density:

* the default same-viewport target is 25 tiles;
* the tile count is configurable in Settings;
* off-viewport tiles do not load embedded webpage/document renderers;
* near-viewport tiles may keep lightweight thumbnails, metadata, and source state only;
* focused tiles receive loading priority.

Browser absorption mode:

* when zooming toward a focused L3 tile, the tile grows until it occupies more than 80% of the viewport;
* after crossing that threshold, SeekStar animates the tile to the viewport center, matches tile size to the viewport, and snaps it into a full browser-like surface;
* clicking the focused tile before the threshold runs the same absorption animation directly;
* while absorbed, the embedded webpage/document owns scroll and pointer behavior, so mouse wheel no longer drives SeekStar zoom;
* a half-hidden top label must remain visible: "Click exit browser mode to keep exploring downward";
* exiting browser mode returns wheel ownership to SeekStar and continues semantic descent into L4 section, L5 paragraph, L6 sentence, L7 phrase, and L8 word terrain.

Hyperlinks inside absorbed tiles:

* normal hyperlink activation opens a new SeekStar tab at the absorbed webpage/document tile level;
* the origin tab remains unchanged and stores backlink context;
* an explicit external-browser action remains available;
* when a link creates an orphan tile without enough upper-layer context, upward exploration requests AI Service to summarize or synthesize the missing parent topic/source context as structured Cartographer output, marked with the correct source state.

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

## 9.5 Superseded Prototype Notes

Earlier local-only Cartographer and visual-spine prototypes are no longer part of the product path. P5.8 removed renderer-local preview output, and P5.9 moved core semantics into the Constellation Engine.

The retained product boundary is:

* Playwright Scout returns observations or source snapshots, not terrain facts.
* AI Service returns structured Cartographer output only through a real service boundary.
* Source-backed terrain requires explicit conversion into `SourceRef`, nodes, relations, and provenance.
* The renderer must not fabricate explanations, learning paths, comparisons, exports, or source distillation.

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

This phase is aggressive about moving beyond prototype visuals, but it still preserves SeekStar's core boundary: map over list, observations before facts, Playwright as Scout, and explicit source conversion.

## 9.14 P4.7 Source-Anchored Linked Frontier

P4.7 lets a source-backed node act as a telescope anchor.

* Source evidence cards may expose `Scout linked frontier` when the node has a confirmed `SourceRef` URL.
* The Electron Scout adapter uses Playwright `page_outlinks` mode to observe candidate links from that confirmed page.
* Returned links become same-layer Scout candidate stars positioned around the source node.
* Candidate stars are not facts, are not ranked results, and are not source-backed terrain until the user confirms conversion.

This improves the real discovery loop without adding browser navigation, chat, AI summarization, or automatic meaning decisions.

## 9.15 P5.1 Exploration Runtime And Scene Validation

P5.1 aligns engineering structure with `PHILOSOPHY.md` / `PHILOSOPHY.zh.md`:

* renderer exploration state moves out of monolithic `App.tsx` into `useExplorationSession`;
* Scout closure remains the primary real-data loop: direct URL, frontier discovery, linked outlinks, user-confirmed conversion;
* `TerrainScene` hydrate, patch apply, and workspace save pass `validateTerrainScene` / `normalizeTerrainScene`;
* typed exploration services own scene mutations and Scout plan orchestration;
P5.1 does not add real HTML tile parsing, heuristic keyword expansion, real AI calls, or a global event bus. Those belong to P5.2+ and must extend the exploration runtime instead of bypassing it.

## 9.16 P5.2 Evented Layer Runtime

P5.2 starts the runtime needed for the real multi-layer telescope.

The three product bands are explanatory focal ranges, not the full layer model:

* Star Gallery describes macro orientation.
* Tile Field describes source-backed content surfaces.
* Text Grain describes close reading.

The actual runtime spine is the canonical L0-L11 12Level ladder: domain seed pool, topic, source, webpage/document tile, section, paragraph, sentence, phrase, word, character, Unicode/dictionary, and recursive new seed.

P5.2 adds:

* canonical semantic layer definitions in `@seekstar/core-schema`;
* shared deep-zoom stops used by the canvas;
* typed exploration events for selection, viewport movement, layer changes, and Scout observation intake;
* a derived object pool indexing nodes, relations, sources, Scout observations, layer membership, and source-state counts.

P5.2 does not add real HTML parsing, persistent object storage, model calls, vector search, or a full pub/sub framework.

The fastest next product path after P5.2 is:

1. convert confirmed source snapshots into L3-L8 terrain;
2. make phrase / word / character grains seedable;
3. add heuristic keyword and adjacent-possibility suggestions before relying on AI;
4. attach real AI Cartographer calls behind the same event and validation path.

## 9.17 P5.3 Source Snapshot Terrain

P5.3 begins the next product breakthrough: source material becomes zoomable terrain.

The first implementation converts manually provided text and user-confirmed Scout snippets into source-backed nodes:

* L2 source anchor;
* L3 document / webpage tile;
* L4 section;
* L5 paragraph;
* L6 sentence;
* L7 phrase;
* L8 word.

Generated source terrain preserves source metadata, source ranges, token ranges where available, `source_contains` relations, and zoom targets. Phrase and word grains can become new exploration seeds.

P5.3 does not yet implement full HTML DOM parsing, page styling, asset capture, browser rendering, L9 character generation, L10 Unicode / dictionary lookup, or AI source distillation. It deliberately gets the telescope loop working first: a real source enters the map, the user zooms into text grains, and grounded grains become future Scout or Cartographer anchors.

## 9.18 P5.4 Character Unicode Seed Loop

P5.4 extends source-backed close reading beyond words.

For generated L8 word nodes, the system now creates bounded child grains:

* L9 character nodes;
* L10 local Unicode / dictionary cards.

L9 character nodes are source-backed because the character exists in the source text and preserves a source range. L10 Unicode / dictionary cards are local deterministic expansions, not external dictionary facts, so they remain `local_only`.

P5.4 keeps the node count bounded by expanding only a small number of characters per word. This proves the telescope path without making long pasted sources unreadable.

P5.4 does not add full external dictionary lookup, translation, morphology, corpus examples, or a dedicated `grain.seed.created` event.

## 9.19 P5.5 Heuristic Candidate Pool

P5.5 adds a local candidate pool before real AI calls.

When a confirmed source enters the map, SeekStar derives seedable candidate concepts from source-backed paragraph, sentence, phrase, and word grains. These candidates appear as L1 concept nodes around the source context.

Rules:

* candidates are `local_only`, not source-backed facts;
* candidates preserve source range and token range for traceability;
* candidates are seedable;
* candidate relations are `semantic_similarity` and `local_only`;
* the system must not present candidates as ranked search results or AI conclusions.

P5.5 does not add vector search, real AI keywording, automatic Scout execution, workspace-wide candidate ranking, or user-tunable extraction settings.

## 9.20 P5.6 App Framework Tab Runtime

P5.6 starts the real desktop app framework:

* Electron main owns `TabRecord`, per-tab session partitions, folders, settings, cache budgets, detached windows, and crash records;
* Playwright Scout runs as a background service with per-tab context reuse and utility-process isolation when available;
* the renderer talks through narrow preload APIs for tabs, settings, Scout, and workspace storage;
* the JSON workspace store is treated as a replaceable `WorkspaceStore` API, not as the future database design.

P5.6 does not migrate to SQLite/FTS and does not make every main-window tab renderer isolated.

## 9.21 P5.7 Main-Window Tab Docking

P5.7 makes the Chrome-like tab model real inside the main window.

The main observatory shell owns:

* title bar;
* workspace and folder sidebar;
* tab controls;
* settings;
* the dock rectangle for the active telescope tab.

The active tab owns:

* telescope workbench;
* Pixi terrain canvas;
* command composer;
* inspector;
* per-tab scene hydration and save merge.

Electron main docks the active tab's `WebContentsView` into the shell-provided rectangle using `runtimeSurface=docked`. Detached windows use `runtimeSurface=detached`. A tab renderer crash should be recorded on the tab and replaced with local crash HTML without destroying the shell.

P5.7 also stops using preview seed terrain for new tabs. New seed tabs now start as local deterministic `local_only` / `fog` objects on the canonical L0-L11 12Level telescope spine. They are seedable and structured, but they do not claim source-backed facts or AI synthesis before Scout/source intake happens.

## 9.22 P5.8 Pixi Runtime Spine And Simulated Path Removal

P5.8 is a destructive prototype cleanup.

SeekStar removes renderer-local Cartographer and region-action preview behavior from the product path. The product should not fabricate local explanations, questions, learning paths, comparisons, exports, source distillation, or adjacent path maps while those capabilities do not have a real service boundary.

P5.8 keeps only real local telescope operations:

* pan, zoom, layer movement, selection, and lasso;
* saving selected context;
* creating a new seed from a selected region or grain;
* manual source intake;
* Playwright Scout observations;
* user-confirmed conversion of observations into source-backed terrain.

The workspace snapshot schema intentionally drops deprecated region action state. Earlier local snapshots are not considered compatible in this prototype slice.

P5.8 also begins moving core presentation logic behind a PixiJS runtime boundary. React remains the shell and control surface. PixiJS owns the telescope stage, and a projection layer decides which terrain objects, relations, and Scout candidates enter the stage for the current viewport.

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

## 14. P5.9 Modular Runtime Direction

P5.9 establishes the corrected product architecture:

* App Electron Framework: desktop shell, windows, tab surfaces, settings, IPC, and service hosting.
* Constellation Engine: the SeekStar core. It owns telescope events, object pools, semantic layers, tab scene state, service requests, and Pixi projection data.
* Scout / DataService: Playwright-backed observation and source snapshot service.
* AI Service: encrypted key boundary, context management, structured Cartographer output, and unavailable status when not configured.
* Storage / Cache Service: JSON adapter now, SQLite/FTS and cache policy later.

The Constellation Engine has two internal layers:

* Constellation Core: domain events, object-pool mutation, scene state, source and AI service ports.
* Pixi Runtime Adapter: renderable terrain projection, visible relation filtering, candidate observation placement, and later hit-testing/draw commands.

Each module must have a terminal harness that accepts structured parameters and returns structured JSON. These harnesses are for protocol verification, not product fallback behavior.

## 15. P5.10 Engine-Owned Terrain Direction

P5.10 continues reducing App coupling:

* seed scene scaffolding belongs to the Constellation Engine;
* source snapshots become source-backed terrain through `source.snapshot.ingested`;
* text grains and heuristic candidate seeds are generated inside the engine;
* Pixi interaction math belongs to the Pixi Runtime Adapter;
* desktop React components subscribe, render controls, and forward events, but do not own terrain semantics.

The engine exposes service ports for Scout, AI, Storage, and source snapshot services so future implementations can move behind Electron utility processes, SQLite/FTS, native modules, or remote APIs without changing the product semantics.

## 16. P5.11 Web Tile Field Direction

P5.11 defines L3 content terrain as a real tile field:

* webpage/document/PDF/image tiles use a Windows 10 Phone-style asymmetric tile layout and Windows 11 task-view-style live surface density;
* the default visible density is 25 tiles per viewport and is configurable;
* off-viewport tiles do not load embedded webpage/document renderers;
* a focused tile can absorb the viewport after crossing 80% viewport area or when clicked;
* absorbed tiles temporarily own scroll and pointer input like a browser;
* SeekStar keeps an exit label so the user can return control to the telescope and continue downward exploration;
* hyperlinks inside absorbed tiles open new SeekStar tabs at the webpage/document tile level with backlink context;
* orphan parent context is filled only through AI Service as structured, marked Cartographer output.

Implementation status as of P5.17:

* the core schema now carries `TerrainScene.runtime` for focused tile and browser absorption state;
* `SourceSnapshot` is a shared protocol for Scout, Constellation Engine, Storage snapshots, and desktop boundaries;
* Scout observations can carry final URL, content type, visible text, outlinks, media candidates, source type, and retrieval time;
* `SearchCandidate` is now a shared protocol for web-search and page-outlink discovery; it represents possible sources, not source-backed terrain;
* Scout/DataService has a provider registry boundary: source observers produce `SourceSnapshot`, search/outlink providers produce `SearchCandidate`, and API/authority/browser-assisted/URL-only providers register without changing the renderer or terrain engine;
* content provider settings now expose default active arXiv, GitHub, Wikipedia, Wikidata, and local Playwright browser-assisted discovery, with Zhihu and Runoob built in as disabled URL-only providers;
* the Electron Scout worker now delegates to the Scout/DataService package instead of owning a duplicate browser-search implementation;
* source terrain ingestion stores structured snapshots and uses snapshot visible text before falling back to snippets;
* text-grain terrain is generated through a materialization profile instead of fixed demo-sized caps;
* command input treats direct `http`/`https` URLs as real source intake: add to current Seek runs Scout and creates a source-backed L3 tile, while open as new Seek creates an active tab and ingests the page at L3;
* direct URL Scout writeback now targets the intended tab scene, so a new URL tab does not remain a local seed map after asynchronous Scout completion;
* the main content projection distinguishes domain gallery, source intake pending, source intake failed, source-backed tile field, browser absorption, text grain, and empty source field states;
* visible/focused L3 tiles can be prewarmed as offscreen thumbnails without stealing telescope input;
* clicking an already focused L3 tile and crossing the 80% viewport threshold first play a tile absorption transition, then commit the Constellation Engine absorption event;
* absorbed tiles use Electron native live surfaces only after absorption is committed and retain the top exit label;
* hyperlink-created tabs now run direct URL Scout, ingest the observed page as source-backed terrain, and open at L3 webpage/document tile level;
* Storage Service workspace change notifications now propagate saved source intake across docked and detached tab renderers without forcing tab refresh;
* Constellation Engine now owns workspace hydrate/persist merge rules through `WorkspacePersistenceCoordinator`;
* Constellation Engine now owns Scout job execution/writeback rules through `ScoutJobCoordinator`;
* Constellation Engine now owns open/close/reorder/activate tab-session transactions through `TabSessionCoordinator`;
* default New Seek L3 terrain remains local placeholder terrain until Scout or source intake provides a `sourceUrl`; only source-backed L3 webpage/document nodes produce tile surfaces or enter live browser absorption;
* remaining usability work is PDF/image-specific snapshot extraction, encrypted provider key handling, viewport-demand text materialization, remaining shell tab-registration/reset helper decoupling, and AI parent-context patches for orphan linked pages.
