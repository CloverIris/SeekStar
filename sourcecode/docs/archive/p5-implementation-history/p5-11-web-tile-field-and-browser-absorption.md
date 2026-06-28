# P5.11 Web Tile Field And Browser Absorption

Status: implementation in progress
Date: 2026-06-24

## Purpose

P5.11 defines the source-content band of the telescope: L3 webpage, document, PDF, and image tiles.

The goal is not to build a generic browser inside SeekStar. The goal is to make existing webpages and documents explorable as spatial tiles, then allow one tile to temporarily absorb the viewport when the user needs native page reading and link interaction.

## Visual Model

The L3 tile field should feel closer to:

- Windows 10 Phone live tiles: asymmetric blocks, dense rhythm, and strong spatial memory;
- Windows 11 task view: multiple live surfaces visible at once;
- a source wall on an infinite telescope canvas.

It should not feel like:

- a ranked search result page;
- a tab strip browser clone;
- card-heavy dashboard content;
- a static image gallery detached from source provenance.

## Density And Loading

- The default target density is 25 visible tiles per viewport.
- The target density is configurable in Settings.
- Off-viewport tiles do not load embedded webpage/document renderers.
- Near-viewport tiles may keep metadata, thumbnails, source state, and cache handles.
- Visible and focused tiles receive loading priority.
- The App Electron Framework owns embedded surface lifecycle and cache budget enforcement.
- The Constellation Engine owns tile identity, source state, viewport visibility, focus state, and service requests.
- The Pixi Runtime Adapter owns tile projection, bounds, visible relation overlays, and animation geometry.

## Absorption Mode

A focused L3 tile can enter browser absorption mode.

Entry triggers:

- zooming until the focused tile occupies more than 80% of the viewport;
- clicking the focused tile;
- an explicit command action later.

Entry animation:

1. Continue the telescope zoom toward the focused tile.
2. Center the tile.
3. Match the tile bounds to the viewport.
4. Snap into a full embedded webpage/document surface.

While absorbed:

- the embedded surface owns scroll and primary pointer input;
- mouse wheel no longer changes SeekStar semantic zoom;
- SeekStar keeps a minimal half-hidden top label visible: "Click exit browser mode to keep exploring downward";
- global shell controls and crash boundaries remain owned by Electron.

Exit behavior:

- clicking the exit label returns wheel ownership to SeekStar;
- semantic descent resumes into L4 section, L5 paragraph, L6 sentence, L7 phrase, L8 word, L9 character, L10 Unicode/dictionary, or L11 new seed terrain;
- the absorbed tile remains the origin for backlink, provenance, and source context.

## Hyperlinks

Normal hyperlink activation inside an absorbed tile opens a new SeekStar tab at the absorbed webpage/document tile level.

Rules:

- the origin tab remains unchanged;
- the new tab stores backlink context to the origin tile;
- browser scroll history is not inherited;
- an explicit external-browser action remains available;
- modified click behavior may open externally once settings support it.

## Orphan Parent Context

Some linked pages arrive without enough source, topic, or domain parent context.

When the user exits browser mode or explores upward from an orphan tile:

- the Constellation Engine may request AI Service to produce a structured Cartographer patch;
- the patch may create parent topic, source orientation, or summary terrain;
- AI-created parent context must be marked generated or agent-inferred;
- Scout or source intake can later confirm or replace that context with source-backed terrain.

This keeps the telescope honest: existence comes from observed content, while uncertain organization is explicit AI cartography.

## Implementation Direction

1. Add tile-field settings for target visible tile count.
2. Extend Pixi projection with tile visibility, load priority, focus, and absorption progress.
3. Add an App Framework tile surface manager with visible-tile thumbnail/prewarm and absorbed live surfaces.
4. Add absorption state to the Constellation Engine session runtime.
5. Route hyperlink activation through tab runtime creation with backlink metadata.
6. Add AI Service parent-context requests for orphan upward exploration.

## Current Implementation Notes

- `TileSurfaceManager` owns two lanes: offscreen thumbnail capture for visible/focused L3 tiles, and native `WebContentsView` live surfaces for absorbed tiles.
- The default thumbnail prewarm concurrency is 2. This warms Chromium/session cache and emits Pixi-ready thumbnails without taking wheel or pointer ownership.
- The default live tile limit is 1. Raising this is a settings-level App Framework decision; the core projection already supplies rank, focus, and visibility.
- Off-viewport tiles are not sent into the preload queue. Near-viewport tiles remain metadata/cache candidates only.
- `TerrainScene.runtime` now stores focused tile state and browser absorption state. Desktop triggers events; Constellation Engine decides the persistent session transition.
- Clicking an already focused L3 tile enters browser absorption. Zooming past the 80% viewport threshold also enters absorption through the same engine event path.
- Exiting browser absorption clears the native live surface and asks the engine to descend to the configured exit layer, currently L4.
- Hyperlink-created tabs now run direct URL Scout under the new tab id, ingest the observed page as source-backed terrain, and place the new scene at L3 webpage/document tile level.
- Storage Service workspace change notifications now propagate saved source intake to docked and detached tab renderers without forcing tab refresh.
- `WorkspacePersistenceCoordinator` in the Constellation Engine now owns hydrate/persist snapshot merge rules through a storage port, so desktop React no longer hand-builds workspace snapshots.
- `ScoutJobCoordinator` in the Constellation Engine now owns Scout plan execution, failure observations, frontier/outlink placement, hyperlink L3 source intake, and observation-to-source conversion through a Scout port.
- `TabSessionCoordinator` in the Constellation Engine now owns open, close, reorder, and activate tab-session transactions through Storage and App Framework tab runtime ports.
- P5.13 promotes `SourceSnapshot` to core schema, carries structured Scout snapshots through observations, stores snapshots on source refs, and uses snapshot visible text for source-backed L3-L8 terrain.
- P5.13 adds a pure Pixi Runtime Adapter helper for tile absorption transitions. Desktop plays the transition before committing `tile.absorption.entered`, so live browser surfaces mount only after absorption is semantically real.
- P5.14 makes direct URL command input a real source intake path. Successful Scout candidates become source-backed L3 webpage/document tiles; failed runs remain observations and do not create live browser tiles.

## Remaining Usability Gap

SeekStar is structurally past mock/prototype scaffolding, but it is not yet a complete daily exploration tool.

The shortest path to usable is:

1. Move remaining shell-only tab registration and reset helpers behind explicit engine/app-framework ports.
2. Add richer PDF/image snapshot adapters and failure recovery UI.
3. Add viewport-demand incremental text materialization beyond the current profile-based first terrain.
4. Add AI Service orphan-parent Cartographer patches for upward exploration from linked pages.
