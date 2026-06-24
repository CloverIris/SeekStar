# P5.3 Source Snapshot Terrain

Status: P5.3 first implementation contract
Date: 2026-06-24

## Purpose

P5.3 starts the next product breakthrough: confirmed source material becomes zoomable terrain.

P5.2 gave the runtime a canonical layer spine and event entry. P5.3 uses that spine to turn a source snapshot into real source-backed nodes across the content and text-grain layers.

## First Scope

The first implementation is local and deterministic. It works for:

- manually pasted source text;
- user-confirmed Scout snippets;
- future bounded page body snapshots once Playwright returns fuller text.

It does not yet parse full HTML DOM structure, render browser pages, fetch assets, preserve CSS, or use AI.

## Generated Terrain

`createSourceTerrainPatch` now creates:

| Layer | Node type | Meaning |
| --- | --- | --- |
| L2 | `source` | Source anchor and provenance card |
| L3 | `webpage` / `document` | Document tile |
| L4 | `section` | Initial section surface |
| L5 | `paragraph` | Paragraph blocks with source ranges |
| L6 | `sentence` | Sentence grains |
| L7 | `phrase` | Seedable phrase grains |
| L8 | `word` | Seedable word grains |
| L9 | `character` | Source-backed character grains |
| L10 | `dictionary_entry` | Local Unicode / dictionary card |
| L11 | `question` | Recursive seed entry |

Every generated node is `source_backed`, carries source metadata, and preserves `source_range` where available. Phrase and word nodes are seedable, but seedability does not create new facts or change provenance.

## Why This Is Fast

This path gives SeekStar a real telescope loop before expensive AI integration:

```text
Source confirmed
  -> source terrain patch
  -> L3-L11 text grains
  -> user zooms / selects / seeds words
  -> Scout or Cartographer can expand from a grounded grain
```

The product now has a concrete place for AI to attach later. AI does not need to invent the document structure; it can organize and explain grounded terrain.

## Next Steps

1. Add `html.ingested` and `text.grains.created` events around this adapter.
2. Preserve fuller Playwright page text instead of only snippets.
3. Keep L8 words, L9 characters, L10 Unicode / dictionary cards, and L11 recursive seed entries bounded so long sources stay readable.
4. Add heuristic keyword candidates from L5-L11 terrain before real AI calls.
