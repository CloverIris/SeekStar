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
import type { ScoutObservation, TerrainScene } from "@seekstar/core-schema";
import { AiCartographerService, type AiModelTelemetry } from "@seekstar/ai-service";
import { runLevelRuntime } from "@seekstar/level-runtime";
import { JsonLevelChunkStorage } from "@seekstar/storage-service";
import { loadSettings, resolveAiProviderConfigForRoute, resolveCartographerLevelRuntimeSettings } from "./appSettingsStore.js";
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
    phase: "applied" | "cancelled";
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
    phase: "applied" | "cancelled";
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
    phase: "applied" | "cancelled";
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

const CARTOGRAPHER_BOOTSTRAP_LEVELS: readonly CartographerRuntimeRequest["level_id"][] = ["L0", "L1", "L2", "L3"];

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
    const runtimeSettings = resolveCartographerLevelRuntimeSettings(await loadSettings());
    let nextScene = bootstrap.scene;
    let lastSnapshot = await appendCartographerChunkRecords(bootstrap.tabId, []);
    let lastCacheStatus: "hit" | "miss" | "refresh" | undefined;
    let currentLevelId: CartographerRuntimeRequest["level_id"] = "L0";
    let currentMode: CartographerGenerationMode = "bootstrap_seed";

    try {
      for (const levelId of CARTOGRAPHER_BOOTSTRAP_LEVELS) {
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
          context: createCartographerSceneContext(nextScene, levelId),
          forceRefresh: bootstrap.forceRefresh,
          level_id: levelId,
          mode,
          preload: true,
          scene: nextScene,
          seed,
          signal: transaction.controller.signal,
          settings: runtimeSettings,
        });

        lastCacheStatus = result.cacheStatus;
        lastSnapshot = await appendCartographerChunkRecords(bootstrap.tabId, result.chunkRecords);
        await appendCartographerCostLedgerRecords(bootstrap.tabId, result, seed);

        if (result.output.status === "cancelled") {
          return createCancelledBootstrapResult(nextScene, lastSnapshot, chunk, seed, lastCacheStatus);
        }

        if (result.sceneApply?.scene) {
          nextScene = result.sceneApply.scene;
        }
      }

      return {
        cacheStatus: lastCacheStatus,
        scene: nextScene,
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
    const startedMessage = `Generating adjacent ${levelId} chunk ${chunk.key}`;
    const errorMessage = `Failed to generate ${levelId} chunk ${chunk.key}`;

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
          ...createCartographerSceneContext(expansion.scene, levelId),
          expansion_reason: "viewport_edge",
          viewport: expansion.viewport,
        },
        forceRefresh: expansion.forceRefresh,
        level_id: levelId,
        mode: "expand_horizontal",
        preload: true,
        scene: expansion.scene,
        seed,
        signal: transaction.controller.signal,
        settings: runtimeSettings,
      });
      const snapshot = await appendCartographerChunkRecords(expansion.tabId, result.chunkRecords);
      const cancelled = result.output.status === "cancelled";
      await appendCartographerCostLedgerRecords(expansion.tabId, result, seed);

      return {
        result,
        snapshot,
        status: {
          cacheStatus: result.cacheStatus,
          chunkKey: chunk.key,
          levelId,
          message: cancelled ? `Cancelled ${levelId} chunk ${chunk.key}` : `Loaded ${levelId} chunk ${chunk.key}`,
          mode: "expand_horizontal",
          phase: cancelled ? "cancelled" : "applied",
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
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
        preload: true,
        scene: replacement.scene,
        seed,
        signal: transaction.controller.signal,
        settings: runtimeSettings,
      });
      const snapshot = await appendCartographerChunkRecords(replacement.tabId, result.chunkRecords);
      const cancelled = result.output.status === "cancelled";
      await appendCartographerCostLedgerRecords(replacement.tabId, result, seed);

      return {
        result,
        snapshot,
        status: {
          cacheStatus: result.cacheStatus,
          chunkKey: chunk.key,
          levelId: "L3",
          message: cancelled ? `Cancelled replacement for ${messageTitle}` : `Replacement candidates loaded for ${messageTitle}`,
          mode: "replace_failed_source",
          phase: cancelled ? "cancelled" : "applied",
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
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
        const service = new AiCartographerService(
          resolveAiProviderConfigForRoute(settings, {
            level_id: input.level_id,
            mode: input.mode,
          }),
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

function createCartographerSceneContext(scene: TerrainScene, levelId: CartographerRuntimeRequest["level_id"]): Record<string, unknown> {
  return {
    active_layer: scene.viewport.layer,
    existing_cartographer_nodes: scene.nodes.filter((node) => node.tags?.includes("cartographer")).slice(0, 24).map((node) => ({
      id: node.id,
      title: node.title,
      layer: node.layer,
      summary: node.summary,
    })),
    level_id: levelId,
    selected_node_ids: scene.selection.node_ids,
    source_count: scene.sources.length,
    tab_id: scene.active_tab_id,
  };
}

function resolveBootstrapCartographerMode(levelId: CartographerRuntimeRequest["level_id"]): CartographerGenerationMode {
  return levelId === "L0" ? "bootstrap_seed" : "decompose_down";
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
