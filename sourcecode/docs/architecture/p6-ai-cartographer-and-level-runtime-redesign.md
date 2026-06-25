# P6 AI Cartographer and Level Runtime Redesign

Status: P6.1 implementation baseline started

P6 changes the center of gravity of SeekStar.

The product is not primarily a search-result visualizer. It is an AI-driven cartographic telescope. AI is the main terrain producer and organizer for macro exploration. DataService remains essential, but its role is validation, source loading, and reality probing rather than being the primary source of every visible object.

## Product Thesis

SeekStar solves unknown unknowns by letting the user move through an ever-expanding semantic field. The user does not need to already know a query. A seed, focused node, selected text, URL, document, file, image, or orphan tile can start exploration.

The central canvas should feel like a telescope over a generated and verified star map:

- AI proposes and organizes the visible terrain.
- DataService probes candidate URLs and source surfaces.
- Storage/Cache keeps nearby and recently explored chunks reusable.
- The renderer subscribes to structured chunks and object pools.
- The right sidebar becomes an AI conversation and control surface for the active map, not a leftover inspector full of module-era panels.

## Source State Model

AI-generated terrain is the main product material, not a second-class fallback.

Recommended source-state vocabulary for the next schema revision:

- `cartographer_primary`: AI-generated map content that passed schema/format validation and is allowed to render as normal exploration terrain.
- `source_backed`: content verified through DataService observation, source snapshot, file snapshot, or future extractor output.
- `cartographer_unverified_source`: AI-proposed URL or source candidate waiting for DataService probing.
- `cartographer_failed`: failed AI generation or failed source probing, used for diagnostics and edge-failure effects.
- `user_seed`: user-entered or user-promoted seed.
- `local_scaffold`: structural runtime anchor only; it must not render as content.

The UI should not visually treat `cartographer_primary` as suspicious by default. `source_backed` is stronger provenance, not the only legitimate map material.

P6.1 implementation note:
`core-schema` now includes these source states. Existing P5 states remain for compatibility while the old `TerrainScene` path is gradually migrated.

## DataService Role

DataService is a reality probe and loader.

For AI-proposed source candidates:

1. AI returns structured candidate URLs, titles, source types, and reasons.
2. DataService attempts to load, observe, snapshot, or thumbnail them.
3. Successful candidates enter L3 as source-backed tiles.
4. Failed candidates do not render in the main canvas.
5. Failures remain available only in diagnostics/Advanced logs.
6. The AI agent may request replacement candidates when a slot fails.

DataService should also be exposed as a tool to the local AI agent. When the model is uncertain, it can call local source probing instead of guessing.

## Level Runtime vNext

The old L0-L11 ladder remains useful as implementation history, but it should not remain the user-facing runtime design forever. P6 should move toward independently testable level modules.

Recommended user-facing bands:

| Band | Role | Notes |
| --- | --- | --- |
| Supra Macro | broader context above the current domain | Example: CPU can zoom out to computer architecture, computing hardware, industrial supply chain, or information technology. This is not a negative layer; it is an upward context band. |
| L0 Star Gallery | domains and seed pool | AI-populated, chunked, horizontally infinite. |
| L1 Topic Field | topics, subdomains, concept neighborhoods | AI decomposes L0 focus into adjacent topic clusters. |
| L2 Source Orientation | source directions, article families, reference types, communities, paper trails | AI suggests where knowledge exists; DataService can probe candidates. |
| L3 Tile Field | webpages, papers, PDFs, images, documents, source tiles | AI may propose candidates; only DataService-successful candidates become source-backed live/thumbnail tiles. |
| Deep Lens | sections, paragraphs, sentences, phrases, words, characters, Unicode/dictionary, and future byte/hex views | This should be a content decomposition mode inside the focused source or selection, not seven separate top-level user layers. |
| Recursive Seed | any grain becomes a new exploration universe | Selecting text, image regions, links, file regions, bytes, or concepts can bootstrap a new tab. |

Deep Lens replaces the need to maintain separate visible L4-L10 product levels. The system can still store structured internal address paths such as `section/paragraph/sentence/token/char`, but the user should experience it as a continuous close-reading lens.

## Chunked Canvas Runtime

The main canvas should be chunked like a world map or game terrain.

Each user-facing band owns spatial chunks:

```text
level_id + chunk_x + chunk_y + seed_context + prompt_profile -> chunk
```

Each chunk stores:

- nodes;
- relations;
- layout hints;
- generation status;
- AI prompt profile and model metadata;
- cache metadata;
- source candidates;
- source-backed tile references;
- diagnostics.

Chunk behavior:

- visible chunks are active;
- near chunks are preloaded;
- one or two outer rings may be AI-generated or DataService-probed in the background;
- distant chunks sleep;
- cache limits evict least-recently-used or low-value chunks;
- user settings control request concurrency, API rate limits, cache budget, preloading rings, and generation depth.

This makes horizontal movement the main discovery gesture. When the user approaches a boundary, AI begins preparing adjacent chunks before they enter the viewport.

## AI Generation Modes

Every band should be an independently testable module with its own prompt templates, settings, validators, and CLI harness.

Core modes:

- `expand_horizontal`: generate same-level adjacent terrain for the current viewport edge or chunk.
- `decompose_down`: split the focused node/region into the next lower semantic band.
- `summarize_up`: infer broader parent context from a focused region or orphan source.
- `bootstrap_seed`: generate the initial Star Gallery / Topic Field / Source Orientation for a new seed.
- `replace_failed_source`: ask for alternative candidates when DataService rejects AI-proposed URLs.
- `navigate_or_explain`: answer right-sidebar user questions using current map context and available operations.

Level modules should expose a uniform CLI contract.

Input:

```json
{
  "mode": "expand_horizontal",
  "level_id": "L1",
  "seed": "CPU",
  "viewport": { "chunk_x": 0, "chunk_y": 0, "rings": 1 },
  "focus": { "node_ids": [], "selection": null },
  "settings": {
    "density": "normal",
    "target_node_count": 24,
    "max_relations": 36,
    "language": "zh-Hans"
  },
  "context": {
    "nearby_nodes": [],
    "source_summaries": [],
    "failed_candidates": []
  }
}
```

Output:

```json
{
  "nodes": [],
  "relations": [],
  "source_candidates": [],
  "chunk_hints": [],
  "cache_writes": [],
  "diagnostics": []
}
```

The CLI must let developers test a single band without launching Electron.

P6.1 implementation note:
`@seekstar/level-runtime` now exposes this first unified input/output contract. It is intentionally independent of Electron, React, Pixi, Playwright, and Storage. The initial runtime uses the AI Service mock provider by default, lightly dedupes nodes and source URLs, emits one-ring chunk preload hints, and refuses to produce `source_backed` material directly. L3 source candidates remain `cartographer_unverified_source` until DataService probes them.

## Prompt Configuration

SeekStar should ship with internal prompt templates and ordinary settings variables.

Ordinary settings:

- density per band;
- target node count per band;
- preloading ring count;
- concurrent AI requests;
- API rate limits;
- generation depth for new seeds;
- language and region preferences;
- source-candidate count;
- retry count for failed sources.

Advanced settings:

- editable prompt templates per band and mode;
- provider/model routing per band;
- temperature and reasoning profile per band;
- schema validation strictness;
- diagnostics verbosity.

Prompt templates should include coarse/fine controls so AI does not over-split or under-split a level. These controls are part of the product, not incidental prompt text.

## AI Service Requirements

The first real AI Service should support an OpenAI-compatible provider boundary.

P6.1 implementation note:
`@seekstar/ai-service` now includes `AiCartographerService`, an OpenAI-compatible provider, deterministic mock provider, structured output validator, explicit `missing_key` diagnostics, and CLI `generate` / `validate` commands. Real provider cancellation, encrypted key storage, per-band model routing UI, and token/cost accounting are still pending.

Minimum service capabilities:

- provider configuration by `base_url`, model, API key reference, and model capabilities;
- encrypted or OS-backed key storage later; no plaintext permanent key files;
- per-band model routing;
- structured JSON output validation;
- retries and fallback models;
- cancellation;
- cost/token/time tracking;
- diagnostics for failed validation;
- CLI harness for each generation mode;
- DataService tool access for URL/source probing;
- cache key generation based on seed, level, chunk, mode, prompt profile, and model.

The local agent should share the current canvas context, selected nodes, visible chunks, source summaries, and available app operations. It should not drive frame-by-frame UI, but it may call app-level operations such as create node, navigate to chunk, observe candidate, open seed tab, or summarize selection.

## Right Sidebar Redesign

The right sidebar should become an AI chat and map-control surface.

Default responsibilities:

- ask questions about the current map;
- request navigation to a topic or source;
- ask AI to expand, summarize, compare, or explain selected regions;
- show compact operation logs;
- expose advanced diagnostics only when expanded.

Old module-era panels such as manual source cards, cartographer debug cards, and source-readiness counters should not dominate the default view.

## Recursive Seeds and Orphan Context

Any selected grain can become a recursive seed:

- domain;
- topic;
- source direction;
- webpage;
- paragraph;
- sentence;
- phrase;
- word;
- character;
- image region;
- file region;
- future byte/hex region.

Default recursive bootstrap should generate:

- upward context;
- L0 Star Gallery around the new seed;
- L1 topics;
- L2 source orientation;
- L3 candidate source slots in the background.

When a page, image, file, or text selection enters as an orphan, AI should infer missing parent context upward and generate adjacent same-band terrain. DataService then validates source candidates where applicable.

## Future Ground Mode

Deep Lens should eventually support a "ground mode" for local files:

- file icon/name;
- filesystem metadata;
- logical file sections;
- encoded text or binary regions;
- file headers and markers;
- hex blocks;
- theoretical byte/bit representation.

This is future work and should not block P6 AI Cartographer or web/document tile exploration.

## Migration Direction

P6 should not continue to expand the old monolithic canvas path.

Recommended implementation path:

1. Add `packages/ai-service` OpenAI-compatible provider and structured output validators. Done in P6.1 baseline.
2. Add a new `packages/level-runtime` or equivalent canvas-level runtime package. Done in P6.1 baseline.
3. Implement L0-L3 and Deep Lens as independently testable modules. L0-L3 and interface-level Deep Lens are CLI-testable in P6.1; full Deep Lens content decomposition remains pending.
4. Add CLI commands for each band and generation mode.
5. Move center canvas consumption from old `TerrainScene`-first rendering toward chunk-runtime subscriptions.
6. Replace the right inspector with an AI chat/control panel.
7. Keep DataService as the validation/loading tool for source candidates.

Existing P5 DataService, source snapshot, and browser absorption work should be reused as validation/loading infrastructure, not as the primary content-generation model.
