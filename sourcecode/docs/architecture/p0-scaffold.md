# P0 Application Scaffold

Status: Initial scaffold
Date: 2026-06-22

## Purpose

This scaffold creates the smallest durable application foundation for SeekStar without implementing product features yet.

It maps the existing product documents into code boundaries:

- `AGENTS.md`: preserves the Observatory / Scout / Cartographer / Telescope separation.
- `PRD.md`: starts from the 2.5D cognitive canvas, independent tabs, side panel, side tray direction, and source-aware data model.
- `ARCHITECTURE_AND_UI_SPEC.md`: separates Electron host, renderer, preload boundary, shared schema, future scout, future agent orchestration, and future storage.

## Package Choices

- npm workspaces: built into npm, enough for a small monorepo without adding workspace tooling.
- TypeScript: shared contracts and strict checks across app and packages.
- Electron: desktop observatory for window lifecycle, app boundary, and future local coordination.
- electron-vite: compact dev/build path for Electron main, preload, and renderer bundles.
- React: lightweight component model for the renderer shell around the future canvas.

The scaffold avoids adding linting, Playwright, persistence, graph layout, and AI dependencies until the relevant decision records are tested.

## Current Structure

Monorepo 根目录为仓库下的 `sourcecode/`。下列路径均相对于该目录。

```text
sourcecode/
├─ apps/desktop/
│  └─ src/
│     ├─ main/       Electron app lifecycle and window creation
│     ├─ preload/    Narrow renderer bridge placeholder
│     └─ renderer/   Static P0 shell around the canvas placeholder
│
└─ packages/core-schema/
   └─ src/            Shared TypeScript interfaces for terrain contracts
```

## Process Boundaries

- Electron main process owns the desktop window and will later coordinate workspace, tabs, storage, permissions, scout jobs, and cartographer jobs.
- Preload exposes a deliberately tiny bridge. It does not expose raw Electron APIs.
- Renderer owns the visible shell: top bar, tool rail, canvas placeholder, inspector panel, and status bar.
- Core schema owns shared interfaces only. It does not implement persistence, search, or agent behavior.

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

The first `TerrainScene` renderer contract now exists. P0 startup splash is implemented. Next, add a small scene normalization or validation layer before any Agent output is allowed to render.
