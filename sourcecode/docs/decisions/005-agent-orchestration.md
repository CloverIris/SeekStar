# 005: Agent Orchestration Boundary

Status: Accepted for P3.1 structured mock cartographer boundary
Date: 2026-06-22
Subsystem: Cartographer jobs, structured outputs, and scout coordination

## Problem

SeekStar needs AI cartographer behavior for seed mapping, source distillation, layer mapping, region explanation, learning paths, and Markdown export. The agent must produce structured terrain and explanations, not drive real-time UI animation or impersonate a browser.

## Product Constraints

- The agent interprets; Playwright observes; Electron owns state; renderer displays.
- Agent outputs must conform to the Node, Relation, Layer, Constellation, and Fog Region contracts.
- Unsupported factual claims must not become factual nodes.
- AI-generated, inferred, weak hypothesis, source-backed, user note, and fog states must be explicit.
- Jobs should be interruptible, cancellable, resumable when possible, visible, cached, and cost-aware.

## Existing Libraries Checked

- OpenAI Agents SDK:
  - Official docs: https://developers.openai.com/api/docs/guides/agents
  - Notes: candidate for richer tool orchestration, guardrails, results/state, tracing, and future multi-agent behavior.
- OpenAI structured outputs:
  - Official docs: https://developers.openai.com/api/docs/guides/structured-outputs
  - Notes: strong fit for enforcing terrain data contracts.
- Playwright Library:
  - Official docs: https://playwright.dev/docs/library
  - Notes: scout retrieves and extracts observations, but does not decide meaning.

## Performance Constraints

- Agent jobs must not block canvas interaction.
- Seed maps should cache by seed, source set, and schema version.
- Region explanations should use selected nodes/text, brush weights, current layer, parent context, and source snippets, not the entire workspace by default.

## Interaction Constraints

- Job status is visible in top bar and later Jobs panel.
- Lasso prompt output appears in the side panel with source references.
- Markdown export preserves source links and generated-content labels.

## Chosen Approach

Begin with an application-owned job queue and a small set of cartographer modes over typed schemas:

- seed mapper;
- web scout planner;
- source distiller;
- layer cartographer;
- region explainer;
- Markdown brief generator.

Use mock cartographer outputs first to unblock renderer and schema work. Add real model calls only behind the same structured interfaces. Prefer structured output validation for every cartographer response before it reaches the workspace store.

P3.1 implements this as a renderer-local mock execution boundary:

- `AgentJob` records mode, status, progress, target nodes/sources, and linked outputs.
- `CartographerOutput` records structured notes, generated terrain patches, and optional scout plans.
- `TerrainPatch` is the only accepted mutation shape for cartographer-produced terrain.
- `ScoutPlan` records candidate directions for future Playwright observation; it is not retrieval evidence.
- Region explainer, source distiller, and web scout planner are mock-only in P3.1.

No OpenAI SDK, API key, Playwright dependency, or browser retrieval is added in P3.1. Real Agents SDK or Responses API integration must attach behind the same output contract and validate structured output before touching `TerrainScene`.

P3.2 adds a local lifecycle scheduler over the same contract:

- jobs start as queued;
- renderer timers advance mock work to running progress;
- completion applies the structured terrain patch;
- cancellation and mock failure stop before patch application;
- failed jobs keep an error message for inspection.

This is not a real background worker or external Agent runtime. It is the smallest durable lifecycle shape needed before real model or scout work can plug in.

P3.3 adds retry/rerun affordances for local mock jobs:

- failed and cancelled jobs can enqueue a new job from the same target node IDs;
- completed jobs can be rerun to produce a new mock output;
- retry/rerun does not overwrite existing job/output history.

These controls validate lifecycle ergonomics only. They are not real model retries, Playwright retries, billing retries, or durable background orchestration.

P3.4 adds a mock layer-cartographer mode:

- selected terrain can enqueue a `layer_cartographer` job;
- completion applies a structured patch with generated questions, weak adjacent routes, and fog regions;
- this validates map-expansion ergonomics without producing source-backed claims.

The output remains terrain-first. It must not be rendered as a chatbot answer, browser result, or primary ranked list.

P3.5 adds mock question and learning-path modes:

- `question_generator` produces generated next-question nodes from selected terrain;
- `learning_path_mapper` produces a short terrain path through orientation, evidence readiness, and fog-following;
- lasso selections, side-tray items, and selected nodes all use the same structured job lifecycle.

These modes validate cartographer ergonomics only. They do not call a model, retrieve sources, create citations, or make generated terrain source-backed.

P3.7 makes selected cartographer output seedable:

- generated questions, adjacent routes, scout-plan questions, learning-path steps, and fog edges can carry `can_create_seed`;
- seedable outputs carry `created_from` refs for backlink context;
- creating a seed opens a new independent tab instead of mutating the current exploration history.

Seedability is a navigation affordance, not evidence. It must not promote generated or inferred terrain to source-backed status.

## Rejected Approaches

- Chat transcript as the core app model:
  - It conflicts with map-first exploration and makes provenance and spatial layers secondary.
- Fully custom multi-agent framework for P0:
  - It overbuilds orchestration before the core tab, canvas, search, and lasso loop exists.
- Letting Playwright summarize or classify pages directly:
  - The scout observes; the cartographer interprets.

## Why Not Build From Scratch

Model calling, structured validation, tracing, cancellation, and tool orchestration are established platform concerns. SeekStar should own its semantic contracts and job lifecycle, while using proven APIs for model interaction where appropriate.

## Fallback Plan

If Agents SDK integration is too heavy for P0, use direct Responses API calls with structured outputs behind the same cartographer interface. If no model key is available, keep deterministic mock cartographer fixtures for local development.

## Open Questions

- What is the first real cartographer mode to connect: seed mapping or lasso explanation?
- How should rough cost be displayed before exact token accounting exists?
