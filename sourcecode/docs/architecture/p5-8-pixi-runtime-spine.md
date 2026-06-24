# P5.8 Pixi Runtime Spine

Status: P5.8 implementation started
Date: 2026-06-24

## Purpose

P5.8 removes renderer-local Cartographer preview behavior from the product path and starts the rendering-core consolidation around PixiJS.

SeekStar's prototype no longer keeps local preview jobs as a fallback product behavior. If a capability needs AI synthesis, source distillation, region explanation, or export, it must enter through a real service boundary later. Until then the UI exposes only operations that have real local semantics: telescope navigation, selection, seed creation, source intake, Scout observations, and source conversion.

## Removed

- Renderer-local Cartographer job generation and timer lifecycle.
- Region action preview generation from lasso or side-tray selections.
- Persisted region action preview state in the workspace snapshot.
- UI controls that implied local explanation, question generation, learning paths, comparison, export, or source distillation without a real service.
- Runtime Scout adapter compatibility with local preview observations.

The workspace snapshot schema was revision 58 in this slice. P5.9 moved validation into the Constellation Engine, and the canonical 12Level cleanup supersedes it with schema revision 61.

## Rendering Boundary

P5.8 starts moving presentation decisions into a PixiJS-oriented runtime boundary:

```text
TerrainScene + ViewportState
  -> createTerrainPixiProjection
  -> PixiJS render stage
  -> pointer / lasso / viewport events
  -> typed exploration events
```

React still owns shell composition, sidebars, command input, and high-level event wiring. It should not decide which terrain objects are renderable Pixi entities. The Pixi projection layer owns visible nodes, ghost nodes, rendered relations, and Scout candidate observations for the current viewport.

## Current Product Surface

- Default seed tabs are local telescope scaffolds, not fabricated answers.
- Selection can be saved as context or used as a new seed.
- Source-backed terrain is created only through manual source intake or confirmed Scout observations.
- Scout uses Playwright-backed observations only.
- Cartographer outputs remain readable if a future real service writes them, but the renderer no longer fabricates them.

## Next

1. Split shell renderer and tab renderer into separate entrypoints.
2. Move more canvas hit-testing and draw commands behind the Pixi runtime boundary.
3. Add `source.snapshot.ingested`, `text.grains.created`, `grain.seed.created`, and `candidate.seed.created` event handlers.
4. Introduce a real Cartographer service API only after event validation and cancellation semantics are explicit.
5. Add fuller source snapshots for Playwright-observed pages before SQLite/FTS migration.
