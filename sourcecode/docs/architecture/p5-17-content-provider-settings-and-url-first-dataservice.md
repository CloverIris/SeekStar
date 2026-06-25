# P5.17 Content Provider Settings and URL-First DataService

Status: implemented
Date: 2026-06-25

## Purpose

P5.17 makes DataService discovery configurable without changing the telescope rule.

Search providers discover candidate URLs. They do not create source-backed terrain, do not claim evidence, and do not render tiles directly. A candidate URL must still pass through Scout source observation and Constellation Engine source ingestion before it can become an L3 source tile.

## Provider Catalog

`@seekstar/core-schema` owns the built-in content provider catalog and default provider settings. The default active providers are:

- `arxiv`: official arXiv Atom API authority discovery.
- `github`: GitHub REST repository search, with optional `GITHUB_TOKEN`.
- `wikipedia`: MediaWiki article search, default languages `zh,en`.
- `wikidata`: Wikidata entity search, not SPARQL text search.
- `browser-assisted-playwright`: low-priority local Playwright browser-assisted search fallback.

Built-in but disabled by default:

- `runoob-url`: URL-only site-restricted discovery for `runoob.com`.
- `zhihu-url`: URL-only site-restricted discovery for `zhihu.com` and `zhida.zhihu.com`.

Zhihu remains URL-only until a stable official public API is confirmed. Runoob remains URL-only because SeekStar needs stable content URLs for tiles, not crawler-owned tutorial extraction.

## Runtime Contract

- Settings adds a Content Providers page for enabling, disabling, prioritizing, and validating provider configuration.
- `SeekStarSettings.content_providers` persists provider activation, priority, languages, region, base URL, key reference, and health status.
- Electron Scout adapter passes the current provider settings into the utility process for every Scout run.
- `PlaywrightScoutService` rebuilds its DataService registry when provider settings change.
- Direct URL source observation and page outlink discovery remain always available internal Scout capabilities.

## Product Rules

- Search API and browser-assisted results are `SearchCandidate` records only.
- URL-only providers may discover links, but they must not extract page bodies during search.
- API keys are not stored in settings JSON. Providers may reference environment variable names until the encrypted secret store exists.
- Browser-assisted search uses local Playwright. Browser-use/cloud browsing is not part of P5.17.
- Failed provider runs must report failure reasons instead of fabricating candidates.

## Validation

`npm.cmd run build` verifies the shared schema, Scout package, desktop main/preload/renderer bundles, and generated package types.

`npm.cmd run smoke:modules` verifies the local DataService source observation path, page-outlink candidate discovery, Scout worker handoff, Constellation Engine source-backed L3 ingestion, Pixi projection, and App Shell hydrate path.
