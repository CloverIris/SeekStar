import { normalizeTerrainScene, type LayerId, type NodeType, type ScoutObservation, type SourceState, type SourceType, type TerrainNode, type TerrainRelation, type TerrainScene } from "@seekstar/core-schema";
import { resolveZoomForLayer } from "./lens.js";

export type CartographerLevelBandId = "supra_macro" | "L0" | "L1" | "L2" | "L3" | "deep_lens" | "recursive_seed";
export type CartographerGenerationMode = "bootstrap_seed" | "expand_horizontal" | "decompose_down" | "summarize_up" | "replace_failed_source";

export interface CartographerLevelChunkKey {
  x: number;
  y: number;
  z?: number;
  ring: number;
  key: string;
}

export interface CartographerLevelRuntimeFocus {
  id?: string;
  title: string;
  level_id?: string;
  excerpt?: string;
}

export interface CartographerLevelRuntimeSettings {
  target_counts?: Partial<Record<CartographerLevelBandId, number>>;
  preload_rings?: number;
  max_concurrent_ai_requests?: number;
  ai_request_rate_per_minute?: number;
  cache_object_limit?: number;
  chunk_policy?: CartographerLevelRuntimeChunkPolicy;
  prompt_profile_id?: string;
  prompt_profile?: CartographerPromptProfileOverride;
}

export interface CartographerLevelRuntimeChunkPolicy {
  auto_preload_ring?: number;
  boundary_debounce_ms?: number;
  chunk_height: number;
  chunk_width: number;
  manual_preload_range?: number;
  policy_revision?: string;
}

export interface CartographerPromptModuleOverride {
  prompt_brief?: string;
  prompt_constraints?: string[];
  target_count?: number;
}

export interface CartographerPromptProfileOverride {
  density?: "compact" | "normal" | "rich";
  id?: string;
  label?: string;
  language?: string;
  modules?: Partial<Record<CartographerLevelBandId, CartographerPromptModuleOverride>>;
}

export interface CartographerLevelRuntimeInput {
  mode: CartographerGenerationMode;
  level_id: CartographerLevelBandId;
  seed: string;
  chunk: CartographerLevelChunkKey;
  focus?: CartographerLevelRuntimeFocus;
  settings?: CartographerLevelRuntimeSettings;
  context?: Record<string, unknown>;
}

export interface CartographerLevelNodeDraft {
  id: string;
  title: string;
  level_id: CartographerLevelBandId;
  node_type: NodeType;
  source_state: SourceState;
  summary?: string;
  confidence: number;
  importance: number;
  tags: string[];
  position_hint: {
    x: number;
    y: number;
    z?: number;
  };
  can_create_seed: boolean;
}

export interface CartographerLevelRelationDraft {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
  explanation: string;
}

export interface CartographerLevelSourceCandidateDraft {
  id: string;
  title: string;
  url: string;
  source_state: "cartographer_unverified_source";
  source_type: SourceType;
  provider_id?: string;
  snippet?: string;
  reason?: string;
  confidence: number;
}

export interface CartographerLevelRuntimeOutput {
  status: "ok" | "missing_key" | "provider_error" | "invalid_output" | "cancelled";
  mode: CartographerGenerationMode;
  model?: string;
  level_id: CartographerLevelBandId;
  provider_id?: string;
  seed: string;
  chunk: CartographerLevelChunkKey;
  chunk_policy?: CartographerLevelRuntimeChunkPolicy;
  nodes: CartographerLevelNodeDraft[];
  relations: CartographerLevelRelationDraft[];
  source_candidates: CartographerLevelSourceCandidateDraft[];
  chunk_hints?: {
    active: CartographerLevelChunkKey;
    preload: CartographerLevelChunkKey[];
    unload?: CartographerLevelChunkKey[];
  };
  diagnostics: unknown[];
  telemetry?: unknown;
  generated_at: string;
}

export type CartographerChunkCacheStatus = "hit" | "miss" | "refresh";
export type CartographerChunkLifecyclePhase = "applied" | "cancelled" | "error";
export type CartographerChunkLifecycleRole = "active" | "preload";

export interface CartographerChunkLifecycleRecord {
  cacheStatus?: CartographerChunkCacheStatus;
  chunkKey: string;
  levelId: CartographerLevelBandId;
  message: string;
  mode: CartographerGenerationMode;
  phase: CartographerChunkLifecyclePhase;
  ring: number;
  role: CartographerChunkLifecycleRole;
  updatedAt: string;
  x: number;
  y: number;
  z: number;
}

export interface CartographerChunkCacheRecord {
  access_count: number;
  bytes_estimate: number;
  cache_key: string;
  created_at: string;
  input: {
    mode: string;
    level_id: string;
    seed: string;
    chunk_key: string;
    chunk_policy_key?: string;
    focus_key?: string;
    prompt_profile_id?: string;
  };
  last_accessed_at: string;
  output: CartographerLevelRuntimeOutput;
}

export interface CartographerChunkStoragePort {
  loadChunk(cacheKey: string): Promise<CartographerChunkCacheRecord | undefined>;
  pruneChunks?(maxEntries: number): Promise<unknown>;
  saveChunk(record: CartographerChunkCacheRecord): Promise<void>;
}

export interface CartographerChunkCoordinatorOptions {
  generate: (input: CartographerLevelRuntimeInput, options?: { signal?: AbortSignal }) => Promise<CartographerLevelRuntimeOutput>;
  maxPreloadChunks?: number;
  maxStoredChunks?: number;
  now?: () => string;
  storage?: CartographerChunkStoragePort;
}

export interface CartographerChunkRequest {
  applyToScene?: boolean;
  chunk: CartographerLevelChunkKey;
  context?: Record<string, unknown>;
  focus?: CartographerLevelRuntimeFocus;
  forceRefresh?: boolean;
  level_id: CartographerLevelBandId;
  mode: CartographerGenerationMode;
  preload?: boolean;
  scene: TerrainScene;
  seed: string;
  settings?: CartographerLevelRuntimeSettings;
  signal?: AbortSignal;
}

export interface CartographerChunkRequestResult {
  cacheStatus: CartographerChunkCacheStatus;
  chunkRecords: CartographerChunkLifecycleRecord[];
  output: CartographerLevelRuntimeOutput;
  preloaded: CartographerLevelRuntimeOutput[];
  sceneApply?: CartographerRuntimeSceneApplyResult;
}

interface CartographerPreloadResult {
  cacheStatus: CartographerChunkCacheStatus;
  output: CartographerLevelRuntimeOutput;
}

export interface CartographerRuntimeSceneApplyOptions {
  focusFirstNode?: boolean;
  focus?: CartographerLevelRuntimeFocus;
  timestamp?: string;
}

export interface CartographerRuntimeSceneApplyResult {
  addedNodeIds: string[];
  addedObservationIds: string[];
  addedRelationIds: string[];
  focusNodeId?: string;
  scene: TerrainScene;
}

export class CartographerChunkCoordinator {
  private readonly generate: CartographerChunkCoordinatorOptions["generate"];
  private readonly maxPreloadChunks: number;
  private readonly maxStoredChunks: number | undefined;
  private readonly now: () => string;
  private readonly storage: CartographerChunkStoragePort | undefined;

  constructor(options: CartographerChunkCoordinatorOptions) {
    this.generate = options.generate;
    this.maxPreloadChunks = Math.max(0, options.maxPreloadChunks ?? 8);
    this.maxStoredChunks = options.maxStoredChunks;
    this.now = options.now ?? (() => new Date().toISOString());
    this.storage = options.storage;
  }

  async request(input: CartographerChunkRequest): Promise<CartographerChunkRequestResult> {
    const runtimeInput = toRuntimeInput(input);
    const cacheKey = createCartographerChunkCacheKey(runtimeInput);
    const stored = input.forceRefresh ? undefined : await this.storage?.loadChunk(cacheKey);
    const cached = isUsableCartographerCacheRecord(stored) ? stored : undefined;
    const cacheStatus: CartographerChunkCacheStatus = cached ? "hit" : input.forceRefresh || stored ? "refresh" : "miss";
    traceCartographerEngine("coordinator.request", {
      apply_to_scene: input.applyToScene !== false,
      cache_key: cacheKey,
      cache_status: cacheStatus,
      ignored_cached_status: stored && !cached ? stored.output.status : undefined,
      chunk: runtimeInput.chunk,
      level_id: runtimeInput.level_id,
      mode: runtimeInput.mode,
      seed: runtimeInput.seed,
    });
    const output = cached ? cached.output : await this.generate(runtimeInput, { signal: input.signal });

    traceCartographerEngine("coordinator.output", {
      cache_status: cacheStatus,
      diagnostics: output.diagnostics.slice(0, 4),
      level_id: output.level_id,
      mode: output.mode,
      node_count: output.nodes.length,
      relation_count: output.relations.length,
      source_candidate_count: output.source_candidates.length,
      status: output.status,
    });

    if (isCacheableCartographerOutput(output)) {
      await this.saveOutput(cacheKey, runtimeInput, output, cached);
    }

    const preloadResults = input.preload && output.status === "ok" ? await this.preload(output, runtimeInput, input.signal) : [];
    const preloaded = preloadResults.map((result) => result.output);
    const sceneApply = input.applyToScene === false || output.status !== "ok"
      ? undefined
      : applyLevelRuntimeOutputToScene(input.scene, output, {
          focus: runtimeInput.focus,
          focusFirstNode: false,
          timestamp: output.generated_at,
        });

    return {
      cacheStatus,
      chunkRecords: [
        createCartographerChunkLifecycleRecord({
          cacheStatus,
          output,
          role: "active",
        }),
        ...preloadResults.map((result) =>
          createCartographerChunkLifecycleRecord({
            cacheStatus: result.cacheStatus,
            output: result.output,
            role: "preload",
          }),
        ),
      ],
      output,
      preloaded,
      sceneApply,
    };
  }

  private async preload(
    output: CartographerLevelRuntimeOutput,
    sourceInput: CartographerLevelRuntimeInput,
    signal?: AbortSignal,
  ): Promise<CartographerPreloadResult[]> {
    const preloadChunks = (output.chunk_hints?.preload ?? []).slice(0, this.maxPreloadChunks);
    const preloaded: CartographerPreloadResult[] = [];

    for (const chunk of preloadChunks) {
      const runtimeInput: CartographerLevelRuntimeInput = {
        ...sourceInput,
        chunk,
        context: {
          ...sourceInput.context,
          preload_for: output.chunk.key,
        },
      };
      const cacheKey = createCartographerChunkCacheKey(runtimeInput);
      const stored = await this.storage?.loadChunk(cacheKey);
      const cached = isUsableCartographerCacheRecord(stored) ? stored : undefined;
      const cacheStatus: CartographerChunkCacheStatus = cached ? "hit" : stored ? "refresh" : "miss";

      if (signal?.aborted) {
        break;
      }

      const nextOutput = cached?.output ?? await this.generate(runtimeInput, { signal });

      if (!cached && isCacheableCartographerOutput(nextOutput)) {
        await this.saveOutput(cacheKey, runtimeInput, nextOutput);
      }

      if (nextOutput.status !== "ok") {
        break;
      }

      preloaded.push({
        cacheStatus,
        output: nextOutput,
      });
    }

    return preloaded;
  }

  private async saveOutput(
    cacheKey: string,
    input: CartographerLevelRuntimeInput,
    output: CartographerLevelRuntimeOutput,
    existing?: CartographerChunkCacheRecord,
  ): Promise<void> {
    if (!this.storage) {
      return;
    }

    const timestamp = this.now();
    await this.storage.saveChunk({
      access_count: (existing?.access_count ?? 0) + 1,
      bytes_estimate: JSON.stringify(output).length,
      cache_key: cacheKey,
      created_at: existing?.created_at ?? timestamp,
      input: {
        mode: input.mode,
        level_id: input.level_id,
        seed: input.seed,
        chunk_key: input.chunk.key,
        chunk_policy_key: createChunkPolicyCacheKey(input.settings),
        focus_key: input.focus?.id ?? input.focus?.title,
        prompt_profile_id: createPromptProfileCacheKey(input.settings),
      },
      last_accessed_at: timestamp,
      output,
    });

    if (this.maxStoredChunks !== undefined) {
      await this.storage.pruneChunks?.(this.maxStoredChunks);
    }
  }
}

function isUsableCartographerCacheRecord(record: CartographerChunkCacheRecord | undefined): record is CartographerChunkCacheRecord {
  return Boolean(
    record &&
      isCacheableCartographerOutput(record.output) &&
      isCompatibleCartographerCacheOutput(record.output) &&
      !hasMojibakeCartographerOutput(record.output),
  );
}

function isCacheableCartographerOutput(output: CartographerLevelRuntimeOutput): boolean {
  return output.status === "ok" && (output.nodes.length > 0 || output.relations.length > 0 || output.source_candidates.length > 0);
}

function isCompatibleCartographerCacheOutput(output: CartographerLevelRuntimeOutput): boolean {
  if (output.level_id !== "L3") {
    return true;
  }

  return output.source_candidates.length > 0 && output.nodes.every((node) => node.source_state === "fog" || node.node_type === "fog_region");
}

function hasMojibakeCartographerOutput(output: CartographerLevelRuntimeOutput): boolean {
  return (
    output.nodes.some((node) => looksLikeMojibake(node.title) || looksLikeMojibake(node.summary ?? "")) ||
    output.source_candidates.some((candidate) => looksLikeMojibake(candidate.title) || looksLikeMojibake(candidate.snippet ?? ""))
  );
}

function looksLikeMojibake(value: string): boolean {
  const text = value.trim();

  return (
    text.includes("\uFFFD") ||
    /(?:Ã.|Â.|â[€™€œ€“]|閲忓|鑴戞|绯荤|鏂规|绠楁|璁＄|瓒呭|闅忔|杩愬|姣旂|纭|妯℃|缁艰|鍥㈤|鎺ュ|鏁版|璋锋)/u.test(text)
  );
}

const DEFAULT_CARTOGRAPHER_PROMPT_PROFILE_ID = "seekstar-default-p6-gallery-v3";

function createCartographerChunkLifecycleRecord(input: {
  cacheStatus: CartographerChunkCacheStatus;
  output: CartographerLevelRuntimeOutput;
  role: CartographerChunkLifecycleRole;
}): CartographerChunkLifecycleRecord {
  const chunk = normalizeCartographerRuntimeChunk(input.output.chunk);

  return {
    ...chunk,
    cacheStatus: input.cacheStatus,
    chunkKey: chunk.key,
    levelId: input.output.level_id,
    message: `${input.role === "active" ? "Loaded" : "Preloaded"} ${input.output.level_id} chunk ${chunk.key}`,
    mode: input.output.mode,
    phase: input.output.status === "ok" ? "applied" : input.output.status === "cancelled" ? "cancelled" : "error",
    role: input.role,
    updatedAt: input.output.generated_at,
  };
}

function normalizeCartographerRuntimeChunk(chunk: CartographerLevelChunkKey): {
  key: string;
  ring: number;
  x: number;
  y: number;
  z: number;
} {
  return {
    key: chunk.key,
    ring: chunk.ring,
    x: chunk.x,
    y: chunk.y,
    z: chunk.z ?? 0,
  };
}

export function applyLevelRuntimeOutputToScene(
  scene: TerrainScene,
  output: CartographerLevelRuntimeOutput,
  options: CartographerRuntimeSceneApplyOptions = {},
): CartographerRuntimeSceneApplyResult {
  const timestamp = options.timestamp ?? output.generated_at ?? new Date().toISOString();
  const targetLayer = mapLevelBandToLayer(output.level_id);
  const existingNodeIds = new Set(scene.nodes.map((node) => node.id));
  const existingRelationIds = new Set(scene.relations.map((relation) => relation.id));
  const existingObservationIds = new Set((scene.scout_observations ?? []).map((observation) => observation.id));
  const existingCandidateUrls = new Set((scene.scout_observations ?? []).flatMap((observation) => (observation.url ? [normalizeUrlKey(observation.url)] : [])));
  const nodeIdMap = new Map<string, string>();
  const nextNodes = output.nodes.flatMap((node, index) => {
    const mappedNode = toTerrainNode(node, output, targetLayer, timestamp, index, existingNodeIds, options.focus);
    nodeIdMap.set(node.id, mappedNode.id);
    existingNodeIds.add(mappedNode.id);

    return [mappedNode];
  });
  const nextRelations = output.relations.flatMap((relation, index) => {
    const mappedRelation = toTerrainRelation(relation, nodeIdMap, timestamp, index, existingRelationIds);

    if (!mappedRelation) {
      return [];
    }

    existingRelationIds.add(mappedRelation.id);

    return [mappedRelation];
  });
  const nextObservations = output.source_candidates.flatMap((candidate, index) => {
    const urlKey = normalizeUrlKey(candidate.url);

    if (existingCandidateUrls.has(urlKey)) {
      return [];
    }

    const mappedObservation = toScoutObservation(candidate, output, scene.active_tab_id, timestamp, index, existingObservationIds, options.focus);
    existingObservationIds.add(mappedObservation.id);
    existingCandidateUrls.add(urlKey);

    return [mappedObservation];
  });

  traceCartographerEngine("scene.apply.prepare", {
    added_node_count: nextNodes.length,
    added_observation_count: nextObservations.length,
    added_relation_count: nextRelations.length,
    existing_node_count: scene.nodes.length,
    existing_observation_count: scene.scout_observations?.length ?? 0,
    existing_relation_count: scene.relations.length,
    output: {
      chunk: output.chunk.key,
      diagnostics: output.diagnostics.slice(0, 4),
      level_id: output.level_id,
      mode: output.mode,
      node_count: output.nodes.length,
      relation_count: output.relations.length,
      source_candidate_count: output.source_candidates.length,
      status: output.status,
    },
    target_layer: targetLayer,
  });

  const focusNode = options.focusFirstNode ? nextNodes[0] : undefined;
  const nextViewport = focusNode
    ? {
        ...scene.viewport,
        x: focusNode.position_hint?.x ?? scene.viewport.x,
        y: focusNode.position_hint?.y ?? scene.viewport.y,
        layer: focusNode.layer,
        zoom: Math.max(scene.viewport.zoom, resolveZoomForLayer(focusNode.layer)),
      }
    : scene.viewport;
  const nextScene = normalizeTerrainScene({
    ...scene,
    nodes: [...scene.nodes, ...nextNodes],
    relations: [...scene.relations, ...nextRelations],
    scout_observations: [...(scene.scout_observations ?? []), ...nextObservations],
    viewport: nextViewport,
    selection: {
      ...scene.selection,
      node_ids: focusNode ? [focusNode.id] : scene.selection.node_ids,
    },
    runtime: {
      ...scene.runtime,
      focused_node_id: focusNode?.id ?? scene.runtime.focused_node_id,
      updated_at: timestamp,
    },
    tabs: scene.tabs.map((tab) =>
      tab.id === scene.active_tab_id
        ? {
            ...tab,
            current_layer: nextViewport.layer,
            node_ids: [...tab.node_ids, ...nextNodes.map((node) => node.id)],
            relation_ids: [...tab.relation_ids, ...nextRelations.map((relation) => relation.id)],
            updated_at: timestamp,
            viewport: nextViewport,
          }
        : tab,
    ),
    metadata: {
      ...scene.metadata,
      source_state: "cartographer_primary",
      generated_by: scene.metadata.generated_by,
      updated_at: timestamp,
      description: `${scene.metadata.title} includes AI Cartographer terrain for ${output.level_id} chunk ${output.chunk.key}.`,
    },
  });

  traceCartographerEngine("scene.apply.done", {
    added_node_count: nextNodes.length,
    added_observation_count: nextObservations.length,
    added_relation_count: nextRelations.length,
    next_node_count: nextScene.nodes.length,
    next_observation_count: nextScene.scout_observations?.length ?? 0,
    next_relation_count: nextScene.relations.length,
    target_layer: targetLayer,
    viewport_layer: nextScene.viewport.layer,
  });

  return {
    addedNodeIds: nextNodes.map((node) => node.id),
    addedObservationIds: nextObservations.map((observation) => observation.id),
    addedRelationIds: nextRelations.map((relation) => relation.id),
    focusNodeId: focusNode?.id,
    scene: nextScene,
  };
}

export function createCartographerChunkCacheKey(input: CartographerLevelRuntimeInput): string {
  return [
    "level-runtime",
    input.mode,
    input.level_id,
    slugify(input.seed),
    input.chunk.key,
    slugify(input.focus?.id ?? input.focus?.title ?? "none"),
    slugify(createPromptProfileCacheKey(input.settings)),
    slugify(createChunkPolicyCacheKey(input.settings)),
  ].join(":");
}

export function mapLevelBandToLayer(levelId: CartographerLevelBandId): LayerId {
  if (levelId === "supra_macro") {
    return "supra_macro";
  }

  if (levelId === "deep_lens") {
    return "L4";
  }

  if (levelId === "recursive_seed") {
    return "L11";
  }

  return levelId;
}

function toRuntimeInput(input: CartographerChunkRequest): CartographerLevelRuntimeInput {
  return {
    mode: input.mode,
    level_id: input.level_id,
    seed: input.seed.trim() || input.scene.metadata.title,
    chunk: input.chunk,
    focus: input.focus,
    settings: input.settings,
    context: input.context,
  };
}

function createPromptProfileCacheKey(settings?: CartographerLevelRuntimeSettings): string {
  const profile = settings?.prompt_profile;
  const profileId = normalizePromptProfileId(profile?.id ?? settings?.prompt_profile_id);

  if (!profile) {
    return profileId;
  }

  const modules = Object.entries(profile.modules ?? {})
    .map(([levelId, module]) => [
      levelId,
      module?.target_count,
      normalizePromptText(module?.prompt_brief, ""),
      normalizePromptConstraints(module?.prompt_constraints, []).join("|"),
    ].join("="))
    .sort()
    .join(";");

  return `${profileId}:${profile.language ?? ""}:${profile.density ?? ""}:${hashPromptRevision(modules)}`;
}

function normalizePromptProfileId(profileId?: string): string {
  const normalized = normalizePromptText(profileId, DEFAULT_CARTOGRAPHER_PROMPT_PROFILE_ID);

  return normalized === "seekstar-default-p6" || normalized === "seekstar-default-p6-gallery-v2"
    ? DEFAULT_CARTOGRAPHER_PROMPT_PROFILE_ID
    : normalized;
}

function createChunkPolicyCacheKey(settings?: CartographerLevelRuntimeSettings): string {
  const policy = normalizeCartographerChunkPolicy(settings?.chunk_policy);

  return policy.policy_revision ?? [
    "chunk-policy",
    `w${policy.chunk_width}`,
    `h${policy.chunk_height}`,
    `ring${policy.auto_preload_ring ?? 1}`,
    `manual${policy.manual_preload_range ?? 1}`,
  ].join(":");
}

function normalizeCartographerChunkPolicy(policy?: Partial<CartographerLevelRuntimeChunkPolicy>): CartographerLevelRuntimeChunkPolicy {
  const chunkWidth = clampInteger(policy?.chunk_width, 480, 3_200, 1200);
  const chunkHeight = clampInteger(policy?.chunk_height, 480, 3_200, 900);
  const autoPreloadRing = clampInteger(policy?.auto_preload_ring, 0, 2, 1);
  const manualPreloadRange = clampInteger(policy?.manual_preload_range, 1, 3, 1);
  const boundaryDebounceMs = clampInteger(policy?.boundary_debounce_ms, 120, 5_000, 360);
  const explicitRevision = typeof policy?.policy_revision === "string" && policy.policy_revision.trim() ? policy.policy_revision.trim().slice(0, 160) : undefined;

  return {
    auto_preload_ring: autoPreloadRing,
    boundary_debounce_ms: boundaryDebounceMs,
    chunk_height: chunkHeight,
    chunk_width: chunkWidth,
    manual_preload_range: manualPreloadRange,
    policy_revision: explicitRevision ?? `chunk-policy:v1:w${chunkWidth}:h${chunkHeight}:ring${autoPreloadRing}:manual${manualPreloadRange}`,
  };
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function hashPromptRevision(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function normalizePromptText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 4_000) : fallback;
}

function normalizePromptConstraints(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, 1_000) : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized.slice(0, 12) : fallback;
}

function toTerrainNode(
  node: CartographerLevelNodeDraft,
  output: CartographerLevelRuntimeOutput,
  layer: LayerId,
  timestamp: string,
  index: number,
  existingNodeIds: Set<string>,
  focus?: CartographerLevelRuntimeFocus,
): TerrainNode {
  const id = uniqueId(node.id || `cartographer-${slugify(output.seed)}-${slugify(output.chunk.key)}-${index + 1}`, existingNodeIds);
  const chunkPolicy = normalizeCartographerChunkPolicy(output.chunk_policy);

  return {
    id,
    type: node.node_type,
    title: node.title,
    layer,
    source_state: node.source_state === "source_backed" ? "cartographer_unverified_source" : node.source_state,
    confidence: node.confidence,
    importance: node.importance,
    tags: Array.from(new Set(["cartographer", output.mode, output.level_id, ...node.tags])),
    summary: node.summary,
    semantic_breadcrumb: [output.seed, output.level_id, node.title],
    can_create_seed: node.can_create_seed,
    created_from: {
      label: `${output.mode} / ${output.level_id} / ${output.chunk.key}`,
      layer,
      node_id: focus?.id,
      excerpt: node.summary,
    },
    position_hint: {
      x: node.position_hint.x + output.chunk.x * chunkPolicy.chunk_width,
      y: node.position_hint.y + output.chunk.y * chunkPolicy.chunk_height,
      z: node.position_hint.z,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function toTerrainRelation(
  relation: CartographerLevelRelationDraft,
  nodeIdMap: Map<string, string>,
  timestamp: string,
  index: number,
  existingRelationIds: Set<string>,
): TerrainRelation | undefined {
  const from = nodeIdMap.get(relation.from);
  const to = nodeIdMap.get(relation.to);

  if (!from || !to) {
    return undefined;
  }

  return {
    id: uniqueId(relation.id || `cartographer-relation-${index + 1}-${timestamp.replace(/[^0-9]/g, "")}`, existingRelationIds),
    from,
    to,
    type: relation.type === "parent_child" ? "parent_child" : relation.type === "source_contains" ? "source_contains" : "semantic_similarity",
    confidence: relation.confidence,
    explanation: relation.explanation,
    source_state: "cartographer_primary",
  };
}

function toScoutObservation(
  candidate: CartographerLevelSourceCandidateDraft,
  output: CartographerLevelRuntimeOutput,
  tabId: string,
  timestamp: string,
  index: number,
  existingObservationIds: Set<string>,
  focus?: CartographerLevelRuntimeFocus,
): ScoutObservation {
  const id = uniqueId(candidate.id || `cartographer-candidate-${slugify(output.seed)}-${slugify(output.chunk.key)}-${index + 1}`, existingObservationIds);
  const chunkPolicy = normalizeCartographerChunkPolicy(output.chunk_policy);
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, output.source_candidates.length))));
  const row = Math.floor(index / columns);
  const column = index % columns;

  return {
    id,
    tab_id: tabId,
    status: "source_candidate",
    layer: "L3",
    position_hint: {
      x: output.chunk.x * chunkPolicy.chunk_width + Math.round((column - (columns - 1) / 2) * 300),
      y: output.chunk.y * chunkPolicy.chunk_height + Math.round((row - Math.floor((output.source_candidates.length - 1) / columns) / 2) * 190),
    },
    discovery_mode: "frontier_web_search",
    provider_id: candidate.provider_id ?? "ai-cartographer",
    confidence: candidate.confidence,
    query: output.seed,
    title: candidate.title,
    target_node_ids: focus?.id ? [focus.id] : [],
    url: candidate.url,
    snippet: candidate.snippet ?? candidate.reason,
    source_type: candidate.source_type,
    retrieved_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);

    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function traceCartographerEngine(event: string, payload?: unknown): void {
  if (!isSeekStarTraceEnabled()) {
    return;
  }

  const suffix = payload === undefined ? "" : ` ${stringifyCartographerEngineTracePayload(payload)}`;
  console.info(`[SeekStar][constellation-engine] ${event}${suffix}`);
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

function stringifyCartographerEngineTracePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, (_key, value: unknown) => {
      if (typeof value === "string" && value.length > 800) {
        return `${value.slice(0, 800)}...<truncated ${value.length - 800} chars>`;
      }

      return value;
    });
  } catch (error) {
    return JSON.stringify({
      trace_error: error instanceof Error ? error.message : String(error),
    });
  }
}

function uniqueId(baseId: string, existingIds: Set<string>): string {
  const normalized = slugify(baseId) || "cartographer";

  if (!existingIds.has(normalized)) {
    return normalized;
  }

  let suffix = 2;
  let candidate = `${normalized}-${suffix}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalized}-${suffix}`;
  }

  return candidate;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
