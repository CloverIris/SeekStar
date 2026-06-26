# P6 AI Cartographer and Level Runtime Redesign

Status: P6 implementation baseline active through P6.57

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

P6.2 implementation note:
`@seekstar/constellation-engine` now exposes `applyLevelRuntimeOutputToScene`. This bridge lets the old `TerrainScene`/Pixi transition path consume chunk runtime output without making the desktop renderer orchestrate AI. Level Runtime nodes enter the scene as `cartographer_primary` terrain. Source candidates enter as L3 `ScoutObservation` records with `source_candidate` status. Pixi projection therefore shows a `source_candidate_field`, but no source-backed tile surface is created until DataService/Scout converts a candidate into a source snapshot.

P6.3 implementation note:
`@seekstar/level-runtime` now exposes `ChunkedLevelRuntimeHost`. The host owns in-memory chunk cache keys, miss/hit/refresh behavior, one-ring preload execution, estimated cache size, access counters, and simple LRU/LFU-style eviction. This is still an in-process host, not durable Storage Service persistence, but it gives the desktop shell a clear future subscription target instead of putting cache and preload logic into React hooks.

P6.4 implementation note:
`@seekstar/storage-service` now exposes `JsonLevelChunkStorage`. It stores Level Runtime chunk cache records keyed by the same runtime cache key, supports save/load/list/delete/clear/prune, and preserves output plus cache metadata. This is deliberately the JSON adapter before SQLite/FTS; the contract is the important part.

P6.5 implementation note:
`@seekstar/constellation-engine` now exposes `CartographerChunkCoordinator`. The coordinator is the App Framework-facing lifecycle wrapper: it accepts a Level Runtime generator port and optional chunk storage port, checks cache, runs generation on miss or refresh, saves output, preloads nearby chunks, prunes storage through the port, and applies the active chunk into the current `TerrainScene`. This keeps React out of AI/cache orchestration while still allowing the P5 scene/projection path to consume P6 terrain during migration.

P6.6 implementation note:
The Electron App Framework now has the first main-process Cartographer bridge. `apps/desktop/src/main/cartographerRuntimeBridge.ts` registers coordinator-backed Cartographer IPC handlers, validates runtime requests, routes them through `CartographerChunkCoordinator`, and persists chunk cache records with `JsonLevelChunkStorage` in Electron `userData`. The important boundary is in place: React does not need to orchestrate AI generation, preload rings, storage writes, or cache pruning.

P6.7 implementation note:
The desktop renderer consumed that bridge for the first real migration step. `useExplorationSession` bootstraps default/new keyword seeds through the Cartographer bridge, accepts the coordinator-applied `TerrainScene`, and persists the result. Direct URL intake and candidate observation still use DataService/Scout validation. Keyword seeds no longer run browser-assisted Scout discovery by default, which keeps AI Cartographer as the primary L0-L3 terrain producer and DataService as the verification/loading layer.

P6.8 implementation note:
Pixi main-content projection now distinguishes AI Cartographer terrain chunks from source intake states through `cartographer_chunk_field`. When Cartographer terrain exists on the active layer, the renderer promotes `cartographer_primary` nodes and hides old local scaffold nodes for that layer. This is the first presentation-side break from the P5 placeholder look: generated terrain is treated as normal map material, while source-backed tiles remain a stronger provenance state and candidate URLs still require DataService validation before live/browser surfaces are created.

P6.9 implementation note:
Viewport-edge movement on L0-L3 now uses Cartographer chunk expansion as the default macro exploration path. The desktop canvas detects and debounces edge movement, then sends a viewport-expansion intent to the App Framework. Electron main computes the chunk key, builds the `expand_horizontal` request, applies lifecycle records, and returns a coordinator-applied scene for the renderer to persist. The old Scout frontier path remains for non-Cartographer layers and source-specific workflows, but macro exploration now follows the Minecraft-like chunk model described in this document.

P6.10 implementation note:
Desktop session state now exposes a compact Cartographer runtime status for chunk bootstrap and viewport-edge expansion. `TerrainCanvas` renders this as a low-visibility badge containing generation phase, level, chunk key, and cache status. This is not the final chunk-boundary UI, but it makes invisible background generation legible while keeping the main canvas focused on terrain.

P6.11 implementation note:
Desktop settings now include an AI Cartographer provider surface. It manages the active provider, local deterministic test provider, OpenAI-compatible base URL, model, env-key reference, timeout, and retry knobs without storing plaintext keys. The Electron Cartographer bridge now loads settings for each chunk request, resolves the active provider into `AiCartographerService`, and passes that generator into `runLevelRuntime`. The built-in mock provider remains available for deterministic development and smoke tests, but it is no longer an invisible hard-coded bridge dependency; real providers can be selected through the App Framework settings boundary.

P6.12 implementation note:
`@seekstar/level-runtime` now owns explicit band profile modules. The default P6 profile defines Supra Macro, L0 Star Gallery, L1 Topic Field, L2 Source Orientation, L3 Tile Field, Deep Lens, and Recursive Seed with role, prompt brief, constraints, default node type, target count, layout family, and source-candidate policy. `runLevelRuntime` now derives target density, node conversion, source-candidate filtering, and the AI prompt context from those modules. This means L0 can be proven to reject source candidates, L3 can be proven to emit only unverified candidate URLs, and developers can inspect `profiles` or a single `module --level L3` through the Level Runtime CLI without launching Electron.

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
`@seekstar/ai-service` now includes `AiCartographerService`, an OpenAI-compatible provider, deterministic mock provider, structured output validator, explicit `missing_key` diagnostics, and CLI `generate` / `validate` commands. Encrypted key storage and per-band model routing UI are separate follow-up layers; P6.43 adds baseline call telemetry and cost estimates, P6.44 adds provider cancellation, and P6.46 persists those call records in the desktop App Framework ledger.

P6.11 implementation note:
The first desktop-level provider routing is in place. Settings keep only configuration and env-key references; the runtime bridge constructs the provider on demand. Per-band prompt profiles, encrypted secret storage, durable call ledgers, and right-sidebar agent routing are separate App Framework layers rather than AI Service concerns. P6.45 adds desktop transaction cancel controls on top of the P6.44 provider/runtime cancellation protocol, and P6.46 adds a JSON-backed desktop cost ledger with settings UI/export.

P6.12 implementation note:
AI Service now receives band instructions through `context.level_module` instead of owning band policy itself. The system prompt explicitly tells OpenAI-compatible providers to follow that module role, brief, constraints, target count, and source-candidate policy. This keeps AI Service as the provider/validation boundary while Level Runtime remains responsible for SeekStar's semantic band design.

P6.13 implementation note:
AI Service now exposes the Cartographer message builder and CLI `prompt --input`. Developers can inspect the exact OpenAI-compatible messages for a single generation request, including `context.level_module`, before making a real provider call. Module smoke covers this path so prompt/profile plumbing is tested independently from network access.

P6.48 implementation note:
The same preview boundary is now available from the desktop App Framework. Electron main exposes a Cartographer prompt preview IPC that resolves current provider settings, prompt profile overrides, chunk policy, and band module context, then returns the exact `buildCartographerMessages` payload plus a prompt revision hash without calling a provider or spending tokens. Settings > AI Cartographer displays this preview for a chosen level/mode/seed.

P6.14 implementation note:
Desktop AI settings now include per-band route rules. A route can match a level plus optional generation modes, choose an enabled provider, and optionally override the model. The Electron Cartographer bridge resolves the matching route for each chunk request before constructing `AiCartographerService`. This makes provider/model routing an App Framework setting instead of a renderer concern, and lets L3 source candidate generation, Deep Lens, or future expensive macro bands move to different models without changing Level Runtime.

P6.15 implementation note:
`@seekstar/ai-service` now has a separate AI map assistant/control protocol. `AiCartographerService.assist()` accepts intents such as `answer_question`, `navigate`, `expand_map`, `summarize_selection`, and `explain_source`, plus current map context and allowed app operations. It returns a validated answer plus typed action suggestions such as `focus_node`, `request_chunk`, `observe_source`, `create_seed`, or `open_settings`. This keeps right-sidebar chat/control out of frame-level generation and gives the future sidebar a CLI-testable protocol before UI wiring.

P6.16 implementation note:
Electron main/preload now exposes `seekstar.ai.assist` through the App Framework boundary. The bridge resolves the active AI provider from settings in the main process, so renderer code can send current tab, layer, selection, and scene summary context without seeing API keys. The right sidebar has a minimal AI map assistant panel that displays validated answers and typed suggested actions, but action execution is still intentionally manual/future work.

P6.17 implementation note:
The right-sidebar assistant now has an explicit action execution boundary. Suggested actions render as user-clicked controls, and the desktop App Framework maps validated action types to existing operations: `focus_node`, `request_chunk`, `observe_source`, `create_seed`, and `open_settings`. AI still cannot mutate the canvas directly or drive frame-level interaction; it proposes typed operations, and the app executes only after the user clicks.

P6.18 implementation note:
The right-sidebar assistant records a compact operation log for user-run assistant actions. Running, completed, and failed operation states are visible as App Framework outcomes. P6.18 introduced it as renderer-local UI state; P6.20/P6.21 made the audit fields durable, and P6.35 adds the first undo metadata on top of that record.

P6.19 implementation note:
The right-sidebar assistant now keeps a compact local chat history instead of a single transient answer. Each assistant response displays reviewable action cards with operation type, target, level, and seed context before execution. This makes the sidebar start behaving like an AI map-control surface while still keeping all execution behind explicit user clicks.

P6.20 implementation note:
Assistant chat history and operation logs now persist through an Electron main-process assistant-session store under `userData`. Preload exposes `seekstar.ai.loadSession`, `saveSession`, and `clearSession`, and the right sidebar hydrates/saves per active tab. This keeps durable assistant UI state in the App Framework instead of AI Service or renderer-only state.

P6.21 implementation note:
Assistant operation records now carry permission and audit metadata. A user click is recorded as `approved_by_click`, alongside action type, target id, level, seed, requested/approved/completed timestamps, and execution result. This gives the future permission system a real data spine without allowing AI output to bypass user review.

P6.22 implementation note:
Settings now include an assistant action permission mode under AI Cartographer. `ask_each_time` keeps explicit click approval for every operation, `allow_low_risk` records focus/navigation/settings actions as low-risk after click, and `block_all` prevents assistant actions from executing while leaving suggestions visible. The desktop shell enforces the policy; the sidebar only renders review controls and records outcomes.

P6.23 implementation note:
The desktop renderer now keeps tab-scoped Cartographer chunk runtime records for bootstrap chunks, viewport-edge queued chunks, active expansion requests, successful coordinator preloads, cache hits/misses, and failures. `TerrainCanvas` consumes those records as a small chunk-runtime panel with the current chunk, surrounding preload ring, and recent request log. This is still a transition UI over the old `TerrainScene` bridge, but it makes chunk-runtime subscription state visible without moving AI orchestration into the Pixi canvas.

P6.24 implementation note:
`@seekstar/constellation-engine` now owns the successful chunk lifecycle record protocol. `CartographerChunkCoordinator.request()` returns `chunkRecords` for the active chunk and coordinator preloads, including role, level, chunk key, cache status, phase, and timestamp. The desktop renderer still owns queued/generating/error UI records because those are App Framework interaction states, but applied active/preload records now come from the engine result instead of renderer-side inference.

P6.25 implementation note:
Electron main now owns a JSON-backed Cartographer chunk lifecycle store under `userData`. The first bridge exposed explicit load/save/clear calls so `useExplorationSession` could hydrate and persist tab-scoped records while clearing them when a tab closes. P6.33 replaces the renderer load/save part with `seekstar.cartographer.subscribeChunkRecords`, while keeping the same invariant: chunk lifecycle UI state lives in the App Framework and is not treated as `TerrainScene` fact.

P6.26 implementation note:
The desktop renderer now has a `cartographerRuntimeClient` transaction helper for chunk requests. It owns the request lifecycle pattern for started records, status updates, engine-owned applied records, and error records. `useExplorationSession` still decides when to bootstrap or expand and still persists scene changes, but it no longer hand-writes the request/status/record sequence in each path. This is the staging boundary before moving scheduling and broadcast ownership into a formal App Framework chunk host.

P6.27 implementation note:
Electron main introduced `cartographer:run-chunk-transaction` as an App Framework transaction boundary. The main process writes started, applied, and error lifecycle records into the Cartographer chunk store and broadcasts `cartographer-chunks:changed` snapshots through preload. P6.28/P6.29 move default paths onto specialized bootstrap and viewport-expansion transactions, so the renderer no longer needs raw chunk or generic transaction APIs for the main Cartographer flow. This moves lifecycle ownership out of renderer code while preserving the existing `TerrainScene` bridge during migration.

P6.28 implementation note:
Electron main now also exposes `cartographer:run-bootstrap-transaction` for the fixed L0-L3 seed bootstrap path. The main process owns the ordered `L0 bootstrap_seed -> L1/L2/L3 decompose_down` scheduling loop, lifecycle writes, preload broadcasts, and sequential scene application. The renderer sends one bootstrap intent and then persists the returned scene. This removes the largest remaining Cartographer scheduling loop from `useExplorationSession` while keeping workspace persistence in the desktop shell until a full chunk host owns scene commits.

P6.29 implementation note:
Electron main now exposes `cartographer:run-viewport-expansion-transaction` for L0-L3 viewport-edge expansion. The main process owns viewport-to-chunk resolution, seed/context construction, `expand_horizontal` request creation, lifecycle writes, preload broadcasts, and coordinator scene application. The renderer still detects canvas movement and debounces the intent because that depends on pointer/viewport state, but it no longer builds Level Runtime requests or exposes raw chunk/generic transaction APIs through preload.

P6.30 implementation note:
The desktop bridge retires raw `cartographer:request-chunk` and generic `cartographer:run-chunk-transaction` handlers from the product IPC surface. `cartographerRuntimeBridge` now registers only intent-level Cartographer transactions for the current product paths: seed bootstrap and viewport expansion. This prevents renderer code from rebuilding arbitrary Level Runtime requests and keeps future transaction additions explicit.

P6.31 implementation note:
Electron main now exposes `cartographer:run-source-replacement-transaction` for failed source candidates. The main process owns failed-observation lookup, `replace_failed_source` request construction, focused replacement context, lifecycle records, preload broadcasts, and coordinator scene application. The renderer sends only an observation id, then merges the returned scene and persists it. The right sidebar exposes this as `Replace candidate`, and assistant `observe_source` actions aimed at failed observations use the same replacement path.

P6.32 implementation note:
Settings > AI Cartographer now persists a per-action assistant permission matrix for `focus_node`, `request_chunk`, `observe_source`, `create_seed`, and `open_settings`. The global permission mode remains as a coarse shell policy, but each action can now be allowed after click, recorded as explicit approval, or blocked. The right-sidebar assistant labels and disables action cards from the matrix, and the App shell checks the same decision before executing assistant-suggested operations.

P6.33 implementation note:
Cartographer chunk lifecycle records now use an App Framework subscription boundary. The renderer no longer calls chunk load/save APIs or persists local queued records. Preload exposes `subscribeChunkRecords(tabId, callback)`, Electron main replays the current tab snapshot on subscription, and later chunk-store broadcasts are targeted to web contents subscribed to that tab. This moves chunk lifecycle visibility closer to a formal host subscription while keeping queued renderer records as transient UI feedback only.

P6.34 implementation note:
The right-sidebar Scout observation review path now separates failed source handling into two explicit operations. `Retry original source` reuses the DataService/Scout observation path for the same URL, while `Ask AI for replacement` uses the P6.31 `replace_failed_source` transaction to request alternative Cartographer candidates. The UI also explains the split so a failed candidate is no longer an ambiguous dead-end or a hidden AI substitution.

P6.35 implementation note:
Assistant operation records now carry durable undo metadata. The first supported undo context is `restore_viewport_selection`, which captures tab id, viewport, selected node ids, and focus node before `focus_node` or `request_chunk` actions run. The right-sidebar operation log can execute that undo and persists `undo_status`, request/completion timestamps, and messages through the assistant-session store. Source observation and seed/tab creation actions were deliberately marked non-undoable at this stage until later transaction-level rollback semantics arrived.

P6.36 implementation note:
The canvas chunk runtime panel now has first-class boundary controls. Users can pause/resume automatic viewport-edge expansion, refresh the current chunk with `forceRefresh`, or manually preload north/east/south/west adjacent chunks without moving the camera. The controls remain App Framework intents: TerrainCanvas emits UI intent, App/useExplorationSession resolves the target viewport, and Electron main still owns the viewport-expansion transaction and lifecycle records.

P6.37 implementation note:
Assistant-created recursive seed tabs now carry the first source/tab-mutating rollback context. When a user runs an AI `create_seed` action, the App Framework records `close_created_tab` metadata with the created tab id, origin tab id, and origin selection. The sidebar operation log can undo that action by closing the created seed tab through the tab-session transaction path. Source observation rollback was kept separate here because it needed scene-diff or source-ingestion reversal semantics, not just tab close.

P6.38 implementation note:
Assistant-triggered `observe_source` actions now carry the first scene-mutating rollback context. Before observing a source candidate or direct URL, the App Framework captures a target-tab `TerrainScene` snapshot. If the user undoes the operation, the shell restores that scene through the workspace persistence path and reactivates the target tab. This was intentionally a conservative snapshot restore, not an AI-authored rollback plan, and P6.40 later shrank new records to scene diffs.

P6.39 implementation note:
The desktop right sidebar now defaults to an AI-first map control surface. The assistant panel is the first interactive region, while legacy overview/selected-node/search material is grouped under `Map context`, source candidate actions live under `Source review`, and Cartographer/manual/tray surfaces remain under `Advanced`. This is not the final chat/control redesign, but it changes the product path away from a module-era inspector and toward the P6 assistant-as-control-surface direction.

P6.40 implementation note:
Assistant-triggered source observation rollback now records a scene diff instead of a full pre-observation scene snapshot. The patch stores stable scene fields plus per-collection order, added ids, and changed/removed item restorations for nodes, relations, sources, Scout observations, Cartographer outputs, and agent jobs. Undo applies the diff to the current target scene and then restores through the existing workspace persistence path. Legacy `restore_scene_snapshot` contexts remain readable for local session compatibility, but new `observe_source` actions write `restore_scene_diff`.

P6.41 implementation note:
Chunk scheduling policy is now configurable at the App Framework boundary. Settings expose automatic boundary expansion, auto preload ring, boundary debounce, macro chunk width/height, and manual directional preload range. The desktop canvas panel displays that policy, directional controls can queue more than one adjacent chunk, and viewport-edge discovery uses the configured debounce and chunk step size before asking Electron main to run the existing viewport-expansion transaction. P6.47 later adds the matching policy-versioned chunk cache key and Storage metadata so custom dimensions cannot reuse stale chunk output.

P6.42 implementation note:
Editable prompt profile overrides now flow through the full Cartographer path. Settings > AI Cartographer stores profile language, density, and per-band target count, prompt brief, and constraints. Electron main turns those settings into Level Runtime settings for bootstrap, viewport expansion, and failed-source replacement transactions. `@seekstar/level-runtime` applies the overrides before building `context.level_module`, and its cache key includes a prompt revision hash so changed prompts do not silently reuse stale chunk output. The module smoke test verifies that a custom L0 brief/constraint reaches the AI generation input and clamps output to the configured target count.

P6.43 implementation note:
AI Service now emits call-level telemetry on validated generation and assistant outputs. OpenAI-compatible calls report attempts, start/completion timestamps, duration, provider token usage when available, and optional USD cost estimates when input/output price rates are configured. The mock provider emits deterministic zero-token, zero-cost telemetry for CLI and smoke tests. Desktop provider settings can store those price rates, but long-term cost ledger persistence and UI/export remain App Framework work.

P6.44 implementation note:
AI Service now has an explicit cancellation protocol. Generation and assistant calls accept `AbortSignal`; deterministic mock providers return `cancelled` without fabricating terrain; OpenAI-compatible calls merge external cancellation with their internal timeout controller and keep user cancellation distinct from provider timeout. Level Runtime forwards the same signal through its generator boundary, so chunk requests can now produce `cancelled` outputs once App Framework exposes transaction-level controls.

P6.45 implementation note:
The desktop Cartographer transaction layer now owns cancellation controls. Bootstrap, viewport expansion, and failed-source replacement transactions run under tab-scoped `AbortController`s in Electron main. `cartographer.cancelTransaction` is exposed through preload, and the canvas chunk runtime panel shows a Cancel action while a transaction is generating. The coordinator does not cache cancelled outputs, does not apply cancelled scene output, and records cancelled lifecycle status for subscriptions.

P6.46 implementation note:
Electron App Framework now owns a local AI cost ledger. Assistant calls and Cartographer chunk transactions append call-level telemetry records into `seekstar-ai-cost-ledger.json` under Electron `userData`, including source, tab, level/mode/intent, provider/model, timing, attempts, token usage, estimated USD cost, and status. Preload exposes load/export/clear methods, and Settings > AI Cartographer displays totals plus recent records. AI Service remains stateless: it only emits telemetry on validated outputs and does not persist ledgers or decide presentation.

P6.47 implementation note:
Chunk scheduling policy is now part of the chunk runtime contract instead of a renderer-only hint. `LevelRuntimeSettings.chunk_policy` carries chunk width/height, preload ring, manual range, debounce, and a deterministic policy revision; Level Runtime and Constellation Engine include that revision in cache keys, Level Runtime outputs carry the policy used for layout, and `JsonLevelChunkStorage` writes schema revision 2 records with `chunk_policy_key` while still reading revision 1 caches. Electron main also computes viewport and failed-observation chunk keys from settings instead of hard-coded 1200/900 dimensions.

P6.48 implementation note:
Prompt preview is now a product UI path instead of CLI-only diagnostics. The renderer asks Electron main for a preview; main builds the same Level Runtime -> AI Service request envelope used by generation, returns system/user messages, provider/model identity, and a deterministic prompt revision. This keeps provider/key resolution and prompt construction above the renderer while letting users inspect prompt changes before generating terrain.

P6.49 implementation note:
Prompt profile history/rollback now exists in Settings. `SeekStarSettings` stores up to 20 `cartographer_prompt_profile_revisions`, each with revision hash, timestamp, label, and a full normalized profile snapshot. Settings > AI Cartographer can save the current prompt profile, restore a saved revision, or delete stale revisions. This keeps prompt history in the App Framework settings layer rather than AI Service.

P6.50 implementation note:
The right sidebar is now a more explicit AI map-control console instead of only an assistant chat plus legacy inspector groups. The assistant panel surfaces active tab, layer, visible-band node count, selection count, source-backed count, candidate count, and the current action permission policy before the user asks anything. It also offers prompt shortcuts for explain, navigate, expand, source review, summarization, or recursive seed suggestions, while the operation audit is collapsed unless work is running or failed. All suggested actions still flow through the existing explicit user-click App Framework boundary and permission matrix.

P6.51 implementation note:
Workspace snapshot persistence now uses the Storage Service boundary instead of a desktop-only JSON writer. `JsonWorkspaceStorage` owns atomic temp-file replacement, schema inspection, corrupt JSON quarantine, clear, health, and CLI validation, while Electron main keeps only path ownership, IPC registration, workspace-change broadcasts, and development-data cleanup. This hardens the JSON adapter before SQLite/FTS without moving workspace semantics into React.

P6.52 implementation note:
Workspace hydration tab registration now uses a dedicated App Framework transaction. `TabRuntimeManager.syncWorkspaceTabs()` updates or creates runtime tab records from workspace tab metadata, sets the active runtime tab, removes deprecated default runtime tabs, saves once, and broadcasts one snapshot. The renderer no longer loops through `tabs.create`, `tabs.activate`, and deprecated-tab close calls during workspace hydration; it only forwards the tab metadata derived from scenes.

P6.53 implementation note:
Source candidate failure recovery is now a first-class right-sidebar path. Failed Scout/source observations are promoted into a compact recovery queue with explicit `Retry original`, `Ask AI replacement`, and `Open as Seek` actions. The queue states the key invariant: failed candidates stay out of the main canvas and do not become source-backed terrain until DataService observation or Cartographer replacement succeeds.

P6.54 implementation note:
DataService source snapshots now distinguish primary resource assets. `SourceSnapshot.primary_resource` records whether the observed URL is HTML, image, PDF, or unknown, along with mime type, byte length, and preview URL when applicable. The Scout observer uses a request/header path for direct `image/*` and PDF URLs instead of forcing them through DOM extraction, while normal HTML pages still use Playwright for visible text, outlinks, and embedded media. Module smoke covers local HTML, image, and PDF snapshots.

P6.55 implementation note:
DataService provider secrets are now explicit references instead of loose provider fields. `ContentProviderSettings.api_key_ref` stores an env-var reference such as `{ "kind": "env", "name": "GITHUB_TOKEN" }`; the older `api_key_env_var` remains readable only for settings migration. The Settings UI edits the env reference name and never stores plaintext provider keys. Scout resolves provider secrets at runtime through an exported helper, so later OS-backed encrypted secret storage can replace the resolver without moving secret handling into React or provider definitions.

P6.56 implementation note:
Assistant-triggered chunk expansion now uses a dedicated synchronous renderer-to-App-Framework transaction instead of the debounced canvas frontier path. `request_chunk` actions call the viewport-expansion transaction, persist the returned scene, and record a `restore_scene_diff` undo context against the before/after scenes. This makes assistant-generated Cartographer terrain reversible through the same operation log that already handles source observation and recursive seed rollback.

P6.57 implementation note:
Assistant operation records now preserve the original validated action and redo timestamps in the desktop assistant-session store. Once a user undoes an operation, the sidebar can redo it by sending the stored action through the same App Framework execution boundary; the redo result refreshes the operation message, completion timestamp, and next undo context. AI Service still does not emit rollback or redo plans.

Minimum service capabilities:

- provider configuration by `base_url`, model, API key reference, and model capabilities;
- encrypted or OS-backed key storage later; no plaintext permanent key files;
- per-band model routing;
- structured JSON output validation;
- retries and fallback models;
- provider/runtime cancellation through `AbortSignal`;
- call-level cost/token/time telemetry;
- App Framework cost ledger persistence, UI summary, JSON export, and local clear controls;
- diagnostics for failed validation;
- CLI harness for each generation mode;
- DataService tool access for URL/source probing;
- cache key generation based on seed, level, chunk, mode, prompt profile, and model.
- assistant/control output validation for right-sidebar app operations;
- a desktop bridge that keeps AI provider/key resolution in the main process while exposing a small validated assistant API to the renderer.

The local agent should share the current canvas context, selected nodes, visible chunks, source summaries, and available app operations. It should not drive frame-by-frame UI, but it may call app-level operations such as create node, navigate to chunk, observe candidate, open seed tab, or summarize selection.

P6.17 makes that boundary concrete in the desktop shell. Assistant actions are treated as command intents at the App Framework layer, not as renderer-side mutation privileges. This keeps future permission prompts, operation logs, and undo/redo hooks in one place.

P6.18 adds the first visible operation trace to that flow. The log records the desktop shell's execution result rather than trusting model text, so later durable audit storage can attach to the same boundary.

P6.19 adds short-lived conversation memory in the renderer. This is not yet durable chat storage, but it establishes the UX contract: the sidebar is a history of user requests, assistant answers, reviewed operations, and actual App Framework execution outcomes.

P6.20 makes that conversation memory durable at the desktop shell boundary. The persisted session shape stores turns and operation outcomes per tab, while the AI provider contract remains stateless and reusable through CLI tests.

P6.21 extends the persisted operation shape with audit metadata. The important invariant is now explicit: model output proposes an operation, the user approves it, the desktop shell executes it, and the session log records what actually happened.

P6.22 adds the first configurable policy on top of that invariant. P6.32 refines it into an action-level matrix while preserving the same shell enforcement boundary.

P6.23 makes the center-canvas migration more inspectable. The visible chunk ring is not the final chunk host, but it proves the renderer can consume runtime chunk lifecycle state separately from node projection. P6.33 replaces the manual renderer hydration/save shim with a tab-scoped App Framework subscription, and P6.41 adds configurable scheduling policy on top of the manual boundary controls.

P6.24 hardens that subscription boundary. The coordinator result now contains explicit lifecycle records, so callers no longer need to infer cache/preload state from bare `preloaded` outputs. This is still not the final durable host, but it moves the source of truth from React glue toward the engine/App Framework port.

P6.25 makes that runtime state durable at the desktop shell boundary. The JSON store is intentionally small and cache-like; it persists lifecycle visibility, not generated terrain outputs. P6.33 removes the renderer hydration/save shim; P6.41 adds configurable request scheduling knobs, and P6.47 adds policy-versioned generated chunk cache keys for those knobs.

P6.26 starts that consolidation inside the renderer boundary. The transaction helper is intentionally small and does not own scene persistence or AI provider resolution. It removes duplicate bootstrap/expansion bookkeeping so the future main-process chunk host has a clearer shape to absorb.

P6.27 moves the transaction boundary into Electron main. The host is still not complete because request scheduling triggers and scene persistence remain in `useExplorationSession`, but chunk lifecycle writing, persistence, and broadcasting now sit behind the App Framework bridge.

P6.28 moves the default/new seed bootstrap schedule into Electron main as well. P6.29 moves viewport-edge expansion request construction into Electron main; only the movement trigger and debounce remain in renderer because they depend on current canvas interaction. P6.30 removes the raw/generic chunk IPC handlers from the product bridge, so new Cartographer flows should be modeled as explicit App Framework transactions rather than exposing open-ended runtime request envelopes. P6.31 applies that rule to failed source replacement: the renderer sends a failed observation id and the main process builds the `replace_failed_source` Cartographer request. P6.32 adds action-level assistant permission decisions on top of the same App Framework operation boundary. P6.33 removes renderer-owned chunk lifecycle hydration/save calls and replaces them with tab-scoped App Framework subscriptions. P6.34 clarifies failed source review by making retry-via-DataService and replacement-via-Cartographer separate user actions. P6.35 adds the first durable undo context for reversible assistant navigation operations. P6.36 makes chunk-boundary behavior user-controllable through pause, refresh, and directional preload intents. P6.37 adds the first tab-mutating assistant rollback by closing AI-created seed tabs through the tab-session transaction path. P6.38 adds conservative scene-snapshot rollback for assistant-triggered source observation. P6.39 makes the right sidebar AI-first by moving context/source/debug surfaces below the assistant control panel. P6.40 shrinks new source-observation rollback records from full scene snapshots to scene diffs. P6.41 makes chunk scheduling policy configurable through settings while keeping generation requests behind the existing App Framework transaction boundary. P6.42 makes per-band prompt profile overrides editable and sends them through the same transaction boundary. P6.43 adds provider call telemetry and cost-estimate settings without making AI Service own cost ledger persistence. P6.44 adds provider/runtime cancellation status. P6.45 exposes desktop transaction cancellation for the main Cartographer flows. P6.46 adds App Framework cost ledger persistence plus Settings UI/export/clear controls for assistant and Cartographer calls. P6.47 makes chunk cache keys policy-versioned and aligns Electron main chunk indexing with custom chunk dimensions. P6.48 adds desktop prompt preview/revision UI for current Cartographer settings. P6.49 adds prompt profile revision history and rollback in Settings. P6.50 polishes the right sidebar into a more explicit map-control console with live context, quick prompts, action policy visibility, and collapsed operation audit. P6.51 moves hardened JSON workspace snapshot persistence into Storage Service. P6.52 moves workspace-hydration tab runtime registration and legacy cleanup into a single App Framework transaction. P6.53 promotes failed source recovery into a dedicated right-sidebar queue while preserving the no-fake-source-backed invariant. P6.54 adds primary-resource image/PDF snapshot support to DataService. P6.55 hardens ContentProvider secret references so DataService providers resolve env refs at runtime instead of treating API keys as renderer-owned settings. P6.56 makes assistant-requested chunk expansion scene-diff undoable. P6.57 adds redo support for persisted assistant operation records. P6.58 moves L0/L1 from radial chunk islands toward an Apple-Watch-style continuous bubble gallery and hardens the Electron runtime errors discovered while testing that canvas path.

## P6.58 Gallery And Runtime Hardening

Apple Watch Grid View establishes the interaction reference for the first bands: icons live in a continuous clustered field that can be panned, rearranged, and entered, while the chunk/cache boundary remains invisible to the user. SeekStar adopts that as a principle rather than cloning watchOS exactly:

- L0 Star Gallery and L1 Topic Field are continuous bubble-gallery bands.
- Level Runtime, not the AI provider, owns bubble positions for `bubble_gallery` modules.
- Adjacent chunks are shifted by chunk coordinates and should appear as nearby offscreen material, not as separate rings or spirals.
- Relations in macro bands are sparse local adjacency hints; old long radial relations are filtered by Pixi projection so existing workspaces do not need manual reset.
- Chunk lifecycle panels remain diagnostics, not the visual structure of the map.

The same pass hardens the desktop runtime around the observed failure modes: transient Windows `rename` failures while writing the AI cost ledger are retried and no longer abort Cartographer transactions, tab renderer loads retry through short dev-server timing failures, and chunk subscriptions replace old `destroyed` listeners instead of accumulating them on the same WebContents.

## P6.59 MVP Layout Cleanup And DeepSeek Adapter

P6.59 removes the old radial/spiral fallback from the MVP layer runtime. AI Service may return semantic nodes, relations, source candidates, and diagnostics, but it no longer owns visible coordinates. Level Runtime derives coordinates from the layer module:

- `bubble_gallery` for Supra Macro, L0 Star Gallery, L1 Topic Field, and recursive seed fields;
- `source_compass` for L2 source orientation;
- `tile_field` for L3 webpage/document/image candidates;
- `deep_lens` for text/selection decomposition.

This makes per-layer CLI debugging stable: the same seed, level, chunk, prompt profile, and provider output produce the same spatial contract, and old provider/mock radial hints cannot re-enter the product path.

The same pass adds a first-class DeepSeek AI provider preset to Settings. It uses DeepSeek's OpenAI-compatible endpoint `https://api.deepseek.com`, default model `deepseek-v4-flash`, and environment key reference `DEEPSEEK_API_KEY`. Routes still use the existing App Framework provider/route boundary; activating a provider in Settings now also points the Cartographer routes at that provider so "active provider" means real generation will use it.

## P6.60 Destructive App Gallery Projection Cleanup

P6.60 treats old L0/L1 radial and chunk-island scenes as incompatible MVP artifacts. Instead of preserving them, Pixi projection now owns the visible App Gallery contract:

- L0 and L1 ignore persisted `position_hint` values during rendering.
- L0 and L1 render as a continuous deterministic bubble gallery inspired by Apple Watch Grid View.
- Macro-layer relation lines are suppressed in the default product path so old hub-and-spoke relations cannot visually recreate a spiral.
- The default chunk debug HUD is removed from the main canvas; chunk records remain runtime diagnostics for future Advanced/dev surfaces.
- The default prompt profile is bumped to `seekstar-default-p6-gallery-v3`, and old P6 profile ids normalize into the new profile to avoid stale chunk cache reuse.

This is intentionally destructive. During MVP, user-facing coherence of the telescope canvas has higher priority than compatibility with mock-stage cached terrain.

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
5. Move center canvas consumption from old `TerrainScene`-first rendering toward chunk-runtime subscriptions. The P6.2 bridge is the first compatibility step; P6.3 adds the in-memory runtime host, P6.4 adds the JSON chunk storage adapter, P6.5 adds the port-based coordinator, P6.6 wires that coordinator into the Electron main/preload boundary, P6.7 makes the renderer request and persist L0-L3 chunks for default/new keyword seeds, P6.8 gives Cartographer chunks their own projection mode and rendering priority, P6.9 makes viewport-edge movement request adjacent `expand_horizontal` chunks, P6.10 surfaces compact generation/cache feedback, P6.11 routes chunk generation through desktop AI provider settings, P6.12 makes band modules/profile policy inspectable and runtime-enforced, P6.13 adds AI prompt preview for single-request debugging, P6.14 adds per-band provider/model route settings, P6.15 adds a separate assistant/control protocol, P6.16 wires the first desktop right-sidebar assistant bridge, P6.17 adds user-run assistant action execution, P6.18 adds a visible local operation log, P6.19 adds local chat history plus action review cards, P6.20 persists assistant sessions through the App Framework JSON store, P6.21 adds permission/audit metadata for assistant operations, P6.22 adds the first assistant permission policy setting plus shell enforcement, P6.23 adds visible tab-scoped chunk lifecycle/preload-ring state in the canvas, P6.24 promotes applied chunk lifecycle records into the constellation-engine coordinator result, P6.25 persists those tab-scoped records through the App Framework JSON store, P6.26 centralizes renderer chunk request transactions before a full host migration, P6.27 moves chunk transaction lifecycle writing/broadcasting into Electron main, P6.28 moves the multi-level seed bootstrap schedule into Electron main, P6.29 moves viewport expansion request construction into Electron main, P6.30 retires raw/generic chunk IPC from the product bridge, P6.31 adds a dedicated failed-source replacement transaction, P6.32 adds a per-action assistant permission matrix, P6.33 adds tab-scoped chunk host subscriptions, P6.34 separates failed source retry/replacement review, P6.35 adds the first durable assistant undo hook, P6.36 adds first-class chunk boundary controls, P6.37 makes AI-created seed tabs undoable by closing the created tab, P6.38 makes assistant source observation undoable by restoring the pre-observation scene snapshot, P6.39 makes the right sidebar AI-first, P6.40 switches new source-observation undo records to scene diffs, P6.41 makes chunk scheduling policy/range configurable, P6.42 adds editable per-band prompt profile overrides, P6.43 adds call-level AI telemetry and cost estimates, P6.44 adds cancellable AI generation/runtime calls, P6.45 adds desktop transaction cancel controls, P6.46 adds a persistent AI cost ledger with settings UI/export, P6.47 adds policy-versioned chunk cache keys plus custom-dimension chunk indexing, P6.48 adds Settings prompt preview/revision inspection, P6.49 adds prompt profile history/rollback, P6.50 polishes the right-sidebar AI map-control console, P6.51 hardens workspace snapshot persistence through Storage Service, P6.52 moves workspace-hydration tab runtime sync into Electron main, P6.53 adds the source recovery queue for failed candidates, P6.54 adds primary-resource image/PDF snapshots, P6.55 hardens ContentProvider env-secret references, P6.56 makes assistant chunk expansion scene-diff undoable, P6.57 adds redo support to persisted assistant operation records, and P6.58 makes macro-band chunk output read as one continuous App-Gallery field while hardening the Electron runtime errors found in that path.
6. Replace the remaining right inspector surfaces with a full AI chat/control panel. P6.39 starts this by making the assistant panel primary and demoting old context/source/debug surfaces into grouped sections.
7. Keep DataService as the validation/loading tool for source candidates.

Existing P5 DataService, source snapshot, and browser absorption work should be reused as validation/loading infrastructure, not as the primary content-generation model.
