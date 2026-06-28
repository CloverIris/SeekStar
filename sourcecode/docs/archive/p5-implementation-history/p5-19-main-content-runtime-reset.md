# P5.19 Main Content Runtime Reset

Status: in progress

This reset separates the main content area from the Pixi canvas implementation.

## Problem

The previous main display implementation mixed too many responsibilities in `TerrainCanvas`:

- 12Level scene rendering;
- candidate/source-backed mode selection;
- scaffold placeholder filtering;
- status overlay copy;
- Electron tile surface synchronization;
- browser absorption transition triggers.

That made failures look like fake content. A Scout worker exit, an empty candidate result, or a local seed scaffold could all appear as the same center-panel tile.

## Runtime Boundary

`MainContentRuntime` is now the renderer boundary for central content state.

It owns:

- deriving `MainContentProjection` from the Constellation Engine projection;
- deciding whether candidate observations are visible;
- filtering seed-scaffold placeholders out of the main content canvas;
- exposing only renderable nodes, visible relations, candidate tile surfaces, and source-backed tile surfaces to Pixi;
- rendering the status overlay for pending, failed, empty, and candidate states.

`TerrainCanvas` should stay focused on:

- Pixi app lifecycle;
- camera, pointer, pan, lasso, hover, and layer controls;
- drawing the renderable stage from runtime output;
- syncing source-backed tile surfaces to Electron.

## Scout Host Rule

The Electron utility process is a host adapter, not the authority on Scout success.

If the utility process exits or times out, App Framework falls back to the main-process `ScoutWorkerRuntime`. Only a failure from the runtime itself should become a failed Scout observation.

The utility worker also keeps its event loop alive so an idle `process.parentPort` listener does not end the process with code 0 before a request settles.

## Product Rule

The center canvas must not fabricate content:

- local seed scaffold nodes are navigation anchors, not content;
- pending search observations are shown as pending, not discovered;
- failed provider discovery is shown as failed, not an empty source-backed field;
- only source-backed L3 nodes with `source_url` are eligible for thumbnail/live browser surfaces.
