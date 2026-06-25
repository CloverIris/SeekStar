# P5.15 Main Content Runtime

Status: implemented with module smoke coverage
Date: 2026-06-25

## Purpose

P5.15 turns the central workbench from placeholder terrain into a formal runtime surface.

The main content area now distinguishes:

- domain gallery;
- source intake pending;
- source intake failed;
- source-backed L3 tile field;
- browser absorbed;
- text grain;
- empty source field.

This prevents local L3 placeholders from looking like browser-ready tiles.

## Runtime Contract

- Direct URL Scout writes a pending observation to the target tab before network work starts.
- Successful Scout writeback updates the target tab scene with source-backed L3 terrain.
- Failed Scout writeback keeps a failed observation and does not create source-backed terrain.
- Direct URL intake must settle into either source-backed terrain or a visible failed observation; renderer-level timeout guards prevent permanent pending states when Scout IPC or Playwright stalls.
- If the target tab is no longer present in the latest workspace snapshot before Scout completes, Storage discards the stale writeback and does not resurrect the tab.
- `TerrainTileSurface` is emitted only for L3 source-backed webpage/document nodes with a `sourceUrl`.
- Browser absorption only accepts those real L3 tile nodes.

## Product Behavior

- A URL tab must not stay as a URL-shaped local seed map after Scout finishes.
- A blocked URL should show a clear source intake failure state.
- Default New Seek remains an L0 domain gallery.
- L4-L8 remain semantic descent layers, not fake browser surfaces.

## Acceptance Smoke

1. Open a stable URL as a new Seek.
2. Confirm the target tab first shows source intake pending.
3. Confirm successful observation switches the tab to a source-backed L3 tile field.
4. Confirm a blocked URL shows source intake failed and no tile surface.
5. Confirm local L3 placeholder nodes do not render as browser-ready tile frames.
6. Confirm focused source-backed L3 tile can absorb and exit to L4.

## Module Smoke Coverage

P5.15 now has a reusable module smoke harness:

```bash
npm.cmd run smoke:modules
npm.cmd run smoke:modules:public
```

`smoke:modules` starts a local HTTP page and verifies the offline-capable runtime chain:

- `@seekstar/scout-service` Playwright Scout can snapshot title, visible text, outlinks, and media.
- Desktop `ScoutWorkerRuntime` can observe the same page and return a `source_candidate`.
- `ScoutJobCoordinator` can ingest the Scout result into a source-backed L3 scene.
- `createTerrainPixiProjection` derives `mainContent.mode: "source_tile_field"` and one real `TerrainTileSurface`.
- `WorkspacePersistenceCoordinator.hydrate` loads the saved engine scene back into the App Shell boundary without losing sources.

`smoke:modules:public` additionally verifies desktop `frontier_web_search` against the public web. It requires network access and confirms that the Scout worker can return search result `source_candidate` observations.

## Findings Fixed

- Workspace hydrate previously let the fallback New Seek scene overwrite a stored scene with the same tab id. This erased source-backed terrain at the App Shell boundary. `removeDeprecatedDefaultScenes` now only inserts fallback when the scene is missing.
- DuckDuckGo HTML search can return an automation error page under Playwright. Desktop Scout now falls back to Bing for frontier search.
- Search result parsing was too dependent on `innerText`; headless pages can expose content through `textContent` while `innerText` is empty. The Scout worker now prefers `textContent` for result titles and snippets.
