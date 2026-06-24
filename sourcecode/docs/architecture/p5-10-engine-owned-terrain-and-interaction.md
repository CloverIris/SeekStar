# P5.10 Engine-Owned Terrain And Interaction

Status: P5.10 implementation started
Date: 2026-06-24

## Purpose

P5.10 continues the P5.9 module split by removing more product semantics from the desktop renderer.

The desktop app should remain an Electron framework and React shell. The Constellation Engine should own seed scaffolds, source terrain construction, source snapshot events, object pools, semantic lens behavior, Pixi projection, and Pixi interaction math.

## Moved Into Constellation Engine

- Seed scene scaffolding and the default SeekStar seed scene.
- Source snapshot to source-backed terrain conversion.
- Text grain construction from source snapshots.
- Heuristic candidate construction from source text.
- `source.snapshot.ingested` reducer behavior.
- Pixi interaction math:
  - camera zoom at pointer;
  - screen/world coordinate conversion;
  - lasso rectangle normalization;
  - hit testing for rectangular selection;
  - viewport fit and reset.

## Desktop Boundary After This Slice

The desktop renderer still owns:

- React state subscription;
- UI panels;
- Electron preload calls;
- tab runtime coordination;
- form state and button interactions.

It no longer owns:

- source-backed terrain construction;
- source text grain generation;
- seed scene construction;
- renderable terrain projection decisions;
- canvas camera/lasso math.

## Engine Ports

`@seekstar/constellation-engine` now exposes pure TypeScript service ports:

- `ConstellationScoutPort`;
- `ConstellationAiPort`;
- `ConstellationStoragePort`;
- `ConstellationSourceSnapshotPort`;
- `ConstellationEnginePorts`.

These ports define how the engine talks to Scout, AI, Storage, and source snapshot services without depending on Electron, React, Playwright, SQLite, or any future native module.

## Harness

`seekstar-engine ingest-source --scene scene.json --source source-input.json` validates source snapshot ingestion without the desktop app.

The command proves that source-backed terrain, text grains, heuristic candidates, viewport movement, and selection focus can be produced by the engine boundary alone.

## Next

1. Move tab session runtime helpers out of `useExplorationSession` and into the engine.
2. Move job lifecycle helpers into the engine and attach AI Service through `ConstellationAiPort`.
3. Route desktop workspace load/save through `@seekstar/storage-service` rather than direct workspace snapshot helpers.
4. Keep Electron focused on windows, tab surfaces, IPC, settings, and process/service hosting.
