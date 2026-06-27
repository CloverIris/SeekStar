# @seekstar/ai-service

AI Service is the P6 Cartographer boundary.

It should not become a chat-only utility. Its primary job is to generate, organize, validate, and explain structured terrain for SeekStar's chunked level runtime.

## P6.1 Implementation

The package now provides the first OpenAI-compatible boundary and CLI harness:

- `AiCartographerService` with an OpenAI-compatible provider boundary;
- direct `api_key_value`, explicit env references, then `SEEKSTAR_AI_API_KEY` / `OPENAI_API_KEY` fallback for real calls;
- explicit `missing_key` outputs when no key is available;
- structured JSON validation for nodes, relations, and source candidates;
- CLI commands:

```bash
node packages/ai-service/dist/cli.js status
node packages/ai-service/dist/cli.js generate --input input.json --provider deepseek --api-key-env DEEPSEEK_API_KEY
node packages/ai-service/dist/cli.js prompt --input input.json
node packages/ai-service/dist/cli.js assist --input assistant-input.json --provider deepseek --api-key-env DEEPSEEK_API_KEY
node packages/ai-service/dist/cli.js assistant-prompt --input assistant-input.json
node packages/ai-service/dist/cli.js validate --input output.json
node packages/ai-service/dist/cli.js validate-assistant --input assistant-output.json
```

## Provider Target

The implementation boundary supports:

- `base_url`;
- model id;
- API key reference;
- request timeout;
- retry/fallback policy;
- token/cost/time accounting;
- structured JSON output validation;
- request cancellation through `AbortSignal`; persistent cost ledgers and UI/export live above this package in the desktop App Framework.

No permanent plaintext API keys should be written to project JSON. Secret storage can start as a key reference and later move to OS-backed encryption.

AI Service is a real-provider boundary, not a product mock fallback. Product routes should resolve to OpenAI-compatible providers such as DeepSeek, validate structured JSON, return explicit diagnostics, and surface telemetry. Deterministic fixtures belong in tests only.

The provider should receive compact, band-specific generation input. Full prompt profiles, all level modules, distant scene nodes, and verbose debug payloads should not be sent on every terrain request. Level Runtime/App Framework are responsible for reducing a scene into the active module, focus anchor, nearby anchors, movement vector, source-candidate policy, and compact chunk settings before calling `generate()`.

## Cartographer Jobs

Core generation modes:

- `bootstrap_seed`;
- `expand_horizontal`;
- `decompose_down`;
- `summarize_up`;
- `replace_failed_source`;
- `navigate_or_explain`.

Each mode should be testable through CLI with JSON input and JSON output.

The current P6 desktop chunk bridge calls the terrain-generation subset (`bootstrap_seed`, `expand_horizontal`, `decompose_down`, `summarize_up`, `replace_failed_source`). `navigate_or_explain` remains the future right-sidebar chat/control job and should not be routed through frame or chunk generation.

P6.15 implements that split as `AiCartographerService.assist()`. The assistant path accepts map chat/control intents such as `answer_question`, `navigate`, `expand_map`, `summarize_selection`, and `explain_source`. It returns a natural-language answer plus validated app action suggestions from a small allowed set: `focus_node`, `request_chunk`, `observe_source`, `create_seed`, `open_settings`, or `none`.

The assistant path is intentionally separate from `generate()`: it should power the future right sidebar and app-operation agent, not chunk generation or Pixi frame interaction.

P6.16 adds the first desktop consumer. Electron main/preload exposes `seekstar.ai.assist`, resolves provider settings in the main process, and lets the renderer send current map context without exposing provider keys. The current sidebar panel displays validated answers and suggested actions only; executing those actions remains a later App Framework control step.

P6.17 connects those suggestions to the desktop App Framework as explicit user-run actions. The renderer still treats `AiAssistantOutput.actions` as suggestions, but the app can now execute validated `focus_node`, `request_chunk`, `observe_source`, `create_seed`, and `open_settings` operations through existing handlers after the user clicks. AI Service continues to provide typed intent; it does not own UI mutation, scene persistence, or frame interaction.

P6.18 adds the first visible operation trace in the desktop sidebar. User-run assistant actions now show running, done, and error outcomes based on App Framework execution. This remains outside AI Service state; the service returns structured suggestions, while the shell records what actually happened.

P6.19 adds local chat history and action review in the desktop sidebar. A response is no longer just a transient answer: the UI keeps recent turns and renders each suggested operation as a review card with type, target, level, and seed context. AI Service still only returns typed suggestions; the shell owns review, execution, and history presentation.

P6.20 persists that sidebar session through the desktop App Framework. Electron main owns the assistant-session JSON store, preload exposes load/save/clear APIs, and the right sidebar hydrates turns plus operation logs per tab. AI Service remains stateless for assistant calls; it does not save chat history or own App Framework operation results.

P6.21 adds permission and audit metadata to persisted assistant operations. User-run actions record `approved_by_click`, action type, target id, level, seed, and requested/approved/completed timestamps. These fields live in the desktop assistant session store, not in provider output, so AI Service remains a stateless protocol boundary.

P6.22 adds a desktop permission policy setting for assistant actions. The policy is enforced by the App Framework (`ask_each_time`, `allow_low_risk`, or `block_all`) and recorded in assistant-session audit metadata. AI Service does not decide whether an action may run; it only returns validated suggestions.

P6.23 adds canvas-side chunk lifecycle visibility in the desktop renderer. That runtime state remains an App Framework/Level Runtime concern; AI Service still returns structured generation or assistant suggestions and does not persist chunk records.

P6.24 promotes applied active/preload chunk lifecycle records into the constellation-engine coordinator result. AI Service remains below that boundary: providers generate structured terrain, while the runtime/coordinator reports cache and chunk lifecycle state.

P6.25 persists those chunk lifecycle records in the desktop App Framework JSON store. This remains outside AI Service: providers do not read or write chunk lifecycle history.

P6.26 adds a desktop renderer transaction helper for chunk request bookkeeping. AI Service remains below that helper and continues to return only structured generation or assistant suggestions.

P6.27 moves chunk transaction lifecycle writing and broadcasting into Electron main. AI Service still does not own request lifecycle, cache visibility, or renderer subscription state; it only generates structured Cartographer content.

P6.28 moves the default/new seed bootstrap schedule into Electron main as a single App Framework transaction. AI Service still receives ordinary structured generation requests one level at a time; it does not know whether `bootstrap_seed` and `decompose_down` calls came from startup bootstrap, viewport-edge expansion, retry, or a future chunk host.

P6.29 moves viewport-edge expansion request construction into Electron main as a dedicated App Framework transaction. AI Service still receives a normal `expand_horizontal` generation input and does not know whether the request was triggered by pointer movement, assistant navigation, preload, or a retry.

P6.30 retires raw/generic Cartographer chunk IPC from the desktop product bridge. AI Service is unaffected: explicit App Framework transactions still resolve provider settings and call `generate()` with ordinary structured inputs.

P6.31 turns `replace_failed_source` into a product transaction for failed source candidates. AI Service still only receives a normal generation request with failed-observation context; it does not probe URLs or decide whether replacement candidates should become source-backed.

P6.32 adds per-action assistant permission rules in the desktop shell. AI Service output is unchanged: it still proposes typed actions, while App Framework decides whether each clicked action is low-risk, requires explicit approval audit, or is blocked.

P6.33 adds tab-scoped Cartographer chunk lifecycle subscriptions in the desktop shell. AI Service remains stateless and does not own chunk lifecycle stores, subscription replay, renderer cache visibility, or preload-ring UI state.

P6.34 clarifies failed source review above AI Service. Retrying the original URL uses DataService/Scout; asking for replacement uses `replace_failed_source`. AI Service only proposes structured replacement candidates and does not decide whether the failed URL should be retried or hidden.

P6.35 adds durable undo metadata to assistant operation records in the desktop shell. AI Service output is unchanged: undo contexts are captured by App Framework before executing reversible actions such as `focus_node` and `request_chunk`; source/tab mutating actions were still non-undoable at this stage until shell transactions could roll them back safely.

P6.36 adds manual chunk boundary controls in the desktop shell. AI Service is still only called through the resulting Level Runtime request; it does not know whether an `expand_horizontal` request came from automatic viewport movement, a refresh button, or a directional preload control.

P6.37 adds the first tab-mutating undo above AI Service. When an assistant `create_seed` suggestion is executed, App Framework records a `close_created_tab` context and can undo by closing the created seed tab. The provider still only emits typed action suggestions; it does not author rollback plans.

P6.38 adds the first scene-mutating source-observation undo above AI Service. When an assistant `observe_source` suggestion succeeds, App Framework records the pre-observation target-tab scene and can undo by restoring that snapshot. The provider remains stateless and still does not emit rollback instructions.

P6.39 makes the desktop right sidebar AI-first above AI Service. The assistant panel is now the primary surface, while map context, source review, and advanced diagnostics are grouped below it. AI Service still only provides the assistant protocol and typed action suggestions; it does not own layout or shell information architecture.

P6.40 shrinks assistant `observe_source` undo payloads above AI Service. The desktop shell now stores a scene rollback diff rather than a full scene snapshot for new source-observation undo records. AI Service still does not generate rollback content.

P6.41 adds configurable chunk scheduling above AI Service. Settings now control automatic boundary expansion, preload ring, debounce, chunk dimensions, and manual directional range in the desktop shell. AI Service still receives ordinary structured generation requests only after App Framework schedules them; it does not know whether a request came from auto boundary movement, a directional preload button, refresh, or assistant navigation.

P6.42 adds editable prompt profile overrides above AI Service. Desktop settings now edit language, density, per-band target count, prompt brief, and constraints; Level Runtime applies those overrides before building `context.level_module`. AI Service receives the resulting structured generation input and prompt context, but it still does not own settings persistence, prompt-profile UI, or chunk cache invalidation.

P6.43 adds provider telemetry at the AI Service boundary. OpenAI-compatible calls now return attempts, start/completion timestamps, duration, provider token usage when available, and estimated USD cost when pricing is configured. Module smoke tests use local fixture output when deterministic terrain is needed; fixture generators are not exported as AI providers. AI Service still does not persist a cost ledger or decide UI presentation.

P6.44 adds the first provider cancellation baseline. `AiCartographerService.generate()` and `assist()` accept an optional `AbortSignal`, OpenAI-compatible providers return explicit `cancelled` outputs with `ai.cancelled` diagnostics, and provider timeout remains a separate `timeout` status. This gives App Framework transactions a real cancellation protocol without making AI Service own cancel buttons or renderer state.

P6.45 wires that protocol into the desktop Cartographer transaction layer above AI Service. Electron main owns tab-scoped transaction `AbortController`s for bootstrap, viewport expansion, and failed-source replacement, while the provider still only honors signals and returns structured `cancelled` results.

P6.46 consumes provider telemetry in the desktop App Framework ledger. Assistant and Cartographer calls append records to an Electron `userData` JSON store, and Settings > AI Cartographer can load, export, and clear the ledger. AI Service remains stateless: it emits telemetry fields on validated outputs but does not persist ledgers, own cost summaries, or decide UI presentation.

P6.47 makes chunk cache policy versioning explicit above AI Service. Chunk width/height, preload ring, manual range, and debounce feed Level Runtime cache keys and layout metadata, but the provider still only receives resolved structured settings/context and does not own cache invalidation.

P6.48 surfaces the existing message builder through the desktop App Framework. Settings can request a prompt preview for a selected level/mode/seed and inspect the exact system/user messages plus prompt revision before generation. AI Service still only owns `buildCartographerMessages`; Electron main owns provider/settings resolution and the renderer owns display.

P6.49 adds prompt profile history/rollback above AI Service. The desktop Settings store persists profile revisions and restores full prompt-profile snapshots, while AI Service remains responsible only for validating inputs and building messages from the resolved profile context.

P6.50 polishes the right-sidebar map-control surface above AI Service. Desktop renders active-map context, quick prompt shortcuts, action policy, and a collapsed operation audit before calling `assist()`. AI Service still only validates assistant requests/responses and suggests typed actions; it does not own sidebar state, quick-prompt UI, or App Framework execution.

P6.51 hardens workspace snapshot persistence outside AI Service. Storage Service now owns JSON workspace inspection, atomic writes, and corrupt-file quarantine, while Electron main owns IPC and path wiring. AI Service remains stateless and does not persist terrain, workspace snapshots, or assistant session files.

P6.52 moves workspace-hydration tab runtime registration into the App Framework. Electron main synchronizes runtime tab records from workspace metadata in one transaction; AI Service remains uninvolved in tab registration, active-tab state, or deprecated runtime cleanup.

P6.53 makes failed source recovery clearer above AI Service. The right sidebar presents failed Scout/source candidates as a recovery queue with retry, replacement, and open-as-seed actions. AI Service may generate replacement candidates through `replace_failed_source`, but it does not decide whether failed URLs are shown, hidden, retried, or promoted to source-backed terrain.

P6.54 extends DataService source snapshots outside AI Service. Scout now marks direct HTML/image/PDF URLs with a `primary_resource` shape and keeps image/PDF observation on the validation/loading path. AI Service may propose asset URLs, but DataService still verifies them before any L3 tile becomes source-backed.

P6.55 hardens DataService provider secret references outside AI Service. Content-provider API keys are represented as environment-variable references in `core-schema`, edited in Settings as references, and resolved by Scout at runtime. AI Service keeps its own provider key-reference boundary for model calls; it does not own DataService provider secrets or write plaintext keys into project JSON.

P6.56 broadens assistant undo above AI Service. `request_chunk` suggestions now execute through a synchronous App Framework viewport-expansion transaction and record a scene-diff undo context, so generated chunk terrain can be removed from the operation log. AI Service still emits only the typed `request_chunk` suggestion; it does not generate rollback instructions or mutate scenes.

P6.57 adds redo at the assistant-session layer above AI Service. The shell persists the original validated action with each operation record, and after undo can replay that action through the same user-run App Framework boundary. AI Service remains stateless: it does not author redo plans and does not know whether a typed action is first-run or replayed.

## Desktop Provider Routing

P6.11 adds the first App Framework settings boundary for this package.

Desktop settings can now choose an active Cartographer provider:

- DeepSeek as the default OpenAI-compatible provider;
- custom OpenAI-compatible providers configured by `base_url`, `model`, direct key/env-key reference, timeout, and retry knobs.

The Electron Cartographer bridge loads settings for each chunk request, resolves the active provider into `AiCartographerService`, and passes that service into `@seekstar/level-runtime`. Settings support a local masked API key value plus env references such as `DEEPSEEK_API_KEY`, `SEEKSTAR_AI_API_KEY`, or `OPENAI_API_KEY`.

P6.59 adds DeepSeek as a first-class OpenAI-compatible settings preset above this package. The AI Service implementation remains generic: Settings supplies `base_url: https://api.deepseek.com`, `model: deepseek-v4-flash`, and either `api_key_value` or `api_key_ref: { kind: "env", name: "DEEPSEEK_API_KEY" }`. CLI generation uses the same real provider boundary; deterministic module tests use local fixtures instead of an exported provider.

P6.63 records the token-discipline boundary: default opening sky should not ask the provider to generate every band, L2/L3 should not be preloaded by default, and L3 candidates returned by the model remain unverified queue objects until DataService observes them. AI Service validates provider output; it does not decide that an unverified webpage-looking node is a source-backed tile.

P6.14 adds route rules above the provider boundary. Desktop settings can match a level and optional generation modes, choose a provider, and optionally override the model. AI Service does not own that routing table; it receives the already resolved `AiProviderConfig` and remains responsible for provider execution, diagnostics, and output validation.

## Level Modules

AI Service must support per-level prompt profiles:

- Supra Macro;
- L0 Star Gallery;
- L1 Topic Field;
- L2 Source Orientation;
- L3 Tile Field source candidates;
- Deep Lens;
- Recursive Seed.

Prompt profiles should expose ordinary settings such as density, target node count, source-candidate count, language, preloading rings, and generation depth. Advanced settings may edit prompt templates and model routing.

In P6.12, the first concrete band profile lives in `@seekstar/level-runtime`, not in AI Service. Level Runtime sends the selected module as `context.level_module`, and OpenAI-compatible providers are instructed to obey that module's role, prompt brief, constraints, target count, and source-candidate policy. AI Service remains the provider/validation boundary rather than the owner of SeekStar's level design.

Use `prompt --input` to inspect the exact OpenAI-compatible message array before spending tokens. This is the quickest CLI check that a level module profile is flowing into AI Service correctly.

## DataService Tooling

DataService is a tool for AI, not the primary terrain generator.

The local agent should be able to ask DataService to probe AI-proposed URLs. Successful probes may become source-backed L3 tiles. Failed probes should stay out of the main canvas and only appear in diagnostics unless the agent asks for replacement candidates.

## Runtime And Storage Boundary

AI Service returns structured Cartographer output. `@seekstar/level-runtime` turns that output into chunk runtime drafts and owns in-memory request/cache/preload semantics. `@seekstar/storage-service` persists chunk cache records through the current JSON adapter. `@seekstar/constellation-engine` coordinates those ports through `CartographerChunkCoordinator`. AI Service should not persist chunk state or mutate scenes directly; it remains the generation/provider boundary.

## Right Sidebar Agent

The right sidebar should eventually use this package to:

- answer questions about the current map;
- navigate to topics;
- expand or summarize selected regions;
- explain source-backed content;
- call app operations through explicit tools.

The sidebar agent shares current scene/chunk context, but it must not own frame-by-frame canvas interaction.

P6.16 wires the first minimal panel into the desktop right sidebar. It sends active tab, current layer, selected nodes, scene summary, and allowed app operations to `seekstar.ai.assist`, then renders the returned answer and action suggestions. This is a bridge/protocol proof, not the final chat/control UI.

P6.17 turns those suggestions into executable buttons while preserving the boundary: action validation happens in AI Service, provider/key resolution stays in Electron main, and actual app operations stay in the desktop shell. The next sidebar work should add chat history, operation logs, permissions, and richer action review rather than letting model output mutate the map invisibly.

P6.18 starts that action review path with a local operation log. Later P6 steps persist the same operation records, attach permissions, and expose undo metadata without changing the AI provider contract.

P6.19 adds short-lived chat history on top of that operation log. Future durable storage can persist the same turn shape without changing `AiAssistantOutput`.

P6.20 implements that durable storage in the desktop shell. Future permission prompts and audit metadata should extend the assistant-session record rather than changing provider output.

P6.21 makes that extension concrete. P6.35 adds the first undo metadata on top of the same persisted operation audit record while leaving `AiAssistantOutput.actions` as model suggestions.

P6.22 adds the first policy surface above that audit record. Future per-action permission matrices should stay in settings/session infrastructure rather than in provider output.

P6.23 keeps that boundary intact for center-canvas runtime work as well. Chunk preload rings, cache status, and viewport-edge queues should be reported by the runtime host and renderer, not by provider output.

P6.24 makes the host/coordinator side of that rule explicit. Provider responses should not include UI lifecycle fields such as cache hit/miss or preload role; those are derived after generation by the runtime coordinator.

P6.25 keeps the persistence rule on the same side of the boundary. Durable preload-ring state belongs to the desktop shell and runtime host, not to model prompts or provider responses.

P6.26 keeps request lifecycle bookkeeping on the same side as well. Provider code should not know whether a chunk request is a bootstrap, viewport-edge expansion, queued UI preload, or retry transaction beyond the structured generation mode passed into the request.

P6.27 keeps the same provider boundary after moving the transaction host upward. The main-process transaction can record and broadcast lifecycle state without changing provider prompts or model output validation.

P6.28 keeps that boundary intact for multi-level seed bootstrap as well. Electron main sequences L0-L3 and applies scenes between requests; AI Service remains a stateless provider/validation layer and should not persist workspace scenes, own tab state, or coordinate multi-level bootstrap loops.

P6.29 keeps viewport expansion on the same side of the line. Electron main resolves viewport chunks and runtime context; AI Service only validates and returns structured Cartographer terrain.

P6.30 reinforces that provider boundary by removing open-ended renderer-to-runtime request envelopes from the desktop bridge. Future flows should add explicit transaction inputs above AI Service rather than expanding provider responsibilities.

P6.31 follows the same pattern for failed source replacement. App Framework owns failed-observation lookup and scene application; AI Service only proposes structured replacement terrain and candidate URLs.

P6.32 keeps permission policy above the provider boundary. Model output cannot bypass the action matrix; the desktop shell interprets the typed action and applies the configured policy before any app operation runs.

P6.33 keeps chunk host subscriptions above the provider boundary as well. The provider returns structured terrain; Electron main owns lifecycle snapshot replay and targeted chunk-state broadcasts.

P6.34 keeps failed-source review above the provider boundary. App Framework chooses retry or replacement; AI Service receives a normal `replace_failed_source` generation request only when replacement is explicitly requested.

P6.35 keeps undo above the provider boundary. The provider never emits rollback instructions; the shell captures reversible UI state before executing selected operations and records undo status in the assistant session.

P6.36 keeps chunk boundary controls above the provider boundary. The shell decides pause/refresh/directional preload behavior, then sends ordinary generation input to AI Service only when a chunk request actually runs.

P6.37 keeps seed-tab rollback above the provider boundary. The shell captures created/origin tab ids during execution and stores the undo context in the assistant session; AI Service remains stateless.

P6.38 keeps source-observation rollback above the provider boundary. The shell captures and restores the scene snapshot; AI Service only suggested `observe_source`.

P6.39 keeps right-sidebar layout above the provider boundary. AI Service does not decide which panels are open or primary; the desktop shell presents assistant output as the default control surface.

P6.40 keeps scene-diff rollback above the provider boundary. The provider suggests `observe_source`; App Framework computes and applies the rollback patch.

P6.41 keeps chunk scheduling policy above the provider boundary. Pause/Auto state, preload ring, directional range, debounce, and chunk step size are App Framework concerns; provider prompts and output validation remain unchanged.

P6.42 keeps prompt-profile editing above the provider boundary. Providers see the resolved `settings` and `context.level_module`; App Framework and Level Runtime own profile storage, override normalization, and prompt-revision cache keys.

P6.43 keeps telemetry execution inside the provider boundary and cost policy above it. Providers attach per-call timing/token/cost estimates to validated outputs; App Framework settings own optional input/output price rates, and desktop ledger/export work can build from those call-level records.

P6.44 keeps cancellation protocol inside the provider boundary and cancellation control above it. Providers honor `AbortSignal` and return `cancelled`; App Framework and the right sidebar still need to decide which running transaction can be cancelled and how that control is presented to the user.

P6.45 starts that App Framework control layer for Cartographer chunk transactions. AI Service remains stateless: it does not track active jobs or own transaction registries.

P6.46 applies the same boundary to cost accounting. Electron main owns ledger persistence, summaries, export, and clear controls; AI Service only supplies the telemetry attached to each generation or assistant response.

P6.47 keeps chunk policy on that same upper boundary. Cache-key policy revisions, Storage schema migration, and custom-dimension chunk indexing are App Framework/Level Runtime concerns; AI Service remains a stateless generator/validator.

P6.48 keeps prompt preview on the same line. The provider boundary exposes message construction, but desktop preview is an App Framework transaction and does not call a model, spend tokens, or expose provider keys to the renderer.

P6.49 keeps prompt rollback on the App Framework side too. Provider prompts are rebuilt from the restored settings; AI Service does not store revision history or decide which profile is active.
