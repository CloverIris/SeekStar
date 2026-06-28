# P5.7 Main-Window Tab Docking

Status: P5.7 implementation contract
Date: 2026-06-24

## Purpose

P5.7 completes the first real App Framework split for the prototype.

The main window is no longer the place where the active telescope tab is rendered directly. The shell owns workspace controls, folder controls, tab records, settings, and the dock rectangle. Electron main owns the active tab `WebContentsView` and docks it into that rectangle.

## Runtime Shape

```text
Shell renderer
  -> reports tab dock bounds through seekstar.tabs.setDockBounds
  -> shows workspace / folder / tab controls

Electron main
  -> activates TabRecord
  -> creates or reuses per-tab WebContentsView
  -> loads renderer with runtimeTabId + runtimeSurface=docked
  -> sets bounds inside the shell dock rectangle

Tab renderer
  -> owns the telescope workbench, Pixi canvas, command composer, inspector
  -> hydrates and merge-saves only its locked tab scene
```

## Implemented

- `tabs:set-dock-bounds` preload and main-process IPC.
- `TabRuntimeManager` tracks dock bounds and docks the active tab view into the main window.
- Tab views can reload between `runtimeSurface=docked` and `runtimeSurface=detached`.
- The shell renderer now renders a dock host instead of the active Pixi terrain canvas.
- Detached tab windows continue to render their own title bar and tab workbench.
- The default New Seek tab and user-created Seek tabs use deterministic local seed terrain instead of preview seed scenes.

## Current Limits

- The shell and tab renderers still share the same bundled React entrypoint. They branch by query params instead of using separate renderer bundles.
- P5.8 removes the remaining renderer-local Cartographer and region action preview surfaces instead of hiding them behind feature flags.
- JSON remains the backing implementation for `WorkspaceStore`. SQLite/FTS should replace that implementation later without changing renderer APIs.
- Main-window drag-out / reinsert polish is still basic.

## Next

1. Split shell and tab renderers into separate entrypoints.
2. Continue moving renderable object projection into the PixiJS runtime boundary.
3. Add persisted tab cache manifests and object-cache telemetry.
4. Move `WorkspaceStore` to SQLite/FTS with source-cache tables and migrations.
