# P5.5 Heuristic Candidate Pool

Status: P5.5 first implementation contract
Date: 2026-06-24

## Purpose

P5.5 makes SeekStar more active before real AI calls.

After P5.3 and P5.4, confirmed sources can become L2-L10 terrain. P5.5 adds a local candidate pool that extracts seedable concepts from source-backed text. This gives the telescope nearby things to discover without waiting for a model.

## First Scope

During source ingestion, SeekStar now derives bounded heuristic candidates from paragraph, sentence, phrase, and word grains.

The first version creates:

- up to 8 L1 `concept` nodes per source;
- `local_only` provenance;
- source ranges and token ranges pointing back to the source text;
- seedability so the user can turn a candidate into a new exploration tab;
- `semantic_similarity` relations from the source anchor to candidate nodes.

## Provenance Rules

Heuristic candidates are not source-backed facts. The text exists in the source, but the decision that a term is worth exploring is a local heuristic. Therefore:

- candidate nodes use `local_only`;
- candidate relations use `local_only`;
- labels must not imply search ranking, AI confidence, or factual promotion;
- candidates may become seeds, but seed tabs remain independent exploration universes.

## What This Does Not Add

- real AI keywording;
- vector search;
- workspace-wide candidate ranking;
- automatic Scout execution;
- persistent candidate scoring;
- user-tunable extraction settings.

## Next Steps

1. Add a visible candidate pool panel or overlay.
2. Add `grain.seed.created` / `candidate.seed.created` events.
3. Allow candidates to trigger same-layer Scout plans after user confirmation.
4. Add language-aware tokenization once the source snapshot pipeline is stable.
