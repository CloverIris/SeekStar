# P5.16 DataService Provider Registry

Status: implemented with module smoke coverage
Date: 2026-06-25

## Purpose

P5.16 separates web discovery from source observation.

SeekStar should not treat a search result as a source-backed tile. Search APIs, browser search pages, and page outlinks produce `SearchCandidate` records. A browser observer or extractor produces a `SourceSnapshot`. Only a snapshot-backed Scout observation can become source-backed L3 terrain.

This matches the telescope rule:

- discovery finds nearby stars;
- observation confirms a source exists;
- Constellation Engine decides whether the source enters the map;
- Pixi projection renders only engine-derived terrain.

## Runtime Contract

- `@seekstar/core-schema` owns the shared `SearchCandidate`, `SearchCandidateRequest`, `SearchCandidateResult`, `SourceObservationRequest`, and `SourceObservationResult` protocols.
- `@seekstar/scout-service` owns `DataServiceProviderRegistry`.
- Search providers return candidates only. They do not create terrain and do not claim source-backed evidence.
- Source observer providers return `SourceSnapshot` or a failure reason.
- `PlaywrightScoutService` is now a DataService facade over registered providers.
- The Electron Scout worker is a host adapter. It validates IPC payloads and delegates Scout execution to `@seekstar/scout-service`.

## Default Providers

Current providers:

- `playwright-source-observer`: direct HTTP(S) page observation into `SourceSnapshot`.
- `arxiv`: official arXiv Atom API authority discovery.
- `github`: GitHub REST repository search, optionally using `GITHUB_TOKEN`.
- `wikipedia`: MediaWiki article search.
- `wikidata`: Wikidata entity search, not SPARQL text search.
- `browser-assisted-playwright`: browser-mediated frontier search. It currently tries DuckDuckGo HTML and then Bing as a low-priority fallback provider.
- `runoob-url` and `zhihu-url`: built-in URL-only providers, disabled by default.
- `playwright-page-outlinks`: source-anchored outlink discovery from a confirmed page.

Future provider slots:

- Brave Search API, Tavily Search, Exa Search, Google Custom Search, or other optional Search API providers;
- extractor providers such as Tavily Extract, Exa Contents, Firecrawl, local PDF/image extraction;
- cache providers over JSON today and SQLite/FTS/vector indexes later.

## Product Rules

- Frontier search candidates are Scout observations, not ranked result pages.
- Page outlinks remain candidate stars until a direct source observer snapshots the target URL.
- L3 tile surfaces still require `source_state: "source_backed"` and `source_url`.
- Failed source observation remains a failed observation and must not fabricate placeholder tiles.
- AI Service is not part of normal discovery, observation, scrolling, or absorption.

## Module Smoke Coverage

`npm.cmd run smoke:modules` now verifies:

- the provider registry can observe a local HTTP page through `playwright-source-observer`;
- the provider registry can discover page outlink `SearchCandidate` records through `playwright-page-outlinks`;
- `PlaywrightScoutService.run` still returns source candidate observations for direct URL plans;
- desktop `ScoutWorkerRuntime` delegates to the same DataService package;
- Constellation Engine can ingest the observed source into source-backed L3 terrain;
- Pixi projection emits `mainContent.mode: "source_tile_field"` and one real tile surface;
- App Shell hydrate preserves the source-backed scene.

`npm.cmd run smoke:modules:public` still exercises browser-mediated public search, but it is a development provider smoke, not the final commercial search strategy.

## Acceptance

1. Search candidate providers can be tested without Electron UI.
2. Direct URL observation can be tested without a public search engine.
3. Desktop Scout worker no longer maintains a duplicate search/extraction implementation.
4. The engine receives the same `ScoutObservation` shape regardless of provider.
5. Adding an API search provider later should not touch React, Pixi, tab runtime, or source terrain ingestion.
