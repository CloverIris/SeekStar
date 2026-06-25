# P5.13 Telescope Closure

Status: implementation in progress
Date: 2026-06-24

## Purpose

P5.13 turns the P5.11/P5.12 tile-field skeleton into a continuous telescope loop:

```text
L3 source tile
  -> browser absorption transition
  -> exit browser mode
  -> L4-L8 source-backed text grains
  -> grain promoted into a new seed tab
```

The goal is still SeekStar, not SearchStar: the user explores a source-backed star map by zooming, panning, opening one tile when necessary, then returning to semantic descent.

## Implemented Contract

- `SourceSnapshot` is now a core-schema protocol shared by Scout, Constellation Engine, Storage snapshots, and desktop boundaries.
- Scout observations may carry structured snapshots: final URL, content type, visible text, outlinks, media candidates, source type, retrieval time, and failure context.
- Source terrain ingestion stores the snapshot on `SourceRef` and uses full `visible_text` before falling back to a snippet.
- Text-grain construction is controlled by a materialization profile rather than fixed demo caps. L3 intake produces a usable first terrain; deeper text-grain intake can request richer limits.
- The Pixi Runtime Adapter exposes a pure `createTileAbsorptionTransition` helper. It computes from/to bounds, target viewport, duration, and the completion event without touching React, Electron, or Playwright.
- Desktop renderer plays the tile absorption transition first. Only after completion does it commit `tile.absorption.entered`, allowing the Electron live surface to take over.
- The deep-zoom minimap now lays out all 12 canonical L0-L11 stops.
- P5.14 direct URL command intake now uses Scout to create real source-backed L3 tiles. The default New Seek placeholder terrain remains local-only and is not a live browser test surface.

## Boundary Rules

- The Constellation Engine owns durable semantic state: focused tile, absorbed tile, source-backed terrain, text grains, and seedable nodes.
- Pixi/renderer owns transient animation progress. Animation frames are not stored in workspace snapshots.
- The App Electron Framework owns thumbnail/live `WebContentsView` lifecycles and only materializes a live surface after runtime absorption is committed.
- Scout observes existing web content and returns evidence. It does not rank truth or directly control the star map.
- AI Service remains optional and explicit. It can later create Cartographer patches for orphan parent context, but it does not drive telescope movement.

## Remaining Gap

- PDF/image-specific extraction still needs richer snapshot adapters.
- Text materialization is profile-based, not yet viewport-demand incremental streaming.
- Direct URL command intake is source-backed, but richer PDF/image snapshot adapters still need to widen the set of source tiles that can be tested.
- AI parent-context patches for orphan linked pages remain pending.
- Automated Electron smoke coverage is still needed for the full click-to-absorb and exit-to-L4 interaction.
