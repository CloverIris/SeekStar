#!/usr/bin/env node
import http from "node:http";
import { once } from "node:events";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PlaywrightScoutService } from "@seekstar/scout-service";
import {
  buildWorkspaceSnapshot,
  createDirectUrlScoutPlan,
  createSeedScene,
  createTerrainPixiProjection,
  ScoutJobCoordinator,
  WorkspacePersistenceCoordinator,
} from "@seekstar/constellation-engine";

const runPublicSearch = process.argv.includes("--public-search");

const html = `<!doctype html>
<html>
  <head><title>SeekStar Local Test Page</title></head>
  <body>
    <main>
      <h1>SeekStar Local Test Page</h1>
      <p>Alpha telescope tile content. Unique token: seekstar-local-alpha.</p>
      <p>Second paragraph with phrase grain words.</p>
      <a href="/article">Read article</a>
      <img src="/image.png" alt="Local preview image">
    </main>
  </body>
</html>`;

const server = http.createServer((request, response) => {
  if (request.url === "/image.png") {
    response.writeHead(200, { "content-type": "image/png" });
    response.end(Buffer.from("89504e470d0a1a0a", "hex"));
    return;
  }

  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html><head><title>Article Child</title></head><body><p>Child outlink page.</p></body></html>");
    return;
  }

  response.writeHead(200, { "content-type": "text/html" });
  response.end(html);
});

server.listen(0, "127.0.0.1");
await once(server, "listening");

const service = new PlaywrightScoutService();
const desktopRuntime = await createDesktopScoutWorkerRuntime();

try {
  const address = server.address();
  const localUrl = `http://127.0.0.1:${address.port}/`;
  const localResult = await runLocalPipelineSmoke(localUrl, service, desktopRuntime);
  const aiLevelRuntimeResult = await runAiLevelRuntimeSmoke();
  const publicSearchResult = runPublicSearch ? await runPublicSearchSmoke(desktopRuntime) : undefined;

  process.stdout.write(`${JSON.stringify({ ...localResult, aiLevelRuntime: aiLevelRuntimeResult, publicSearch: publicSearchResult }, null, 2)}\n`);
} finally {
  await service.dispose();
  await desktopRuntime.dispose();
  server.close();
}

async function runLocalPipelineSmoke(localUrl, service, desktopRuntime) {
  const snapshot = await service.snapshotUrl("unit-scout", localUrl);
  assert(snapshot.title === "SeekStar Local Test Page", `snapshot title mismatch: ${snapshot.title}`);
  assert(snapshot.visible_text.includes("seekstar-local-alpha"), "snapshot body text missing");
  assert(snapshot.outlinks.length >= 1, "snapshot outlink missing");
  assert(snapshot.media.length >= 1, "snapshot media missing");

  const observedSource = await service.observeSource({
    tab_id: "unit-provider-registry",
    url: localUrl,
    requested_at: new Date().toISOString(),
  });
  assert(observedSource.provider_id === "playwright-source-observer", `observer provider mismatch: ${observedSource.provider_id}`);
  assert(observedSource.snapshot?.visible_text.includes("seekstar-local-alpha"), "observer snapshot missing body text");

  const outlinkCandidates = await service.searchCandidates({
    tab_id: "unit-provider-registry",
    query: localUrl,
    source_url: localUrl,
    discovery_mode: "page_outlinks",
    limit: 5,
    requested_at: new Date().toISOString(),
  });
  assert(outlinkCandidates.candidates.length >= 1, "provider registry outlink candidates missing");
  assert(outlinkCandidates.candidates[0].url.includes("/article"), `unexpected outlink candidate: ${outlinkCandidates.candidates[0].url}`);

  const plan = createDirectUrlScoutPlan(localUrl, [], new Date().toISOString());
  const packageRun = await service.run({
    tab_id: "unit-scout",
    plan,
    requested_at: new Date().toISOString(),
  });
  const packageObservation = packageRun.observations[0];
  assert(packageObservation?.status === "source_candidate", `package scout status: ${packageObservation?.status}`);

  const desktopRun = await desktopRuntime.run({
    tab_id: "unit-desktop-worker",
    plan,
    requested_at: new Date().toISOString(),
  });
  const desktopObservation = desktopRun.observations[0];
  assert(
    desktopObservation?.status === "source_candidate",
    `desktop scout worker status: ${desktopObservation?.status} ${desktopObservation?.failure_reason ?? ""}`,
  );

  const baseScene = createSeedScene("Local source seek", {
    tabId: "tab-local-source",
    timestamp: new Date().toISOString(),
  });
  const engineScout = new ScoutJobCoordinator({
    scout: {
      runPlan: (tabId, scoutPlan) =>
        service.run({
          tab_id: tabId,
          plan: scoutPlan,
          requested_at: new Date().toISOString(),
        }),
    },
  });
  const engineResult = await engineScout.ingestDirectUrlSource({
    scene: baseScene,
    tabId: "tab-local-source",
    url: localUrl,
  });
  const engineProjection = createTerrainPixiProjection(engineResult.scene, engineResult.scene.viewport, {
    viewportBounds: { width: 1280, height: 800 },
  });

  assert(engineResult.scene.sources.length === 1, "engine scene has no source");
  assert(engineProjection.mainContent.mode === "source_tile_field", `engine projection mode: ${engineProjection.mainContent.mode}`);
  assert(engineProjection.tileSurfaces.length === 1, "engine tile surface missing");

  let stored = buildWorkspaceSnapshot({
    activeTabId: "tab-local-source",
    basketByTabId: {},
    fallbackScene: baseScene,
    scenesByTabId: {
      "tab-local-source": engineResult.scene,
    },
  });
  const shellPersistence = new WorkspacePersistenceCoordinator({
    resolveFallbackScene: () => baseScene,
    storage: {
      loadWorkspaceSnapshot: async () => stored,
      saveWorkspaceSnapshot: async (snapshotValue) => {
        stored = snapshotValue;
      },
      clearWorkspaceSnapshot: async () => {
        stored = undefined;
      },
    },
  });
  const shellLaunch = await shellPersistence.hydrate({
    preferredActiveTabId: "tab-local-source",
  });
  const shellScene = shellLaunch.scenesByTabId[shellLaunch.activeTabId];
  const shellProjection = createTerrainPixiProjection(shellScene, shellScene.viewport, {
    viewportBounds: { width: 1280, height: 800 },
  });

  assert(shellLaunch.activeTabId === "tab-local-source", "shell active tab mismatch");
  assert(shellScene.sources.length === 1, "shell did not load engine source");
  assert(shellProjection.mainContent.mode === "source_tile_field", `shell projection mode: ${shellProjection.mainContent.mode}`);
  assert(shellProjection.tileSurfaces.length === 1, "shell tile surface missing");

  return {
    localUrl,
    scoutPackage: {
      snapshotTitle: snapshot.title,
      textIncludes: snapshot.visible_text.includes("seekstar-local-alpha"),
      outlinks: snapshot.outlinks.length,
      media: snapshot.media.length,
      runStatus: packageObservation.status,
    },
    dataServiceRegistry: {
      observerProvider: observedSource.provider_id,
      observerKind: observedSource.provider_kind,
      outlinkProvider: outlinkCandidates.provider_runs[0]?.provider_id,
      outlinkCandidates: outlinkCandidates.candidates.length,
      firstOutlinkTitle: outlinkCandidates.candidates[0]?.title,
    },
    desktopScoutWorker: {
      runStatus: desktopObservation.status,
      title: desktopObservation.title,
      textIncludes: desktopObservation.source_snapshot?.visible_text.includes("seekstar-local-alpha") ?? false,
    },
    constellationEngine: {
      sources: engineResult.scene.sources.length,
      layer: engineResult.scene.viewport.layer,
      mainContentMode: engineProjection.mainContent.mode,
      tileSurfaces: engineProjection.tileSurfaces.length,
      tileTitle: engineProjection.tileSurfaces[0].title,
    },
    appShellHydrate: {
      activeTabId: shellLaunch.activeTabId,
      sources: shellScene.sources.length,
      mainContentMode: shellProjection.mainContent.mode,
      tileSurfaces: shellProjection.tileSurfaces.length,
    },
  };
}

async function runAiLevelRuntimeSmoke() {
  const aiModule = await import(pathToFileURL(resolve("packages/ai-service/dist/index.js")).href);
  const levelRuntimeModule = await import(pathToFileURL(resolve("packages/level-runtime/dist/index.js")).href);
  const savedSeekStarKey = process.env.SEEKSTAR_AI_API_KEY;
  const savedOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.SEEKSTAR_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const missingKeyService = new aiModule.AiCartographerService({
    kind: "openai_compatible",
    api_key_ref: { kind: "env", name: "SEEKSTAR_MODULE_SMOKE_EMPTY_KEY" },
  });
  const missingKeyOutput = await missingKeyService.generate({
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });
  if (savedSeekStarKey !== undefined) {
    process.env.SEEKSTAR_AI_API_KEY = savedSeekStarKey;
  }
  if (savedOpenAiKey !== undefined) {
    process.env.OPENAI_API_KEY = savedOpenAiKey;
  }

  assert(missingKeyOutput.status === "missing_key", `AI missing-key status mismatch: ${missingKeyOutput.status}`);

  const mockService = new aiModule.AiCartographerService({ kind: "mock" });
  const mockOutput = await mockService.generate({
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });

  assert(mockOutput.status === "ok", `AI mock generation status: ${mockOutput.status}`);
  assert(mockOutput.nodes.length > 0, "AI mock generation returned no nodes");

  const invalidValidation = aiModule.validateCartographerGenerationOutput({ nodes: "bad" }, {
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });
  assert(!invalidValidation.valid, "AI invalid JSON validation should fail");

  const baseChunk = levelRuntimeModule.createLevelChunkKey(0, 0, 0);
  const levels = ["L0", "L1", "L2", "L3"];
  const levelOutputs = [];

  for (const levelId of levels) {
    const output = await levelRuntimeModule.runLevelRuntime({
      mode: levelId === "L0" ? "bootstrap_seed" : "decompose_down",
      level_id: levelId,
      seed: "CPU",
      chunk: baseChunk,
    });
    const validation = levelRuntimeModule.validateLevelRuntimeOutput(output);

    assert(output.status === "ok", `Level Runtime ${levelId} status: ${output.status}`);
    assert(validation.valid, `Level Runtime ${levelId} invalid: ${JSON.stringify(validation.diagnostics)}`);
    assert(output.nodes.length > 0, `Level Runtime ${levelId} returned no nodes`);
    assert(output.nodes.length <= levelRuntimeModule.DEFAULT_LEVEL_RUNTIME_SETTINGS.target_counts[levelId], `Level Runtime ${levelId} exceeded density`);
    assert(output.nodes.every((node) => node.source_state !== "source_backed"), `Level Runtime ${levelId} produced source-backed nodes`);
    assert(
      output.source_candidates.every((candidate) => candidate.source_state === "cartographer_unverified_source"),
      `Level Runtime ${levelId} produced invalid candidate state`,
    );

    levelOutputs.push({
      levelId,
      nodes: output.nodes.length,
      sourceCandidates: output.source_candidates.length,
      preloadChunks: output.chunk_hints.preload.length,
    });
  }

  const l3 = levelOutputs.find((output) => output.levelId === "L3");
  assert(l3?.sourceCandidates > 0, "Level Runtime L3 should expose unverified source candidates");

  return {
    missingKeyStatus: missingKeyOutput.status,
    mockNodes: mockOutput.nodes.length,
    invalidOutputValid: invalidValidation.valid,
    levels: levelOutputs,
  };
}

async function runPublicSearchSmoke(desktopRuntime) {
  const createdAt = new Date().toISOString();
  const plan = {
    id: `public-search-smoke-${Date.now()}`,
    title: "Public Search Smoke: SeekStar GitHub",
    target_node_ids: [],
    candidate_queries: ["SeekStar GitHub"],
    discovery_mode: "frontier_web_search",
    source_type_targets: ["webpage", "article"],
    priority: "medium",
    stop_conditions: ["Return candidate observations only."],
    deduplication_notes: ["Stable module smoke query."],
    created_at: createdAt,
  };
  const result = await desktopRuntime.run({
    tab_id: "tab-public-search",
    plan,
    requested_at: new Date().toISOString(),
  });
  const sourceCandidates = result.observations.filter((observation) => observation.status === "source_candidate");

  assert(
    sourceCandidates.length > 0,
    `public search returned no source candidates: ${result.observations[0]?.failure_reason ?? "no observations"}`,
  );

  return {
    adapter: result.adapter,
    completedAt: result.completed_at,
    observationCount: result.observations.length,
    statuses: result.observations.map((observation) => observation.status),
    firstTitle: result.observations[0]?.title,
    firstFailure: result.observations[0]?.failure_reason,
  };
}

async function createDesktopScoutWorkerRuntime() {
  const chunkDir = resolve("apps/desktop/out/main/chunks");
  const chunkNames = await readdir(chunkDir);
  const runtimeChunkNames = chunkNames.filter((name) => /^scoutWorkerRuntime-.+\.js$/.test(name));
  const runtimeChunks = await Promise.all(
    runtimeChunkNames.map(async (name) => ({
      mtimeMs: (await stat(resolve(chunkDir, name))).mtimeMs,
      name,
    })),
  );
  const runtimeChunkName = runtimeChunks.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.name;

  if (!runtimeChunkName) {
    throw new Error("Desktop ScoutWorkerRuntime chunk not found. Run npm.cmd run build first.");
  }

  const runtimeModule = await import(pathToFileURL(resolve(chunkDir, runtimeChunkName)).href);
  const ScoutWorkerRuntime = runtimeModule.S;

  if (!ScoutWorkerRuntime) {
    throw new Error(`Desktop ScoutWorkerRuntime export missing from ${runtimeChunkName}.`);
  }

  return new ScoutWorkerRuntime();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
