# P5.9 Service Contracts And Constellation Engine

Status: P5.9 implementation started
Date: 2026-06-24

## Purpose

P5.9 turns the SeekStar prototype from an Electron renderer-centered app into a modular observatory system.

The product boundary is now:

```text
App Electron Framework
  -> Constellation Engine
      -> Constellation Core
      -> Pixi Runtime Adapter
  -> Scout / DataService
  -> AI Service
  -> Storage / Cache Service
```

The goal is not to preserve old preview behavior. The goal is to make each major module callable by protocol, testable from the terminal, and replaceable later by a stronger implementation in TypeScript, Rust, C++, SQLite, or a dedicated service process.

## Module Boundaries

### App Electron Framework

Electron owns:

- desktop lifecycle;
- windows and detachable tab surfaces;
- settings;
- preload IPC;
- shell UI composition;
- crash isolation;
- service hosting.

Electron should not own terrain mutation rules, renderable object filtering, AI context construction, or source observation semantics.

### Constellation Engine

`@seekstar/constellation-engine` is the SeekStar core.

It owns:

- telescope events;
- scene reducer semantics;
- workspace snapshot schema revision;
- exploration object pools;
- semantic lens zoom/layer mapping;
- Scout planning and observation placement;
- Pixi projection data.

It is split internally:

```text
Constellation Core
  TerrainScene + ExplorationEvent
  -> TerrainScene mutation
  -> object pool
  -> service requests

Pixi Runtime Adapter
  TerrainScene + ViewportState
  -> renderable nodes
  -> visible relations
  -> candidate observations
```

React and Electron consume this package. They do not define the core exploration semantics.

### Scout / DataService

`@seekstar/scout-service` defines the Playwright-backed DataService boundary.

Scout returns observations and source snapshots. It does not rank truth, mutate terrain facts, or drive the UI. Source-backed terrain still requires explicit conversion by the engine/UI path.

### AI Service

`@seekstar/ai-service` defines the AI boundary.

It owns:

- encrypted key handoff shape;
- context packet creation;
- Cartographer service contract;
- unavailable status when no key is configured.

The current implementation is intentionally unconfigured. It returns explicit unavailable output instead of fabricating insight.

### Storage / Cache Service

`@seekstar/storage-service` defines storage and cache ports.

The first adapter is JSON. SQLite/FTS should replace the adapter behind the same interface later. Cache policy is modeled as an API contract, not hardwired into React state.

## Terminal Harnesses

Every module has a CLI entrypoint for protocol testing:

```text
seekstar-engine apply-event --scene scene.json --event event.json
seekstar-engine project-pixi --scene scene.json --viewport viewport.json
seekstar-engine object-pool --scene scene.json
seekstar-engine plan-frontier --scene scene.json --viewport viewport.json

seekstar-scout run --tab dev --url https://example.com
seekstar-scout snapshot --tab dev --url https://example.com

seekstar-ai status
seekstar-ai build-context --scene scene.json --selection node-a,node-b

seekstar-storage health --snapshot workspace.json
seekstar-storage inspect --snapshot workspace.json
```

These are not product fallback paths. They are module harnesses: JSON in, JSON out, using the same contracts as the app.

## Schema

Workspace snapshots move to revision 61 after the canonical 12Level cleanup.

Older snapshots are intentionally rejected in this core-development phase. This prevents P5.8/P5.9 or older local workspace state from reintroducing deprecated UI, stale default scenes, removed behavior, or non-canonical layer ladders.

## Implementation Notes

- The renderer now imports event application, object-pool creation, Scout planning, workspace snapshot validation, and Pixi projection from `@seekstar/constellation-engine`.
- `TerrainCanvas` consumes the engine's Pixi projection adapter.
- `canvas/interaction.ts` consumes the engine's lens mapping.
- Service packages compile independently and can later move behind Electron utility processes or native modules.

## Next

1. Move tab session runtime helpers out of `useExplorationSession` and into the engine.
2. Put Scout package runtime behind the existing Electron `utilityProcess` host.
3. Replace JSON workspace adapter with SQLite/FTS through `@seekstar/storage-service`.
4. Add real AI provider adapters behind `@seekstar/ai-service`, with encrypted key storage in Electron.

P5.10 supersedes the earlier note about source ingestion: source snapshot ingestion, text-grain construction, seed scaffolding, and Pixi interaction math now live in the Constellation Engine.
