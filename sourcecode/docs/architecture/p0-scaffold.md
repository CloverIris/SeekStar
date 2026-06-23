# P0 Application Scaffold

Status: P0 mock shell
Date: 2026-06-22

## Purpose

This scaffold creates the smallest durable application foundation for SeekStar while keeping P0 local-only and mock-only.

It maps the product documents into code boundaries:

- `AGENTS.md`: preserves the Observatory / Scout / Cartographer / Telescope separation.
- `PRD.md`: starts from the 2.5D cognitive canvas, independent tabs, side panel, side tray direction, and source-aware data model.
- `ARCHITECTURE_AND_UI_SPEC.md`: separates Electron host, renderer, preload boundary, shared schema, future scout, future agent orchestration, and future storage.

## Package Choices

- npm workspaces: built into npm and enough for a small monorepo.
- TypeScript: shared contracts and strict checks across app and packages.
- Electron: desktop observatory for window lifecycle, app boundary, and future local coordination.
- electron-vite: compact dev/build path for Electron main, preload, and renderer bundles.
- React: component model for the renderer shell around the canvas.

The scaffold avoids adding linting, Playwright, persistence, graph layout, and AI dependencies until the relevant decision records are tested.

## Current Structure

The active monorepo root is `sourcecode/`. Paths below are relative to that directory.

```text
sourcecode/
|- apps/desktop/
|  `- src/
|     |- main/       Electron app lifecycle, window creation, window bridge
|     |- preload/    Narrow renderer bridge
|     `- renderer/   P0 mock exploration shell and TerrainScene canvas
`- packages/core-schema/
   `- src/           Shared TypeScript interfaces for terrain contracts
```

## Process Boundaries

- Electron main process owns the desktop window and will later coordinate workspace, tabs, storage, permissions, scout jobs, and cartographer jobs.
- Preload exposes a deliberately tiny bridge. It does not expose raw Electron APIs.
- Renderer owns the visible shell: integrated title bar, observatory sidebar, canvas, inspector, command composer, status strip, and renderer overlay splash.
- Core schema owns shared interfaces only. It does not implement persistence, search, or agent behavior.

## Current Mock Interaction Slice

- `openingSkyScene` provides the initial `TerrainScene`.
- New seed creates an independent in-memory mock scene and tab.
- Current-tab search scans mock scene nodes and highlights matches on the canvas.
- Node selection updates in-memory selection state and the inspector.
- Tabs do not inherit search, focus, or transient selection state.

## What This Does Not Implement Yet

- No real search.
- No AI calls or API keys.
- No Playwright scout.
- No web retrieval.
- No real persistence.
- No graph layout.
- No lasso or brush behavior.
- No Markdown export.
- No source ingestion.
- No full 3D.
- No browser replacement behavior.
- No chatbot-first panel.

## Next Step

Add a small scene normalization or validation layer before any future Agent output is allowed to render.
