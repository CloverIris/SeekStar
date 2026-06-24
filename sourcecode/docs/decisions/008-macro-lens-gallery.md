# 008: Macro Lens Gallery For Macro Semantic Layers

Status: Accepted, revised by P4.6
Date: 2026-06-23
Subsystem: Macro canvas visual language, cognitive lens, constellation handoff, edge Scout discovery

## Problem

SeekStar's macro layers must help users explore before they know the right question. Ordinary rounded cards make the product feel like a dashboard or search-results grid, while the product direction calls for a spatial cognitive map.

The macro view needs a visual form that supports orientation, density, semantic zoom, fog, and later Playwright Scout expansion without becoming a browser, chatbot, or ranked list.

## Decision

Use a Macro Lens Gallery for layers L-3, L-2, L-1, and L0.

The gallery is an Apple Watch App Gallery-like bubble lens: colorful but restrained solid bubbles, center magnification, edge shrink/fade, and dense spatial packing.

The constellation algorithm and the bubble gallery are separate but connected:

- constellation layout owns coarse semantic shape and domain identity;
- bubble lens owns visual density, local magnification, edge shrink/fade, and macro navigation feel;
- L1 / L2 hand off from bubbles to topic and source cards;
- L3 and deeper use document tiles and text grains.

P4.6 supersedes the long-press fracture idea. Macro discovery is triggered by telescope movement: when the viewport moves near a macro-layer edge, the renderer may request same-layer Scout observations and place them as candidate frontier stars.

## Constraints

- The canvas remains primary.
- Movement and star placement are local renderer behavior, not AI-driven behavior.
- Playwright observes and reports; it does not decide meaning or rank results.
- Observation count may affect frontier star count but must not imply factual answer count.
- Source-backed, generated, inferred, weak, pending, failed, duplicate, and fog states remain visually distinct.
- Observed candidates need provenance before they become durable terrain.

## Rejected Approaches

- Rounded dashboard cards for macro layers:
  - Too close to generic SaaS dashboards and weakens the cognitive map metaphor.
- Search-result grid:
  - Pulls SeekStar back toward a normal search engine.
- Chat-first reveal:
  - Makes the input/output transcript the center instead of the map.
- Game-like starfield or particle spectacle:
  - Adds noise and suggests reward effects rather than orientation.
- Playwright-driven animation:
  - Violates the Scout boundary; retrieval must not control UI frames.
- AI-generated animation decisions:
  - Violates the Cartographer boundary; AI produces structured terrain, not real-time rendering.

## Consequences

P4 Scout work should connect to structured observation states and let the renderer place frontier stars locally. It should not bypass this contract with a browser view, ranked search results, or freeform AI answer panel.

P4.6 adopts PixiJS as the primary terrain renderer for star bubbles, relation lines, Scout candidate stars, and camera movement. The semantic contract remains renderer-owned and source-state-aware.
