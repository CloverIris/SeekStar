# Deep Zoom Spine

SeekStar's Z axis is recursive semantic depth, not visual magnification.

The Deep Zoom Spine is the mock protocol that proves the product can move from a seed into progressively smaller semantic grains, then loop any grain back into a new exploration universe.

## Spine Layers

The current prototype uses a mock `Unknown Unknowns` scene:

- L0 Seed Field
- L1 Topic Neighborhood
- L2 Source Orientation
- L3 Document Tile
- L4 Section
- L5 Paragraph
- L6 Sentence
- L7 Phrase / Word
- L8 Character
- L9 Unicode / Dictionary
- L10 New Seed Loop

The scene is source-free mock terrain. Every node remains marked as generated, inferred, weak, or mock-only. It is not web retrieval and it is not source-backed evidence.

## Renderer Contract

The renderer still consumes `TerrainScene`.

Deep zoom adds optional node fields for source ranges, token ranges, semantic breadcrumbs, zoom targets, seedability, and created-from context. These fields describe how a terrain node participates in recursive depth without creating nested renderer state or replacing `TerrainScene`.

## Interaction Contract

- The semantic layer rail can navigate L0-L10.
- Wheel zoom maps camera scale to semantic layer bands.
- Selecting a zoomable node exposes a `Zoom in` action.
- Breadcrumb items can return to ancestor layers.
- Parent and child layer nodes may appear as muted ghost context so layer changes preserve spatial orientation.
- A compact mini-map shows the current spine layer and lets the user jump between semantic depths.
- Text grains render differently from ordinary terrain cards: paragraph blocks, sentence rows, word chips, character tiles, and Unicode/dictionary cards.
- Seedable word, character, and dictionary nodes can create a new independent tab with an origin backlink.

## Boundaries

This prototype does not implement real webpage rendering, Playwright retrieval, AI source distillation, real dictionary lookup, real search, browser navigation, or a new persistence system.

Future Playwright scouts should provide observed source/text material into this spine. Future AI cartographers should generate and validate terrain, ranges, breadcrumbs, and zoom targets against this contract before the renderer sees them.

## P3.3 Orientation Additions

P3.3 adds continuity aids without changing the data contract:

- ghost context renders parent/child layer nodes from the existing `TerrainScene`;
- ghost nodes are orientation hints, not selected search results;
- the mini-map is a layer spine indicator, not a ranked list;
- layer changes still resolve through `ViewportState.layer` and `TerrainScene.layers`.
