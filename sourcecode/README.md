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
|  |- scout-service/        # Scout/DataService provider registry and Playwright providers
|  |- ai-service/           # AI provider/context/structured-output boundary
|  |- level-runtime/        # Chunked AI Cartographer level runtime, CLI-testable outside Electron
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
npm run smoke:modules
npm run smoke:modules:public
npm run dev
```

Development mode opens detached DevTools by default. Restart Electron fully after changing the main process or preload boundary.

`smoke:modules` verifies the local DataService provider registry -> Scout -> Constellation Engine -> App Shell data path without relying on public network access. `smoke:modules:public` additionally checks browser-mediated public web search and requires network access.

## Key Documents

- `PHILOSOPHY.md`: product philosophy (English normative edition).
- `PHILOSOPHY.zh.md`: 项目哲学（中文版，与英文版同步）。
- `PRD.md`: product requirements.
- `AGENTS.md`: agent operating rules.
- `ARCHITECTURE_AND_UI_SPEC.md`: architecture and UI specification.
- `UI_STYLE_GUIDE.md`: visual system and shell standards.
- `docs/architecture/`: architecture slices, service contracts, 12Level/P6 telescope runtime.
- `docs/decisions/`: architecture decision records.

## Current Mainline Status

SeekStar is past mock-era cleanup and is in core usability construction. The five-module boundary is active: Electron App Framework, Constellation Engine, Scout/DataService, AI Service, and Storage/Cache Service.

P6 redirects the mainline toward AI Cartographer-driven terrain generation. DataService remains the validation/loading layer for source candidates, but L0-L3, recursive seeds, orphan context, and horizontal frontier chunks are intended to be primarily generated and organized by AI, then cached and verified where source surfaces are needed.

The current usable spine includes:

- canonical 12Level terrain schema and Pixi projection;
- Constellation Engine event reducer, object pool, source terrain intake, and workspace persistence coordinator;
- Electron tab/window runtime with docked and detached tab surfaces;
- L3 tile projection with visible-tile thumbnail prewarm and absorbed live browser surfaces;
- `TerrainScene.runtime` for focused tile and browser absorption session state;
- direct URL command intake that runs Scout and creates source-backed L3 webpage/document tiles without synthetic fallback;
- main content runtime projection that separates domain gallery, source intake pending/failed, real source tile fields, browser absorption, text grain, and empty source fields;
- hyperlink-created tabs that run direct URL Scout and hydrate into source-backed L3 webpage/document terrain;
- Storage Service workspace change notifications so saved terrain updates propagate across docked and detached tab renderers without refresh hacks.
- Constellation Engine `ScoutJobCoordinator` for Scout plan execution, failure observations, frontier/outlink placement, hyperlink intake, and observation-to-source conversion.
- Constellation Engine `TabSessionCoordinator` for open/close/reorder/activate tab-session transactions over Storage and App Framework tab runtime ports.
- P5.13-P5.16 telescope closure work: core `SourceSnapshot` protocol, snapshot-backed source terrain, profile-based text-grain materialization, direct URL target-tab writeback, main content mode projection, DataService provider registry, and animated tile absorption handoff before live browser surfaces mount.
- module smoke coverage for DataService source observation, page-outlink `SearchCandidate` discovery, Scout capture, Constellation Engine source-backed L3 ingestion, Pixi main-content projection, App Shell workspace hydrate, and public web search fallback.
- P5.17 content provider settings: shared provider catalog, default active arXiv/GitHub/Wikipedia/Wikidata plus local Playwright browser-assisted fallback, disabled URL-only Zhihu/Runoob providers, and settings-driven Scout registry rebuilds.
- P5.18 main content usability: keyword discovery now enters an L3 Pixi `source_candidate_field`; candidate URL tiles are selectable and observable, but only observed source snapshots become source-backed L3 tile surfaces and live browser absorption targets.
- P6 design baseline: AI Cartographer as primary terrain producer, chunked Level Runtime, Deep Lens replacing many separate visible text-grain levels, and right sidebar redesign into AI map chat/control surface.
- P6.1 AI Cartographer foundation: `@seekstar/ai-service` now has an OpenAI-compatible provider boundary, deterministic mock provider, JSON validators, missing-key diagnostics, and CLI `generate` / `validate`; `@seekstar/level-runtime` now emits schema-valid chunk outputs for Supra Macro, L0, L1, L2, L3, Deep Lens, and Recursive Seed without Electron.

Remaining before practical daily use:

- real provider prompt profiles, provider routing, cancellation, and cost accounting beyond the first OpenAI-compatible AI Service boundary;
- desktop canvas subscription migration from the old `TerrainScene` transition path to chunked Level Runtime output;
- right sidebar replacement with AI chat/control over current map context and app operations;
- richer PDF/image snapshot adapters and candidate observation failure recovery UI;
- extractor providers behind the P5.16/P5.17 DataService registry and encrypted key handling for providers that require secrets;
- remaining shell-only tab registration/reset helpers moved out of desktop React glue;
- Storage Service workspace adapter hardening before SQLite/FTS.
