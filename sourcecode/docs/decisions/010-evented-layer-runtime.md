# 010: Evented Layer Runtime And Object Pool

Status: Accepted for P5.2
Date: 2026-06-24
Subsystem: Exploration events, semantic layer spine, object-pool indexes

## Problem

P5.1 moved exploration work out of `App.tsx`, but the runtime was still mostly a set of direct handler calls over `TerrainScene`.

The product model is deeper than the three explanatory bands of Star Gallery, Tile Field, and Text Grain. Those bands are telescope focal ranges. The actual exploration spine is the canonical L0-L11 12Level deep-zoom path:

- L0 domain Star Gallery / seed pool;
- L1 topic;
- L2 source;
- L3 webpage / document / PDF / image tile;
- L4 section;
- L5 paragraph;
- L6 sentence;
- L7 phrase;
- L8 word / keyword;
- L9 character;
- L10 Unicode / dictionary;
- L11 recursive new seed.

SeekStar also needs an event vocabulary for telescope operations. Pan, zoom, selection, layer changes, Scout intake, and future keyword seeding should be represented as typed exploration events, not as scattered component mutations.

## Product Constraints

- The three focal bands remain useful language, but they must not collapse the product into only three layers.
- `TerrainScene` remains the durable snapshot contract.
- Renderer movement stays local and immediate.
- Scout observations enter as intake records first.
- AI Cartographer remains on-demand and must not own real-time movement.
- The object pool is derived from the scene in P5.2; it is not a new durable store yet.

## Chosen Approach

P5.2 introduces three thin foundations:

1. Canonical semantic layer definitions in `@seekstar/core-schema`.
   - The definitions include focal band, order, description, primary node types, and zoom stop.
   - The canvas zoom spine reads L0-L11 stops from this shared contract.

2. A typed exploration event reducer in the renderer runtime.
   - Initial events cover selection changes, viewport changes, layer changes, and Scout observation append.
   - The event reducer wraps existing scene mutation functions instead of replacing them.

3. A derived `ExplorationObjectPool`.
   - It indexes nodes, relations, sources, Scout observations, nodes by layer, and source-state counts.
   - It is exposed by `useExplorationSession` for future canvas, inspector, search, and conversion subscribers.

## Rejected Approaches

- Replacing `TerrainScene` with a new object graph immediately:
  - too disruptive before HTML tile parsing and text-grain ingestion exist.
- Adding Redux or MobX as the P5.2 center:
  - premature before event vocabulary and object lifecycles stabilize.
- Treating Star Gallery / Tile Field / Text Grain as the only product layers:
  - loses the core recursive depth of SeekStar.

## Consequences

- Layer semantics now have one canonical source.
- The existing UI can keep working while future features enter through events.
- P5.3 can add HTML tile parsing and keyword-grain generation without bypassing the runtime.
- A future persistent object store can replace the derived object pool behind the same read model.

## Next Decisions

- Define `html.ingested`, `text.grains.created`, and `grain.seed.created` events.
- Decide whether object lifecycles need dirty flags, version counters, and per-object subscriptions before real AI calls.
- Choose the first HTML parsing library and source snapshot format.
