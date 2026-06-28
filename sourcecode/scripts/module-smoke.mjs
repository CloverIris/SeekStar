#!/usr/bin/env node
import http from "node:http";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { readdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { PlaywrightScoutService, resolveContentProviderApiKey, resolveContentProviderSecretRef } from "@seekstar/scout-service";
import {
  buildWorkspaceSnapshot,
  applyLevelRuntimeOutputToScene,
  applyLayerSelect,
  CartographerChunkCoordinator,
  createCartographerChunkCacheKey,
  createDirectUrlScoutPlan,
  createSeedScene,
  createTerrainPixiProjection,
  ScoutJobCoordinator,
  WorkspacePersistenceCoordinator,
} from "@seekstar/constellation-engine";

const runPublicSearch = process.argv.includes("--public-search");
const execFileAsync = promisify(execFile);

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
const onePixelPng = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100ffff03000006000557bfab320000000049454e44ae426082",
  "hex",
);
const minimalPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "utf8");

const server = http.createServer((request, response) => {
  if (request.url === "/image.png") {
    response.writeHead(200, {
      "content-length": String(onePixelPng.length),
      "content-type": "image/png",
    });
    response.end(onePixelPng);
    return;
  }

  if (request.url === "/doc.pdf") {
    response.writeHead(200, {
      "content-length": String(minimalPdf.length),
      "content-type": "application/pdf",
    });
    response.end(minimalPdf);
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
  const providerKey = resolveContentProviderApiKey(
    {
      api_key_ref: { kind: "env", name: "SEEKSTAR_SMOKE_PROVIDER_TOKEN" },
    },
    { SEEKSTAR_SMOKE_PROVIDER_TOKEN: "smoke-secret-token" },
  );
  const providerLegacyKey = resolveContentProviderApiKey(
    {
      api_key_env_var: "SEEKSTAR_SMOKE_LEGACY_PROVIDER_TOKEN",
    },
    { SEEKSTAR_SMOKE_LEGACY_PROVIDER_TOKEN: "legacy-smoke-secret-token" },
  );
  const missingProviderKey = resolveContentProviderSecretRef(
    { kind: "env", name: "SEEKSTAR_SMOKE_MISSING_PROVIDER_TOKEN" },
    {},
  );

  assert(providerKey === "smoke-secret-token", "provider env-ref key resolution failed");
  assert(providerLegacyKey === "legacy-smoke-secret-token", "provider legacy env-var migration failed");
  assert(missingProviderKey === undefined, "missing provider key should not resolve");

  const snapshot = await service.snapshotUrl("unit-scout", localUrl);
  assert(snapshot.title === "SeekStar Local Test Page", `snapshot title mismatch: ${snapshot.title}`);
  assert(snapshot.visible_text.includes("seekstar-local-alpha"), "snapshot body text missing");
  assert(snapshot.outlinks.length >= 1, "snapshot outlink missing");
  assert(snapshot.media.length >= 1, "snapshot media missing");
  assert(snapshot.primary_resource?.kind === "html", `snapshot primary resource mismatch: ${snapshot.primary_resource?.kind}`);

  const imageSnapshot = await service.snapshotUrl("unit-scout-image", `${localUrl}image.png`);
  assert(imageSnapshot.source_type === "image", `image snapshot source type mismatch: ${imageSnapshot.source_type}`);
  assert(imageSnapshot.primary_resource?.kind === "image", `image snapshot primary kind mismatch: ${imageSnapshot.primary_resource?.kind}`);
  assert(imageSnapshot.primary_resource?.preview_url?.includes("/image.png"), "image snapshot preview URL missing");
  assert(imageSnapshot.media[0]?.kind === "image", "image snapshot media missing primary image");

  const pdfSnapshot = await service.snapshotUrl("unit-scout-pdf", `${localUrl}doc.pdf`);
  assert(pdfSnapshot.source_type === "document", `pdf snapshot source type mismatch: ${pdfSnapshot.source_type}`);
  assert(pdfSnapshot.primary_resource?.kind === "pdf", `pdf snapshot primary kind mismatch: ${pdfSnapshot.primary_resource?.kind}`);
  assert(pdfSnapshot.media[0]?.kind === "pdf", "pdf snapshot media missing primary pdf");

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
      primaryResource: snapshot.primary_resource?.kind,
      imagePrimaryResource: imageSnapshot.primary_resource?.kind,
      pdfPrimaryResource: pdfSnapshot.primary_resource?.kind,
      runStatus: packageObservation.status,
    },
    dataServiceRegistry: {
      providerSecretRef: providerKey ? "env-ref-resolved" : "missing",
      providerLegacySecretRef: providerLegacyKey ? "legacy-env-ref-resolved" : "missing",
      missingProviderSecretRef: missingProviderKey ?? "missing",
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
  const storageModule = await import(pathToFileURL(resolve("packages/storage-service/dist/index.js")).href);
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

  const fixtureGenerator = createFixtureCartographerGenerator();
  const fixtureOutput = await fixtureGenerator({
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });
  const fixtureAssistantOutput = createFixtureAssistantOutput({
    intent: "navigate",
    prompt: "Take me toward source candidates.",
    seed: "CPU",
    current_level: "L2",
    selected_nodes: [{ id: "node-cpu-docs", title: "CPU documentation", level_id: "L2" }],
    available_operations: ["focus_node", "request_chunk", "observe_source"],
  });
  const fixtureGenerationValidation = aiModule.validateCartographerGenerationOutput(fixtureOutput, {
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });
  const fixtureAssistantValidation = aiModule.validateAssistantOutput(fixtureAssistantOutput, {
    intent: "navigate",
    prompt: "Take me toward source candidates.",
  });
  const cancelledController = new AbortController();
  cancelledController.abort();
  const cancellableService = new aiModule.AiCartographerService({
    kind: "openai_compatible",
    api_key_value: "module-smoke-cancel-only",
  });
  const cancelledGenerationOutput = await cancellableService.generate(
    {
      mode: "bootstrap_seed",
      level_id: "L0",
      seed: "CPU",
    },
    { signal: cancelledController.signal },
  );
  const cancelledAssistantOutput = await cancellableService.assist(
    {
      intent: "answer_question",
      prompt: "Will this run?",
      seed: "CPU",
      current_level: "L0",
      available_operations: ["none"],
    },
    { signal: cancelledController.signal },
  );

  assert(fixtureGenerationValidation.valid, `AI fixture generation invalid: ${JSON.stringify(fixtureGenerationValidation.diagnostics)}`);
  assert(fixtureOutput.status === "ok", `AI fixture generation status: ${fixtureOutput.status}`);
  assert(fixtureOutput.nodes.length > 0, "AI fixture generation returned no nodes");
  assert(fixtureOutput.telemetry?.attempts === 1, "AI fixture generation telemetry missing attempts");
  assert(fixtureOutput.telemetry?.estimated_cost_usd === 0, "AI fixture generation telemetry should be zero cost");
  assert(fixtureAssistantValidation.valid, `AI fixture assistant invalid: ${JSON.stringify(fixtureAssistantValidation.diagnostics)}`);
  assert(fixtureAssistantOutput.status === "ok", `AI fixture assistant status: ${fixtureAssistantOutput.status}`);
  assert(fixtureAssistantOutput.actions.length > 0, "AI fixture assistant returned no actions");
  assert(fixtureAssistantOutput.telemetry?.attempts === 1, "AI fixture assistant telemetry missing attempts");
  assert(cancelledGenerationOutput.status === "cancelled", `AI cancelled generation status: ${cancelledGenerationOutput.status}`);
  assert(cancelledGenerationOutput.diagnostics[0]?.code === "ai.cancelled", "AI cancelled generation diagnostic mismatch");
  assert(cancelledAssistantOutput.status === "cancelled", `AI cancelled assistant status: ${cancelledAssistantOutput.status}`);
  const estimatedCost = aiModule.estimateAiModelCostUsd(
    { input_tokens: 1_000, output_tokens: 500, total_tokens: 1_500 },
    { input_cost_per_million_tokens_usd: 0.1, output_cost_per_million_tokens_usd: 0.2 },
  );
  assert(estimatedCost === 0.0002, `AI cost estimator mismatch: ${estimatedCost}`);

  const invalidValidation = aiModule.validateCartographerGenerationOutput({ nodes: "bad" }, {
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
  });
  const invalidAssistantValidation = aiModule.validateAssistantOutput({ actions: [] }, {
    intent: "answer_question",
    prompt: "validation",
  });
  assert(!invalidValidation.valid, "AI invalid JSON validation should fail");
  assert(!invalidAssistantValidation.valid, "AI invalid assistant validation should fail");

  const baseChunk = levelRuntimeModule.createLevelChunkKey(0, 0, 0);
  const cancelledRuntimeOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "bootstrap_seed",
      level_id: "L0",
      seed: "CPU",
      chunk: baseChunk,
    },
    {
      generate: fixtureGenerator,
      signal: cancelledController.signal,
    },
  );
  assert(cancelledRuntimeOutput.status === "cancelled", `Level Runtime cancellation status: ${cancelledRuntimeOutput.status}`);
  const profiles = levelRuntimeModule.listLevelRuntimeProfiles();
  const defaultProfile = levelRuntimeModule.resolveLevelRuntimeProfile(levelRuntimeModule.DEFAULT_LEVEL_RUNTIME_PROFILE_ID);
  const l0Module = levelRuntimeModule.resolveLevelModuleDefinition("L0", defaultProfile.id);
  const l3Module = levelRuntimeModule.resolveLevelModuleDefinition("L3", defaultProfile.id);
  const cliProfiles = await execJson(process.execPath, [resolve("packages/level-runtime/dist/cli.js"), "profiles"]);
  const cliL3Module = await execJson(process.execPath, [resolve("packages/level-runtime/dist/cli.js"), "module", "--level", "L3"]);
  const aiPromptInputPath = resolve(`.module-smoke-ai-prompt-${Date.now()}.json`);
  await writeFile(
    aiPromptInputPath,
    JSON.stringify({
      mode: "decompose_down",
      level_id: "L3",
      seed: "CPU",
      chunk: baseChunk,
      context: {
        level_module: l3Module,
      },
    }),
    "utf8",
  );
  const aiPromptPreview = await execJson(process.execPath, [resolve("packages/ai-service/dist/cli.js"), "prompt", "--input", aiPromptInputPath]);
  const assistantPromptInputPath = resolve(`.module-smoke-ai-assistant-${Date.now()}.json`);
  await writeFile(
    assistantPromptInputPath,
    JSON.stringify({
      intent: "navigate",
      prompt: "Find nearby source-backed options.",
      seed: "CPU",
      current_level: "L2",
      available_operations: ["focus_node", "request_chunk", "observe_source"],
    }),
    "utf8",
  );
  const assistantPromptPreview = await execJson(process.execPath, [
    resolve("packages/ai-service/dist/cli.js"),
    "assistant-prompt",
    "--input",
    assistantPromptInputPath,
  ]);
  await rm(aiPromptInputPath, { force: true });
  await rm(assistantPromptInputPath, { force: true });

  const defaultProfileId = levelRuntimeModule.DEFAULT_LEVEL_RUNTIME_PROFILE_ID;
  assert(profiles.some((profile) => profile.id === defaultProfileId), "Level Runtime default profile missing");
  assert(l0Module.source_candidate_policy === "none", `L0 source candidate policy mismatch: ${l0Module.source_candidate_policy}`);
  assert(l3Module.source_candidate_policy === "prefer_unverified", `L3 source candidate policy mismatch: ${l3Module.source_candidate_policy}`);
  assert(Array.isArray(cliProfiles) && cliProfiles.some((profile) => profile.id === defaultProfileId), "Level Runtime CLI profiles missing default");
  assert(cliL3Module.level_id === "L3" && cliL3Module.layout_family === "tile_field", "Level Runtime CLI L3 module mismatch");
  const aiPromptUserMessage = aiPromptPreview.messages?.find((message) => message.role === "user");
  const aiPromptPayload = JSON.parse(aiPromptUserMessage?.content ?? "{}");
  assert(aiPromptPayload.output_contract, "AI Service CLI prompt preview missing compact output contract");
  assert(
    Array.isArray(aiPromptPayload.output_contract.nodes) && aiPromptPayload.output_contract.nodes.length === 0,
    "AI Service CLI L3 prompt contract must keep AI nodes out of the tile canvas",
  );
  assert(!aiPromptPayload.settings?.prompt_profile, "AI Service CLI prompt preview must not include full prompt profile");
  assert(!aiPromptPayload.settings?.modules, "AI Service CLI prompt preview must not include full prompt modules");
  assert(
    assistantPromptPreview.messages?.some((message) => message.content.includes("AI Map Assistant")),
    "AI Service CLI assistant prompt preview missing assistant instruction",
  );

  const levels = ["L0", "L1", "L2", "L3"];
  const levelOutputs = [];
  let l0RuntimeOutput;
  let l1RuntimeOutput;
  let l3RuntimeOutput;

  for (const levelId of levels) {
    const output = await levelRuntimeModule.runLevelRuntime(
      {
        mode: levelId === "L0" ? "bootstrap_seed" : "decompose_down",
        level_id: levelId,
        seed: "CPU",
        chunk: baseChunk,
      },
      {
        generate: fixtureGenerator,
      },
    );
    const validation = levelRuntimeModule.validateLevelRuntimeOutput(output);

    assert(output.status === "ok", `Level Runtime ${levelId} status: ${output.status}`);
    assert(validation.valid, `Level Runtime ${levelId} invalid: ${JSON.stringify(validation.diagnostics)}`);
    if (levelId === "L3") {
      assert(output.nodes.length === 0, "Level Runtime L3 must not return main-canvas webpage/document nodes");
    } else {
      assert(output.nodes.length > 0, `Level Runtime ${levelId} returned no nodes`);
    }
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

    if (levelId === "L0") {
      l0RuntimeOutput = output;
    }
    if (levelId === "L1") {
      l1RuntimeOutput = output;
    }
    if (levelId === "L3") {
      l3RuntimeOutput = output;
    }
  }

  const l3 = levelOutputs.find((output) => output.levelId === "L3");
  const l2 = levelOutputs.find((output) => output.levelId === "L2");
  const l0 = levelOutputs.find((output) => output.levelId === "L0");
  assert(l0?.sourceCandidates === 0, `Level Runtime L0 should not expose source candidates: ${l0?.sourceCandidates}`);
  assert(l2?.preloadChunks === 0, `Level Runtime L2 should not expose preload chunks: ${l2?.preloadChunks}`);
  assert(l3?.preloadChunks === 0, `Level Runtime L3 should not expose preload chunks: ${l3?.preloadChunks}`);
  assert(l3?.sourceCandidates > 0, "Level Runtime L3 should expose unverified source candidates");
  assert(l0RuntimeOutput, "Level Runtime L0 output missing");
  assert(l1RuntimeOutput, "Level Runtime L1 output missing");
  assert(l3RuntimeOutput, "Level Runtime L3 output missing");
  assertGalleryAdjacency(l0RuntimeOutput, "L0");
  assertGalleryAdjacency(l1RuntimeOutput, "L1");

  const missingGeneratorRuntimeOutput = await levelRuntimeModule.runLevelRuntime({
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
    chunk: baseChunk,
  });
  assert(missingGeneratorRuntimeOutput.status === "provider_error", `Level Runtime missing generator status: ${missingGeneratorRuntimeOutput.status}`);
  assert(
    missingGeneratorRuntimeOutput.diagnostics.some((diagnostic) => diagnostic.code === "level_runtime.missing_generator"),
    "Level Runtime missing generator diagnostic absent",
  );

  const invalidL3RuntimeOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "decompose_down",
      level_id: "L3",
      seed: "CPU",
      chunk: baseChunk,
    },
    {
      generate: async (generationInput) => createInvalidL3NodeOnlyOutput(generationInput),
    },
  );
  assert(invalidL3RuntimeOutput.status === "ok", `Level Runtime invalid L3 recovery status: ${invalidL3RuntimeOutput.status}`);
  assert(invalidL3RuntimeOutput.nodes.length === 0, "Level Runtime invalid L3 output must not retain webpage nodes");
  assert(invalidL3RuntimeOutput.source_candidates.length > 0, "Level Runtime invalid L3 output should recover unverified source candidates");
  assert(invalidL3RuntimeOutput.chunk_hints.preload.length === 0, "Level Runtime invalid L3 output must not preload");

  const replacementRuntimeOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "replace_failed_source",
      level_id: "L3",
      seed: "CPU",
      chunk: baseChunk,
      focus: {
        id: "failed-observation-smoke",
        title: "Failed CPU source",
        level_id: "L3",
        excerpt: "The original candidate could not be observed.",
      },
      context: {
        failed_observation: {
          id: "failed-observation-smoke",
          title: "Failed CPU source",
          url: "https://example.invalid/cpu",
          failure_reason: "Smoke-test replacement context.",
        },
        replacement_reason: "failed_source_candidate",
      },
    },
    {
      generate: fixtureGenerator,
    },
  );
  const replacementValidation = levelRuntimeModule.validateLevelRuntimeOutput(replacementRuntimeOutput);

  assert(replacementRuntimeOutput.status === "ok", `Level Runtime replacement status: ${replacementRuntimeOutput.status}`);
  assert(replacementValidation.valid, `Level Runtime replacement invalid: ${JSON.stringify(replacementValidation.diagnostics)}`);
  assert(replacementRuntimeOutput.source_candidates.length > 0, "Level Runtime replacement should expose replacement candidates");
  assert(replacementRuntimeOutput.chunk_hints.preload.length === 0, "Level Runtime replacement should not preload L3 chunks");
  assert(
    replacementRuntimeOutput.source_candidates.every((candidate) => candidate.source_state === "cartographer_unverified_source"),
    "Level Runtime replacement produced non-unverified source candidates",
  );

  const focusAOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "decompose_down",
      level_id: "L2",
      seed: "CPU",
      chunk: baseChunk,
      focus: { id: "focus-a", title: "Focus A", level_id: "L1" },
      context: {
        focus_anchor: { id: "focus-a", title: "Focus A", layer: "L1", x: -500, y: 0 },
        scale_model: "continuous",
      },
    },
    { generate: fixtureGenerator },
  );
  const focusBOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "decompose_down",
      level_id: "L2",
      seed: "CPU",
      chunk: baseChunk,
      focus: { id: "focus-b", title: "Focus B", level_id: "L1" },
      context: {
        focus_anchor: { id: "focus-b", title: "Focus B", layer: "L1", x: 500, y: 0 },
        scale_model: "continuous",
      },
    },
    { generate: fixtureGenerator },
  );
  const focusAIds = new Set(focusAOutput.nodes.map((node) => node.id));
  const focusBX = averageNodeX(focusBOutput.nodes);
  const focusAX = averageNodeX(focusAOutput.nodes);
  assert(focusAOutput.nodes.length > 0 && focusBOutput.nodes.length > 0, "Focused continuous L2 smoke returned no nodes");
  assert(focusBOutput.nodes.every((node) => !focusAIds.has(node.id)), "Focused continuous L2 node ids collided across parent anchors");
  assert(focusBX - focusAX > 600, `Focused continuous L2 anchors did not separate terrain: ${focusAX} -> ${focusBX}`);

  let promptOverrideGenerationInput;
  const promptOverrideOutput = await levelRuntimeModule.runLevelRuntime(
    {
      mode: "bootstrap_seed",
      level_id: "L0",
      seed: "CPU",
      chunk: baseChunk,
      settings: {
        prompt_profile_id: "seekstar-smoke-custom",
        prompt_profile: {
          id: "seekstar-smoke-custom",
          language: "en",
          density: "compact",
          modules: {
            L0: {
              target_count: 3,
              prompt_brief: "Smoke custom L0 brief.",
              prompt_constraints: ["Smoke custom constraint."],
            },
          },
        },
      },
    },
    {
      generate: async (generationInput) => {
        promptOverrideGenerationInput = generationInput;
        return fixtureGenerator(generationInput);
      },
    },
  );
  const promptOverrideValidation = levelRuntimeModule.validateLevelRuntimeOutput(promptOverrideOutput);

  assert(promptOverrideValidation.valid, `Level Runtime prompt override invalid: ${JSON.stringify(promptOverrideValidation.diagnostics)}`);
  assert(promptOverrideOutput.nodes.length <= 3, `Level Runtime prompt override target count ignored: ${promptOverrideOutput.nodes.length}`);
  assert(
    promptOverrideGenerationInput?.context?.level_module?.prompt_brief === "Smoke custom L0 brief.",
    "Level Runtime prompt override brief did not reach AI input",
  );
  assert(
    promptOverrideGenerationInput?.context?.level_module?.prompt_constraints?.includes("Smoke custom constraint."),
    "Level Runtime prompt override constraints did not reach AI input",
  );
  assert(promptOverrideGenerationInput?.settings?.language === "en", "Level Runtime prompt override language did not reach AI input");
  assert(!promptOverrideGenerationInput?.settings?.prompt_profile, "Level Runtime AI payload must not include full prompt_profile");
  assert(!promptOverrideGenerationInput?.settings?.modules, "Level Runtime AI payload must not include full prompt modules");
  assert(promptOverrideGenerationInput?.context?.level_module?.target_count === 3, "Level Runtime compact level module target did not reach AI input");

  const host = new levelRuntimeModule.ChunkedLevelRuntimeHost({
    generate: fixtureGenerator,
    maxCacheEntries: 4,
    maxPreloadChunks: 2,
    now: createDeterministicClock(),
  });
  const hostInput = {
    mode: "bootstrap_seed",
    level_id: "L0",
    seed: "CPU",
    chunk: baseChunk,
  };
  const defaultPolicyCacheKey = levelRuntimeModule.createLevelRuntimeCacheKey(hostInput);
  const compactPolicyCacheKey = levelRuntimeModule.createLevelRuntimeCacheKey({
    ...hostInput,
    settings: {
      chunk_policy: {
        auto_preload_ring: 1,
        boundary_debounce_ms: 360,
        chunk_height: 600,
        chunk_width: 600,
        manual_preload_range: 1,
      },
    },
  });
  const hostMiss = await host.request(hostInput, { preload: true });
  const hostHit = await host.request(hostInput);
  const hostRefresh = await host.request(hostInput, { forceRefresh: true });
  await host.request({ ...hostInput, chunk: levelRuntimeModule.createLevelChunkKey(10, 0, 0) });
  await host.request({ ...hostInput, chunk: levelRuntimeModule.createLevelChunkKey(11, 0, 0) });
  await host.request({ ...hostInput, chunk: levelRuntimeModule.createLevelChunkKey(12, 0, 0) });
  const hostStats = host.getStats();
  const firstCacheEntry = host.getCacheSnapshot()[0];

  assert(hostMiss.cache_status === "miss", `Level Runtime host first request should miss: ${hostMiss.cache_status}`);
  assert(defaultPolicyCacheKey !== compactPolicyCacheKey, "Level Runtime cache key ignored chunk policy dimensions");
  assert(hostMiss.preloaded.length === 2, `Level Runtime host preload count: ${hostMiss.preloaded.length}`);
  assert(hostHit.cache_status === "hit", `Level Runtime host second request should hit: ${hostHit.cache_status}`);
  assert(hostRefresh.cache_status === "refresh", `Level Runtime host forced request should refresh: ${hostRefresh.cache_status}`);
  assert(hostStats.cache_entries <= 4, `Level Runtime host cache limit exceeded: ${hostStats.cache_entries}`);
  assert(firstCacheEntry, "Level Runtime host cache snapshot missing first entry");

  const chunkCachePath = resolve(`.module-smoke-level-chunks-${Date.now()}.json`);
  const chunkStorage = new storageModule.JsonLevelChunkStorage(chunkCachePath);
  const firstCacheInput = firstCacheEntry.input;
  const chunkRecord = storageModule.createLevelChunkCacheRecord({
    accessCount: firstCacheEntry.access_count,
    cacheKey: firstCacheEntry.cache_key,
    createdAt: firstCacheEntry.created_at,
    input: {
      mode: firstCacheInput.mode,
      level_id: firstCacheInput.level_id,
      seed: firstCacheInput.seed,
      chunk_key: firstCacheInput.chunk.key,
      chunk_policy_key: firstCacheInput.settings?.chunk_policy?.policy_revision,
      focus_key: firstCacheInput.focus?.id ?? firstCacheInput.focus?.title,
      prompt_profile_id: firstCacheInput.settings?.prompt_profile_id,
    },
    lastAccessedAt: firstCacheEntry.last_accessed_at,
    output: firstCacheEntry.output,
  });
  await chunkStorage.saveChunk(chunkRecord);
  const loadedChunkRecord = await chunkStorage.loadChunk(chunkRecord.cache_key);
  await chunkStorage.saveChunk({
    ...chunkRecord,
    cache_key: `${chunkRecord.cache_key}:older`,
    access_count: 0,
    last_accessed_at: "2026-01-01T00:00:00.000Z",
  });
  const pruneResult = await chunkStorage.pruneChunks(1);
  const chunkListAfterPrune = await chunkStorage.listChunks();
  await chunkStorage.clearChunks();
  await rm(chunkCachePath, { force: true });

  assert(loadedChunkRecord?.cache_key === chunkRecord.cache_key, "Storage chunk cache failed to reload saved chunk");
  assert(
    loadedChunkRecord?.input.chunk_policy_key === firstCacheInput.settings?.chunk_policy?.policy_revision,
    "Storage chunk cache did not preserve chunk policy key",
  );
  assert(pruneResult.evicted.length === 1, `Storage chunk prune eviction mismatch: ${pruneResult.evicted.length}`);
  assert(chunkListAfterPrune.length === 1, `Storage chunk prune remaining mismatch: ${chunkListAfterPrune.length}`);

  const workspaceStoragePath = resolve(`.module-smoke-workspace-${Date.now()}.json`);
  const workspaceStorage = new storageModule.JsonWorkspaceStorage(workspaceStoragePath);
  const workspaceScene = createSeedScene("Storage Smoke", {
    tabId: "tab-storage-smoke",
    timestamp: new Date().toISOString(),
  });
  const workspaceSnapshot = buildWorkspaceSnapshot({
    activeTabId: workspaceScene.active_tab_id,
    basketByTabId: {},
    fallbackScene: workspaceScene,
    scenesByTabId: {
      [workspaceScene.active_tab_id]: workspaceScene,
    },
  });
  await workspaceStorage.saveWorkspaceSnapshot(workspaceSnapshot);
  const workspaceInspection = await workspaceStorage.inspectWorkspaceSnapshot();
  const loadedWorkspaceSnapshot = await workspaceStorage.loadWorkspaceSnapshot();
  await writeFile(workspaceStoragePath, "{not-json", "utf8");
  const corruptWorkspaceInspection = await workspaceStorage.inspectWorkspaceSnapshot();
  await workspaceStorage.clearWorkspaceSnapshot();
  await rm(workspaceStoragePath, { force: true });
  if (corruptWorkspaceInspection.quarantine_path) {
    await rm(corruptWorkspaceInspection.quarantine_path, { force: true });
  }

  assert(workspaceInspection.status === "valid", `Workspace storage inspection failed: ${workspaceInspection.status}`);
  assert(loadedWorkspaceSnapshot?.active_tab_id === workspaceScene.active_tab_id, "Workspace storage failed to reload saved snapshot");
  assert(corruptWorkspaceInspection.status === "invalid_json", `Workspace storage corrupt inspection mismatch: ${corruptWorkspaceInspection.status}`);
  assert(Boolean(corruptWorkspaceInspection.quarantine_path), "Workspace storage did not quarantine corrupt JSON");

  const cartographerScene = createSeedScene("CPU", {
    tabId: "tab-ai-cartographer-smoke",
    timestamp: new Date().toISOString(),
  });
  const coordinatorCachePath = resolve(`.module-smoke-cartographer-coordinator-${Date.now()}.json`);
  const coordinatorStorage = new storageModule.JsonLevelChunkStorage(coordinatorCachePath);
  const coordinator = new CartographerChunkCoordinator({
    generate: (input, options) => levelRuntimeModule.runLevelRuntime(input, { ...options, generate: fixtureGenerator }),
    maxPreloadChunks: 2,
    maxStoredChunks: 6,
    now: createDeterministicClock(),
    storage: coordinatorStorage,
  });
  const coordinatorMiss = await coordinator.request({
    applyToScene: true,
    chunk: baseChunk,
    level_id: "L3",
    mode: "decompose_down",
    preload: true,
    scene: cartographerScene,
    seed: "CPU",
  });
  const coordinatorHit = await coordinator.request({
    applyToScene: false,
    chunk: baseChunk,
    level_id: "L3",
    mode: "decompose_down",
    scene: cartographerScene,
    seed: "CPU",
  });
  let rendererBootstrappedScene = createSeedScene("GPU", {
    tabId: "tab-ai-cartographer-renderer-smoke",
    timestamp: new Date().toISOString(),
  });
  const rendererBootstrapLevels = [
    ["L0", "bootstrap_seed"],
    ["L1", "decompose_down"],
    ["L2", "decompose_down"],
    ["L3", "decompose_down"],
  ];

  for (const [levelId, mode] of rendererBootstrapLevels) {
    const result = await coordinator.request({
      applyToScene: true,
      chunk: baseChunk,
      level_id: levelId,
      mode,
      preload: true,
      scene: rendererBootstrappedScene,
      seed: "GPU",
    });

    if (result.sceneApply?.scene) {
      rendererBootstrappedScene = result.sceneApply.scene;
    }
  }

  const rendererBootstrapProjection = createTerrainPixiProjection(
    rendererBootstrappedScene,
    { ...rendererBootstrappedScene.viewport, layer: "L3", zoom: 1.42 },
    {
      viewportBounds: { width: 1280, height: 800 },
    },
  );
  const rendererChunkExpansion = await coordinator.request({
    applyToScene: true,
    chunk: levelRuntimeModule.createLevelChunkKey(1, 0, 1),
    context: {
      expansion_reason: "viewport_edge",
      viewport: { ...rendererBootstrappedScene.viewport, x: 1200, y: 0, layer: "L1" },
    },
    level_id: "L1",
    mode: "expand_horizontal",
    preload: true,
    scene: rendererBootstrappedScene,
    seed: "GPU",
  });
  const coordinatorReplacement = await coordinator.request({
    applyToScene: true,
    chunk: levelRuntimeModule.createLevelChunkKey(2, 0, 2),
    context: {
      failed_observation: {
        id: "failed-observation-smoke",
        title: "Failed GPU source",
        url: "https://example.invalid/gpu",
        failure_reason: "Smoke-test replacement context.",
      },
      replacement_reason: "failed_source_candidate",
    },
    focus: {
      id: "failed-observation-smoke",
      title: "Failed GPU source",
      level_id: "L3",
      excerpt: "The original candidate could not be observed.",
    },
    level_id: "L3",
    mode: "replace_failed_source",
    preload: true,
    scene: rendererBootstrappedScene,
    seed: "GPU",
  });
  const invalidCoordinatorStoragePath = resolve(`.module-smoke-cartographer-invalid-l3-${Date.now()}.json`);
  const invalidCoordinatorStorage = new storageModule.JsonLevelChunkStorage(invalidCoordinatorStoragePath);
  const invalidCoordinator = new CartographerChunkCoordinator({
    generate: (input, options) =>
      levelRuntimeModule.runLevelRuntime(input, {
        ...options,
        generate: async (generationInput) => createInvalidL3NodeOnlyOutput(generationInput),
      }),
    storage: invalidCoordinatorStorage,
  });
  const invalidCoordinatorResult = await invalidCoordinator.request({
    applyToScene: true,
    chunk: levelRuntimeModule.createLevelChunkKey(3, 0, 3),
    level_id: "L3",
    mode: "decompose_down",
    preload: true,
    scene: rendererBootstrappedScene,
    seed: "GPU",
  });
  const invalidCoordinatorStoredChunks = await invalidCoordinatorStorage.listChunks();
  await invalidCoordinatorStorage.clearChunks();
  await rm(invalidCoordinatorStoragePath, { force: true });
  const staleL3CachePath = resolve(`.module-smoke-cartographer-stale-l3-${Date.now()}.json`);
  const staleL3Storage = new storageModule.JsonLevelChunkStorage(staleL3CachePath);
  const staleL3Input = {
    mode: "decompose_down",
    level_id: "L3",
    seed: "GPU stale cache",
    chunk: baseChunk,
  };
  const staleL3CacheKey = createCartographerChunkCacheKey(staleL3Input);
  await staleL3Storage.saveChunk(storageModule.createLevelChunkCacheRecord({
    cacheKey: staleL3CacheKey,
    input: {
      mode: staleL3Input.mode,
      level_id: staleL3Input.level_id,
      seed: staleL3Input.seed,
      chunk_key: staleL3Input.chunk.key,
      focus_key: "none",
    },
    output: createInvalidL3NodeOnlyOutput(staleL3Input),
  }));
  const staleL3Coordinator = new CartographerChunkCoordinator({
    generate: (input, options) => levelRuntimeModule.runLevelRuntime(input, { ...options, generate: fixtureGenerator }),
    storage: staleL3Storage,
  });
  const staleL3Refresh = await staleL3Coordinator.request({
    applyToScene: true,
    chunk: staleL3Input.chunk,
    level_id: "L3",
    mode: "decompose_down",
    scene: rendererBootstrappedScene,
    seed: staleL3Input.seed,
  });
  await staleL3Storage.clearChunks();
  await rm(staleL3CachePath, { force: true });
  const rendererExpandedScene = rendererChunkExpansion.sceneApply?.scene ?? rendererBootstrappedScene;
  const rendererExpansionProjection = createTerrainPixiProjection(
    rendererExpandedScene,
    { ...rendererExpandedScene.viewport, x: 1200, y: 0, layer: "L1", zoom: 1.18 },
    {
      viewportBounds: { width: 1280, height: 800 },
    },
  );
  const coordinatorStoredChunks = await coordinatorStorage.listChunks();
  const cancelledCoordinatorStoragePath = resolve(`.module-smoke-cartographer-cancel-${Date.now()}.json`);
  const cancelledCoordinatorStorage = new storageModule.JsonLevelChunkStorage(cancelledCoordinatorStoragePath);
  const coordinatorCancelController = new AbortController();
  coordinatorCancelController.abort();
  const cancelledCoordinator = new CartographerChunkCoordinator({
    generate: (input, options) => levelRuntimeModule.runLevelRuntime(input, { ...options, generate: fixtureGenerator }),
    storage: cancelledCoordinatorStorage,
  });
  const coordinatorCancelled = await cancelledCoordinator.request({
    applyToScene: true,
    chunk: levelRuntimeModule.createLevelChunkKey(4, 0, 4),
    level_id: "L1",
    mode: "expand_horizontal",
    preload: true,
    scene: cartographerScene,
    seed: "CPU",
    signal: coordinatorCancelController.signal,
  });
  const cancelledCoordinatorStoredChunks = await cancelledCoordinatorStorage.listChunks();
  await cancelledCoordinatorStorage.clearChunks();
  await rm(cancelledCoordinatorStoragePath, { force: true });
  await coordinatorStorage.clearChunks();
  await rm(coordinatorCachePath, { force: true });

  assert(coordinatorMiss.cacheStatus === "miss", `Cartographer coordinator first request should miss: ${coordinatorMiss.cacheStatus}`);
  assert(coordinatorMiss.sceneApply?.addedObservationIds.length > 0, "Cartographer coordinator did not apply L3 candidates to scene");
  assert(coordinatorMiss.preloaded.length === 0, `Cartographer coordinator L3 preload count: ${coordinatorMiss.preloaded.length}`);
  assert(coordinatorMiss.chunkRecords.length === 1, `Cartographer coordinator L3 lifecycle record count: ${coordinatorMiss.chunkRecords.length}`);
  assert(
    coordinatorMiss.chunkRecords.some((record) => record.role === "active" && record.cacheStatus === "miss" && record.phase === "applied"),
    "Cartographer coordinator did not return an active miss lifecycle record",
  );
  assert(
    coordinatorMiss.chunkRecords.filter((record) => record.role === "preload").length === 0,
    "Cartographer coordinator must not return preload lifecycle records for L3",
  );
  assert(coordinatorHit.cacheStatus === "hit", `Cartographer coordinator second request should hit: ${coordinatorHit.cacheStatus}`);
  assert(
    coordinatorHit.chunkRecords.length === 1 && coordinatorHit.chunkRecords[0].cacheStatus === "hit",
    "Cartographer coordinator hit did not return a hit lifecycle record",
  );
  assert(coordinatorStoredChunks.length >= 1, "Cartographer coordinator did not persist chunks");
  assert(coordinatorCancelled.output.status === "cancelled", `Cartographer coordinator cancellation status: ${coordinatorCancelled.output.status}`);
  assert(!coordinatorCancelled.sceneApply, "Cartographer coordinator cancellation must not apply scene output");
  assert(
    coordinatorCancelled.chunkRecords.length === 1 && coordinatorCancelled.chunkRecords[0].phase === "cancelled",
    "Cartographer coordinator cancellation lifecycle record mismatch",
  );
  assert(cancelledCoordinatorStoredChunks.length === 0, "Cartographer coordinator cancellation must not persist chunk output");
  assert(
    rendererBootstrappedScene.nodes.some((node) => node.source_state === "cartographer_primary"),
    "Renderer-style Cartographer bootstrap did not add cartographer_primary terrain",
  );
  assert(
    rendererBootstrapProjection.mainContent.mode === "source_candidate_field",
    `Renderer-style Cartographer bootstrap projection mode: ${rendererBootstrapProjection.mainContent.mode}`,
  );
  assert(
    rendererBootstrapProjection.candidateObservations.length > 0,
    "Renderer-style Cartographer bootstrap did not retain L3 candidate observations",
  );
  assert(
    rendererBootstrapProjection.candidateTileSurfaces.length === 0,
    "Renderer-style Cartographer bootstrap must not render unverified candidates as tile surfaces",
  );
  assert(
    rendererBootstrapProjection.tileSurfaces.length === 0,
    "Renderer-style Cartographer bootstrap must not create source-backed tile surfaces before DataService validation",
  );
  assert(
    (rendererChunkExpansion.sceneApply?.addedNodeIds.length ?? 0) > 0,
    "Renderer-style Cartographer chunk expansion did not add adjacent terrain",
  );
  assert(
    rendererExpansionProjection.mainContent.mode === "cartographer_chunk_field",
    `Renderer-style Cartographer expansion projection mode: ${rendererExpansionProjection.mainContent.mode}`,
  );
  assert(
    (coordinatorReplacement.sceneApply?.addedObservationIds.length ?? 0) > 0,
    "Cartographer coordinator source replacement did not add replacement candidates",
  );
  assert(coordinatorReplacement.preloaded.length === 0, `Cartographer coordinator replacement preload count: ${coordinatorReplacement.preloaded.length}`);
  assert(invalidCoordinatorResult.output.status === "ok", `Cartographer coordinator recovered L3 status: ${invalidCoordinatorResult.output.status}`);
  assert(invalidCoordinatorResult.output.nodes.length === 0, "Cartographer coordinator recovered L3 output must not retain webpage nodes");
  assert(
    (invalidCoordinatorResult.sceneApply?.addedObservationIds.length ?? 0) > 0,
    "Cartographer coordinator recovered L3 output should apply source candidate observations",
  );
  assert(invalidCoordinatorStoredChunks.length > 0, "Cartographer coordinator recovered L3 output should be cached");
  assert(staleL3Refresh.cacheStatus === "refresh", `Cartographer coordinator stale L3 cache status: ${staleL3Refresh.cacheStatus}`);
  assert(staleL3Refresh.output.nodes.length === 0, "Cartographer coordinator stale L3 cache should regenerate through L3 cleaner");
  assert(staleL3Refresh.output.source_candidates.length > 0, "Cartographer coordinator stale L3 cache should regenerate source candidates");

  const l0Apply = applyLevelRuntimeOutputToScene(cartographerScene, l0RuntimeOutput, { focusFirstNode: false });
  const l0FocusTarget = l0Apply.scene.nodes.find((node) => node.layer === "L0");
  assert(l0FocusTarget, "Continuous zoom-in smoke target missing");
  const zoomInSelection = applyLayerSelect(l0Apply.scene, "L1", l0FocusTarget.id);
  assert(zoomInSelection.focusNodeId === l0FocusTarget.id, "Continuous zoom-in should retain parent focus anchor");
  assert(zoomInSelection.scene.runtime.focused_node_id === l0FocusTarget.id, "Continuous zoom-in runtime focus should remain on parent anchor");
  assert(zoomInSelection.scene.selection.node_ids.length === 0, "Continuous zoom-in should not select parent node on child layer");
  const l1Apply = applyLevelRuntimeOutputToScene(l0Apply.scene, l1RuntimeOutput, { focusFirstNode: false });
  const l3Apply = applyLevelRuntimeOutputToScene(l0Apply.scene, l3RuntimeOutput, { focusFirstNode: false });
  const l1Projection = createTerrainPixiProjection(l1Apply.scene, { ...l1Apply.scene.viewport, layer: "L1", zoom: 1.18 }, {
    viewportBounds: { width: 1280, height: 800 },
  });
  const l3Projection = createTerrainPixiProjection(l3Apply.scene, { ...l3Apply.scene.viewport, layer: "L3", zoom: 1.42 }, {
    viewportBounds: { width: 1280, height: 800 },
  });

  assert(l0Apply.addedNodeIds.length > 0, "Cartographer runtime bridge added no L0 nodes");
  assert(l1Projection.mainContent.mode === "cartographer_chunk_field", `Cartographer runtime L1 projection mode: ${l1Projection.mainContent.mode}`);
  const l1Nodes = l1Apply.scene.nodes.filter((node) => node.layer === "L1");
  const zoomOutTargetNode = l1Nodes[l1Nodes.length - 1];
  assert(zoomOutTargetNode, "Continuous zoom-out smoke target missing");
  const zoomOutSelection = applyLayerSelect(
    {
      ...l1Apply.scene,
      viewport: {
        ...l1Apply.scene.viewport,
        layer: "L2",
        x: zoomOutTargetNode.position_hint?.x ?? 0,
        y: zoomOutTargetNode.position_hint?.y ?? 0,
        zoom: 1.42,
      },
    },
    "L1",
  );
  assert(zoomOutSelection.focusNodeId === zoomOutTargetNode.id, "Continuous zoom-out should select the nearest upper-layer anchor");
  assert(l3Apply.addedObservationIds.length > 0, "Cartographer runtime bridge added no L3 source candidates");
  assert(l3Projection.mainContent.mode === "source_candidate_field", `Cartographer runtime projection mode: ${l3Projection.mainContent.mode}`);
  assert(l3Projection.candidateObservations.length > 0, "Cartographer runtime projection candidate observation missing");
  assert(l3Projection.candidateTileSurfaces.length === 0, "Cartographer runtime must not render unverified candidates as tile surfaces");
  assert(l3Projection.tileSurfaces.length === 0, "Cartographer runtime should not create source-backed tile surfaces");

  return {
    missingKeyStatus: missingKeyOutput.status,
    fixtureNodes: fixtureOutput.nodes.length,
    fixtureAssistantActions: fixtureAssistantOutput.actions.length,
    invalidOutputValid: invalidValidation.valid,
    invalidAssistantValid: invalidAssistantValidation.valid,
    fixtureTelemetryAttempts: fixtureOutput.telemetry.attempts,
    telemetryCostEstimate: estimatedCost,
    cancellation: {
      generation: cancelledGenerationOutput.status,
      assistant: cancelledAssistantOutput.status,
      levelRuntime: cancelledRuntimeOutput.status,
    },
    missingGenerator: missingGeneratorRuntimeOutput.status,
    invalidL3: invalidL3RuntimeOutput.status,
    profile: {
      id: defaultProfile.id,
      l0Policy: l0Module.source_candidate_policy,
      l3Policy: l3Module.source_candidate_policy,
      cliProfiles: cliProfiles.length,
      cliL3Layout: cliL3Module.layout_family,
      aiPromptMessages: aiPromptPreview.messages.length,
      promptOverrideNodes: promptOverrideOutput.nodes.length,
      promptOverrideBrief: promptOverrideGenerationInput.context.level_module.prompt_brief,
      focusedAnchorDelta: Math.round(focusBX - focusAX),
    },
    levels: levelOutputs,
    constellationBridge: {
      addedL0Nodes: l0Apply.addedNodeIds.length,
      l1ProjectionMode: l1Projection.mainContent.mode,
      addedL3CandidateObservations: l3Apply.addedObservationIds.length,
      projectionMode: l3Projection.mainContent.mode,
      candidateObservations: l3Projection.candidateObservations.length,
      candidateTileSurfaces: l3Projection.candidateTileSurfaces.length,
      sourceTileSurfaces: l3Projection.tileSurfaces.length,
      zoomInFocusNode: zoomInSelection.focusNodeId,
      zoomOutFocusNode: zoomOutSelection.focusNodeId,
    },
    chunkRuntimeHost: {
      firstRequest: hostMiss.cache_status,
      secondRequest: hostHit.cache_status,
      forcedRequest: hostRefresh.cache_status,
      preloaded: hostMiss.preloaded.length,
      cacheEntries: hostStats.cache_entries,
      cacheBytesEstimate: hostStats.cache_bytes_estimate,
    },
    storageChunkCache: {
      loadedCacheKey: loadedChunkRecord.cache_key,
      pruneEvicted: pruneResult.evicted.length,
      remainingAfterPrune: chunkListAfterPrune.length,
    },
    workspaceStorage: {
      corruptStatus: corruptWorkspaceInspection.status,
      loadedActiveTabId: loadedWorkspaceSnapshot.active_tab_id,
      status: workspaceInspection.status,
    },
    cartographerCoordinator: {
      firstRequest: coordinatorMiss.cacheStatus,
      secondRequest: coordinatorHit.cacheStatus,
      lifecycleRecords: coordinatorMiss.chunkRecords.length,
      hitLifecycleRecords: coordinatorHit.chunkRecords.length,
      preloaded: coordinatorMiss.preloaded.length,
      appliedCandidateObservations: coordinatorMiss.sceneApply?.addedObservationIds.length ?? 0,
      rendererBootstrapCandidateObservations: rendererBootstrapProjection.candidateObservations.length,
      rendererBootstrapCandidateTiles: rendererBootstrapProjection.candidateTileSurfaces.length,
      rendererBootstrapSourceTiles: rendererBootstrapProjection.tileSurfaces.length,
      rendererExpansionAddedNodes: rendererChunkExpansion.sceneApply?.addedNodeIds.length ?? 0,
      rendererExpansionMode: rendererExpansionProjection.mainContent.mode,
      replacementCandidates: coordinatorReplacement.sceneApply?.addedObservationIds.length ?? 0,
      invalidL3CachedChunks: invalidCoordinatorStoredChunks.length,
      invalidL3Status: invalidCoordinatorResult.output.status,
      staleL3CacheStatus: staleL3Refresh.cacheStatus,
      staleL3RegeneratedCandidates: staleL3Refresh.output.source_candidates.length,
      cancellation: {
        lifecyclePhase: coordinatorCancelled.chunkRecords[0]?.phase,
        sceneApplied: Boolean(coordinatorCancelled.sceneApply),
        status: coordinatorCancelled.output.status,
        storedChunks: cancelledCoordinatorStoredChunks.length,
      },
      storedChunks: coordinatorStoredChunks.length,
    },
  };
}

function createFixtureCartographerGenerator() {
  return async (input, options = {}) => {
    if (options.signal?.aborted) {
      const generatedAt = new Date().toISOString();

      return {
        status: "cancelled",
        mode: input.mode,
        level_id: input.level_id,
        seed: input.seed,
        nodes: [],
        relations: [],
        source_candidates: [],
        diagnostics: [
          {
            severity: "info",
            code: "ai.cancelled",
            message: "Fixture generation cancelled before work started.",
            provider_id: "fixture-cartographer",
          },
        ],
        provider_id: "fixture-cartographer",
        model: "fixture-cartographer-v1",
        generated_at: generatedAt,
      };
    }

    return createFixtureGenerationOutput(input);
  };
}

function createFixtureGenerationOutput(input) {
  const generatedAt = new Date().toISOString();
  const seed = input.seed?.trim() || "Fixture Seed";
  const count = getFixtureCount(input.level_id);
  const titles = Array.from({ length: count }, (_, index) => createFixtureTitle(seed, input.level_id, input.mode, index));
  const nodes = titles.map((title, index) => ({
    id: `fixture-${slugify(input.level_id)}-${slugify(seed)}-${slugify(input.chunk?.key ?? "0")}-${index + 1}`,
    title,
    summary: `${title} as ${input.level_id} fixture terrain for ${seed}.`,
    node_type: getFixtureNodeType(input.level_id),
    source_state: "cartographer_primary",
    confidence: 0.72,
    importance: index === 0 ? 0.9 : 0.58,
    tags: [input.level_id, input.mode, "fixture-cartographer"],
    level_id: input.level_id,
    can_create_seed: true,
  }));

  return {
    status: "ok",
    mode: input.mode,
    level_id: input.level_id,
    seed,
    nodes,
    relations: nodes.slice(1).map((node, index) => ({
      id: `fixture-relation-${slugify(input.level_id)}-${index + 1}`,
      from: nodes[Math.max(0, index - 1)]?.id ?? nodes[0]?.id ?? node.id,
      to: node.id,
      type: "semantic_similarity",
      confidence: 0.58,
      explanation: `Fixture adjacency around ${seed}.`,
    })),
    source_candidates: createFixtureSourceCandidates(input, seed, titles),
    diagnostics: [
      {
        severity: "info",
        code: "ai.fixture_provider",
        message: "Schema-valid fixture output for module smoke tests.",
        provider_id: "fixture-cartographer",
      },
    ],
    provider_id: "fixture-cartographer",
    model: "fixture-cartographer-v1",
    telemetry: {
      attempts: 1,
      completed_at: generatedAt,
      duration_ms: 0,
      estimated_cost_usd: 0,
      started_at: generatedAt,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
    },
    generated_at: generatedAt,
  };
}

function createInvalidL3NodeOnlyOutput(input) {
  const generatedAt = new Date().toISOString();
  const seed = input.seed?.trim() || "Fixture Seed";

  return {
    status: "ok",
    mode: input.mode,
    level_id: input.level_id,
    seed,
    nodes: [
      {
        id: `invalid-l3-node-${slugify(seed)}`,
        title: `${seed} unverified webpage concept`,
        summary: "This deliberately invalid fixture mimics an AI webpage node without a URL candidate.",
        node_type: "webpage",
        source_state: "cartographer_primary",
        confidence: 0.5,
        importance: 0.5,
        tags: ["L3", "fixture-cartographer"],
        level_id: "L3",
      },
    ],
    relations: [],
    source_candidates: [],
    diagnostics: [
      {
        severity: "info",
        code: "ai.invalid_l3_fixture",
        message: "Fixture output intentionally returns L3 webpage nodes without source candidates.",
        provider_id: "fixture-cartographer",
      },
    ],
    provider_id: "fixture-cartographer",
    model: "fixture-cartographer-v1",
    telemetry: {
      attempts: 1,
      completed_at: generatedAt,
      duration_ms: 0,
      estimated_cost_usd: 0,
      started_at: generatedAt,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
    },
    generated_at: generatedAt,
  };
}

function createFixtureAssistantOutput(input) {
  const generatedAt = new Date().toISOString();
  const actionType = input.available_operations?.includes("request_chunk")
    ? "request_chunk"
    : input.available_operations?.includes("focus_node")
      ? "focus_node"
      : "none";

  return {
    status: "ok",
    intent: input.intent,
    answer: `Fixture map assistant response for ${input.intent}. ${input.prompt}`,
    actions: [
      {
        type: actionType,
        label: actionType === "none" ? "No app action" : `Suggested ${actionType}`,
        target_id: input.selected_nodes?.[0]?.id,
        level_id: input.current_level,
        seed: input.seed,
      },
    ],
    diagnostics: [
      {
        severity: "info",
        code: "assistant.fixture_provider",
        message: "Schema-valid fixture assistant output for module smoke tests.",
        provider_id: "fixture-cartographer",
      },
    ],
    provider_id: "fixture-cartographer",
    model: "fixture-cartographer-v1",
    telemetry: {
      attempts: 1,
      completed_at: generatedAt,
      duration_ms: 0,
      estimated_cost_usd: 0,
      started_at: generatedAt,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      },
    },
    generated_at: generatedAt,
  };
}

function createFixtureSourceCandidates(input, seed, titles) {
  if (input.level_id !== "L3" && input.mode !== "replace_failed_source") {
    return [];
  }

  const count = input.mode === "replace_failed_source" ? 2 : Math.min(4, Math.max(1, titles.length));

  return Array.from({ length: count }, (_, index) => ({
    id: `fixture-source-${slugify(seed)}-${slugify(input.mode)}-${slugify(input.chunk?.key ?? "0")}-${index + 1}`,
    title: `${seed} source candidate ${index + 1}`,
    url: `https://example.com/seekstar-fixture/${encodeURIComponent(slugify(seed) || "seed")}/${encodeURIComponent(slugify(input.mode) || "mode")}/${encodeURIComponent(slugify(input.chunk?.key ?? "0") || "chunk")}/${index + 1}`,
    snippet: `Fixture unverified source candidate ${index + 1} for ${seed}.`,
    provider_id: "fixture-cartographer",
    source_type: "webpage",
    confidence: 0.44,
    reason: "Fixture candidate remains unverified until DataService probes it.",
  }));
}

function createFixtureTitle(seed, levelId, mode, index) {
  const vocabulary = {
    supra_macro: ["systems context", "knowledge instrument", "public imagination", "material constraint"],
    L0: ["computing", "science", "engineering", "medicine", "design", "society", "history", "materials"],
    L1: ["architecture", "core concept", "research thread", "tool family", "frontier question", "application"],
    L2: ["official docs", "paper trail", "repository hub", "dataset family", "community source", "visual source"],
    L3: ["webpage tile", "paper tile", "document tile", "repository tile", "image tile", "reference tile"],
    deep_lens: ["section", "paragraph", "phrase", "word"],
    recursive_seed: ["upward context", "same-band neighbor", "downward detail", "source trail"],
  };
  const words = vocabulary[levelId] ?? vocabulary.L0;
  const suffix = mode === "expand_horizontal" ? "neighbor" : mode === "summarize_up" ? "parent" : mode === "decompose_down" ? "detail" : "seed";

  return `${seed} ${words[index % words.length]} ${Math.floor(index / words.length) + 1} ${suffix}`;
}

function getFixtureCount(levelId) {
  const counts = {
    supra_macro: 12,
    L0: 24,
    L1: 18,
    L2: 12,
    L3: 8,
    deep_lens: 12,
    recursive_seed: 6,
  };

  return counts[levelId] ?? 8;
}

function getFixtureNodeType(levelId) {
  if (levelId === "L0" || levelId === "supra_macro") {
    return "domain";
  }

  if (levelId === "L1") {
    return "topic";
  }

  if (levelId === "L2") {
    return "source";
  }

  if (levelId === "L3") {
    return "webpage";
  }

  return "concept";
}

function averageNodeX(nodes) {
  if (nodes.length === 0) {
    return 0;
  }

  return nodes.reduce((sum, node) => sum + (node.position_hint?.x ?? 0), 0) / nodes.length;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function execJson(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: resolve("."),
    maxBuffer: 1024 * 1024,
  });

  return JSON.parse(stdout);
}

function createDeterministicClock() {
  let tick = 0;

  return () => {
    tick += 1;

    return `2026-01-01T00:00:${String(tick).padStart(2, "0")}.000Z`;
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

function assertGalleryAdjacency(output, levelId) {
  const relationFanout = new Map();

  for (const relation of output.relations) {
    relationFanout.set(relation.from, (relationFanout.get(relation.from) ?? 0) + 1);
  }

  const maxFanout = Math.max(0, ...relationFanout.values());
  assert(output.relations.length <= Math.max(0, output.nodes.length - 1), `Level Runtime ${levelId} emitted too many gallery relations`);
  assert(maxFanout <= 2, `Level Runtime ${levelId} emitted radial gallery relation fanout: ${maxFanout}`);
}
