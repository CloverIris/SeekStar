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

### 3.5 From accidental browsing to structured serendipity

SeekStar should make accidental discovery possible, but not chaotic. Every discovery should remain source-backed, explainable, and exportable.

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

## 5.6 Constellation

A constellation is a domain-level shape identity.

At far zoom, a domain may be represented by a recognizable icon-like constellation. Example: music may resemble a guitar; biology may resemble a DNA helix; chemistry may resemble a flask.

Rules:

* far zoom: shape identity dominates;
* middle zoom: shape begins to dissolve into clusters;
* close zoom: semantic structure dominates;
* near content level: shape identity disappears.

The constellation is a road sign, not the truth of the data.

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
