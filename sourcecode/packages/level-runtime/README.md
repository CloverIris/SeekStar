# @seekstar/level-runtime

Chunked Level Runtime turns AI Cartographer output into renderer-subservable terrain drafts.

P6.1 keeps this package CLI-testable and independent of Electron, React, Pixi, Playwright, and Storage. It accepts one unified input shape for `supra_macro`, `L0`, `L1`, `L2`, `L3`, `deep_lens`, and `recursive_seed`, then returns nodes, relations, source candidates, chunk hints, and diagnostics.

```bash
npm --workspace @seekstar/level-runtime run build
node packages/level-runtime/dist/cli.js run --input input.json
node packages/level-runtime/dist/cli.js profiles
node packages/level-runtime/dist/cli.js module --level L3
```

Source candidates emitted by this package are `cartographer_unverified_source`; DataService must validate them before any L3 tile becomes `source_backed`. A generated L3 `webpage` or `document` draft is not a live tile surface by itself.

The runtime also owns prompt and layout compression before AI generation. For product calls it should pass only the active level module, target count, source-candidate policy, layout family, compact chunk policy, focus anchor, nearby anchors, and minimum scene summary needed for the band. It should not forward the entire prompt profile or all module definitions to every request.

`@seekstar/constellation-engine` consumes this output through `applyLevelRuntimeOutputToScene`. That bridge keeps Level Runtime independent from Electron while allowing the current Pixi projection path to display AI-generated terrain and candidate URL fields during migration.

## Runtime Host

`ChunkedLevelRuntimeHost` is the first in-process host for P6 chunk requests.

It provides:

- deterministic cache keys from mode, level, seed, chunk, focus, and prompt profile;
- `miss` / `hit` / `refresh` request semantics;
- optional preload of nearby chunks from runtime `chunk_hints`;
- cache entry byte estimates and access counters;
- simple eviction when `maxCacheEntries` is exceeded.

The host is storage-agnostic. `@seekstar/storage-service` provides `JsonLevelChunkStorage` as the current JSON persistence adapter for completed chunk records; SQLite/FTS can replace that adapter later without changing the renderer subscription contract.

## Desktop Bridge

The Electron main process consumes this package through `CartographerChunkCoordinator` rather than importing generation logic into React. The desktop bridge stores chunk cache records in Electron `userData` through `JsonLevelChunkStorage` and exposes intent-level bootstrap/viewport-expansion transactions through preload.

This package must remain free of Electron, Pixi, React, Playwright, and filesystem storage assumptions. Desktop can request chunks; Level Runtime only returns structured terrain drafts and diagnostics.

The first renderer consumer is `useExplorationSession`: for default opening-sky seeds it now treats Supra Macro plus L0 as the first visible terrain, then asks for L1/L2/L3 chunks on demand from focus and viewport movement. URL intake and candidate observation remain DataService validation paths, so Level Runtime still never creates source-backed tiles directly.

P6.11 makes the desktop bridge resolve `AiCartographerService` from App Framework settings before calling `runLevelRuntime`. Product calls use real OpenAI-compatible providers without making Level Runtime depend on Electron settings, key storage, or renderer state. Deterministic generation belongs in test fixtures, not product fallback.

P6.23 adds the first visible chunk lifecycle subscription in desktop: `useExplorationSession` records active, queued, preloaded, cached, and failed chunks per tab, and `TerrainCanvas` renders a compact current-chunk/preload-ring panel. This remains a renderer/App Framework concern. Level Runtime still emits `chunk_hints`; it does not own UI state or persistence beyond structured output.

P6.24 promotes successful active/preload lifecycle records into the constellation-engine coordinator result. Level Runtime still only emits output plus `chunk_hints`; the coordinator turns that into App Framework-facing lifecycle records with cache status and timestamps.

P6.25 persists those App Framework-facing lifecycle records through a desktop JSON store. The store is deliberately separate from Level Runtime cache output: Level Runtime remains pure and CLI-testable, while the shell remembers chunk visibility state per tab.

P6.28 moves the ordered default/new seed bootstrap loop into Electron main. The shell now sends one bootstrap intent, then sequences L0 `bootstrap_seed` followed by L1-L3 `decompose_down` through `CartographerChunkCoordinator`. Level Runtime remains unchanged at the package boundary: each call accepts one unified chunk input and returns one schema-valid output; it does not own tab lifecycle, workspace save, broadcast subscription, or multi-level transaction state.

P6.29 moves viewport-edge expansion request construction into Electron main. The shell now sends a viewport-expansion intent; main resolves the chunk key, seed, context, `expand_horizontal` mode, and lifecycle records before calling the coordinator. Level Runtime still only sees one chunk request at a time and remains independent of Electron, React, Pixi, and workspace persistence.

P6.30 retires raw/generic chunk IPC handlers from the desktop product bridge. Level Runtime remains callable through CLI and coordinator internals, but renderer code now crosses the App Framework boundary through explicit bootstrap and viewport-expansion intents instead of arbitrary runtime request envelopes.

P6.31 adds an explicit failed-source replacement intent above this package. Level Runtime receives one ordinary L3 `replace_failed_source` request with failed-observation context and returns replacement terrain/source candidates; DataService still must validate any returned URL before a tile becomes source-backed.

P6.33 moves chunk lifecycle visibility to a tab-scoped App Framework subscription. Level Runtime still does not hydrate, save, or broadcast renderer chunk panels; it only emits structured output and `chunk_hints` that the coordinator and desktop shell turn into lifecycle snapshots.

P6.36 adds canvas chunk boundary controls above this package. Pause/resume, current-chunk refresh, and directional preload are App Framework intents that eventually call the same viewport-expansion transaction; Level Runtime still receives one ordinary `expand_horizontal` request at a time.

P6.42 adds prompt profile overrides to the runtime contract. `LevelRuntimeSettings.prompt_profile` can override profile language, density, and each band's target count, prompt brief, and constraints. The override is normalized before `context.level_module` is sent to AI Service, and the runtime cache key includes a prompt revision hash so edited prompts generate fresh chunks instead of reusing stale output.

P6.44 adds cancellation propagation to the runtime contract. `runLevelRuntime` accepts an optional `AbortSignal` and forwards it to the configured generator. If AI Service returns `cancelled`, Level Runtime returns an empty cancelled output with diagnostics and chunk hints instead of fabricating terrain.

P6.45 uses that contract from the desktop coordinator path. `CartographerChunkCoordinator` forwards cancellation to active and preload generation, skips cache writes for cancelled output, and skips scene application when a transaction is cancelled.

P6.46 keeps cost accounting above this package while preserving traceability. `runLevelRuntime` now propagates AI telemetry, provider id, and model id on each output so the coordinator and Electron App Framework can append cost-ledger records. Level Runtime still does not persist ledgers, summarize spending, or know about Settings UI/export.

P6.47 adds chunk-policy versioning to the runtime contract. `LevelRuntimeSettings.chunk_policy` carries chunk width/height, preload ring, manual range, debounce, and a deterministic policy revision. Runtime cache keys include that policy revision, outputs echo the policy for downstream layout, and module smoke verifies that changing chunk dimensions produces a different cache key. This prevents custom chunk settings from reusing stale generated terrain.

P6.58 moves L0/L1 spatial ownership fully into Level Runtime. AI providers may still return titles, summaries, tags, and semantic hints, but `bubble_gallery` modules now receive deterministic continuous gallery positions and sparse local adjacency. This prevents provider-authored shape hints from turning Star Gallery/Topic Field chunks into separate radial islands. Chunk coordinates still shift the generated positions later in Constellation Engine, so neighboring chunks form one pan-ready offscreen field rather than visually isolated spirals.

P6.59 removes the old radial fallback entirely for the MVP path. Level Runtime no longer accepts provider-supplied `position_hint` as canvas truth; it derives every node position from the active layout family. This keeps per-layer CLI debugging deterministic: AI output answers "what should exist here," while Level Runtime answers "where should it live in the telescope field."

P6.60 bumps the default profile to `seekstar-default-p6-gallery-v3` and makes the renderer destructive about old L0/L1 layouts: persisted macro-layer positions and macro relations are ignored by Pixi projection, then rendered as a continuous Apple-Watch-like bubble gallery. The default chunk debug HUD is removed from the canvas; chunk status remains infrastructure, not product UI.

P6.63 adds the continuous-telescope and cost discipline constraints. L0/L1 may use limited adjacent prefetch for smooth macro exploration, but L2/L3 should be on-demand by default. Lower-band requests should carry focus and neighbor anchors so zooming feels like changing focal length in one semantic terrain, not opening nested boxes. L3 source candidates remain queue/status records until DataService converts them into source-backed tile surfaces.

## Band Profiles

P6.12 adds explicit band profile modules.

The default profile (`seekstar-default-p6-gallery-v3`) defines:

- Supra Macro;
- L0 Star Gallery;
- L1 Topic Field;
- L2 Source Orientation;
- L3 Tile Field;
- Deep Lens;
- Recursive Seed.

Each module owns its role, prompt brief, prompt constraints, default node type, target count, layout family, and source-candidate policy. `runLevelRuntime` injects that module into the Cartographer request as `context.level_module`, then enforces the policy while turning AI output into runtime drafts. For example, L0 rejects source candidates entirely, while L3 allows only `cartographer_unverified_source` candidates that DataService must probe before any live/source-backed tile appears.

Prompt profile overrides are ordinary JSON input, so they can be tested without Electron:

```json
{
  "settings": {
    "prompt_profile": {
      "id": "local-custom",
      "language": "zh-Hans",
      "density": "compact",
      "modules": {
        "L0": {
          "target_count": 12,
          "prompt_brief": "Generate broad durable domains for the seed.",
          "prompt_constraints": ["No source candidates at L0."]
        }
      }
    }
  }
}
```

Use the CLI to inspect the runtime contract for a single level without launching Electron:

```bash
node packages/level-runtime/dist/cli.js module --level L0
node packages/level-runtime/dist/cli.js module --level L3
```
