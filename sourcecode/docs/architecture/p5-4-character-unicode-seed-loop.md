# P5.4 Character Unicode Seed Loop

Status: P5.4 first implementation contract
Date: 2026-06-24

## Purpose

P5.4 extends source snapshot terrain past word grains.

P5.3 made confirmed source text navigable from L2 source anchors through L8 words. P5.4 adds the next close-reading step:

```text
L8 word
  -> L9 character
  -> L10 Unicode / dictionary card
```

This keeps the telescope model honest: a real source can be approached until the user reaches a single character and a local Unicode-oriented card.

## First Scope

For each generated L8 word, the first implementation creates a bounded set of child grains:

- up to two L9 `character` nodes;
- one L10 `dictionary_entry` node under each generated character.

The limit is deliberate. It proves the recursive depth without making pasted long text create an unreadable number of glyph nodes.

## Provenance Rules

- L9 character nodes are `source_backed` because the glyph exists in the source text and carries a source range.
- L10 Unicode / dictionary cards are `local_only` because they are deterministic local expansions, not external dictionary retrieval.
- Character-to-Unicode relations use `token_contains`, not `source_contains`, to avoid pretending the Unicode explanation was retrieved from the source.
- L9 and L10 nodes may be seedable, but seedability does not create facts.

## What This Does Not Add

- full dictionary lookup;
- language-specific morphology;
- translations;
- examples from external corpora;
- L11 expanded dictionary surfaces;
- a dedicated `grain.seed.created` event.

Those should attach after the source-backed close-reading spine is stable.

## Next Steps

1. Add a `grain.seed.created` event around existing seed-tab creation.
2. Generate heuristic keyword candidates from L5-L8 source-backed text.
3. Add optional L11 dictionary expansion only after a local or external dictionary source is chosen.
