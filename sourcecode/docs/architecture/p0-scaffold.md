# P0 Application Scaffold

Status: Superseded by P5.1 exploration runtime; retained as historical scaffold notes
Date: 2026-06-22
Updated: 2026-06-24

## Purpose

This scaffold created the smallest durable application foundation for SeekStar while keeping early prototypes local-first.

It mapped the product documents into code boundaries:

- `AGENTS.md`: preserves the Observatory / Scout / Cartographer / Telescope separation.
- `PRD.md`: starts from the 2.5D cognitive canvas, independent tabs, side panel, side tray direction, and source-aware data model.
- `ARCHITECTURE_AND_UI_SPEC.md`: separates Electron host, renderer, preload boundary, shared schema, scout, agent orchestration, and storage.

## Current Structure

The active monorepo root is `sourcecode/`. Paths below are relative to that directory.

```text
sourcecode/
|- apps/desktop/
|  `- src/
|     |- main/       Electron app lifecycle, workspace store, scout adapter
|     |- preload/    Narrow renderer bridge
|     `- renderer/
|        |- exploration/   P5.1 exploration runtime and session hook
|        `- ...            Shell UI, Pixi canvas, inspector panels
`- packages/core-schema/
   `- src/           Shared contracts + validateTerrainScene
```

## Process Boundaries

- Electron main process owns the desktop window, workspace persistence, and Playwright Scout execution.
- Preload exposes a deliberately tiny bridge. It does not expose raw Electron APIs.
- Renderer owns the visible shell and delegates exploration state to `useExplorationSession`.
- Core schema owns shared interfaces and scene validation. It does not implement persistence, search, or agent behavior.

## What P5.9 Supersedes Beyond The Original Scaffold

- `validateTerrainScene` / `normalizeTerrainScene` in `@seekstar/core-schema`
- `@seekstar/constellation-engine` for event mutation, object pools, Scout planning, lens mapping, and Pixi projection
- `@seekstar/scout-service`, `@seekstar/ai-service`, and `@seekstar/storage-service` as service contracts
- `useExplorationSession` as desktop glue, not the owner of core semantics
- `docs/architecture/p5-9-service-contracts-and-constellation-engine.md`

## What Still Does Not Exist

- real AI cartographer calls
- real HTML tile parsing
- global pub/sub exploration bus
- full browser replacement
- vector / full-text index database

## Next Step

P5.2: real HTML observation -> structured deep-zoom terrain for one confirmed source page, still behind the exploration runtime and scene validation gate.
