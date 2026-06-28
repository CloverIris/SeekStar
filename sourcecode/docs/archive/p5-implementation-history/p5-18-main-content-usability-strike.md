# P5.18 Main Content Usability Strike

Status: Implemented

P5.18 turns keyword discovery into a usable main-content path without weakening SeekStar's source boundary.

Keyword discovery now produces an L3 `source_candidate_field`: candidate URLs are rendered as Pixi candidate tiles with provider provenance, URL, title, snippet, and status. These candidate tiles are not source-backed terrain and are never sent to Electron's live `WebContentsView` surface manager.

The conversion path is explicit:

1. Keyword command runs provider discovery through Scout/DataService.
2. Constellation Engine stores returned candidates as Scout observations.
3. Pixi projection derives `CandidateTileSurface` objects for L3 candidate tiles.
4. Selecting a candidate exposes `Observe source` in the inspector.
5. Observation runs direct URL Scout.
6. Only a returned `SourceSnapshot` path creates source-backed L3 webpage/document terrain.

This keeps the telescope honest: search results reveal possible stars, while observed sources become tile surfaces.

## Runtime Contracts

- `TerrainPixiProjection.candidateTileSurfaces` is separate from `tileSurfaces`.
- `MainContentProjection.mode: "source_candidate_field"` means candidates are available but not source-backed.
- `source_tile_field` still means real L3 webpage/document nodes with `source_state: "source_backed"` and `sourceUrl`.
- Electron `TileSurfaceManager` receives only source-backed `TerrainTileSurface` entries.
- Candidate tile clicks select observations; they do not trigger browser absorption.
- Keyword discovery writes a temporary pending Scout observation before provider results return, so the main content area shows an observing candidate state instead of falling back to empty local terrain.
- DataService provider discovery runs providers concurrently with per-provider timeouts. A slow or blocked authority provider must produce a failed observation or partial candidate set, never an indefinitely pending main-content tile.
- Seed-scaffold nodes such as `Source intake`, `Document tile intake`, and pending text grains remain in the scene graph as 12Level navigation anchors, but Pixi main-content rendering filters them out. They must not appear as fake source tiles or fake text content.

## App Framework Notes

The renderer now exposes candidate observation actions as transactions:

- observe candidate into the current tab;
- open candidate as a new Seek and observe it there;
- keep direct URL intake, hyperlink intake, and keyword discovery on the same Scout writeback path.

Detached tab cleanup is tightened by clearing tile surfaces on main-window close and before app quit. Startup normalization avoids restoring a hidden tab as the active runtime tab.

## UI Notes

The inspector is biased toward the main telescope loop:

- Overview and selected-source evidence remain visible;
- Scout/Candidate source actions are promoted;
- Cartographer jobs, manual source ingest, and side tray are kept under Advanced.

P5.18 intentionally does not add SQLite, encrypted key storage, browser-use, or AI parent-context patching.
