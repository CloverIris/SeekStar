# SeekStar Visual Interaction Spec

Status: P4 preflight design contract
Date: 2026-06-23

## Purpose

This document fixes the macro visual interaction direction before P4 business work begins.

SeekStar is a cognitive cartography system. Its macro view should help the user start exploring before they know the right question. It must not become a normal search results page, browser clone, dashboard, or chatbot surface.

## Macro Lens Gallery

Layers L-3, L-2, L-1, and L0 use a Macro Lens Gallery: a dense field of colorful, restrained, opaque star bubbles with center magnification and edge shrink/fade.

The bubble field is not decoration. It is the macro orientation surface for domains, topic regions, seed fields, fog regions, scout-pending regions, and constellation anchors.

Rules:

- Center bubbles are larger, clearer, and more readable.
- Edge bubbles become smaller, dimmer, and may fade out.
- Bubble color and scale support orientation but do not imply proof.
- Source-backed, generated, inferred, weak, pending, failed, duplicate, and fog states must remain distinguishable.
- Macro bubbles should not look like generic app icons, ranked search results, or dashboard cards.

The visual reference is an Apple Watch App Gallery-like bubble lens. Implementation must not copy proprietary assets, icons, or brand styling.

## Constellation Handoff

The constellation algorithm and Macro Lens Gallery have different jobs.

- Constellation layout owns coarse semantic shape, region identity, and broad adjacency.
- Bubble lens owns macro visual density, center magnification, edge shrink/fade, and tactile navigation.
- L-3 / L-2 combine constellation shape with bubble lens.
- L-1 / L0 use clustered seed and topic bubbles while keeping constellation orientation in the background.
- L1 / L2 transition toward topic and source cards.
- L3 and deeper use document tiles and text grains rather than macro bubbles.

The renderer may pack bubbles for legibility, but it must not invent semantic relations. Relations still come from structured scene data.

## Edge Frontier Discovery

P4.6 pauses long-press fracture. Macro discovery is driven by moving the telescope across the star field.

- Dragging the macro viewport near the edge of the current layer requests same-layer frontier observations.
- New candidates appear as star bubbles at the frontier, not as a ranked result list.
- Candidate stars remain `ScoutObservation` records until explicit source conversion.
- The renderer controls the field movement locally. Playwright only returns structured observations.

This should feel like moving a telescope horizontally and discovering stars near the edge of view, not like submitting a search query.

## Scout Observation Boundary

Playwright may run during frontier discovery, but only as Scout.

Scout returns structured observations such as:

- pending;
- observed;
- failed;
- duplicate;
- source candidate;
- retrieved title;
- URL;
- snippet;
- retrieved time;
- source type.

Scout does not decide meaning, summarize content, rank results, or create source-backed terrain directly. Any observed candidate must later pass through source/provenance handling and cartographer terrain conversion before becoming durable map terrain.

Frontier star count may reflect observation count, but the UI must label state clearly so users do not read it as factual answer count.

P4.1 records this boundary as `ScoutObservation`. The current implementation may create local mock observations from a scout plan to validate status handling before real Playwright retrieval exists.

## Frontier Star States

After frontier discovery:

- `pending` stars remain temporary and unresolved.
- `observed` stars may become source candidates with provenance.
- `failed` stars stay muted.
- `duplicate` stars may fade or merge.
- `low relevance` bubbles may fade without implying factual rejection.
- `fog` stars remain uncertain and should invite further exploration.

Auto-disappearance is allowed only for duplicate, low relevance, failed, or expired pending observations. It does not mean the underlying idea is false.

## Explicit Non-goals

This spec does not implement:

- long-press fracture;
- AI calls;
- browser navigation;
- graph layout;
- source-backed AI summaries;
- result ranking;
- schema changes.

P4 work should connect Playwright Scout observations to this interaction boundary instead of bypassing it with a search-results list.

## P4.4 Scout Adapter Placement

Scout execution belongs behind the Electron observatory boundary, not inside renderer animation code.

The renderer may trigger a scout plan during macro edge movement or inspector action, but it should call the preload bridge and receive structured observations. The adapter can be mock-only, Playwright-backed, or later hybrid, but the visual contract stays the same:

- animation remains local renderer work;
- Scout results resolve as pending, observed, source-candidate, failed, duplicate, expired, or converted observation states;
- observed candidates still require source conversion before becoming durable terrain;
- Playwright never controls individual animation frames or creates facts directly.

## P4.5 Direct URL Scout

The first real Scout interaction is direct URL observation.

When the command input contains a URL, the command card may offer `Scout direct URL`. This action should feel like placing a probe into the map, not like opening a browser tab or issuing a web search.

Visual rules:

- keep the canvas primary while the observation appears in the inspector;
- label Playwright observations as Scout intake until conversion;
- show failures as observation states rather than modal errors;
- never render a web search results list from keyword input;
- never let Playwright drive macro lens animation frames.

## P4.6 Pixi Star Map

The primary canvas renderer is PixiJS. React owns shell UI and inspector panels; Pixi owns terrain rendering, star bubbles, relation lines, Scout candidate stars, pan/zoom camera movement, and lasso overlay coordination.

Visual rules:

- macro terrain is rendered as solid colored star bubbles, not DOM cards;
- candidate observations render as smaller Scout stars on the same layer;
- zoom controls semantic depth, while horizontal movement discovers frontier stars;
- source-backed conversion is still explicit and inspector-driven.
