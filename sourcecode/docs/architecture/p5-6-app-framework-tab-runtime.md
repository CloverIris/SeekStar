# P5.6 App Framework Tab Runtime

Status: P5.6 implementation complete, with P5.7/P6 migration boundaries noted
Date: 2026-06-24

## Purpose

P5.6 moves SeekStar toward a Chrome-like app framework without turning SeekStar into a browser. The Electron host now owns tab runtime metadata, WebContentsView lifecycle, detached tab windows, folders, settings, cache budgets, and crash records. The renderer remains the telescope UI and keeps `TerrainScene` as the durable exploration snapshot.

## Runtime Shape

```text
Renderer telescope action
  -> preload seekstar.tabs/settings/workspace/scout
  -> Electron host runtime
  -> TabRecord / settings / Scout service / workspace snapshot
  -> renderer subscription and local scene update
```

## Process And Ownership

```text
Electron main process
  owns BaseWindow, WebContentsView, tab records, folders, settings, cache budgets

Shell renderer
  owns observatory sidebar, tab strip controls, settings, inspector orchestration

Tab renderer mode
  owns Telescope / Workbench / Pixi canvas / scene interaction for one runtime tab

Scout utility process
  owns Playwright execution, BrowserContext reuse, queue execution, failure isolation
```

The durable split is: `TabRecord` is app runtime state; `TerrainScene` is exploration terrain state. Tab metadata, cache status, crash status, folder membership, and session partition are not stored inside `TerrainScene`.

## Implemented In This Slice

- `TabRecord`, `TabRuntimeStatus`, `TabWindowState`, `TabCachePolicy`, `TabCrashReport`, and `WorkspaceFolder` are part of `@seekstar/core-schema`.
- The main window runs through `BaseWindow + WebContentsView`.
- `TabRuntimeManager` owns create, activate, close, refresh, pin, favorite, reorder, detach, attach, folder assignment, workspace naming, cache clearing, crash reports, and per-tab session partition strings.
- Each tab uses a stable `persist:seekstar-tab-${tabId}` session partition for its runtime view.
- Detached tabs use independent `WebContentsView` instances and can show a local crash HTML view.
- Detached tabs load the renderer with `runtimeTabId` and enter a pure tab-window mode without the main observatory tab sidebar.
- Runtime-tab renderer sessions lock themselves to that tab and merge-save only the locked scene back into the latest workspace snapshot.
- Main-window tab rows can be dragged outside the app window to detach; dropping inside the tab list still reorders.
- Attaching a detached tab marks it as a main-window tab, focuses/restores the main window, and broadcasts the active tab change back to shell renderers.
- Tab UI supports close, refresh, pin, favorite, drag sort, drag detach, folder assignment, crashed state, and visually cooled inactive state.
- The settings surface persists tab cache budget, inactive grace time, and Scout concurrency. Saving settings rewrites existing tab cache policies and prunes each tab object cache to the new budget.
- `WorkspaceStore` is now an Electron-owned interface with a JSON implementation. Renderer code only sees preload methods, not the JSON file shape.
- Development-data reset clears the workspace snapshot, tab runtime snapshot, settings file, per-tab persistent session partitions, detached views, and in-memory runtime state before restoring the opening tab.
- `TabObjectCache` gives each tab an LRU/LFU logical memory budget. Inactive tabs are visually cooled after their configured grace time, but their records are not destroyed.
- Playwright Scout now runs through a service with per-tab BrowserContext reuse and per-tab queues.
- P5.6.2 moves Scout execution into an Electron `utilityProcess`; the main process owns queueing, timeout handling, global Scout concurrency, and failed-observation fallback.
- Single-tab renderer crashes are recorded on `TabRecord` and replaced with a local error HTML surface containing copyable log data plus Reload and Close actions.
- New seed scenes use the canonical L0-L11 12Level semantic spine instead of falling back to a shallow seed/source scaffold.

## Preload Surface

The renderer uses narrow preload APIs:

- `seekstar.tabs.*` for tab runtime operations.
- `seekstar.workspace.*` for durable scene snapshot operations and development-data reset.
- `seekstar.settings.*` for runtime settings.
- `seekstar.scout.*` for background Scout plans.

Remote content never receives these APIs. External links still open outside the privileged app surface.

## Deliberate Limits

- The renderer has a pure detached-tab mode, but the main shell and tab surface still share one bundle in the main window. A future slice should split shell and tab renderers into separate entrypoints and dock the active tab `WebContentsView` into the main workbench region.
- Scout now has a utility-process boundary, but the fallback path can still run in the main process if the worker bundle is unavailable during development.
- The persistent database is still JSON-compatible behind a store boundary. SQLite/FTS should enter through a later ADR and migration.
- WebContentsView-backed detached tab windows are available, but full Chrome-grade drag-out/reinsert polish needs a dedicated interaction pass.

## Next Boundaries

- P5.7 should implement main-window tab docking so the shell survives a tab renderer crash even when the tab is not detached.
- P5.7 should add workspace/folder reordering and richer folder management beyond create/delete/assign.
- P6 should migrate the `WorkspaceStore` interface to SQLite/FTS and add source-cache tables, cache indexes, and migration tooling.
- P6 should add per-tab cache telemetry, persisted cache manifests, and source/object cache eviction that survives process restart.
