# TerrainScene Renderer Contract

Status: Initial boundary
Date: 2026-06-22

## Purpose

`TerrainScene` is the first structured data boundary between SeekStar's future cartographer output and the renderer.

The renderer should consume a scene object that already contains tabs, layers, nodes, relations, sources, viewport state, selection state, agent job state, and metadata. It should not invent terrain locally inside UI components.

## Current Flow

Monorepo 根目录为仓库下的 `sourcecode/`。下列路径均相对于该目录。

The current desktop renderer imports a mock fixture:

```text
apps/desktop/src/renderer/src/fixtures/openingSkyScene.ts
```

That fixture exports `openingSkyScene`, a `TerrainScene` with generated and inferred conceptual nodes only. It contains no real search results and no fetched sources.

The renderer boundary is:

```text
apps/desktop/src/renderer/src/components/TerrainCanvas.tsx
```

`TerrainCanvas` receives a `TerrainScene` and renders simple positioned node cards. This is intentionally not a graph layout engine.

## Mock Interaction Flow

The P0 shell now keeps interaction state in React memory only.

- The top command input opens a local action card with two active routes: use text as a new mock exploration seed, or search within the current tab.
- New seed creates an independent mock `TerrainScene` with generated, inferred, weak, and fog nodes only.
- Current-tab search scans scene nodes by title, summary, tags, and type, then highlights matching nodes on the canvas and shows a secondary result panel.
- Clicking a node or local search result updates `SelectionState` in memory and shows node details in the inspector.
- Tab switching changes the active in-memory scene and clears transient command/search state.

This flow is a prototype of orientation, not real retrieval.

## Future Flow

Future Agent outputs should be validated against the shared schema in `@seekstar/core-schema`, converted into `TerrainScene`, then handed to the renderer.

Expected future producers:

- seed mapper;
- source distiller;
- layer cartographer;
- region explainer outputs saved as generated terrain;
- local persistence rehydration.

## What This Does Not Implement Yet

- Real search.
- AI calls.
- Playwright retrieval.
- Local persistence.
- Graph layout.
- Lasso behavior.
- Brush behavior.
- Markdown export.
- Source ingestion.
- Browser navigation.
- Electron crash diagnosis in this sandbox.

## Design Rule

Mock nodes must remain visibly generated, inferred, weak, or fog. They must not look like source-backed facts.
