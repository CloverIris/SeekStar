# SeekStar Desktop App

This app is the Electron observatory shell for the core SeekStar telescope.

The first screen is an explorable semantic canvas, not a chat window, generic browser, or ranked search-results page. The shell hosts tab windows, settings, IPC, service bridges, and the dock rectangle. Per-tab telescope surfaces render the map through Pixi and subscribe to Constellation Engine state.

## Current Surface

- Electron title bar and shell window with crash-isolated tab surfaces.
- Chrome-like exploration tabs with pin, favorite, folder, close, refresh, detach, and attach behavior.
- Default `New Seek` tab backed by the canonical L0-L11 12Level terrain spine.
- Left observatory sidebar for workspace, folders, favorites, tools, and exploration tabs.
- Pixi terrain canvas consuming Constellation Engine projection data.
- Bottom command composer for adding a keyword to the current Seek, creating a new Seek, or searching the current map.
- Right inspector for overview, selected terrain, source intake, Scout observations, backlinks, and source readiness.
- Settings surface for runtime, storage, Scout, and configurable domain lexicons.
- JSON workspace and tab runtime stores behind preload APIs; SQLite/FTS can replace the storage adapter later.

## Module Boundaries

- App Electron Framework owns windows, tab runtime, settings, IPC, security boundaries, docked WebContentsView surfaces, and service hosting.
- Constellation Engine owns telescope events, tab scenes, object pools, semantic layers, Scout planning, source terrain construction, and Pixi projection data.
- Scout/DataService owns Playwright-backed observations and source snapshots. It returns candidate observations; it does not mutate terrain facts.
- AI Service owns API/key/context/structured-output boundaries. Without configured keys it must return explicit unavailable status.
- Storage/Cache Service owns the replaceable workspace/cache adapter interface. The current desktop adapter is JSON.

## Canonical 12Level Spine

```text
L0  领域 / Star Gallery / seed pool
L1  主题
L2  来源
L3  网页 / 文档 / PDF / 图片 tile
L4  章节
L5  段落
L6  句子
L7  短语
L8  词语 / keyword
L9  字符
L10 Unicode / 字典
L11 新的探索 seed
```

Star Gallery, Tile Field, and Text Grain are focal bands over this spine. They are not separate replacement layer systems.

## Local Commands

From `sourcecode/`:

```bash
npm run build
npm run dev
```

Development mode starts the Electron shell after building the shared packages so the desktop app does not run against stale package output.
