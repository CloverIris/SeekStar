# SeekStar Source Monorepo

This directory is the active SeekStar monorepo root. Repository-level overview lives in [`../README.md`](../README.md).

## Structure

```text
sourcecode/
|- apps/
|  `- desktop/              # Electron + React desktop observatory
|- packages/
|  |- core-schema/          # Shared TerrainScene and protocol types
|  |- constellation-engine/ # Telescope events, object pools, source terrain, Pixi projection
|  |- scout-service/        # Playwright Scout/DataService boundary
|  |- ai-service/           # AI provider/context/structured-output boundary
|  `- storage-service/      # Storage/cache ports with JSON adapter today
|- docs/
|  |- architecture/
|  `- decisions/
|- AGENTS.md
|- PRD.md
|- PHILOSOPHY.md
|- PHILOSOPHY.zh.md
|- ARCHITECTURE_AND_UI_SPEC.md
`- UI_STYLE_GUIDE.md
```

Paths in this directory are relative to `sourcecode/`.

## Local Commands

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Development mode opens detached DevTools by default. Restart Electron fully after changing the main process or preload boundary.

## Key Documents

- `PHILOSOPHY.md`: product philosophy (English normative edition).
- `PHILOSOPHY.zh.md`: 项目哲学（中文版，与英文版同步）。
- `PRD.md`: product requirements.
- `AGENTS.md`: agent operating rules.
- `ARCHITECTURE_AND_UI_SPEC.md`: architecture and UI specification.
- `UI_STYLE_GUIDE.md`: visual system and shell standards.
- `docs/architecture/`: architecture slices, service contracts, 12Level telescope runtime.
- `docs/decisions/`: architecture decision records.

## Current Mainline Status

SeekStar is past mock fallback cleanup and is in core usability construction. The five-module boundary is active: Electron App Framework, Constellation Engine, Scout/DataService, AI Service, and Storage/Cache Service.

The current usable spine includes:

- canonical 12Level terrain schema and Pixi projection;
- Constellation Engine event reducer, object pool, source terrain intake, and workspace persistence coordinator;
- Electron tab/window runtime with docked and detached tab surfaces;
- L3 tile projection with visible-tile thumbnail prewarm and absorbed live browser surfaces;
- `TerrainScene.runtime` for focused tile and browser absorption session state;
- hyperlink-created tabs that run direct URL Scout and hydrate into source-backed L3 webpage/document terrain;
- Storage Service workspace change notifications so saved terrain updates propagate across docked and detached tab renderers without refresh hacks.
- Constellation Engine `ScoutJobCoordinator` for Scout plan execution, failure observations, frontier/outlink placement, hyperlink intake, and observation-to-source conversion.
- Constellation Engine `TabSessionCoordinator` for open/close/reorder/activate tab-session transactions over Storage and App Framework tab runtime ports.

Remaining before practical daily use:

- animated click/zoom absorption transitions;
- remaining shell-only tab registration/reset helpers moved out of desktop React glue;
- AI Cartographer parent-context patches for orphan linked pages;
- Storage Service workspace adapter hardening before SQLite/FTS.
