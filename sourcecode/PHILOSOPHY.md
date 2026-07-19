# SeekStar Philosophy

Chinese edition: [`PHILOSOPHY.zh.md`](./PHILOSOPHY.zh.md).

The normative product meaning lives in the [Product Contract](./docs/product/PRODUCT_CONTRACT.zh.md) and [Semantic Scale Contract](./docs/product/SEMANTIC_SCALE_CONTRACT.zh.md). The [Current Baseline](./docs/status/CURRENT_BASELINE.zh.md) is the source of truth for implementation status.

SeekStar begins with one observation: most search and chat interfaces assume that the user already knows what to ask.

Many valuable discoveries happen before a question can be named precisely. A person may have only a direction, an unfamiliar term, a fragment of material, or a sense that something relevant is nearby. SeekStar exists for that moment.

It is designed for **unknown unknowns**: fields, concepts, relations, contradictions, people, tools, sources, and paths that users cannot search for because they do not yet know they exist.

## 1. Seek, not only Search

**Search** assumes that a target is already clear enough to name. **Seek** allows direction to come before the question.

SeekStar is therefore neither a decorated results page nor a chat shell spread across a canvas. Search, questions, imported pages, and saved trails are entry points. The product is the cognitive terrain that users can observe, traverse, compare, and revisit.

SeekStar should help users discover:

- where they are;
- what other possibilities surround them;
- why those possibilities are adjacent, overlapping, or in conflict;
- what question is worth forming next;
- which objects are inferred and which are backed by observed sources.

## 2. The interface is a cognitive map

SeekStar organizes information as a spatial field:

- distance suggests semantic proximity;
- footprints and regions suggest coverage;
- landmarks preserve orientation;
- bridges reveal cross-domain connections;
- fog honestly represents terrain that is missing or uncertain;
- trails preserve where the user has actually travelled;
- source objects reconnect the map to existing material.

The map does not exist to create spectacle. It must help users understand where they are, what surrounds them, and what they will encounter by moving further. Nodes with only keywords, no orientation, and no meaningful relations remain a word cloud, however attractive their layout may be.

## 3. One world, one telescope

Every Seek tab is one continuous world. Panning, focusing, or changing scale must not create nested boxes, child scenes, or parallel timelines.

The telescope is SeekStar's interaction constitution:

| Telescope act | SeekStar meaning |
| --- | --- |
| Magnify | Reveal a finer semantic view at the current position |
| Pull back | Preserve position while recovering macro orientation |
| Pan | Travel through adjacent, overlapping, and bridging regions at one scale |
| Focus | Inspect an object, relation, explanation, or source without creating an isolated world |
| Change observing field | Create a new world only through an explicit new Seed |

A user may enter from “cars,” move laterally at a finer scale into the region of “aircraft,” and then pull back near “aircraft.” Returning to the original “cars” entry point would break spatial memory. This continuous behavior is closer to observing a world than navigating a directory tree.

## 4. Zoom changes semantic view

SeekStar currently defines four product scales. They are projections of the same map, not four equal-sized lists:

| Scale | Name | Question answered |
| --- | --- | --- |
| L0 | Domain Field | What large regions make up this knowledge world, and where am I? |
| L1 | Topic Field | What topic neighborhoods, branches, and intersections exist here? |
| L2 | Explanation Field | How does this work, what composes it, and what comparisons, disputes, practices, and evidence directions matter? |
| L3 | Source Field | Which observed materials support, challenge, document, or exemplify these explanations? |

Refinement across scales may be one-to-many, many-to-one, or many-to-many. Density follows semantic difference and available evidence; it must not be forced into a `1:1:1` quota to fill the viewport.

Paragraphs, sentences, words, and other reading grains may later become deep-reading capabilities or new-Seed entry points. They should not be presented as extra fixed layers of the current world map.

## 5. Serendipity should be structured

SeekStar should enable accidental discovery without producing random noise.

A good exploration moment is: “I came here for A, now I understand why B is nearby, why C conflicts with it, and why D may be worth entering next.”

That serendipity must be spatially traceable, relationally explainable, and source-aware. The system may expose unknowns and weak hypotheses, but it must not present them as established facts.

## 6. AI is a Cartographer, not an oracle

The AI Cartographer fixes an unformed question into explorable structure. It can:

- propose semantic objects, concise orientation summaries, and roles;
- organize adjacency, overlap, bridges, contrasts, and refinement;
- reveal unknown boundaries and possible next questions;
- mark inference, uncertainty, and source candidates;
- explain the current region when the user asks.

The Cartographer does not decide pixel coordinates, own the camera, or declare a candidate URL to be a real source. AI may help draw the map, but it cannot cross the reality-verification boundary.

Most of the browsing loop—panning, zooming, selecting, returning, and viewing cached terrain—should not wait for a model. AI serves exploration; exploration does not serve chat.

## 7. Existence precedes cognition; Scout touches reality

Web pages, papers, PDFs, images, documents, and public references exist before a user recognizes their relevance. SeekStar must observe them, not merely ask a model to imagine them.

Scout / DataService must:

- open a candidate URL or local source;
- observe title, visible content, metadata, resource type, and retrieval time;
- return structured observations with provenance;
- fail explicitly when observation fails;
- promote a source to the L3 canvas only after successful observation.

Scout does not decide semantic importance, and Cartographer does not decide whether a source is real. A map made only from model inference becomes a hallucinated sky. A map made only from fetched pages becomes a warehouse without orientation. SeekStar needs both the Cartographer's structure and the Scout's contact with reality.

## 8. The world pool precedes the frame

The user browses objects that already exist in the world pool, not synchronous AI answers triggered by every camera movement.

The camera sends a weak signal: position, scale, direction, and proximity to an edge. Producers use it to reprioritize and predict nearby terrain. The renderer consumes ready objects, while missing, generating, and failed regions remain honest fog or status boundaries.

This protects three properties:

- interaction stays immediate rather than being captured by network latency;
- the world stays continuous instead of splitting after every click;
- explored terrain can be cached, restored, and extended.

## 9. Users explore by seeing, moving, circling, and asking

SeekStar should not force every intention through a typed prompt. Users can pan, zoom, hover, select, lasso, compare, follow relations, open sources, ask about the current region, or explicitly turn any valuable object into a new Seed.

A circle around a region is a question before language.

Input boxes, sidebars, settings, source review, and export panels support the telescope. They must not replace it or create a second state that disagrees with the active map.

## 10. The final object is not an answer

SeekStar should help users leave with:

- a better question;
- a field map that can still be explored;
- a learning or investigation path;
- source-backed materials and notes;
- a reusable new Seed;
- a restorable trail of discovery.

The goal is not to end curiosity quickly. The goal is to make curiosity navigable, inspectable, and durable.

## 11. Philosophy, contract, and implementation

This document explains why SeekStar exists; it does not prove that a feature is complete.

- Product invariants: [Product Contract](./docs/product/PRODUCT_CONTRACT.zh.md).
- Scale, relation, and transition rules: [Semantic Scale Contract](./docs/product/SEMANTIC_SCALE_CONTRACT.zh.md).
- Current runtime boundaries: [Exploration Runtime](./docs/architecture/EXPLORATION_RUNTIME.md).
- Implemented capabilities, known gaps, and release gates: [Current Baseline](./docs/status/CURRENT_BASELINE.zh.md).
