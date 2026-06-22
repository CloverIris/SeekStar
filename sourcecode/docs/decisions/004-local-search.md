# 004: Per-tab Local Search

Status: Proposed
Date: 2026-06-22
Subsystem: Local search and match-to-canvas navigation

## Problem

SeekStar needs immediate search within the current tab without creating a new exploration universe. Results should highlight existing content, show match cards, and move the camera to the matched region.

## Product Constraints

- Current-tab search must not create a new tab.
- Results are secondary support, not the primary product surface.
- Each result carries snippet, source, layer, match type, and camera target.
- Search must include node titles, summaries, source snippets, annotations, and generated outputs.
- P0 needs exact and fuzzy search; workspace-wide search can wait.

## Existing Libraries Checked

- Fuse.js:
  - Official docs: https://www.fusejs.io/
  - Notes: zero-dependency fuzzy search with scores and configurable keys; good for lightweight tab-level metadata search.
- MiniSearch:
  - Official docs: https://lucaong.github.io/minisearch/
  - Notes: client-side full-text search with indexing and field support; stronger candidate for source text and snippets.
- SQLite FTS:
  - Official docs: https://www.sqlite.org/fts5.html
  - Notes: candidate if SQLite becomes the P0 persistence layer.

## Performance Constraints

- Search should respond immediately for P0 seed maps and source cards.
- Index updates should be incremental when nodes or generated outputs change.
- Match records must preserve text ranges or node IDs for camera jumps.

## Interaction Constraints

- Search action card offers "Use as new exploration seed" and "Search within current tab" as distinct actions.
- Result cards group by layer and match type.
- Clicking a result moves camera to the exact content region when available.

## Chosen Approach

Start with a `local-search` package that defines a renderer-independent per-tab index contract. Use Fuse.js for the first metadata search spike because it is lightweight and fast to integrate for node titles, summaries, tags, and source snippets. Keep the contract compatible with MiniSearch or SQLite FTS for fuller source-body search.

Search records should include:

- tab ID;
- item ID;
- item type;
- layer;
- match type;
- snippet;
- source reference if any;
- score;
- camera target;
- text range when available.

## Rejected Approaches

- Global workspace search first:
  - It expands scope before per-tab orientation is stable.
- Server-backed search:
  - P0 is local-first and should work without cloud sync.
- Ranking-only search results:
  - SeekStar search must return spatial orientation targets, not just lists.

## Why Not Build From Scratch

Tokenization, fuzzy scoring, and full-text indexing are commodity infrastructure. SeekStar's custom value is mapping search matches back into semantic layers and camera targets.

## Fallback Plan

If Fuse.js is too weak for source-body search or multilingual text, switch the implementation behind the same contract to MiniSearch or SQLite FTS.

## Open Questions

- What tokenizer should P0 use for Chinese, Japanese, and English mixed text?
- Should generated AI outputs be indexed immediately or only after the user saves them?
