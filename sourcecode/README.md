# SeekStar Source Monorepo

This directory is the active SeekStar monorepo root. Repository-level overview lives in [`../README.md`](../README.md).

## Structure

```text
sourcecode/
|- apps/
|  `- desktop/              # Electron + React desktop observatory
|- packages/
|  |- core-schema/          # Shared TerrainScene and protocol types
|  |- constellation-engine/ # Telescope events, object pools, source terrain, Pixi projection
|  |- scout-service/        # Scout/DataService provider registry and Playwright providers
|  |- ai-service/           # AI provider/context/structured-output boundary
|  |- level-runtime/        # Chunked AI Cartographer level runtime, CLI-testable outside Electron
|  `- storage-service/      # Storage/cache ports with JSON adapter today
|- docs/
|  |- architecture/
|  |- archive/              # Superseded implementation history and legacy root docs
|  `- decisions/
|- AGENTS.md
|- PRD.md
|- PHILOSOPHY.md
|- PHILOSOPHY.zh.md
|- ARCHITECTURE_AND_UI_SPEC.md
`- UI_STYLE_GUIDE.md
```

Paths in this directory are relative to `sourcecode/`.

## Local Commands

```bash
npm install
npm run typecheck
npm run build
npm run smoke:modules
npm run smoke:modules:public
npm run dev
```

Development mode opens detached DevTools by default. Restart Electron fully after changing the main process or preload boundary.

`smoke:modules` verifies the local DataService provider registry -> Scout -> Constellation Engine -> App Shell data path without relying on public network access. `smoke:modules:public` additionally checks browser-mediated public web search and requires network access.

## Key Documents

- `PHILOSOPHY.md`: product philosophy (English normative edition).
- `PHILOSOPHY.zh.md`: 项目哲学（中文版，与英文版同步）。
- `PRD.md`: product requirements.
- `AGENTS.md`: agent operating rules.
- `ARCHITECTURE_AND_UI_SPEC.md`: architecture and UI specification.
- `UI_STYLE_GUIDE.md`: visual system and shell standards.
- `docs/architecture/`: architecture slices, service contracts, 12Level/P6 telescope runtime.
- `docs/status/`: project closure and phase status records.
- `docs/archive/`: superseded implementation history kept out of the current baseline.
- `docs/decisions/`: architecture decision records.

## Current Mainline Status

SeekStar is past mock-era cleanup and is in core usability construction. The five-module boundary is active: Electron App Framework, Constellation Engine, Scout/DataService, AI Service, and Storage/Cache Service.

P6 redirects the mainline toward AI Cartographer-driven terrain generation. DataService remains the validation/loading layer for source candidates, but L0-L3, recursive seeds, orphan context, and horizontal frontier chunks are intended to be primarily generated and organized by AI, then cached and verified where source surfaces are needed.

The current usable spine includes:

- default New Seek opens as an AI-generated `default_tonight_sky` star field; seed input is an auxiliary entrance, not the empty first screen;
- default scenes are empty tab/runtime/layer containers until AI Cartographer or real source intake supplies terrain;
- domain lexicons are prompt hints controlled by `domain_hint_mode` (`guided` or `pure_ai`), not visible default nodes or a hard-coded gallery;
- product AI routing defaults to DeepSeek through the OpenAI-compatible provider boundary, supports a direct masked API key plus env fallback, and fails clearly without a key instead of using mock terrain;
- canonical 12Level terrain schema and Pixi projection;
- Constellation Engine event reducer, object pool, source terrain intake, and workspace persistence coordinator;
- Electron tab/window runtime with docked and detached tab surfaces;
- L3 tile projection with visible-tile thumbnail prewarm and absorbed live browser surfaces;
- `TerrainScene.runtime` for focused tile and browser absorption session state;
- direct URL command intake that runs Scout and creates source-backed L3 webpage/document tiles without synthetic fallback;
- main content runtime projection that separates domain gallery, source intake pending/failed, real source tile fields, browser absorption, text grain, and empty source fields;
- hyperlink-created tabs that run direct URL Scout and hydrate into source-backed L3 webpage/document terrain;
- Storage Service workspace change notifications so saved terrain updates propagate across docked and detached tab renderers without refresh hacks.
- Constellation Engine `ScoutJobCoordinator` for Scout plan execution, failure observations, frontier/outlink placement, hyperlink intake, and observation-to-source conversion.
- Constellation Engine `TabSessionCoordinator` for open/close/reorder/activate tab-session transactions over Storage and App Framework tab runtime ports.
- P5.13-P5.16 telescope closure work: core `SourceSnapshot` protocol, snapshot-backed source terrain, profile-based text-grain materialization, direct URL target-tab writeback, main content mode projection, DataService provider registry, and animated tile absorption handoff before live browser surfaces mount.
- module smoke coverage for DataService source observation, page-outlink `SearchCandidate` discovery, Scout capture, Constellation Engine source-backed L3 ingestion, Pixi main-content projection, App Shell workspace hydrate, and public web search fallback.
- P5.17 content provider settings: shared provider catalog, default active arXiv/GitHub/Wikipedia/Wikidata plus local Playwright browser-assisted fallback, disabled URL-only Zhihu/Runoob providers, and settings-driven Scout registry rebuilds.
- P5.18 main content usability: keyword discovery now enters an L3 Pixi `source_candidate_field`; candidate URL tiles are selectable and observable, but only observed source snapshots become source-backed L3 tile surfaces and live browser absorption targets.
- P6 design baseline: AI Cartographer as primary terrain producer, chunked Level Runtime, Deep Lens replacing many separate visible text-grain levels, and right sidebar redesign into AI map chat/control surface.
- P6.1 AI Cartographer foundation: `@seekstar/ai-service` now has an OpenAI-compatible provider boundary, JSON validators, missing-key diagnostics, and CLI `generate` / `validate`; `@seekstar/level-runtime` emits schema-valid chunk outputs for Supra Macro, L0, L1, L2, L3, Deep Lens, and Recursive Seed when supplied an explicit generator.
- P6.2 runtime bridge foundation: `@seekstar/constellation-engine` can now apply Level Runtime output into a `TerrainScene` as `cartographer_primary` nodes plus L3 `cartographer_unverified_source` Scout observations; Pixi projection sees those observations as `source_candidate_field` and still refuses to create source-backed tile surfaces without DataService evidence.
- P6.3 chunk runtime host foundation: `@seekstar/level-runtime` now includes `ChunkedLevelRuntimeHost` with cache keys, miss/hit/refresh semantics, one-ring preload execution, cache byte estimates, and LRU/LFU-style eviction by access count and last access time.
- P6.4 chunk storage foundation: `@seekstar/storage-service` now includes `JsonLevelChunkStorage` for saving, loading, listing, clearing, and pruning Level Runtime chunk cache records. This is the JSON adapter before SQLite/FTS.
- P6.5 Cartographer lifecycle coordinator: `@seekstar/constellation-engine` now includes `CartographerChunkCoordinator`, a port-based runtime wrapper that checks chunk storage, calls a Level Runtime generator on miss/refresh, saves cache records, preloads nearby chunks, and applies the active chunk into a `TerrainScene`.
- P6.6 desktop Cartographer bridge foundation: the Electron main process registers a `CartographerChunkCoordinator` bridge backed by `runLevelRuntime` and `JsonLevelChunkStorage` under Electron `userData`, so renderer code does not own generation, cache, or storage orchestration.
- P6.7 renderer bootstrap subscription: desktop `useExplorationSession` first consumed the bridge to bootstrap L0-L3 Cartographer terrain for default/new keyword seeds, persists the applied scene, and leaves direct URL/source observation on the DataService validation path. Keyword seeds no longer trigger browser-assisted Scout search as the default terrain producer.
- P6.8 Cartographer canvas presentation: Pixi main-content projection now has `cartographer_chunk_field` for AI-generated terrain chunks; renderer filtering promotes `cartographer_primary` nodes and hides old local scaffold nodes when Cartographer material exists on the layer. Cartographer nodes and relations also have distinct visual styling from source-backed tiles, fog, and legacy local affordances.
- P6.9 viewport chunk expansion: horizontal canvas movement on L0-L3 now requests adjacent Cartographer chunks with `expand_horizontal`, applies the returned scene, and persists it. The old Scout frontier remains available for non-Cartographer layers, but AI chunking is now the default macro exploration path.
- P6.10 chunk generation feedback: desktop session state now tracks Cartographer chunk generation/applied/error phases, and the Pixi canvas shows a compact status badge with level, chunk key, and cache state while chunk bootstrap or viewport-edge expansion runs.
- P6.11 AI provider routing: desktop settings now include an AI Cartographer provider page with active-provider selection, OpenAI-compatible base URL/model/env-key reference, timeout, and retry settings. The Electron Cartographer bridge reads those settings and instantiates `AiCartographerService` for chunk generation instead of hard-coding a synthetic generator.
- P6.12 band profile modules: `@seekstar/level-runtime` now owns explicit per-band module definitions for Supra Macro, L0, L1, L2, L3, Deep Lens, and Recursive Seed. Runtime prompts receive each module's role, brief, constraints, layout family, target density, and source-candidate policy; CLI commands can inspect profiles and individual modules without launching Electron.
- P6.13 AI prompt preview: `@seekstar/ai-service` now exports the Cartographer message builder and CLI `prompt --input`, so a single band/module generation request can be inspected before calling a real model.
- P6.14 per-band model routes: desktop AI settings now include route rules by level and generation mode. The Cartographer bridge resolves the matching route for each chunk request, so L3, Deep Lens, or future expensive/cheap bands can override provider/model without changing Level Runtime or renderer code.
- P6.15 AI map assistant protocol: `@seekstar/ai-service` now has a separate `assist()` path for right-sidebar map chat/control intents such as answer, navigate, expand, summarize, and explain. It includes strict assistant output validation, allowed app action types, and CLI `assist` / `assistant-prompt` / `validate-assistant` commands.
- P6.16 desktop assistant bridge: Electron main/preload now exposes `seekstar.ai.assist`, resolving the active AI provider from settings without exposing keys to the renderer. The right sidebar has a minimal AI map assistant panel that sends current tab/layer/selection context and displays validated answers plus suggested app actions.
- P6.17 assistant action execution: the right-sidebar assistant suggestions are now explicit user-run buttons. App Framework maps validated actions to existing operations for focusing nodes, requesting adjacent chunks, observing source candidates or URLs, creating seed tabs, and opening settings, while AI still cannot drive frame-level canvas interaction.
- P6.18 assistant operation log: the sidebar now records local execution status for assistant-suggested operations, showing running/done/error outcomes as App Framework results rather than invisible model-side state.
- P6.19 assistant chat history and action review: the right sidebar now keeps a compact local chat history for map-control turns. Each response carries reviewable action cards with operation type, target, level, and seed context before the user runs them.
- P6.20 persistent assistant sessions: Electron main now owns a JSON assistant-session store under userData. Preload exposes load/save/clear session APIs, and the right sidebar hydrates chat history plus operation logs per tab while keeping provider/key resolution and actual app operations outside renderer state.
- P6.21 assistant permission/audit metadata: user-run assistant operations now persist approval and audit fields including action type, target id, level, seed, requested/approved/completed timestamps, and permission status. Click-to-run remains the first permission boundary.
- P6.22 assistant permission policy settings: Settings > AI Cartographer now includes an App Framework action permission mode (`ask_each_time`, `allow_low_risk`, `block_all`). The desktop shell enforces `block_all`, the sidebar disables blocked actions, and low-risk clicks are recorded distinctly from explicit approvals.
- P6.23 chunk runtime visibility: the renderer now keeps tab-scoped Cartographer chunk records for seed bootstrap, queued viewport-edge expansion, active generation, coordinator preloads, cache status, and failures. The canvas shows a compact current-chunk/preload-ring panel so chunk-runtime state is visible separately from the old `TerrainScene` projection.
- P6.24 engine-owned chunk lifecycle records: `@seekstar/constellation-engine` coordinator results now include applied active/preload lifecycle records with role, level, chunk key, cache status, and timestamps. Desktop consumes those records for the chunk panel instead of inferring successful preload state from raw outputs.
- P6.25 durable chunk lifecycle store: Electron main now owns `seekstar-cartographer-chunks.json` under userData. Preload exposes chunk-record load/save/clear APIs, and desktop hydrates tab-scoped chunk lifecycle records so the preload ring survives renderer reloads without becoming scene fact.
- P6.26 renderer chunk transaction boundary: desktop renderer now routes bootstrap and viewport-edge expansion through a small `cartographerRuntimeClient` helper that owns started/applied/error lifecycle records and status updates. `useExplorationSession` keeps scene persistence, but request bookkeeping is no longer duplicated in each path.
- P6.27 App Framework chunk transaction boundary: Electron main introduced `cartographer:run-chunk-transaction`, writes started/applied/error lifecycle records into the chunk store, and broadcasts `cartographer-chunks:changed` snapshots. Later specialized transactions use the same ownership pattern while renderer subscribes and merges snapshots instead of owning lifecycle persistence.
- P6.28 main-process seed bootstrap transaction: Electron main now exposes `cartographer:run-bootstrap-transaction` and owns the ordered L0-L3 seed bootstrap schedule. Renderer sends one bootstrap intent, receives the final scene, and persists it without looping through each Cartographer level itself.
- P6.29 main-process viewport expansion transaction: Electron main now exposes `cartographer:run-viewport-expansion-transaction` and owns chunk-key resolution, seed/context construction, `expand_horizontal` request creation, lifecycle writes, and preload broadcasts for L0-L3 viewport-edge expansion. The renderer only detects viewport movement, debounces the intent, merges the returned scene, and persists it.
- P6.30 narrowed Cartographer IPC surface: raw `cartographer:request-chunk` and generic `cartographer:run-chunk-transaction` handlers are retired from the desktop bridge. Product code now crosses the preload boundary through intent-level bootstrap and viewport-expansion transactions instead of arbitrary Level Runtime request envelopes.
- P6.31 source replacement transaction: failed source observations can now request AI replacement candidates through `cartographer:run-source-replacement-transaction`. Electron main owns the `replace_failed_source` request, failed-observation context, lifecycle records, and scene application; the right sidebar exposes this as `Replace candidate`.
- P6.32 assistant action permission matrix: Settings > AI Cartographer now stores per-action decisions for `focus_node`, `request_chunk`, `observe_source`, `create_seed`, and `open_settings`. The right-sidebar assistant labels low-risk/approval/blocked actions from that matrix, while the App shell enforces blocked actions before running any assistant-suggested operation.
- P6.33 chunk host subscription: renderer no longer hydrates or saves Cartographer chunk lifecycle records directly. Preload exposes `subscribeChunkRecords(tabId, callback)`, Electron main owns tab-scoped snapshot replay plus targeted broadcasts, and chunk records remain App Framework runtime state instead of React-owned persistence.
- P6.34 source candidate review split: failed Scout observations now present two explicit review paths in the right sidebar: retry the original URL through DataService, or ask AI Cartographer for replacement candidates. This keeps source verification and AI replacement separate instead of hiding both under one ambiguous action.
- P6.35 assistant undo audit baseline: assistant operation records now persist undo metadata. The first safe undo hook restores viewport and selection for `focus_node` and `request_chunk` actions; source/tab mutating actions were audited but intentionally non-undoable at this stage until stronger transaction rollback models arrived.
- P6.36 chunk boundary controls: the canvas chunk runtime panel now exposes an automatic boundary expansion toggle, current-chunk refresh, and directional north/east/south/west preload controls. Manual controls reuse the App Framework viewport-expansion transaction, while pausing auto discovery prevents drag movement from scheduling new chunks.
- P6.37 seed-tab rollback: assistant `create_seed` actions now record a `close_created_tab` undo context. The operation log can close the AI-created seed tab through the tab-session transaction path; at this point source-observation rollback still required a separate scene-diff or snapshot strategy.
- P6.38 source-observation rollback: assistant `observe_source` actions first gained rollback by recording a pre-observation scene snapshot and restoring it through workspace persistence. This conservative shell-owned path was later shrunk to scene diffs.
- P6.39 AI-first right sidebar: the right sidebar now opens as an AI map control surface first. Legacy overview/selection/search content is grouped under Map context, source candidate actions under Source review, and Cartographer/manual/tray diagnostics under Advanced.
- P6.40 scene-diff rollback: new assistant `observe_source` undo records now store a compact scene rollback diff instead of a full scene snapshot. Legacy snapshot undo contexts remain readable for local session compatibility.
- P6.41 configurable chunk scheduling: Settings > AI Cartographer now controls automatic boundary expansion, preload ring, debounce, macro chunk dimensions, and manual directional preload range. The canvas chunk panel displays those values, and App Framework scheduling uses them before invoking the existing viewport-expansion transaction.
- P6.42 editable prompt profile overrides: Settings > AI Cartographer now stores language, density, and per-band target count, prompt brief, and constraints. Electron main passes those overrides into Level Runtime for bootstrap, viewport expansion, and failed-source replacement; Level Runtime injects them into `context.level_module` and prompt-revision cache keys.
- P6.43 AI telemetry baseline: AI Service now attaches attempts, timing, token usage when providers return it, and optional USD cost estimates to generation/assistant outputs. Settings can store OpenAI-compatible input/output price rates; module smoke covers fixture telemetry and the shared cost estimator.
- P6.44 AI cancellation baseline: AI Service generation and assistant calls now accept `AbortSignal`, return explicit `cancelled` status with `ai.cancelled` diagnostics, and keep timeout separate from user cancellation. Level Runtime passes cancellation through its generator boundary, and module smoke covers generation, assistant, and runtime cancellation.
- P6.45 desktop transaction cancel controls: Cartographer bootstrap, viewport expansion, and failed-source replacement transactions now run under tab-scoped AbortControllers in Electron main. Preload exposes `cartographer.cancelTransaction`, the canvas chunk runtime panel shows a Cancel control while generating, and coordinator smoke proves cancelled chunks do not apply scene output or persist cache records.
- P6.46 AI cost ledger: Electron App Framework now persists assistant and Cartographer call telemetry into `seekstar-ai-cost-ledger.json`, exposes load/export/clear APIs through preload, and Settings > AI Cartographer shows total cost/tokens plus recent provider calls.
- P6.47 policy-versioned chunk cache: Level Runtime and Constellation Engine now include chunk width/height policy revisions in cache keys and output layout, Storage Service writes schema revision 2 chunk records with `chunk_policy_key`, and Electron main uses configured chunk dimensions for viewport/source-replacement transactions instead of hard-coded defaults.
- P6.48 desktop prompt preview: Settings > AI Cartographer can now ask Electron main to build the exact Cartographer system/user messages for a selected level, mode, and seed. The preview includes provider/model identity and a deterministic prompt revision without calling a model.
- P6.49 prompt profile history: Settings now persists up to 20 Cartographer prompt profile revisions, each with a revision hash and full profile snapshot. Users can save the current profile, restore a previous revision, or delete stale revisions.
- P6.50 right-sidebar map control polish: the AI-first sidebar now exposes compact active-map context, action policy, source/candidate counts, quick prompts for explain/navigate/expand/review, and a collapsed operation audit. This keeps the sidebar oriented around map control while preserving explicit user-run App Framework actions.
- P6.51 Storage workspace adapter hardening: `@seekstar/storage-service` now owns the JSON workspace snapshot adapter with atomic writes, schema inspection, corrupt JSON quarantine, and CLI `validate`. Desktop workspace IPC reuses that adapter instead of maintaining a separate snapshot writer.
- P6.52 App Framework tab sync transaction: Electron main now exposes `tabs:sync-workspace-tabs`, a single tab-runtime transaction for workspace hydration. Renderer no longer loops through `tabs.create`/`activate`/deprecated-tab cleanup during startup; it forwards workspace tab metadata and lets the shell own runtime registration, active tab state, and legacy tab removal.
- P6.53 source recovery queue: failed Scout/source candidates now surface in a dedicated right-sidebar recovery queue with explicit `Retry original`, `Ask AI replacement`, and `Open as Seek` actions. Failed candidates remain out of the main canvas until DataService evidence or Cartographer replacement succeeds.
- P6.54 asset snapshot baseline: `SourceSnapshot` now carries `primary_resource`, byte length, preview URL, and image dimensions fields. Scout recognizes direct `image/*` and PDF resources through the DataService observer path instead of treating every URL as HTML, and module smoke covers local HTML, image, and PDF snapshots.
- P6.55 provider secret-reference hardening: Content provider settings now carry an explicit `api_key_ref` shape for environment-variable references, Settings edits only the reference name, Scout resolves provider secrets at runtime, and module smoke covers both new env refs and legacy `api_key_env_var` migration without storing plaintext provider keys.
- P6.56 assistant chunk rollback: assistant `request_chunk` actions now run a synchronous App Framework viewport-expansion transaction, persist the returned scene, and record a scene-diff undo context. Undo can remove assistant-generated chunk terrain instead of merely restoring viewport/selection.
- P6.57 assistant redo baseline: assistant operation records now persist the original validated action plus redo timestamps. After an undo, the sidebar can redo the same action through the App Framework boundary and refresh the undo context from the new result.
- P6.58 App Gallery runtime hardening: L0/L1 Cartographer output now uses a deterministic continuous bubble-gallery layout instead of provider-authored radial positions. Chunk preloads remain cache/runtime boundaries, but the canvas presents them as one offscreen-prepared field inspired by Apple Watch Grid View behavior. The Pixi projection filters old long macro relations, Electron retries transient tab-renderer loads, the chunk subscriber avoids repeated destroyed listeners, and Cartographer cost-ledger writes tolerate transient Windows rename failures.
- P6.59 MVP layout cleanup and DeepSeek adapter: the old radial/spiral Level Runtime fallback is removed. AI providers now supply semantic material only; Level Runtime owns all L0-L3/Deep Lens/Recursive Seed coordinates by layout family, and the default profile is `seekstar-default-p6-gallery-v3`. Settings now includes a DeepSeek OpenAI-compatible provider preset (`https://api.deepseek.com`, `deepseek-v4-flash`, `DEEPSEEK_API_KEY`) so real per-layer CLI/UI testing can use the same provider boundary once the env key is available.
- P6.60 destructive App Gallery projection cleanup: the MVP renderer no longer trusts persisted L0/L1 `position_hint` values or macro relations. Pixi projection derives a continuous Apple-Watch-like bubble field for L0/L1 at render time, filters old hub-and-spoke relation lines, and removes the default chunk debug HUD from the main canvas.
- MVP doctrine documentation reset: PRD, AGENTS guidance, and P6 architecture notes now treat old logic/caches/UI/fallbacks as deletion targets during MVP; AI Cartographer is the primary L0-L3 terrain producer; DataService is a validation/loading/tool boundary; Deep Lens replaces visible L4-L10 detail layers; failed source candidates stay out of the main canvas; the right sidebar is AI map control first.
- P6.62 opening sky and real-provider path: default New Seek uses `default_tonight_sky`, visible scaffold/domain fallback nodes are removed from the product canvas, domain lexicons are prompt hints only, DeepSeek/OpenAI-compatible routing is the default real generation path, and missing keys fail clearly instead of producing mock terrain.
- P6.63 closure complete: workspace load failures no longer overwrite snapshots, continuous telescope layer transitions reject stale Cartographer results, L3 source candidates stay in review/recovery until DataService creates source-backed tiles, L2/L3 expansion is on-demand by default, and mojibake AI/cache output is rejected before scene/cache write.

P6 is closed at P6.63. The closure record is [`docs/status/p6-closure.md`](docs/status/p6-closure.md).

Next after P6:

- extractor providers behind the DataService registry;
- OS-backed encrypted key storage for providers that need more than environment references;
- SQLite/FTS/vector-backed durable storage beyond the current JSON adapters;
- full local-file Ground Mode;
- stronger Deep Lens and file snapshot materialization.
