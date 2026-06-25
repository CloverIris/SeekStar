# @seekstar/ai-service

AI Service is the P6 Cartographer boundary.

It should not become a chat-only utility. Its primary job is to generate, organize, validate, and explain structured terrain for SeekStar's chunked level runtime.

## P6.1 Implementation

The package now provides the first OpenAI-compatible boundary and CLI harness:

- `AiCartographerService` with OpenAI-compatible and deterministic mock providers;
- `SEEKSTAR_AI_API_KEY` first, then `OPENAI_API_KEY` fallback for real calls;
- explicit `missing_key` outputs when no key is available;
- structured JSON validation for nodes, relations, and source candidates;
- CLI commands:

```bash
node packages/ai-service/dist/cli.js status
node packages/ai-service/dist/cli.js generate --input input.json --provider mock
node packages/ai-service/dist/cli.js validate --input output.json
```

## Provider Target

The implementation boundary supports:

- `base_url`;
- model id;
- API key reference;
- request timeout;
- retry/fallback policy;
- token/cost/time accounting;
- structured JSON output validation;
- cancellation and token/cost accounting are still pending.

No permanent plaintext API keys should be written to project JSON. Secret storage can start as a key reference and later move to OS-backed encryption.

## Cartographer Jobs

Core generation modes:

- `bootstrap_seed`;
- `expand_horizontal`;
- `decompose_down`;
- `summarize_up`;
- `replace_failed_source`;
- `navigate_or_explain`.

Each mode should be testable through CLI with JSON input and JSON output.

## Level Modules

AI Service must support per-level prompt profiles:

- Supra Macro;
- L0 Star Gallery;
- L1 Topic Field;
- L2 Source Orientation;
- L3 Tile Field source candidates;
- Deep Lens;
- Recursive Seed.

Prompt profiles should expose ordinary settings such as density, target node count, source-candidate count, language, preloading rings, and generation depth. Advanced settings may edit prompt templates and model routing.

## DataService Tooling

DataService is a tool for AI, not the primary terrain generator.

The local agent should be able to ask DataService to probe AI-proposed URLs. Successful probes may become source-backed L3 tiles. Failed probes should stay out of the main canvas and only appear in diagnostics unless the agent asks for replacement candidates.

## Right Sidebar Agent

The right sidebar should eventually use this package to:

- answer questions about the current map;
- navigate to topics;
- expand or summarize selected regions;
- explain source-backed content;
- call app operations through explicit tools.

The sidebar agent shares current scene/chunk context, but it must not own frame-by-frame canvas interaction.
