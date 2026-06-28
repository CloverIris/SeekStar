# P5.2 Evented Layer Runtime

Status: P5.2 implementation contract
Date: 2026-06-24

## Purpose

P5.2 turns SeekStar's telescope model into a thin runtime contract.

The three familiar product bands are only focal ranges:

- Star Gallery for macro orientation;
- Tile Field for source-backed content;
- Text Grain for close reading.

The actual runtime spine is the canonical L0-L11 12Level path. It does not use negative macro layers or reserved extra layers.

## Runtime Shape

```text
User telescope operation
  -> ExplorationEvent
  -> applyExplorationEvent
  -> scene mutation helpers
  -> validate / normalize through existing P5.1 gates
  -> TerrainScene durable snapshot
  -> ExplorationObjectPool derived indexes
  -> Canvas / Inspector / Search subscribers
```

This is a product contract, not just an implementation convenience. Zoom, pan, lasso, selection, brush, keyword promotion, direct URL intake, and frontier movement should enter the runtime as telescope operations that can change objects, request observations, or create seedable regions.

## Canonical Layer Spine

`@seekstar/core-schema/src/semanticLayers.ts` owns the shared layer definitions.

The canonical deep-zoom stops are:

| Layer | Runtime meaning |
| --- | --- |
| L0 | 领域 / Star Gallery / seed pool |
| L1 | 主题 |
| L2 | 来源 |
| L3 | 网页 / 文档 / PDF / 图片 tile |
| L4 | 章节 |
| L5 | 段落 |
| L6 | 句子 |
| L7 | 短语 |
| L8 | 词语 / keyword |
| L9 | 字符 |
| L10 | Unicode / 字典 |
| L11 | 新的探索 seed |

This is the product spine. The Star Gallery / Tile Field / Text Grain terms describe how groups of these layers feel through the telescope; they are not a replacement for the spine.

## Initial Events

P5.2 starts with four event types:

- `selection.changed`
- `viewport.changed`
- `layer.changed`
- `scout.observations.appended`

These are deliberately small. They cover the core telescope loop: aim, move, change focal depth, and discover candidate stars.

Later events should preserve the same shape: user or system operation first, structured event second, data/object pool effect third, subscribed visual response fourth. AI and Playwright jobs attach behind the event path; they do not bypass it.

## Object Pool

`ExplorationObjectPool` is derived from `TerrainScene` and currently indexes:

- nodes by id;
- relations by id;
- sources by id;
- Scout observations by id;
- nodes by layer;
- source-state counts.

It is not yet a separate durable memory model. It is a stable read side that lets high-frequency renderers and inspectors stop rebuilding their own ad hoc indexes.

The pool is also the bridge between philosophy and UI: Star Gallery, Tile Field, Text Grain, search, inspector, and side tray should observe the same objects through different focal treatments instead of inventing separate page-specific state.

## Fastest Forward Path

1. **P5.2 close**: keep event vocabulary small, canonicalize layers, expose the object pool.
2. **P5.3 HTML tile intake**: add source snapshot events that turn a confirmed source snapshot into L3-L11 terrain.
3. **P5.4 Keyword seed loop**: make phrase, word, character, dictionary, and recursive seed nodes produce independent seed tabs through `grain.seed.created`.
4. **P5.5 Heuristic frontier suggestions**: generate local candidate phrases and Scout plans without model calls first.
5. **P6 Real Cartographer**: attach AI calls behind the same event and validation path.

The fastest route is not to add more chat behavior. It is to make real pages become zoomable terrain as soon as possible.
