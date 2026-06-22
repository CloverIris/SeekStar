# 002: Canvas Renderer And Infinite Interaction Spike

Status: Proposed spike
Date: 2026-06-22
Subsystem: Renderer, infinite canvas, lasso, brush, and semantic Z layers

## Problem

SeekStar needs a smooth 2D/2.5D semantic canvas for panning, zooming, layer opacity, node hit testing, lasso, brush, source cards, fog regions, and later tile fields. The renderer must consume structured scene data and must not depend on AI for frame-by-frame interaction.

## Product Constraints

- The canvas is the primary interface.
- Zoom is semantic, not only visual.
- Z transitions preserve current layer, parent layer, child layer, breadcrumb, and trail.
- Factual, generated, inferred, and fog nodes must remain visually and semantically distinguishable.
- P0 should not jump to full 3D.

## Existing Libraries Checked

- PixiJS:
  - Official docs: https://pixijs.com/8.x/guides/
  - Application docs: https://pixijs.com/8.x/guides/components/application
  - Notes: GPU-friendly scene graph, WebGL/WebGPU preference options, interaction support, text and graphics primitives.
- tldraw:
  - Official docs: https://tldraw.dev/
  - Notes: strong infinite canvas and whiteboard interactions; must verify fit with SeekStar-owned semantic graph data and Z layers.
- Sigma.js and Graphology:
  - Official docs: https://www.sigmajs.org/
  - Notes: strong graph rendering path for large node/edge networks, but may constrain custom tile/text/lasso behaviors.
- Cytoscape.js:
  - Official docs: https://js.cytoscape.org/
  - Notes: mature graph visualization and analysis, many layouts; needs evaluation for custom cognitive lens and layered document tiles.
- D3 Force:
  - Official docs: https://d3js.org/d3-force
  - Notes: useful layout engine, not a full renderer.
- ELK:
  - Official docs: https://eclipse.dev/elk/
  - Notes: candidate for layered graph layout, not the renderer.

## Performance Constraints

- Panning and zooming must remain smooth while AI/scout jobs run.
- The scene should support hundreds of P0 nodes comfortably, with a path toward thousands.
- Labels must remain readable and must not cause layout shifts.

## Interaction Constraints

- Pointer, pan, lasso, and brush are P0 tools.
- Hit testing must work across mixed nodes, source cards, fog regions, and selected text blocks later.
- The renderer must accept stable positions and layer metadata from scene data.

## Chosen Approach

Run a P0 renderer spike with PixiJS as the first candidate, backed by a renderer-agnostic `canvas-scene` data model. Use app-owned camera, layer, selection, and lasso state rather than tying product state to any renderer's internal model.

The spike must prove:

- pan and zoom over a seed map;
- layer opacity changes for L0/L1/L2;
- node and fog hit testing;
- lasso selection payload generation;
- source-card labels that remain readable;
- no overlap regressions in basic source-card layout.

## Rejected Approaches

- Full 3D renderer:
  - P0 explicitly defers full 3D.
- DOM-only canvas:
  - Likely too fragile for dense spatial scenes and smooth lens effects.
- Choosing a graph-only renderer immediately:
  - SeekStar needs graph, tile, text, lasso, brush, and semantic zoom in one experience.

## Why Not Build From Scratch

GPU rendering, interaction plumbing, text rendering, and scene graph management are commodity infrastructure. Custom work should focus on semantic layers, data contracts, provenance, and the cognitive lens.

## Fallback Plan

If PixiJS blocks text quality, accessibility, or lasso/brush ergonomics, evaluate a tldraw-based prototype for interaction ownership and a Sigma/Graphology prototype for graph scale before locking the renderer.

## Open Questions

- Can PixiJS text rendering satisfy source-card and breadcrumb readability at multiple zoom levels?
- Should graph layout be computed separately from rendering from day one?
- How much of brush annotation should live in canvas primitives versus persisted semantic annotation objects?
