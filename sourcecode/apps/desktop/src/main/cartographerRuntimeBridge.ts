import { app, ipcMain } from "electron";
import { join } from "node:path";
import {
  CartographerChunkCoordinator,
  type CartographerChunkRequestResult,
  type CartographerGenerationMode,
  type CartographerLevelChunkKey,
  type CartographerLevelRuntimeInput,
  type CartographerLevelRuntimeSettings,
} from "@seekstar/constellation-engine";
import type { ScoutObservation, TerrainNode, TerrainScene } from "@seekstar/core-schema";
import { AiCartographerService, resolveApiKey, type AiModelTelemetry, type AiProviderConfig } from "@seekstar/ai-service";
import { runLevelRuntime } from "@seekstar/level-runtime";
import { JsonLevelChunkStorage } from "@seekstar/storage-service";
import { loadSettings, resolveAiProviderConfigForRoute, resolveCartographerLevelRuntimeSettings } from "./appSettingsStore.js";
import type { SeekStarSettings } from "./appSettingsStore.js";
import { appendAiCostLedgerRecords } from "./aiCostLedgerStore.js";
import { appendCartographerChunkRecords, type CartographerChunkStoreRecord, type CartographerChunkStoreSnapshot } from "./cartographerChunkStore.js";

export interface CartographerRuntimeRequest {
  applyToScene?: boolean;
  chunk: {
    x: number;
    y: number;
    z?: number;
    ring: number;
    key: string;
  };
  context?: Record<string, unknown>;
  focus?: {
    id?: string;
    title: string;
    level_id?: string;
    excerpt?: string;
  };
  forceRefresh?: boolean;
  level_id: "supra_macro" | "L0" | "L1" | "L2" | "L3" | "deep_lens" | "recursive_seed";
  mode: CartographerGenerationMode;
  preload?: boolean;
  scene: TerrainScene;
  seed: string;
}

export interface CartographerRuntimeBootstrapRequest {
  entryMode?: "default_tonight_sky";
  forceRefresh?: boolean;
  scene: TerrainScene;
  seed: string;
  tabId: string;
}

export interface CartographerRuntimeBootstrapResult {
  cacheStatus?: "hit" | "miss" | "refresh";
  scene: TerrainScene;
  snapshot: CartographerChunkStoreSnapshot;
  status: {
    cacheStatus?: "hit" | "miss" | "refresh";
    chunkKey?: string;
    message: string;
    phase: "applied" | "cancelled" | "error";
    updatedAt: string;
  };
}

export interface CartographerRuntimeViewportExpansionRequest {
  forceRefresh?: boolean;
  scene: TerrainScene;
  tabId: string;
  viewport: TerrainScene["viewport"];
}

export interface CartographerRuntimeViewportExpansionResult {
  result: CartographerChunkRequestResult;
  snapshot: CartographerChunkStoreSnapshot;
  status: {
    cacheStatus?: "hit" | "miss" | "refresh";
    chunkKey: string;
    levelId: CartographerRuntimeRequest["level_id"];
    message: string;
    mode: "expand_horizontal";
    phase: "applied" | "cancelled" | "error";
    updatedAt: string;
  };
}

export interface CartographerRuntimeSourceReplacementRequest {
  forceRefresh?: boolean;
  observationId: string;
  scene: TerrainScene;
  tabId: string;
}

export interface CartographerRuntimeSourceReplacementResult {
  result: CartographerChunkRequestResult;
  snapshot: CartographerChunkStoreSnapshot;
  status: {
    cacheStatus?: "hit" | "miss" | "refresh";
    chunkKey: string;
    levelId: "L3";
    message: string;
    mode: "replace_failed_source";
    phase: "applied" | "cancelled" | "error";
    updatedAt: string;
  };
}

export type CartographerRuntimeTransactionKind = "bootstrap" | "viewport_expansion" | "source_replacement";

export interface CartographerRuntimeCancelRequest {
  kind?: CartographerRuntimeTransactionKind;
  tabId: string;
}

export interface CartographerRuntimeCancelResult {
  cancelled: number;
  tabId: string;
  transactionIds: string[];
}

const CARTOGRAPHER_BOOTSTRAP_LEVELS: readonly CartographerRuntimeRequest["level_id"][] = ["supra_macro", "L0", "L1", "L2", "L3"];
const DEFAULT_TONIGHT_SKY_BOOTSTRAP_LEVELS: readonly CartographerRuntimeRequest["level_id"][] = ["supra_macro", "L0"];

let coordinator: CartographerChunkCoordinator | undefined;
const activeCartographerTransactions = new Map<string, ActiveCartographerTransaction>();

interface ActiveCartographerTransaction {
  controller: AbortController;
  id: string;
  kind: CartographerRuntimeTransactionKind;
  startedAt: string;
  tabId: string;
}

export function registerCartographerRuntimeBridge(): void {
  ipcMain.removeHandler("cartographer:request-chunk");
  ipcMain.removeHandler("cartographer:run-chunk-transaction");
  ipcMain.removeHandler("cartographer:run-bootstrap-transaction");
  ipcMain.removeHandler("cartographer:run-viewport-expansion-transaction");
  ipcMain.removeHandler("cartographer:run-source-replacement-transaction");
  ipcMain.removeHandler("cartographer:cancel-transaction");
  ipcMain.handle("cartographer:cancel-transaction", async (_event, input): Promise<CartographerRuntimeCancelResult> => {
    return cancelCartographerTransactions(parseCartographerRuntimeCancelRequest(input));
  });
  ipcMain.handle("cartographer:run-bootstrap-transaction", async (_event, input): Promise<CartographerRuntimeBootstrapResult> => {
    const bootstrap = parseCartographerRuntimeBootstrapRequest(input);
    const transaction = beginCartographerTransaction(bootstrap.tabId, "bootstrap");
    const seed = bootstrap.seed.trim() || bootstrap.scene.metadata.title;
    const chunk = createCartographerLevelChunkKey(0, 0, 0);
    const appSettings = await loadSettings();
    const runtimeSettings = resolveCartographerLevelRuntimeSettings(appSettings);
    let nextScene = bootstrap.scene;
    let lastSnapshot = await appendCartographerChunkRecords(bootstrap.tabId, []);
    let lastCacheStatus: "hit" | "miss" | "refresh" | undefined;
    let currentLevelId: CartographerRuntimeRequest["level_id"] = "L0";
    let currentMode: CartographerGenerationMode = "bootstrap_seed";

    traceCartographerBridge("bootstrap.start", {
      entry_mode: bootstrap.entryMode,
      force_refresh: Boolean(bootstrap.forceRefresh),
      seed,
      scene: summarizeSceneForTrace(nextScene),
      tab_id: bootstrap.tabId,
    });

    try {
      const bootstrapLevels =
        bootstrap.entryMode === "default_tonight_sky" ? DEFAULT_TONIGHT_SKY_BOOTSTRAP_LEVELS : CARTOGRAPHER_BOOTSTRAP_LEVELS;

      for (const levelId of bootstrapLevels) {
        const mode = resolveBootstrapCartographerMode(levelId);
        currentLevelId = levelId;
        currentMode = mode;

        if (transaction.controller.signal.aborted) {
          return createCancelledBootstrapResult(nextScene, lastSnapshot, chunk, seed);
        }

        await appendCartographerChunkRecords(bootstrap.tabId, [
          createCartographerChunkStoreRecord({
            chunk,
            levelId,
            message: `Generating ${levelId} seed chunk`,
            mode,
            phase: "generating",
            role: "active",
          }),
        ]);

        const result = await getCoordinator().request({
          applyToScene: true,
          chunk,
          context: {
            ...createCartographerSceneContext(nextScene, levelId),
            ...createBootstrapEntryContext(bootstrap.entryMode, levelId, appSettings),
          },
          forceRefresh: bootstrap.forceRefresh,
          level_id: levelId,
          mode,
          preload: false,
          scene: nextScene,
          seed,
          signal: transaction.controller.signal,
          settings: runtimeSettings,
        });

        lastCacheStatus = result.cacheStatus;
        lastSnapshot = await appendCartographerChunkRecords(bootstrap.tabId, result.chunkRecords);
        await appendCartographerCostLedgerRecords(bootstrap.tabId, result, seed);

        traceCartographerBridge("bootstrap.level.done", {
          cache_status: result.cacheStatus,
          level_id: levelId,
          mode,
          output: summarizeRuntimeOutputForTrace(result.output),
          preloaded_count: result.preloaded.length,
          scene_apply: summarizeSceneApplyForTrace(result.sceneApply),
          scene_after: result.sceneApply?.scene ? summarizeSceneForTrace(result.sceneApply.scene) : summarizeSceneForTrace(nextScene),
          tab_id: bootstrap.tabId,
        });

        if (result.output.status === "cancelled") {
          return createCancelledBootstrapResult(nextScene, lastSnapshot, chunk, seed, lastCacheStatus);
        }

        if (result.output.status !== "ok") {
          return createFailedBootstrapResult(nextScene, lastSnapshot, chunk, seed, levelId, result, lastCacheStatus);
        }

        if (result.sceneApply?.scene) {
          nextScene = result.sceneApply.scene;
        }
      }

      const completedScene = normalizeBootstrapCompletedScene(nextScene, bootstrap.entryMode);

      return {
        cacheStatus: lastCacheStatus,
        scene: completedScene,
        snapshot: lastSnapshot,
        status: {
          cacheStatus: lastCacheStatus,
          chunkKey: chunk.key,
          message: `Cartographer terrain ready for ${seed}`,
          phase: "applied",
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      traceCartographerBridge("bootstrap.error", {
        error: error instanceof Error ? error.message : String(error),
        level_id: currentLevelId,
        mode: currentMode,
        seed,
        tab_id: bootstrap.tabId,
      });

      if (transaction.controller.signal.aborted) {
        return createCancelledBootstrapResult(nextScene, lastSnapshot, chunk, seed, lastCacheStatus);
      }

      await appendCartographerChunkRecords(bootstrap.tabId, [
        createCartographerChunkStoreRecord({
          chunk,
          levelId: currentLevelId,
          message: `Failed to generate ${currentLevelId} seed chunk`,
          mode: currentMode,
          phase: "error",
          role: "active",
        }),
      ]);

      throw error;
    } finally {
      finishCartographerTransaction(transaction);
    }
  });
  ipcMain.handle("cartographer:run-viewport-expansion-transaction", async (_event, input): Promise<CartographerRuntimeViewportExpansionResult> => {
    const expansion = parseCartographerRuntimeViewportExpansionRequest(input);
    const transaction = beginCartographerTransaction(expansion.tabId, "viewport_expansion");
    const runtimeSettings = resolveCartographerLevelRuntimeSettings(await loadSettings());
    const levelId = parseExpandableLevelId(expansion.viewport.layer);
    const seed = resolveSceneSeed(expansion.scene);
    const chunk = createCartographerChunkKeyForViewport(expansion.viewport, runtimeSettings);
    const preloadAllowed = shouldAllowAiPreloadForLevel(levelId);
    const startedMessage = `Generating adjacent ${levelId} chunk ${chunk.key}`;
    const errorMessage = `Failed to generate ${levelId} chunk ${chunk.key}`;

    traceCartographerBridge("viewport_expansion.start", {
      chunk,
      force_refresh: Boolean(expansion.forceRefresh),
      level_id: levelId,
      preload_allowed: preloadAllowed,
      scene: summarizeSceneForTrace(expansion.scene),
      seed,
      tab_id: expansion.tabId,
    });

    await appendCartographerChunkRecords(expansion.tabId, [
      createCartographerChunkStoreRecord({
        chunk,
        levelId,
        message: startedMessage,
        mode: "expand_horizontal",
        phase: "generating",
        role: "active",
      }),
    ]);

    try {
      const result = await getCoordinator().request({
        applyToScene: true,
        chunk,
        context: {
          ...createCartographerSceneContext(expansion.scene, levelId, expansion.viewport),
          expansion_reason: "viewport_edge",
          viewport: expansion.viewport,
        },
        forceRefresh: expansion.forceRefresh,
        level_id: levelId,
        mode: "expand_horizontal",
        preload: preloadAllowed,
        scene: expansion.scene,
        seed,
        signal: transaction.controller.signal,
        settings: runtimeSettings,
      });
      const snapshot = await appendCartographerChunkRecords(expansion.tabId, result.chunkRecords);
      const cancelled = result.output.status === "cancelled";
      const failed = result.output.status !== "ok" && !cancelled;
      await appendCartographerCostLedgerRecords(expansion.tabId, result, seed);

      traceCartographerBridge("viewport_expansion.done", {
        cache_status: result.cacheStatus,
        output: summarizeRuntimeOutputForTrace(result.output),
        preloaded_count: result.preloaded.length,
        scene_apply: summarizeSceneApplyForTrace(result.sceneApply),
        tab_id: expansion.tabId,
      });

      return {
        result,
        snapshot,
        status: {
          cacheStatus: result.cacheStatus,
          chunkKey: chunk.key,
          levelId,
          message: cancelled
            ? `Cancelled ${levelId} chunk ${chunk.key}`
            : failed
              ? createRuntimeFailureMessage(`Failed ${levelId} chunk ${chunk.key}`, result)
              : `Loaded ${levelId} chunk ${chunk.key}`,
          mode: "expand_horizontal",
          phase: cancelled ? "cancelled" : failed ? "error" : "applied",
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      traceCartographerBridge("viewport_expansion.error", {
        chunk,
        error: error instanceof Error ? error.message : String(error),
        level_id: levelId,
        tab_id: expansion.tabId,
      });

      if (transaction.controller.signal.aborted) {
        const snapshot = await appendCartographerChunkRecords(expansion.tabId, [
          createCartographerChunkStoreRecord({
            chunk,
            levelId,
            message: `Cancelled ${levelId} chunk ${chunk.key}`,
            mode: "expand_horizontal",
            phase: "cancelled",
            role: "active",
          }),
        ]);
        const cancelledResult = createCancelledViewportExpansionResult(expansion, chunk, levelId, snapshot);

        return cancelledResult;
      }

      await appendCartographerChunkRecords(expansion.tabId, [
        createCartographerChunkStoreRecord({
          chunk,
          levelId,
          message: errorMessage,
          mode: "expand_horizontal",
          phase: "error",
          role: "active",
        }),
      ]);

      throw error;
    } finally {
      finishCartographerTransaction(transaction);
    }
  });
  ipcMain.handle("cartographer:run-source-replacement-transaction", async (_event, input): Promise<CartographerRuntimeSourceReplacementResult> => {
    const replacement = parseCartographerRuntimeSourceReplacementRequest(input);
    const transaction = beginCartographerTransaction(replacement.tabId, "source_replacement");
    const runtimeSettings = resolveCartographerLevelRuntimeSettings(await loadSettings());
    const observation = findReplacementObservation(replacement.scene, replacement.observationId);
    const seed = (observation.query || resolveSceneSeed(replacement.scene)).trim();
    const chunk = createCartographerChunkKeyForObservation(observation, replacement.scene.viewport, runtimeSettings);
    const messageTitle = observation.url ?? observation.title;
    const startedMessage = `Replacing failed source candidate ${messageTitle}`;
    const errorMessage = `Failed to replace source candidate ${messageTitle}`;

    traceCartographerBridge("source_replacement.start", {
      chunk,
      force_refresh: Boolean(replacement.forceRefresh),
      observation_id: replacement.observationId,
      seed,
      tab_id: replacement.tabId,
    });

    await appendCartographerChunkRecords(replacement.tabId, [
      createCartographerChunkStoreRecord({
        chunk,
        levelId: "L3",
        message: startedMessage,
        mode: "replace_failed_source",
        phase: "generating",
        role: "active",
      }),
    ]);

    try {
      const result = await getCoordinator().request({
        applyToScene: true,
        chunk,
        context: {
          ...createCartographerSceneContext(replacement.scene, "L3"),
          failed_observation: {
            failure_reason: observation.failure_reason,
            id: observation.id,
            provider_id: observation.provider_id,
            query: observation.query,
            snippet: observation.snippet,
            title: observation.title,
            url: observation.url,
          },
          replacement_reason: "failed_source_candidate",
        },
        focus: {
          id: observation.id,
          title: observation.title,
          level_id: "L3",
          excerpt: observation.failure_reason ?? observation.snippet ?? observation.url ?? observation.query,
        },
        forceRefresh: replacement.forceRefresh,
        level_id: "L3",
        mode: "replace_failed_source",
        preload: false,
        scene: replacement.scene,
        seed,
        signal: transaction.controller.signal,
        settings: runtimeSettings,
      });
      const snapshot = await appendCartographerChunkRecords(replacement.tabId, result.chunkRecords);
      const cancelled = result.output.status === "cancelled";
      const failed = result.output.status !== "ok" && !cancelled;
      await appendCartographerCostLedgerRecords(replacement.tabId, result, seed);

      traceCartographerBridge("source_replacement.done", {
        cache_status: result.cacheStatus,
        output: summarizeRuntimeOutputForTrace(result.output),
        preloaded_count: result.preloaded.length,
        scene_apply: summarizeSceneApplyForTrace(result.sceneApply),
        tab_id: replacement.tabId,
      });

      return {
        result,
        snapshot,
        status: {
          cacheStatus: result.cacheStatus,
          chunkKey: chunk.key,
          levelId: "L3",
          message: cancelled
            ? `Cancelled replacement for ${messageTitle}`
            : failed
              ? createRuntimeFailureMessage(`Failed replacement for ${messageTitle}`, result)
              : `Replacement candidates loaded for ${messageTitle}`,
          mode: "replace_failed_source",
          phase: cancelled ? "cancelled" : failed ? "error" : "applied",
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      traceCartographerBridge("source_replacement.error", {
        chunk,
        error: error instanceof Error ? error.message : String(error),
        observation_id: replacement.observationId,
        tab_id: replacement.tabId,
      });

      if (transaction.controller.signal.aborted) {
        const snapshot = await appendCartographerChunkRecords(replacement.tabId, [
          createCartographerChunkStoreRecord({
            chunk,
            levelId: "L3",
            message: `Cancelled replacement for ${messageTitle}`,
            mode: "replace_failed_source",
            phase: "cancelled",
            role: "active",
          }),
        ]);

        return createCancelledSourceReplacementResult(replacement, chunk, snapshot, messageTitle);
      }

      await appendCartographerChunkRecords(replacement.tabId, [
        createCartographerChunkStoreRecord({
          chunk,
          levelId: "L3",
          message: errorMessage,
          mode: "replace_failed_source",
          phase: "error",
          role: "active",
        }),
      ]);

      throw error;
    } finally {
      finishCartographerTransaction(transaction);
    }
  });
}

function getCoordinator(): CartographerChunkCoordinator {
  if (!coordinator) {
    coordinator = new CartographerChunkCoordinator({
      generate: async (input: CartographerLevelRuntimeInput, options) => {
        const settings = await loadSettings();
        const provider = resolveAiProviderConfigForRoute(settings, {
          level_id: input.level_id,
          mode: input.mode,
        });

        traceCartographerBridge("coordinator.provider", {
          input: {
            chunk: input.chunk,
            level_id: input.level_id,
            mode: input.mode,
            seed: input.seed,
          },
          provider: summarizeProviderForTrace(provider),
        });

        const service = new AiCartographerService(
          provider,
        );

        return runLevelRuntime(input, {
          generate: (generationInput, generateOptions) => service.generate(generationInput, generateOptions),
          signal: options?.signal,
        });
      },
      maxPreloadChunks: 4,
      maxStoredChunks: 160,
      storage: new JsonLevelChunkStorage(join(app.getPath("userData"), "seekstar-level-chunks.json")),
    });
  }

  return coordinator;
}

function beginCartographerTransaction(tabId: string, kind: CartographerRuntimeTransactionKind): ActiveCartographerTransaction {
  const key = createCartographerTransactionKey(tabId, kind);
  const existing = activeCartographerTransactions.get(key);
  existing?.controller.abort();

  const transaction: ActiveCartographerTransaction = {
    controller: new AbortController(),
    id: `${key}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    kind,
    startedAt: new Date().toISOString(),
    tabId,
  };
  activeCartographerTransactions.set(key, transaction);

  return transaction;
}

function finishCartographerTransaction(transaction: ActiveCartographerTransaction): void {
  const key = createCartographerTransactionKey(transaction.tabId, transaction.kind);

  if (activeCartographerTransactions.get(key)?.id === transaction.id) {
    activeCartographerTransactions.delete(key);
  }
}

function cancelCartographerTransactions(request: CartographerRuntimeCancelRequest): CartographerRuntimeCancelResult {
  const transactionIds: string[] = [];

  for (const [key, transaction] of activeCartographerTransactions) {
    if (transaction.tabId !== request.tabId) {
      continue;
    }

    if (request.kind && transaction.kind !== request.kind) {
      continue;
    }

    transaction.controller.abort();
    transactionIds.push(transaction.id);

    if (request.kind) {
      activeCartographerTransactions.delete(key);
    }
  }

  return {
    cancelled: transactionIds.length,
    tabId: request.tabId,
    transactionIds,
  };
}

function createCartographerTransactionKey(tabId: string, kind: CartographerRuntimeTransactionKind): string {
  return `${tabId}:${kind}`;
}

function traceCartographerBridge(event: string, payload?: unknown): void {
  if (!isSeekStarTraceEnabled()) {
    return;
  }

  const suffix = payload === undefined ? "" : ` ${stringifyTracePayload(payload)}`;
  console.info(`[SeekStar][cartographer-bridge] ${event}${suffix}`);
}

function isSeekStarTraceEnabled(): boolean {
  if (process.env.SEEKSTAR_TRACE === "0" || process.env.SEEKSTAR_TRACE === "false") {
    return false;
  }

  return (
    process.env.SEEKSTAR_TRACE === "1" ||
    process.env.SEEKSTAR_TRACE === "true" ||
    process.env.npm_lifecycle_event === "dev" ||
    process.env.NODE_ENV === "development"
  );
}

function stringifyTracePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, (_key, value: unknown) => {
      if (typeof value === "string" && value.length > 1_000) {
        return `${value.slice(0, 1_000)}...<truncated ${value.length - 1_000} chars>`;
      }

      return value;
    });
  } catch (error) {
    return JSON.stringify({
      trace_error: error instanceof Error ? error.message : String(error),
    });
  }
}

function summarizeProviderForTrace(provider: AiProviderConfig): Record<string, unknown> {
  const key = resolveApiKey(provider);

  return {
    base_url: provider.base_url,
    id: provider.id,
    key_source: key.source ?? "missing",
    kind: provider.kind,
    model: provider.model,
    timeout_ms: provider.timeout_ms,
  };
}

function summarizeRuntimeOutputForTrace(output: CartographerChunkRequestResult["output"]): Record<string, unknown> {
  return {
    chunk: output.chunk,
    diagnostics: output.diagnostics.slice(0, 4),
    generated_at: output.generated_at,
    level_id: output.level_id,
    mode: output.mode,
    model: output.model,
    node_count: output.nodes.length,
    provider_id: output.provider_id,
    relation_count: output.relations.length,
    source_candidate_count: output.source_candidates.length,
    status: output.status,
  };
}

function summarizeSceneApplyForTrace(sceneApply: CartographerChunkRequestResult["sceneApply"]): Record<string, unknown> | undefined {
  if (!sceneApply) {
    return undefined;
  }

  return {
    added_node_count: sceneApply.addedNodeIds.length,
    added_observation_count: sceneApply.addedObservationIds.length,
    added_relation_count: sceneApply.addedRelationIds.length,
    focus_node_id: sceneApply.focusNodeId,
  };
}

function summarizeSceneForTrace(scene: TerrainScene): Record<string, unknown> {
  return {
    active_tab_id: scene.active_tab_id,
    metadata_title: scene.metadata.title,
    node_count: scene.nodes.length,
    observation_count: scene.scout_observations?.length ?? 0,
    relation_count: scene.relations.length,
    viewport: {
      layer: scene.viewport.layer,
      x: Math.round(scene.viewport.x),
      y: Math.round(scene.viewport.y),
      zoom: Number(scene.viewport.zoom.toFixed(3)),
    },
  };
}

function normalizeBootstrapCompletedScene(scene: TerrainScene, entryMode: CartographerRuntimeBootstrapRequest["entryMode"]): TerrainScene {
  if (entryMode !== "default_tonight_sky") {
    return scene;
  }

  const now = new Date().toISOString();
  const starGalleryNodes = scene.nodes.filter((node) => node.layer === "L0");
  const focusNodeId = starGalleryNodes[0]?.id;
  const viewport = { x: 0, y: 0, zoom: 1, layer: "L0" as const };

  return {
    ...scene,
    tabs: scene.tabs.map((tab) =>
      tab.id === scene.active_tab_id
        ? {
            ...tab,
            current_layer: "L0",
            node_ids: starGalleryNodes.map((node) => node.id),
            updated_at: now,
            viewport,
          }
        : tab,
    ),
    viewport,
    selection: {
      ...scene.selection,
      node_ids: focusNodeId ? [focusNodeId] : [],
    },
    runtime: {
      ...scene.runtime,
      focused_node_id: focusNodeId,
      updated_at: now,
    },
    metadata: {
      ...scene.metadata,
      updated_at: now,
    },
  };
}

function createCancelledBootstrapResult(
  scene: TerrainScene,
  snapshot: CartographerChunkStoreSnapshot,
  chunk: CartographerLevelChunkKey,
  seed: string,
  cacheStatus?: "hit" | "miss" | "refresh",
): CartographerRuntimeBootstrapResult {
  return {
    cacheStatus,
    scene,
    snapshot,
    status: {
      cacheStatus,
      chunkKey: chunk.key,
      message: `Cancelled Cartographer terrain for ${seed}`,
      phase: "cancelled",
      updatedAt: new Date().toISOString(),
    },
  };
}

function createFailedBootstrapResult(
  scene: TerrainScene,
  snapshot: CartographerChunkStoreSnapshot,
  chunk: CartographerLevelChunkKey,
  seed: string,
  levelId: CartographerRuntimeRequest["level_id"],
  result: CartographerChunkRequestResult,
  cacheStatus?: "hit" | "miss" | "refresh",
): CartographerRuntimeBootstrapResult {
  return {
    cacheStatus,
    scene,
    snapshot,
    status: {
      cacheStatus,
      chunkKey: chunk.key,
      message: createRuntimeFailureMessage(`Cartographer failed at ${levelId} for ${seed}`, result),
      phase: "error",
      updatedAt: new Date().toISOString(),
    },
  };
}

function createRuntimeFailureMessage(prefix: string, result: CartographerChunkRequestResult): string {
  const diagnostics = Array.isArray(result.output.diagnostics) ? result.output.diagnostics.filter(isRuntimeDiagnostic) : [];
  const diagnostic = diagnostics.find((candidate) => candidate.severity === "error") ?? diagnostics[0];
  const detail = diagnostic?.message ?? result.output.status;

  return `${prefix}: ${detail}`;
}

function isRuntimeDiagnostic(value: unknown): value is { message: string; severity?: string } {
  return typeof value === "object" && value !== null && "message" in value && typeof value.message === "string";
}

function createCancelledViewportExpansionResult(
  request: CartographerRuntimeViewportExpansionRequest,
  chunk: CartographerLevelChunkKey,
  levelId: CartographerRuntimeRequest["level_id"],
  snapshot: CartographerChunkStoreSnapshot,
): CartographerRuntimeViewportExpansionResult {
  return {
    result: createCancelledChunkRequestResult(request.scene, chunk, levelId, "expand_horizontal", resolveSceneSeed(request.scene)),
    snapshot,
    status: {
      chunkKey: chunk.key,
      levelId,
      message: `Cancelled ${levelId} chunk ${chunk.key}`,
      mode: "expand_horizontal",
      phase: "cancelled",
      updatedAt: new Date().toISOString(),
    },
  };
}

function createCancelledSourceReplacementResult(
  request: CartographerRuntimeSourceReplacementRequest,
  chunk: CartographerLevelChunkKey,
  snapshot: CartographerChunkStoreSnapshot,
  messageTitle: string,
): CartographerRuntimeSourceReplacementResult {
  return {
    result: createCancelledChunkRequestResult(request.scene, chunk, "L3", "replace_failed_source", messageTitle),
    snapshot,
    status: {
      chunkKey: chunk.key,
      levelId: "L3",
      message: `Cancelled replacement for ${messageTitle}`,
      mode: "replace_failed_source",
      phase: "cancelled",
      updatedAt: new Date().toISOString(),
    },
  };
}

function createCancelledChunkRequestResult(
  scene: TerrainScene,
  chunk: CartographerLevelChunkKey,
  levelId: CartographerRuntimeRequest["level_id"],
  mode: CartographerGenerationMode,
  seed: string,
): CartographerChunkRequestResult {
  const timestamp = new Date().toISOString();
  const output: CartographerChunkRequestResult["output"] = {
    status: "cancelled",
    mode,
    level_id: levelId,
    seed,
    chunk,
    nodes: [],
    relations: [],
    source_candidates: [],
    chunk_hints: {
      active: chunk,
      preload: [],
    },
    diagnostics: [
      {
        severity: "warning",
        code: "cartographer.cancelled",
        message: "Cartographer transaction was cancelled.",
      },
    ],
    generated_at: timestamp,
  };

  return {
    cacheStatus: "miss",
    chunkRecords: [
      {
        cacheStatus: "miss",
        chunkKey: chunk.key,
        levelId,
        message: `Cancelled ${levelId} chunk ${chunk.key}`,
        mode,
        phase: "cancelled",
        ring: chunk.ring,
        role: "active",
        updatedAt: timestamp,
        x: chunk.x,
        y: chunk.y,
        z: chunk.z ?? 0,
      },
    ],
    output,
    preloaded: [],
    sceneApply: {
      addedNodeIds: [],
      addedObservationIds: [],
      addedRelationIds: [],
      scene,
    },
  };
}

async function appendCartographerCostLedgerRecords(
  tabId: string,
  result: CartographerChunkRequestResult,
  seed: string,
): Promise<void> {
  try {
    await appendAiCostLedgerRecords([result.output, ...result.preloaded].map((output) => ({
      level_id: output.level_id,
      mode: output.mode,
      model: output.model,
      provider_id: output.provider_id,
      seed,
      source: "cartographer",
      status: output.status,
      tab_id: tabId,
      telemetry: output.telemetry as AiModelTelemetry | undefined,
    })));
  } catch (error) {
    console.warn(`[SeekStar] Failed to append Cartographer cost ledger records: ${getErrorMessage(error)}`);
  }
}

function parseCartographerRuntimeBootstrapRequest(value: unknown): CartographerRuntimeBootstrapRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Cartographer runtime bootstrap transaction must be an object.");
  }

  const candidate = value as Partial<CartographerRuntimeBootstrapRequest>;

  if (!candidate.tabId?.trim()) {
    throw new Error("Cartographer runtime bootstrap transaction requires a tab id.");
  }

  if (!candidate.scene || typeof candidate.scene !== "object") {
    throw new Error("Cartographer runtime bootstrap transaction requires a scene.");
  }

  if (!candidate.seed?.trim()) {
    throw new Error("Cartographer runtime bootstrap transaction requires a seed.");
  }

  return {
    entryMode: candidate.entryMode === "default_tonight_sky" ? "default_tonight_sky" : undefined,
    forceRefresh: candidate.forceRefresh,
    scene: candidate.scene as TerrainScene,
    seed: candidate.seed,
    tabId: candidate.tabId.trim().slice(0, 240),
  };
}

function parseCartographerRuntimeCancelRequest(value: unknown): CartographerRuntimeCancelRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Cartographer cancel transaction request must be an object.");
  }

  const candidate = value as Partial<CartographerRuntimeCancelRequest>;

  if (!candidate.tabId?.trim()) {
    throw new Error("Cartographer cancel transaction request requires a tab id.");
  }

  return {
    kind: isCartographerTransactionKind(candidate.kind) ? candidate.kind : undefined,
    tabId: candidate.tabId.trim().slice(0, 240),
  };
}

function parseCartographerRuntimeViewportExpansionRequest(value: unknown): CartographerRuntimeViewportExpansionRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Cartographer viewport expansion transaction must be an object.");
  }

  const candidate = value as Partial<CartographerRuntimeViewportExpansionRequest>;

  if (!candidate.tabId?.trim()) {
    throw new Error("Cartographer viewport expansion transaction requires a tab id.");
  }

  if (!candidate.scene || typeof candidate.scene !== "object") {
    throw new Error("Cartographer viewport expansion transaction requires a scene.");
  }

  if (!candidate.viewport || typeof candidate.viewport !== "object") {
    throw new Error("Cartographer viewport expansion transaction requires a viewport.");
  }

  return {
    forceRefresh: candidate.forceRefresh,
    scene: candidate.scene as TerrainScene,
    tabId: candidate.tabId.trim().slice(0, 240),
    viewport: candidate.viewport as TerrainScene["viewport"],
  };
}

function parseCartographerRuntimeSourceReplacementRequest(value: unknown): CartographerRuntimeSourceReplacementRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Cartographer source replacement transaction must be an object.");
  }

  const candidate = value as Partial<CartographerRuntimeSourceReplacementRequest>;

  if (!candidate.tabId?.trim()) {
    throw new Error("Cartographer source replacement transaction requires a tab id.");
  }

  if (!candidate.scene || typeof candidate.scene !== "object") {
    throw new Error("Cartographer source replacement transaction requires a scene.");
  }

  if (!candidate.observationId?.trim()) {
    throw new Error("Cartographer source replacement transaction requires an observation id.");
  }

  return {
    forceRefresh: candidate.forceRefresh,
    observationId: candidate.observationId.trim().slice(0, 240),
    scene: candidate.scene as TerrainScene,
    tabId: candidate.tabId.trim().slice(0, 240),
  };
}

function createCartographerLevelChunkKey(x: number, y: number, ring: number, z = 0): CartographerLevelChunkKey {
  return {
    x,
    y,
    z,
    ring,
    key: `${x}:${y}:${z}:${ring}`,
  };
}

function createCartographerChunkKeyForViewport(
  viewport: TerrainScene["viewport"],
  settings?: CartographerLevelRuntimeSettings,
): CartographerLevelChunkKey {
  const policy = resolveCartographerChunkPolicy(settings);
  const x = Math.round(viewport.x / policy.chunkWidth);
  const y = Math.round(viewport.y / policy.chunkHeight);
  const ring = Math.max(Math.abs(x), Math.abs(y));

  return createCartographerLevelChunkKey(x, y, ring);
}

function createCartographerChunkKeyForObservation(
  observation: ScoutObservation,
  fallbackViewport: TerrainScene["viewport"],
  settings?: CartographerLevelRuntimeSettings,
): CartographerLevelChunkKey {
  const policy = resolveCartographerChunkPolicy(settings);
  const x = Math.round((observation.position_hint?.x ?? fallbackViewport.x) / policy.chunkWidth);
  const y = Math.round((observation.position_hint?.y ?? fallbackViewport.y) / policy.chunkHeight);
  const ring = Math.max(Math.abs(x), Math.abs(y));

  return createCartographerLevelChunkKey(x, y, ring);
}

function resolveCartographerChunkPolicy(settings?: CartographerLevelRuntimeSettings): { chunkHeight: number; chunkWidth: number } {
  return {
    chunkHeight: clampCartographerPolicyNumber(settings?.chunk_policy?.chunk_height, 480, 3_200, 900),
    chunkWidth: clampCartographerPolicyNumber(settings?.chunk_policy?.chunk_width, 480, 3_200, 1200),
  };
}

function clampCartographerPolicyNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function createCartographerSceneContext(
  scene: TerrainScene,
  levelId: CartographerRuntimeRequest["level_id"],
  requestedViewport: TerrainScene["viewport"] = scene.viewport,
): Record<string, unknown> {
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];
  const anchorContext = createContinuousScaleAnchorContext(scene, levelId, requestedViewport);

  return {
    active_layer: scene.viewport.layer,
    active_seed: activeTab?.seed ?? scene.metadata.title,
    existing_cartographer_nodes: anchorContext.existingCartographerNodes,
    focus_anchor: anchorContext.focusAnchor,
    level_id: levelId,
    movement_vector: anchorContext.movementVector,
    neighbor_anchors: anchorContext.neighborAnchors,
    parent_backlink: activeTab?.parent_backlink
      ? {
          excerpt: activeTab.parent_backlink.excerpt,
          label: activeTab.parent_backlink.label,
          node_id: activeTab.parent_backlink.node_id,
          source_id: activeTab.parent_backlink.source_id,
          tab_id: activeTab.parent_backlink.tab_id,
        }
      : undefined,
    parent_viewport: anchorContext.parentViewport,
    scale_model: "continuous",
    selected_node_ids: scene.selection.node_ids,
    source_count: scene.sources.length,
    tab_id: scene.active_tab_id,
  };
}

function createContinuousScaleAnchorContext(
  scene: TerrainScene,
  levelId: CartographerRuntimeRequest["level_id"],
  requestedViewport: TerrainScene["viewport"],
): {
  existingCartographerNodes: Array<Record<string, unknown>>;
  focusAnchor?: Record<string, unknown>;
  movementVector: { dx: number; dy: number };
  neighborAnchors: Array<Record<string, unknown>>;
  parentViewport?: Record<string, unknown>;
} {
  const parentLayer = getParentLayerForLevel(levelId);
  const focusedNode = resolveFocusAnchorNode(scene, levelId, requestedViewport, parentLayer);
  const existingCartographerNodes = selectNearbyCartographerNodes(scene, levelId, requestedViewport, parentLayer).map(toCartographerAnchor);
  const neighborAnchors = selectNeighborAnchors(scene, focusedNode, requestedViewport, parentLayer).map(toCartographerAnchor);

  return {
    existingCartographerNodes,
    focusAnchor: focusedNode ? toCartographerAnchor(focusedNode) : undefined,
    movementVector: {
      dx: Math.round(requestedViewport.x - scene.viewport.x),
      dy: Math.round(requestedViewport.y - scene.viewport.y),
    },
    neighborAnchors,
    parentViewport: parentLayer
      ? {
          layer: parentLayer,
          x: requestedViewport.x,
          y: requestedViewport.y,
        }
      : undefined,
  };
}

function resolveFocusAnchorNode(
  scene: TerrainScene,
  levelId: CartographerRuntimeRequest["level_id"],
  requestedViewport: TerrainScene["viewport"],
  parentLayer: string | undefined,
): TerrainNode | undefined {
  const focusedNodeId = scene.runtime.focused_node_id ?? scene.selection.node_ids[0];
  const focusedNode = focusedNodeId ? scene.nodes.find((node) => node.id === focusedNodeId) : undefined;

  if (focusedNode) {
    return focusedNode;
  }

  return findNearestNode(scene.nodes, requestedViewport, (node) => node.layer === parentLayer || node.layer === levelId || node.layer === scene.viewport.layer);
}

function selectNearbyCartographerNodes(
  scene: TerrainScene,
  levelId: CartographerRuntimeRequest["level_id"],
  requestedViewport: TerrainScene["viewport"],
  parentLayer: string | undefined,
): TerrainNode[] {
  const preferredLayers = [levelId, parentLayer, scene.viewport.layer].filter((layer): layer is string => Boolean(layer));
  const selected: TerrainNode[] = [];
  const selectedIds = new Set<string>();

  for (const layer of preferredLayers) {
    const nodes = sortNodesByViewportDistance(
      scene.nodes.filter((node) => node.layer === layer && isCartographerAnchorNode(node)),
      requestedViewport,
    );

    for (const node of nodes) {
      if (selectedIds.has(node.id)) {
        continue;
      }

      selected.push(node);
      selectedIds.add(node.id);

      if (selected.length >= 10) {
        return selected;
      }
    }
  }

  return selected;
}

function selectNeighborAnchors(
  scene: TerrainScene,
  focusedNode: TerrainNode | undefined,
  requestedViewport: TerrainScene["viewport"],
  parentLayer: string | undefined,
): TerrainNode[] {
  const focusLayer = focusedNode?.layer ?? parentLayer ?? requestedViewport.layer;
  return sortNodesByViewportDistance(
    scene.nodes.filter((node) => node.id !== focusedNode?.id && node.layer === focusLayer && isCartographerAnchorNode(node)),
    requestedViewport,
  ).slice(0, 6);
}

function findNearestNode(
  nodes: TerrainNode[],
  viewport: TerrainScene["viewport"],
  predicate: (node: TerrainNode) => boolean,
): TerrainNode | undefined {
  return sortNodesByViewportDistance(nodes.filter(predicate), viewport)[0];
}

function sortNodesByViewportDistance(nodes: TerrainNode[], viewport: TerrainScene["viewport"]): TerrainNode[] {
  return [...nodes].sort((left, right) => getNodeViewportDistance(left, viewport) - getNodeViewportDistance(right, viewport));
}

function getNodeViewportDistance(node: TerrainNode, viewport: TerrainScene["viewport"]): number {
  const x = node.position_hint?.x ?? 0;
  const y = node.position_hint?.y ?? 0;
  return Math.hypot(x - viewport.x, y - viewport.y);
}

function isCartographerAnchorNode(node: TerrainNode): boolean {
  return node.source_state === "cartographer_primary" || node.source_state === "source_backed" || node.tags?.includes("cartographer") === true;
}

function toCartographerAnchor(node: TerrainNode): Record<string, unknown> {
  return {
    id: node.id,
    layer: node.layer,
    source_state: node.source_state,
    summary: truncateContextText(node.summary ?? node.quote ?? "", 180),
    title: truncateContextText(node.title, 80),
    type: node.type,
    x: node.position_hint?.x,
    y: node.position_hint?.y,
  };
}

function getParentLayerForLevel(levelId: CartographerRuntimeRequest["level_id"]): string | undefined {
  switch (levelId) {
    case "L0":
      return "supra_macro";
    case "L1":
      return "L0";
    case "L2":
      return "L1";
    case "L3":
      return "L2";
    default:
      return undefined;
  }
}

function truncateContextText(text: string, maxLength: number): string | undefined {
  const normalized = text.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function shouldAllowAiPreloadForLevel(levelId: CartographerRuntimeRequest["level_id"]): boolean {
  return levelId === "L0" || levelId === "L1";
}

function createBootstrapEntryContext(
  entryMode: CartographerRuntimeBootstrapRequest["entryMode"],
  levelId: CartographerRuntimeRequest["level_id"],
  settings: SeekStarSettings,
): Record<string, unknown> {
  if (entryMode !== "default_tonight_sky") {
    return {};
  }

  return {
    entry_mode: "default_tonight_sky",
    default_sky: {
      observation_date: new Date().toISOString().slice(0, 10),
      metaphor: "The user has opened the telescope cap and should immediately see a complete night sky, not an empty search box.",
      intent:
        "Generate a diverse seed group of fresh, recent, surprising, and explorable fields. Favor unknown unknowns, new dynamics, adjacent frontiers, and useful curiosity over obvious evergreen categories.",
      constraints: [
        "Do not treat New Seek as the user query.",
        "Do not ask the user for a keyword.",
        "Keep topics concrete enough that L3 can later produce real webpages, PDFs, papers, images, or documents.",
        "Mix technology, science, society, culture, infrastructure, research, and emerging tools when appropriate.",
      ],
      domain_hint_mode: settings.domain_hint_mode,
      domain_hints: settings.domain_hint_mode === "guided" ? createDomainHints(settings) : [],
      level_guidance: resolveDefaultSkyLevelGuidance(levelId),
    },
  };
}

function createDomainHints(settings: SeekStarSettings): Array<{ id: string; title: string; tags: string[] }> {
  const activeLexicon =
    settings.domain_lexicons.find((lexicon) => lexicon.id === settings.active_domain_lexicon_id) ??
    settings.domain_lexicons.find((lexicon) => lexicon.active) ??
    settings.domain_lexicons[0];

  return (activeLexicon?.terms ?? [])
    .filter((term) => term.enabled)
    .slice(0, 48)
    .map((term) => ({
      id: term.id,
      title: term.labels["zh-Hans"]?.trim() || term.labels.en?.trim() || term.canonical,
      tags: term.tags ?? [],
    }));
}

function resolveDefaultSkyLevelGuidance(levelId: CartographerRuntimeRequest["level_id"]): string {
  switch (levelId) {
    case "supra_macro":
      return "Create the broader parent sky: systems, forces, and civilization-scale contexts above the first Star Gallery.";
    case "L0":
      return "Create the first visible Star Gallery: broad but fresh domains that feel like bright regions in tonight's sky.";
    case "L1":
      return "For each domain, create explorable topic fields and live dynamics, not static textbook chapters.";
    case "L2":
      return "Orient toward likely source families: papers, labs, institutions, explainers, datasets, benchmarks, communities, and primary references.";
    case "L3":
      return "Propose source candidates suitable for validation into dense tile fields: webpages, PDFs, papers, images, documents, repositories, and encyclopedic pages.";
    default:
      return "Support telescope-style exploration from macro field to source-backed detail.";
  }
}

function resolveBootstrapCartographerMode(levelId: CartographerRuntimeRequest["level_id"]): CartographerGenerationMode {
  return levelId === "supra_macro" || levelId === "L0" ? "bootstrap_seed" : "decompose_down";
}

function isCartographerTransactionKind(value: unknown): value is CartographerRuntimeTransactionKind {
  return value === "bootstrap" || value === "viewport_expansion" || value === "source_replacement";
}

function parseExpandableLevelId(value: unknown): "L0" | "L1" | "L2" | "L3" {
  if (value === "L0" || value === "L1" || value === "L2" || value === "L3") {
    return value;
  }

  throw new Error("Cartographer viewport expansion requires an L0-L3 layer.");
}

function resolveSceneSeed(scene: TerrainScene): string {
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];

  return (activeTab?.seed || scene.metadata.title || "New Seek").trim();
}

function findReplacementObservation(scene: TerrainScene, observationId: string): ScoutObservation {
  const observation = (scene.scout_observations ?? []).find((candidate) => candidate.id === observationId);

  if (!observation) {
    throw new Error("Source replacement observation was not found.");
  }

  if (observation.status !== "failed" && !observation.failure_reason) {
    throw new Error("Source replacement requires a failed observation.");
  }

  return observation;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createCartographerChunkStoreRecord(input: {
  chunk: CartographerLevelChunkKey;
  levelId: CartographerRuntimeRequest["level_id"];
  message: string;
  mode: CartographerGenerationMode;
  phase: CartographerChunkStoreRecord["phase"];
  role: CartographerChunkStoreRecord["role"];
}): CartographerChunkStoreRecord {
  return {
    chunkKey: input.chunk.key,
    levelId: input.levelId,
    message: input.message,
    mode: input.mode,
    phase: input.phase,
    ring: input.chunk.ring,
    role: input.role,
    updatedAt: new Date().toISOString(),
    x: input.chunk.x,
    y: input.chunk.y,
    z: input.chunk.z ?? 0,
  };
}
