# SeekStar Agent Operating Guide

## 0. Purpose

SeekStar is not a conventional search engine, chat interface, feed reader, or browser wrapper.

SeekStar is an AI-driven cognitive cartography system. Its purpose is to transform vague intent, unknown unknowns, web content, documents, words, glyphs, and user-selected regions into explorable spatial structures.

The Agent system must treat every user action as a possible act of exploration, not merely as an input requiring an answer.

The core product promise is:

> The user does not need to already know the right question. SeekStar helps the user discover what can be asked.

## 0.5 MVP Development Override

SeekStar is currently in MVP core-development mode.

When the user says that a path is obsolete, mock-only, or blocking the MVP, treat that as a deletion instruction unless there is a concrete safety reason not to. This is not a mature product with existing user data obligations. Old logic, old caches, old UI panels, old fallback data, fake buttons, mock layouts, radial/spiral artifacts, and stale product assumptions should be physically removed rather than hidden, softened, or preserved behind compatibility flags.

Do not "reduce noise" by merely not displaying old state. If the old path can re-enter the runtime, confuse the model boundary, resurrect cached mock scenes, or make the UI look like the previous prototype, delete the path and its cache/readback assumptions.

Current MVP spine:

* AI Cartographer is the primary L0-L3, Supra Macro, and recursive-seed terrain producer.
* AI-generated `cartographer_primary` terrain is the normal map material for L0-L3, not a suspicious fallback. Source-backed terrain is stronger provenance, not the only legitimate visible content.
* DataService validates, observes, and loads sources for AI and user actions; it is a reality probe and tool surface, not the main map generator.
* Failed AI-proposed URLs or source candidates must stay out of the main canvas. They may enter diagnostics/recovery queues, then be retried or replaced by AI.
* Level Runtime owns per-band data contracts, prompt profiles, chunk policy, and layout families. AI supplies semantic material; the runtime decides the product spatial contract.
* Pixi/App Framework render those contracts; they must not resurrect legacy radial, mock, DOM placeholder, debug-HUD, or old inspector-first layouts.
* Right sidebar work should become an AI map chat/control surface. Old inspector/debug sprawl should be removed from the default product path.
* Every level/band module should be CLI-testable with structured input, structured output, validation, and diagnostics. If a path cannot be tested outside the full Electron UI, it is not ready to be a core layer boundary.

For this phase, "stable" means the main exploration loop is coherent and testable. It does not mean maintaining forward compatibility with earlier mock-stage scenes, cached chunks, or UI experiments.

## 1. Non-negotiable Product Principles

### 1.1 Exploration before answer

Do not collapse exploration into a single answer unless the user explicitly asks for an answer.

The Agent should prefer to produce:

* fields of possibility;
* nearby topics;
* upper-level categories;
* lower-level subtopics;
* sibling concepts;
* source-backed content;
* unexplored fog areas;
* possible next questions.

### 1.2 Maps before lists

The primary output is not a ranked list. The primary output is structured spatial data that can be rendered into a map, grid, constellation, tile field, or zoomable content plane.

Lists may exist, but only as secondary support inside panels, inspectors, search results, summaries, and exports.

### 1.3 Sources before confidence

The Agent must not present unsupported claims as source-backed facts.

This does not mean unsourced AI terrain is secondary or hidden. In the MVP, AI-generated terrain is the primary map material for macro and source-orientation exploration. It must be marked with the correct source state and validated against the schema, but it should render as normal exploration terrain.

Every factual content node should prefer to carry:

* title;
* source URL or local source reference;
* source type;
* retrieval time;
* snippet or excerpt;
* confidence;
* relation type;
* reason for inclusion.

If no source exists, the node must be marked as `cartographer_primary`, `agent_inferred`, `weak_hypothesis`, `fog`, or another honest non-source-backed state. It should not claim `source_backed`.

If a generated URL fails DataService observation or cannot produce a usable tile surface, do not show it as a broken tile on the main canvas. Keep failure evidence in recovery/diagnostics and ask AI for a replacement candidate when appropriate.

### 1.4 Structure before style

The Agent produces cognitive terrain, not visual decoration.

The UI owns final rendering style. The Agent may suggest semantic roles, node types, relation types, confidence, importance, and layer placement. The Agent must not randomly decide visual colors, animations, icons, or layout rules unless explicitly asked by the architecture contract.

### 1.5 Infinite zoom must remain legible

SeekStar supports infinite Z-axis depth, but every Z transition must preserve orientation.

The Agent must always identify:

* current band or layer;
* parent / supra context;
* child / detail target;
* sibling regions;
* user’s current path;
* meaningful exits.

The visible product should not expose a brittle staircase of many text layers. L4-L10 style section, paragraph, sentence, phrase, word, character, Unicode, and dictionary detail belong inside Deep Lens unless a grain is promoted into a new recursive seed.

### 1.6 Unknown unknowns must not become hallucinated unknowns

The Agent may infer unexplored regions, but must distinguish:

* source-backed knowledge;
* semantic inference;
* weak hypothesis;
* user-created note;
* generated exploration prompt.

Unverified content must be visually and semantically marked as such.

## 2. System Roles

### 2.1 Observatory Host

The Electron application is the local observatory.

Responsibilities:

* own windows, tabs, panels, local state, file access, and session isolation;
* render the infinite canvas and 2.5D layer system;
* maintain user interaction history;
* store local indexes, snapshots, selections, annotations, and exports;
* coordinate Agent calls and Playwright tasks;
* enforce security and permission rules.

The host must not let remote web pages directly control core application state.

### 2.2 Scout

Playwright and DataService are the scout.

Responsibilities:

* validate AI-proposed URLs and source candidates;
* open and inspect pages when observation is requested;
* extract titles, snippets, visible text, metadata, links, publication dates, and page structure;
* distinguish HTML, PDF, image, and future file snapshots;
* take structured observations;
* report retrieval failures;
* expose source probing as a tool/MCP-style capability to the local AI agent;
* obey rate limits and safety constraints;
* avoid bypassing authentication, paywalls, anti-bot systems, or private content boundaries.

The scout fetches and observes. It does not decide meaning, rank truth, or generate the L0-L3 map.

### 2.3 Cartographer

The AI Agent is the cartographer.

Responsibilities:

* generate `cartographer_primary` L0-L3 terrain;
* generate Supra Macro context above L0 without using negative levels;
* classify retrieved content;
* detect parent, child, and sibling concepts;
* assign semantic relations;
* identify clusters and fog regions;
* generate level/band structures;
* expand same-band horizontal chunks as the user approaches viewport boundaries;
* decompose focused regions downward through band-specific prompts;
* summarize orphan content upward when parent context is missing;
* produce explanations for selected regions;
* generate learning paths, translations, summaries, and question sets;
* propose source candidates for DataService to validate;
* generate structured data that the renderer can consume.

The cartographer interprets. It does not perform raw rendering.

### 2.4 Telescope

The UI is the telescope.

Responsibilities:

* show cognitive lens effects;
* render XY spatial fields;
* handle semantic band movement and camera depth;
* provide lasso, brush, selection, search, tabs, sidebars, and inspectors;
* preserve orientation;
* make source traceability visible;
* make unknown regions attractive but not misleading.

The telescope focuses attention. It does not fabricate content, but it should eagerly display valid Cartographer terrain without waiting for every object to be source-backed.

### 2.5 Archivist

The local data layer is the archivist.

Responsibilities:

* save retrieved sources;
* save generated structures;
* save user trails;
* save notes and annotations;
* save exported Markdown;
* save tab histories;
* save content indexes;
* preserve source provenance.

The archivist remembers. It does not reinterpret without Agent request.

## 3. Agent Types

SeekStar may use one general Agent at the MVP stage, but its behavior must be separated into logical modes.

### 3.1 Seed Mapper

Input:

* seed keyword;
* natural language prompt;
* selected text;
* selected node;
* current canvas region;
* daily topic package.

Output:

* parent fields;
* sibling fields;
* child fields;
* candidate search terms;
* initial spatial schema;
* fog regions;
* confidence labels.

Purpose:
Generate the first explorable map.

### 3.2 Web Scout Planner

Input:

* current seed;
* map gaps;
* selected fog region;
* user intent;
* existing sources.

Output:

* search query set;
* search priority;
* source type targets;
* stop conditions;
* deduplication criteria.

Purpose:
Plan what Playwright should search next.

### 3.3 Source Distiller

Input:

* raw page text;
* title;
* URL;
* page metadata;
* extracted links;
* retrieval timestamp.

Output:

* concise source card;
* main claims;
* keywords;
* entities;
* relation candidates;
* source type;
* reliability hints;
* useful excerpts.

Purpose:
Turn raw web observations into usable content nodes.

### 3.4 Layer Cartographer

Input:

* current layer;
* user viewport;
* node set;
* relation set;
* selection history;
* zoom direction.

Output:

* layer label;
* parent layer;
* child layer;
* sibling regions;
* node grouping;
* edge grouping;
* constellation assignment;
* semantic axes;
* Z-depth transition hints.

Purpose:
Maintain infinite-layer coherence.

### 3.5 Region Explainer

Input:

* lasso selection;
* brush highlights;
* selected nodes;
* selected text blocks;
* user question or preset prompt.

Output:

* explanation;
* cited source chain;
* concept bridge;
* contradictions;
* key takeaways;
* next questions;
* Markdown export.

Purpose:
Explain a selected region as a local universe.

### 3.6 Token Explorer

Input:

* word;
* phrase;
* character;
* Unicode code point;
* selected glyph;
* dictionary source.

Output:

* meaning;
* etymology if available;
* translation;
* usage examples;
* related terms;
* seedable keyword forms;
* link back to original document context.

Purpose:
Allow the user to zoom from content into language itself.

### 3.7 Learning Path Generator

Input:

* selected region;
* known user level if available;
* goal;
* available sources;
* time horizon.

Output:

* ordered learning path;
* prerequisites;
* milestones;
* first-reading list;
* practice prompts;
* next exploration seeds.

Purpose:
Turn exploration into study.

## 4. Core Data Contract

Agent outputs must be structured. The UI may render them differently, but the semantic contract should remain stable.

### 4.1 Node

A node represents one visible or addressable unit.

Node types:

* domain;
* topic;
* subtopic;
* concept;
* question;
* source;
* webpage;
* document;
* section;
* paragraph;
* sentence;
* phrase;
* word;
* character;
* unicode;
* dictionary_entry;
* annotation;
* user_note;
* generated_summary;
* fog_region;
* constellation_anchor.

Required fields:

* id;
* type;
* title;
* layer;
* source_state;
* confidence;
* importance;
* tags;
* created_at;
* updated_at.

Recommended fields:

* summary;
* source_url;
* source_title;
* source_type;
* retrieved_at;
* parent_id;
* child_ids;
* relation_ids;
* semantic_axes;
* position_hint;
* icon_hint;
* language;
* token_range;
* text_range;
* html_selector_hint;
* quote;
* markdown_ref.

### 4.2 Relation

Relations must have explicit types.

Relation types:

* semantic_similarity;
* parent_child;
* sibling;
* citation;
* hyperlink;
* same_author;
* same_institution;
* same_event;
* chronological_sequence;
* contradiction;
* supports;
* critiques;
* toolchain;
* prerequisite;
* translation;
* etymology;
* token_contains;
* source_contains;
* user_selected;
* agent_inferred.

Required fields:

* id;
* from;
* to;
* type;
* confidence;
* explanation;
* source_state.

### 4.3 Layer

Layers and bands are semantic depths, not merely zoom values.

The old canonical 12Level ladder remains useful as an internal address vocabulary and migration reference:

* L0: 领域 / Star Gallery / seed pool;
* L1: 主题;
* L2: 来源;
* L3: webpage / document / PDF / image tile;
* L4: section;
* L5: paragraph;
* L6: sentence;
* L7: phrase;
* L8: word / keyword;
* L9: character;
* L10: Unicode / dictionary;
* L11: term-as-new-seed loop.

The MVP product target is no longer a visible 12-step UI ladder. The user-facing runtime is modular:

* Supra Macro: broader systems and parent domains above L0.
* L0 Star Gallery: domain seed pool and broad exploration field.
* L1 Topic Field: topic neighborhoods and same-layer branches.
* L2 Source Orientation: source directions, reference families, communities, repositories, papers, and trails.
* L3 Tile Field: webpage, article, PDF, image, and document candidates or source-backed tiles.
* Deep Lens: section, paragraph, sentence, phrase, word, character, Unicode/dictionary, and future byte/hex inspection inside one close-reading mode.
* Recursive Seed: any selected grain, region, link, file, image region, or text span becomes a new exploration universe.

The runtime must be extensible. The UI must not assume a hard maximum or force every text granularity into its own visible product layer.

### 4.4 Constellation

A constellation is a domain container with a shape identity.

Required fields:

* id;
* title;
* domain;
* icon_shape;
* anchor_nodes;
* member_nodes;
* skeleton_strength;
* semantic_strength;
* visual_weight;
* semantic_axes;
* source_state.

Rule:
At far zoom, icon shape may dominate. At close zoom, semantic relations must dominate.

### 4.5 Fog Region

A fog region represents visible unknown space.

Fog types:

* semantic_fog;
* temporal_fog;
* controversy_fog;
* long_tail_fog;
* cross_domain_fog;
* source_gap_fog;
* user_unexplored_fog.

Required fields:

* id;
* label;
* reason;
* relation_to_current_view;
* suggested_seed_terms;
* confidence;
* expansion_cost;
* expected_value.

## 5. Agent Workflow

### 5.1 Startup

On launch:

1. Load user workspace.
2. Load recent tabs and saved trails.
3. If no workspace exists, generate or load an opening star field.
4. Use daily topics, user seed collections, or default exploration packs as initial material.
5. Render fog regions instead of pretending that the map is complete.

### 5.2 New seed tab

When the user enters text and chooses “as new exploration seed”:

1. Create a new independent tab.
2. Do not inherit the previous tab’s navigation history.
3. Use the text as the seed context.
4. Ask AI Cartographer to bootstrap Supra Macro, L0, L1, and L2 by default; L3 candidates may be prepared when useful.
5. Render valid `cartographer_primary` terrain immediately after schema validation.
6. Ask DataService to validate only the URL/source candidates that need reality probing.
7. Promote successful observations into source-backed L3 tiles.
8. Hide failed candidates from the main canvas and keep them in recovery/diagnostics.
9. Preload nearby chunks according to settings.

### 5.3 Search within current tab

When the user enters text and chooses “search within this tab”:

1. Search indexed content in the current tab.
2. Highlight matches.
3. Show keyword result cards.
4. Each card must include snippet, location, source, layer, and match type.
5. Clicking a result moves the camera to that exact content region.
6. This action must not create a new tab.

### 5.4 Hyperlink click

When the user clicks a hyperlink in content:

1. Open the link in a new tab.
2. Do not inherit the previous tab history.
3. Preserve a backlink to the origin node.
4. Mark the new tab as hyperlink-derived.
5. Keep original context available in the side panel.

### 5.5 Viewport edge expansion

When the user approaches an edge:

1. Detect that the active viewport is near the prepared chunk boundary.
2. Request AI Cartographer `expand_horizontal` for the next same-band chunk.
3. Preload one or two rings when settings allow.
4. Run DataService only for source candidates that require observation.
5. Add new structures in the direction of travel without re-laying out the entire map.
6. Put distant chunks to sleep, cache them, or evict them when budgets are exceeded.
7. Preserve spatial memory and avoid visible chunk seams.

### 5.6 Z-axis transition

When the user zooms in:

1. Determine whether the next semantic band should be revealed.
2. Fade the current band into context.
3. Generate or hydrate child/detail terrain through the band module.
4. Keep parent/supra context visible.
5. Enter Deep Lens for text/content detail instead of marching through many visible text layers.

When the user zooms out:

1. Collapse child nodes into summaries.
2. Fade lower band detail to zero or near-zero opacity.
3. Reveal parent region.
4. Preserve the user’s trail.

### 5.7 HTML content zoom

At document level:

1. Render content as a non-overlapping tiled plane.
2. Maintain internal scale inside each tile.
3. Absorb a focused tile into a browser/document surface when the user chooses or crosses the threshold.
4. Use Deep Lens for section, paragraph, sentence, phrase, word, character, Unicode/dictionary, and future byte/hex inspection.
5. Every lower-level address path must preserve source location when it came from a source-backed tile.
6. Any phrase, word, character, image region, paragraph, sentence, or selected grain can become a recursive seed.

### 5.8 Lasso and brush AI action

When the user lassos content:

1. Freeze selection.
2. Collect selected nodes, text ranges, source refs, annotations, and visible context.
3. Let the user choose a preset prompt or enter a question.
4. Generate a structured answer.
5. Show the answer in the side panel.
6. Allow export to Markdown.
7. Allow selected items to be dragged into the seed tray or collection tray.

When the user brushes content:

1. Treat brush marks as attention weights.
2. Preserve brush annotations.
3. Use brush weights to guide explanation priority.

## 6. Prompt Presets

Default presets:

* Explain this region.
* Summarize this region.
* Translate selected text.
* Generate learning path.
* Extract key questions.
* Find contradictions.
* Find source chain.
* Expand nearby unknowns.
* Turn selection into new seed.
* Compare selected clusters.
* Explain as beginner.
* Explain as expert.
* Export as Markdown brief.

Each preset must be editable.

## 7. Research-first Rule

Before implementing a custom subsystem, the project must first investigate existing libraries, prior art, and official documentation.

Subsystems requiring research before custom implementation:

* Electron tab architecture;
* browser isolation and security;
* Playwright search and extraction;
* 2D GPU rendering;
* infinite canvas;
* graph layout;
* force simulation;
* local search;
* fuzzy search;
* full-text indexing;
* vector search;
* annotation tools;
* lasso/brush interactions;
* Markdown export;
* citation management;
* HTML parsing;
* Unicode and dictionary lookup;
* local storage;
* agent orchestration;
* cost monitoring;
* tracing and logging.

Deliverable:
Each major technical choice must have a short decision record:

* problem;
* considered libraries;
* official docs checked;
* constraints;
* chosen approach;
* rejected approaches;
* reason for not building from scratch, or reason custom work is justified.

## 8. Library Evaluation Policy

The team must prefer proven libraries when they cover commodity infrastructure.

Build custom only when:

* SeekStar’s interaction is genuinely novel;
* existing libraries cannot handle the required scale;
* existing libraries block the visual language;
* dependency risk is unacceptable;
* integration cost exceeds custom implementation cost.

Candidate categories:

* Desktop host: Electron.
* Browser automation: Playwright.
* 2D rendering: PixiJS or equivalent GPU canvas renderer.
* Infinite canvas and annotation: tldraw-style SDK evaluation required.
* Graph visualization: Cytoscape.js, Sigma.js, React Flow, Graphology, or equivalent.
* Force layout: D3 Force or equivalent.
* Layered graph layout: ELK.js or equivalent.
* Local fuzzy search: Fuse.js.
* Local full-text search: MiniSearch or equivalent.
* Async state and caching: TanStack Query or equivalent.
* Persistence: local database or document store to be evaluated.
* Agent orchestration: Responses API / Agents SDK / custom orchestrator to be evaluated.

## 9. Safety and Trust Rules

### 9.1 Web access

The Agent must not:

* bypass paywalls;
* bypass authentication;
* scrape private user accounts without explicit permission;
* ignore robots, rate limits, or site rules;
* disguise itself as the user in unsafe ways;
* silently download unknown files;
* execute untrusted scripts as application logic.

### 9.2 User data

The Agent must:

* keep user-created notes separate from fetched web data;
* mark local-only data;
* request permission before sending private selections to external AI APIs if privacy mode requires it;
* allow deletion of local trails and cached content.

### 9.3 Source reliability

The Agent must:

* distinguish primary sources, secondary reports, community posts, and generated summaries;
* show uncertainty;
* avoid overclaiming;
* preserve source links;
* allow users to inspect source provenance.

## 10. Performance Principles

The Agent should not drive real-time animation.

The local UI handles:

* panning;
* zooming;
* fisheye lens;
* opacity transitions;
* hit testing;
* selection;
* highlighting;
* tile rendering.

The Agent handles:

* map generation;
* structure expansion;
* source distillation;
* region explanation;
* prompt execution;
* export generation.

Agent calls should be:

* interruptible;
* cancellable;
* resumable when possible;
* visible in a job queue;
* cost-aware;
* cached when possible.

## 11. Output Style

Agent text should be concise, structured, source-aware, and spatially grounded.

Good:

* “This region connects AI role design with virtual identity systems. The strongest bridge node is X. The uncertain fog region to the right likely contains Y.”

Bad:

* “Here is everything about AI role design.”

The Agent should explain what the user is looking at, why it matters, and where they can go next.
