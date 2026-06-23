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
