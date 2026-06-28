# P5.14 Real Source Tile Interaction Loop

Status: implementation in progress
Date: 2026-06-25

## Purpose

P5.14 makes the telescope loop testable with real web sources:

```text
direct URL command
  -> Playwright Scout observation
  -> source-backed L3 webpage/document tile
  -> thumbnail/live tile surface
  -> browser absorption
  -> exit to L4 text terrain
  -> L8 word promoted into a new seed tab
```

The default New Seek scene remains local L0 domain terrain. Its L3 placeholder tile is not source-backed and must not mount a live browser surface.

## Runtime Contract

- Direct `http`/`https` command input is not treated as a plain keyword seed.
- `Add URL to current Seek` runs Scout and ingests the source candidate into the current scene at L3.
- `Open URL as new Seek` creates an active independent tab, then runs the same source intake under that tab id.
- Failed direct URL Scout runs append failed observations only; they do not fabricate source-backed terrain.
- Only L3 tile nodes with `sourceUrl` may prewarm thumbnails or enter live browser absorption.
- L8 word and other seedable text grains keep the inspector action for creating a new seed tab with backlink provenance.

## Acceptance Smoke

1. Start from default `New Seek` at L0.
2. Enter a real URL in the command composer and choose `Open URL as new Seek`.
3. Confirm the new tab stays active and contains a source-backed L3 webpage/document tile.
4. Confirm the tile emits a thumbnail-ready or thumbnail-failed state.
5. Focus the tile, click it again, and confirm absorption mounts a live surface.
6. Confirm wheel/pointer input belongs to the live page while absorbed.
7. Exit browser mode and confirm the scene descends to L4.
8. Continue to an L8 word and use `Create new seed from this`; the new tab must be visible, active, persistent, and backlink-aware.

## Boundaries

- Constellation Engine owns the direct URL source intake transaction and source terrain mutation.
- Scout/DataService only observes web content and returns observations/snapshots.
- App Framework owns thumbnail and live `WebContentsView` surfaces.
- React desktop forwards command and selection events; it does not fabricate source-backed tiles or decide absorption semantics.
