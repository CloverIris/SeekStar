# SeekStar Product Requirements Document

Version: 0.2
Status: P6 MVP reset baseline
Product name: SeekStar / 寻星
Product type: Electron-based AI cartographic telescope
Primary mode: chunked 2.5D semantic star map
Primary goal: Discover unknown unknowns before formal questioning

## 1. Product Summary

SeekStar is an AI-driven cartographic telescope that transforms vague intent, AI-organized concepts, web content, documents, language, and user selections into an infinite zoomable cognitive map.

Instead of asking the user to precisely describe intent in a blank search box, SeekStar lets the user begin with a seed, a question, a webpage, a daily topic, a selected word, or a lassoed region. The AI Cartographer then constructs and extends a layered semantic field that can be panned, zoomed, selected, explained, expanded, validated, and exported.

SeekStar’s core experience is:

> The user enters or encounters a vague direction. AI turns it into a navigable star field. DataService probes real source candidates when needed. The user zooms, drifts, selects, annotates, and discovers what they did not know they could ask.

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

### 3.10 MVP destructive reset doctrine

MVP development must optimize for a coherent usable telescope loop, not compatibility with earlier mock-stage work.

Old product paths must be removed when they contradict the P6 design:

* old renderer-local Cartographer previews;
* old radial / spiral / hub-and-spoke macro layouts;
* old caches that can resurrect obsolete scenes;
* fake buttons, placeholder controls, and inspector/debug panels that do not serve the new mainline;
* fallback source/search behavior that makes DataService look like the map generator;
* visible broken URL tiles or failed candidates in the main canvas.

This phase has no installed user base to protect. "Stable" means the current exploration loop is coherent, testable, and shippable as an MVP, not that old snapshots or prototype UI continue to load.

### 3.11 AI-generated terrain is the default map material

For L0-L3, AI Cartographer is the default producer and organizer of the visible map. Its schema-valid output enters the terrain as `cartographer_primary`.

Source-backed content remains essential, but its role is stronger provenance and real material contact, not permission for a node to exist. DataService verifies source candidates, loads pages/PDFs/images, and exposes observations back to the map. A failed source candidate is not shown as a broken tile; it is recorded in recovery/diagnostics and may ask AI for replacement candidates.

The product contract is:

```text
AI Cartographer proposes and organizes terrain
-> Level Runtime validates shape, density, and layout family
-> App Framework / Pixi render the telescope field
-> DataService probes source candidates when reality contact is needed
-> successful observations become source-backed tiles
```

### 3.12 Opening sky and domain hint priority

The default New Seek tab should feel like removing the cover from a telescope at night: the user should immediately see a generated sky, not an empty search shell waiting for a keyword.

For a brand-new tab with no user seed, SeekStar uses `default_tonight_sky` bootstrap context. The AI Cartographer asks for recent, lively, and potentially meaningful fields, then creates the first visible opening sky as Supra Macro plus L0 Star Gallery. L1, L2, and L3 are generated on demand from focus, viewport position, and exploration movement rather than all being generated during first paint. This starting sky is intentionally exploratory and slightly stochastic, so reopening or refreshing the default tab can lead to a different field of discovery without immediately spending tokens on every deeper band.

Preset domain lexicons are not visible default nodes. They are high-quality prompt hints, similar to a news site's section vocabulary such as technology, finance, science, culture, and society. They help the AI orient the opening sky, but they do not fence the map and do not replace AI free exploration.

The product setting `domain_hint_mode` controls this:

* `guided` is the default. Enabled domain terms are sent as opening-sky prompt hints, and the AI is still expected to freely enumerate fresh neighboring possibilities.
* `pure_ai` sends no preset domain hints. The AI chooses the opening sky from current model knowledge, user context, and the product's exploration brief.

User-entered seeds, selected text, Deep Lens grains, hyperlinks, and orphan-page recursive seeds do not use the default opening-sky mechanism. They already have a concrete exploration center.

### 3.13 Real AI product path

The product path does not use mock terrain. Settings default to the DeepSeek OpenAI-compatible provider, and provider configuration supports a direct masked API key value with environment variable fallback. If no usable key is available, Cartographer transactions must fail with explicit `missing_key` or configuration diagnostics rather than fabricating a star map.

Deterministic generators may exist only as tests or fixtures. They must not appear in default settings, visible provider lists, route defaults, runtime fallback, cached user scenes, or main-canvas material.

### 3.14 Continuous telescope terrain

SeekStar's L0-L3 bands are not nested boxes. They are different focal lengths over one continuous semantic terrain.

Zooming from L1 into L2 should preserve the viewport's semantic position and directional neighborhood. If the user enters L2 through an L1 "cars" region and then pans toward the former L1 direction of "airplanes", the L2 field should gradually shift toward aircraft parts, aviation sources, and aircraft-oriented source directions. When the user zooms back out, the upper band should surface near the current semantic position, not at the original "cars" entry point.

Ordinary L0/L1/L2/L3 zoom and pan therefore stay inside the same scene, coordinate plane, and tab. The runtime should pass focus anchors, nearby upper-band anchors, movement vectors, and viewport/chunk coordinates into Cartographer requests. If lower-band exploration reaches a place that lacks an upper-band node, `summarize_up` should write that missing context back into the existing upper terrain instead of creating a parallel orphan universe.

Orphan and recursive-seed tabs are reserved for genuinely unparented entries: external hyperlinks, direct URLs, local files, source-backed pages opened from outside the current semantic position, or Deep Lens grains promoted into new worlds.

### 3.15 Token and prefetch discipline

Exploratory AI should feel heuristic and alive, but it must not behave like an uncontrolled full-depth crawler.

MVP generation policy:

* opening sky bootstraps only Supra Macro plus L0;
* L0 and L1 may use a small adjacent prefetch ring for smooth macro exploration;
* L2 and L3 are generated on demand and do not run default AI preload;
* failed-source replacement does not trigger neighbor preload;
* each request sends only the active module, current focus, nearby anchors, compact chunk policy, and a small scene summary;
* full prompt profiles, all-level module definitions, long response previews, and distant node lists must stay out of ordinary model calls.

AI Service remains the provider and validation boundary. Level Runtime owns prompt compression, per-band target counts, source-candidate policy, layout family, and cache keys. The App Framework owns when a request is allowed to run.

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

* the macro domain layer is experienced as Star Gallery and is primarily AI-cartographed;
* the topic/source-orientation layers are AI-organized semantic terrain;
* the content layer is experienced as a tile field of source-backed webpages, documents, PDFs, images, and page/document surfaces;
* source-backed tiles are created only after DataService can load or observe the candidate;
* the detail layer is experienced as a Deep Lens over the focused source or selection, not as a long stack of separate user-facing panels.

Every visible object belongs to a scene, data pool, and derived object pool. Rendering surfaces subscribe to those structures. User actions pass through typed events that mutate objects or request Scout observations. The UI must not depend on AI to decide frame-by-frame interaction.

AI Cartographer is the main terrain producer for Supra Macro, L0, L1, L2, recursive seed bootstrap, orphan context reconstruction, same-layer frontier expansion, and L3 source-candidate proposals. DataService is the reality-probing and loading layer: it validates AI-proposed URLs, source candidates, pages, PDFs, images, and future file snapshots before those objects become source-backed tiles. An L3 candidate is therefore only a queue/status object until it is observed.

The object pool is not only a render cache. It is the product's active cognitive field:

* visible objects are rendered;
* near-viewport objects may be preloaded only when the band policy allows it;
* L0/L1 may keep a small exploratory prefetch ring, while L2/L3 should stay on-demand by default;
* distant chunks may sleep, persist, or be evicted;
* failed candidates stay in recovery/diagnostics, not in the main canvas.

DataService should also be exposed as a tool surface to the local AI agent. When AI is uncertain about a URL, paper, page, PDF, image, or future file snapshot, it can ask the local Scout/DataService infrastructure to probe reality and then continue generation with the result.

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

The old canonical L0-L11 12Level ladder remains an internal address vocabulary and migration reference:

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

The system must support deeper address paths without redesigning the architecture, but the MVP user-facing target is a modular Level Runtime rather than a fixed 12-step UI:

* Supra Macro: broader context above the current domain;
* L0 Star Gallery: domain and seed pool;
* L1 Topic Field;
* L2 Source Orientation;
* L3 Tile Field;
* Deep Lens: sections, paragraphs, sentences, phrases, words, characters, Unicode/dictionary, and future byte/hex views inside one close-reading mode;
* Recursive Seed: any grain or region becomes a new exploration universe.

Each user-facing band should be independently testable through a CLI harness and should support AI generation, schema validation, chunk caching, prompt-profile configuration, and renderer subscription without requiring the full Electron UI.

Deep Lens compresses the old visible L4-L10 detail ladder. The system may store internal address paths such as `section/paragraph/sentence/token/character`, but users should experience detail as one continuous close-reading lens unless they promote a grain into a recursive seed.

## 5.5 Cognitive Lens

The visible canvas uses a lens effect:

* center region is larger, clearer, and more readable;
* edge region is smaller, dimmer, and more suggestive;
* center receives detailed labels;
* edge shows hints, fog, and adjacent possibilities.

The lens is both visual and semantic:

* the UI magnifies the center;
* the AI Cartographer prioritizes the center and the near frontier;
* DataService validates AI-proposed source candidates near the edge;
* the chunk cache may preload a small adjacent ring on L0/L1 when settings allow; L2/L3 stay on-demand by default.
* settings control automatic expansion, manual preload, request concurrency, API rate limits, cache budgets, and cancellation.

### 5.5.1 Macro Lens Gallery

At macro layers, SeekStar should not look like a dashboard grid of rounded cards.

Layers L0 and L1 use a dense Star Gallery bubble lens: colorful but restrained solid bubbles clustered in a semantic field. The center of the viewport is larger, clearer, and more readable; the edge becomes smaller, dimmer, and eventually fades. This is a cognitive orientation surface, not decoration.

Macro bubbles are entry points for exploration when the user does not yet know what to ask. They may represent domains, topic regions, seed fields, fog regions, cartographer-primary terrain, source-backed content, or constellation anchors. AI-generated terrain is the default map material; source-backed terrain is stronger provenance, not the only legitimate content state.

Macro discovery should feel like moving a telescope horizontally across a star field: when the user drifts near the edge of the current band, AI Cartographer prepares adjacent chunks and DataService may validate source candidates inside those chunks. It must not turn into a ranked result list or chatbot answer.

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
* a half-hidden top label must remain visible with "退出浏览器模式" and "进入当前页面的DeepLens";
* exiting browser mode returns wheel ownership to SeekStar and continues semantic descent into Deep Lens for section, paragraph, sentence, phrase, word, character, Unicode/dictionary, and future byte/hex inspection.

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
* sets the text as seed context;
* runs AI Cartographer bootstrap for Supra Macro, L0, L1, and L2;
* prepares L3 candidates when the source-orientation band needs concrete material;
* renders schema-valid `cartographer_primary` terrain as the normal map surface;
* does not inherit previous tab history.

Action B: “Search within current tab”

* searches the current tab’s local content index;
* highlights matches on canvas;
* opens a keyword result card;
* shows keyword, snippet, source, layer, and position;
* clicking a result moves the camera to that location.

Future actions:

* “Ask about current viewport”;
* “Ask AI to expand current map”;
* “Probe source candidates with DataService”;
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

1. User enters an L2 source orientation or L3 candidate region.
2. AI proposes candidate webpage / document / PDF / image tiles.
3. User zooms into a tile.
4. DataService observes the candidate before it becomes a source-backed tile.
5. A successful tile can absorb into a browser/document surface.
6. The focused source enters Deep Lens for sections, paragraphs, sentences, phrases, words, characters, Unicode/dictionary, and future byte/hex detail.
7. Any grain, text selection, image region, or link can become a recursive seed.

Acceptance criteria:

* source position remains traceable for every Deep Lens address path;
* user can move back up without losing orientation;
* text remains readable at appropriate lens depth;
* failed candidates are not shown as broken main-canvas tiles.

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

## 7.8 DataService Reality Probe

DataService is a tool for AI and user source actions. It is not the primary L0-L3 terrain generator.

The system must:

* validate AI-proposed URLs and source candidates;
* retrieve or observe pages, PDFs, images, documents, and future file snapshots;
* extract structured metadata, visible text, outlinks, media candidates, and primary resource information;
* avoid obvious duplicate source records;
* record retrieval time and provider provenance;
* store source references only after successful observation/conversion;
* mark failed retrieval in recovery/diagnostics rather than rendering broken source tiles;
* expose retry and AI replacement paths for failed candidates;
* respect user permissions, rate limits, and provider settings.

Future AI tool integration:

* expose DataService as a local tool/MCP-style capability for AI Cartographer;
* allow AI to request source probing when it is uncertain;
* feed observation results back into the chunk/level runtime without letting DataService decide semantic meaning.

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

## 7.10 AI Map Control Sidebar

The right sidebar should be AI-first. Old module-stage inspector/debug sprawl is not part of the default MVP surface.

The sidebar should support:

* ask AI about the active map, current viewport, selection, or focused source;
* review AI-suggested app actions before execution;
* run explicit actions such as focus node, request chunk, observe source, create seed, or open settings;
* show operation status, cancellation, audit, undo/redo where available;
* show compact map context, source/candidate counts, and recovery queue state;
* expose advanced diagnostics only behind an Advanced section;
* route source retry and AI replacement paths separately.

Detailed node/source inspection remains useful, but it must support the AI map-control loop rather than dominate the default sidebar.

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
* show job queue and rough cost later;
* prepare Redis-style cache semantics for durable hot chunk/cache state, while keeping the first implementation behind replaceable storage ports.

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

## 8.6 External Technical Anchors

These references inform implementation boundaries; they do not override SeekStar product philosophy.

* Structured AI output should follow schema-first contracts. OpenAI's Structured Outputs guidance describes supplying JSON Schema and validating/parsing the result after generation: https://developers.openai.com/api/docs/guides/structured-outputs
* Hot chunk and generation-cache work should stay behind replaceable storage ports. Redis caching references support cache-aside, query caching, write-through/write-behind, and prefetch patterns suitable for future hot terrain chunks: https://redis.io/solutions/caching/
* DataService-as-tool work can align with MCP-style tool exposure. MCP describes a standard way for AI apps to connect to tools, data sources, and workflows: https://modelcontextprotocol.io/docs/getting-started/intro

## 9. MVP Scope

## 9.1 MVP Must Have

* Electron desktop shell.
* Multi-tab exploration.
* Top command input as one seed/source entry point, not the product center.
* New tab from seed.
* AI Cartographer bootstrap for Supra Macro, L0, L1, and L2.
* AI-generated `cartographer_primary` terrain rendered as normal map material.
* L0/L1 continuous Star Gallery / Topic Field bubble-gallery projection.
* Chunked horizontal expansion on L0-L3 with automatic/manual controls.
* Per-band Level Runtime contracts with CLI-testable input/output validation.
* Prompt profile settings for language, density, target counts, and per-band prompt overrides.
* L3 candidate source generation and DataService validation into source-backed tile surfaces.
* Failed source candidates hidden from the main canvas with retry/replacement recovery paths.
* Webpage / document / PDF / image tile field for successful source-backed tiles.
* Browser/document absorption for focused source-backed L3 tiles.
* Deep Lens as the single close-reading mode for section/paragraph/sentence/phrase/word/character/Unicode detail.
* Recursive seed creation from text grains, links, selected regions, and source tiles.
* Lasso selection.
* AI explanation and navigation from selection through the right sidebar.
* AI-first right sidebar with action review, operation log, and permission/audit path.
* DataService as a Scout/tool boundary for AI and user source validation.
* Local workspace persistence and replaceable chunk/cache storage ports.
* Destructive cleanup of old mock/fallback/render paths that can pollute the MVP.

## 9.2 MVP Should Have

* Local search within current tab as a support action.
* Brush annotation.
* Backlink between tabs.
* Source confidence/provenance labels.
* Assistant operation undo/redo for safe reversible actions.
* Cost/telemetry display for AI and DataService calls.
* Redis-compatible cache adapter planning or spike for hot chunk cache.

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
* Full webpage rendering for every offscreen tile.
* Universal dictionary coverage.
* Fully OS-backed secret storage for every provider.
* Collaboration/sharing and marketplace concerns.
* Future Ground Mode for arbitrary local files, hex blocks, and theoretical byte/bit views.

## 9.4 Historical Implementation Notes Are Non-normative

The following P2-P5 notes are retained only as implementation history and protocol context. They must not override the P6 MVP reset baseline above.

Current rules:

* AI Cartographer, not DataService, is the primary L0-L3 terrain producer.
* P5 12Level text-grain work is compressed into Deep Lens for the visible product.
* Old preview, fallback, mock, debug, radial, spiral, and inspector-first paths should be deleted when touched.
* Old caches or workspace snapshots may be discarded if they can resurrect obsolete terrain or UI.
* Failed source candidates stay out of the main canvas.

## 9.5 Superseded Milestones Archive

Detailed P2-P5 implementation history has been removed from the PRD mainline. It belongs in architecture notes and decision records, not in the current product requirement contract.

Use these files for historical protocol context only:

* `docs/architecture/`
* `docs/decisions/`
* `docs/architecture/p5-*.md`
* `docs/architecture/p6-ai-cartographer-and-level-runtime-redesign.md`

The PRD now treats the P6 MVP reset baseline as authoritative. If an older milestone conflicts with this document, delete or rewrite the old path rather than carrying compatibility shims forward.

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

## 13. Decisions And Remaining Questions

## 13.1 Resolved for P6 MVP

1. AI-generated terrain is primary `cartographer_primary` map material for Supra Macro through L2 after schema validation; L3 AI output is candidate/status material until validated.
2. DataService validates and loads source candidates; it does not generate the main map, but it is the only path that promotes L3 content into source-backed tile surfaces.
3. Failed or unverified source candidates are hidden from the main canvas and handled through retry/replacement recovery.
4. L4-L10-style content detail is compressed into Deep Lens instead of separate visible product layers.
5. Recursive seed creation is a core flow, not a later enhancement.
6. Viewport-edge movement can automatically request AI horizontal chunks, bounded by settings for depth, rate, budget, and cache.
7. Right sidebar defaults to AI map control rather than old inspector/debug panels.
8. MVP may destructively delete old runtime paths, caches, snapshots, and UI remnants.

## 13.2 Still Open

1. What is the exact first visual grammar for contradiction, uncertainty, and weak hypothesis regions?
2. Which source provider/extractor set is sufficient for the first daily-use L3 tile field?
3. How much prompt-profile editing should be exposed in ordinary Settings versus Advanced?
4. What minimum citation/export format is acceptable for selected-source Markdown?
5. Which cache backend ships first after JSON: Redis-compatible service, SQLite/FTS, or a hybrid?
6. What is the first safe scope for future Ground Mode over local files?

## 14. P6 MVP Reset Architecture

The P6 MVP keeps the five-module boundary but changes the center of gravity toward AI-generated terrain and a replaceable level runtime:

* App Electron Framework: desktop shell, windows, tab surfaces, settings, IPC, and service hosting.
* AI Service: provider routing, structured Cartographer output, assistant/control output, telemetry, cancellation, and unavailable/cancelled/failed status.
* Level Runtime: per-band prompt profiles, schema validation, chunk generation, layout families, cache keys, and CLI harnesses.
* Constellation Engine: telescope events, object pools, tab scene state, source/AI service ports, scene application, and Pixi projection data.
* Scout / DataService: Playwright-backed observation, source snapshot service, candidate validation, PDF/image/page loading, and tool/MCP-style probing for AI.
* Storage / Cache Service: JSON adapter now; future Redis-compatible hot chunk cache, SQLite/FTS, and provider-specific cache adapters behind the same ports.

The Constellation Engine has two internal layers:

* Constellation Core: domain events, object-pool mutation, scene state, source and AI service ports.
* Pixi Runtime Adapter: renderable terrain projection, visible relation filtering, candidate observation placement, and later hit-testing/draw commands.

Each module must have a terminal harness that accepts structured parameters and returns structured JSON. These harnesses are for protocol verification, not product fallback behavior.

The App Framework must expose intent-level transactions rather than generic raw runtime calls. Bootstrap, viewport expansion, source replacement, source observation, assistant actions, and future Deep Lens decomposition should each have explicit inputs, outputs, cancellation, audit, and rollback rules where possible.

## 15. Retained Protocol Facts From P5

P5 implementation history is no longer part of the PRD requirement spine, but a few protocol facts remain useful for P6:

* `SourceSnapshot` remains the shared shape for observed pages, PDFs, images, and future files.
* `SearchCandidate` remains a possible-source record, not source-backed terrain.
* Source observer providers produce source observations or snapshots; search/outlink providers produce candidates.
* Only successful source observation/conversion creates a source-backed L3 tile surface.
* Browser/document absorption remains a focused-tile behavior, not the default way to browse the map.
* Workspace, Scout job, and tab-session coordination should remain engine/App Framework concerns, not renderer-local shortcuts.

Anything else from P5 should be reintroduced only if it supports the P6 MVP reset baseline and does not resurrect old fallback UI, mock terrain, or source-first map generation.
