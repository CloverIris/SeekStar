# 005: Agent Orchestration Boundary

Status: Proposed
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
