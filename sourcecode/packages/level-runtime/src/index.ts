import type {
  CartographerGenerationInput,
  CartographerGenerationMode,
  CartographerGenerationOutput,
  CartographerGeneratedNode,
  CartographerGeneratedRelation,
  CartographerGeneratedSourceCandidate,
  CartographerDiagnostic,
  AiRequestOptions,
  AiModelTelemetry,
} from "@seekstar/ai-service";
import { MockAiModelProvider } from "@seekstar/ai-service";
import type { NodeType, SourceState, SourceType } from "@seekstar/core-schema";
import {
  DEFAULT_LEVEL_RUNTIME_PROFILE_ID,
  listLevelRuntimeProfiles,
  resolveLevelModuleDefinition,
  resolveLevelRuntimeProfile,
  type LevelModuleDefinition,
} from "./profiles.js";

export type LevelBandId = "supra_macro" | "L0" | "L1" | "L2" | "L3" | "deep_lens" | "recursive_seed";
export type LevelRuntimeStatus = "ok" | "missing_key" | "provider_error" | "invalid_output" | "cancelled";

export interface LevelChunkKey {
  x: number;
  y: number;
  z?: number;
  ring: number;
  key: string;
}

export interface LevelRuntimeFocus {
  id?: string;
  title: string;
  level_id?: LevelBandId | string;
  excerpt?: string;
}

export interface LevelRuntimeSettings {
  target_counts?: Partial<Record<LevelBandId, number>>;
  preload_rings?: number;
  max_concurrent_ai_requests?: number;
  ai_request_rate_per_minute?: number;
  cache_object_limit?: number;
  chunk_policy?: LevelRuntimeChunkPolicy;
  prompt_profile_id?: string;
  prompt_profile?: LevelRuntimePromptProfileOverride;
}

export interface LevelRuntimeChunkPolicy {
  auto_preload_ring?: number;
  boundary_debounce_ms?: number;
  chunk_height: number;
  chunk_width: number;
  manual_preload_range?: number;
  policy_revision?: string;
}

export interface LevelRuntimePromptModuleOverride {
  prompt_brief?: string;
  prompt_constraints?: string[];
  target_count?: number;
}

export interface LevelRuntimePromptProfileOverride {
  density?: "compact" | "normal" | "rich";
  id?: string;
  label?: string;
  language?: string;
  modules?: Partial<Record<LevelBandId, LevelRuntimePromptModuleOverride>>;
}

export interface LevelRuntimeInput {
  mode: CartographerGenerationMode;
  model?: string;
  level_id: LevelBandId;
  provider_id?: string;
  seed: string;
  chunk: LevelChunkKey;
  focus?: LevelRuntimeFocus;
  settings?: LevelRuntimeSettings;
  context?: Record<string, unknown>;
}

export interface LevelNodeDraft {
  id: string;
  title: string;
  level_id: LevelBandId;
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

export interface LevelRelationDraft {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
  explanation: string;
}

export interface LevelSourceCandidateDraft {
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

export interface LevelChunkHints {
  active: LevelChunkKey;
  preload: LevelChunkKey[];
  unload?: LevelChunkKey[];
}

export interface LevelRuntimeOutput {
  status: LevelRuntimeStatus;
  mode: CartographerGenerationMode;
  model?: string;
  level_id: LevelBandId;
  provider_id?: string;
  seed: string;
  chunk: LevelChunkKey;
  chunk_policy?: LevelRuntimeChunkPolicy;
  nodes: LevelNodeDraft[];
  relations: LevelRelationDraft[];
  source_candidates: LevelSourceCandidateDraft[];
  chunk_hints: LevelChunkHints;
  diagnostics: CartographerDiagnostic[];
  telemetry?: AiModelTelemetry;
  generated_at: string;
}

export interface LevelRuntimeOptions {
  generate?: (input: CartographerGenerationInput, options?: AiRequestOptions) => Promise<CartographerGenerationOutput>;
  signal?: AbortSignal;
}

export type { LevelModuleDefinition, LevelRuntimeProfile } from "./profiles.js";
export { DEFAULT_LEVEL_RUNTIME_PROFILE_ID, listLevelRuntimeProfiles, resolveLevelModuleDefinition, resolveLevelRuntimeProfile };

export type LevelRuntimeCacheStatus = "hit" | "miss" | "refresh";

export interface LevelRuntimeCacheEntry {
  access_count: number;
  bytes_estimate: number;
  cache_key: string;
  created_at: string;
  input: LevelRuntimeInput;
  last_accessed_at: string;
  output: LevelRuntimeOutput;
}

export interface LevelRuntimeHostRequestOptions {
  forceRefresh?: boolean;
  preload?: boolean;
}

export interface LevelRuntimeHostRequestResult {
  cache_status: LevelRuntimeCacheStatus;
  output: LevelRuntimeOutput;
  preloaded: LevelRuntimeOutput[];
}

export interface LevelRuntimeHostOptions extends LevelRuntimeOptions {
  maxCacheEntries?: number;
  maxPreloadChunks?: number;
  now?: () => string;
  settings?: LevelRuntimeSettings;
}

export interface LevelRuntimeHostStats {
  cache_entries: number;
  cache_bytes_estimate: number;
  max_cache_entries: number;
  max_preload_chunks: number;
  total_access_count: number;
}

export const DEFAULT_LEVEL_RUNTIME_SETTINGS: LevelRuntimeSettings & {
  ai_request_rate_per_minute: number;
  cache_object_limit: number;
  max_concurrent_ai_requests: number;
  preload_rings: number;
  prompt_profile_id: string;
  chunk_policy: LevelRuntimeChunkPolicy;
  target_counts: Record<LevelBandId, number>;
} = {
  target_counts: {
    supra_macro: 12,
    L0: 24,
    L1: 18,
    L2: 12,
    L3: 8,
    deep_lens: 16,
    recursive_seed: 8,
  },
  preload_rings: 1,
  max_concurrent_ai_requests: 2,
  ai_request_rate_per_minute: 20,
  cache_object_limit: 1200,
  chunk_policy: {
    auto_preload_ring: 1,
    boundary_debounce_ms: 360,
    chunk_height: 900,
    chunk_width: 1200,
    manual_preload_range: 1,
    policy_revision: "chunk-policy:v1:w1200:h900:ring1:manual1",
  },
  prompt_profile_id: DEFAULT_LEVEL_RUNTIME_PROFILE_ID,
};

export class ChunkedLevelRuntimeHost {
  private readonly cache = new Map<string, LevelRuntimeCacheEntry>();
  private readonly generate?: LevelRuntimeOptions["generate"];
  private readonly maxCacheEntries: number;
  private readonly maxPreloadChunks: number;
  private readonly now: () => string;
  private readonly settings?: LevelRuntimeSettings;

  constructor(options: LevelRuntimeHostOptions = {}) {
    this.generate = options.generate;
    this.maxCacheEntries = Math.max(1, options.maxCacheEntries ?? options.settings?.cache_object_limit ?? DEFAULT_LEVEL_RUNTIME_SETTINGS.cache_object_limit);
    this.maxPreloadChunks = Math.max(0, options.maxPreloadChunks ?? 8);
    this.now = options.now ?? (() => new Date().toISOString());
    this.settings = options.settings;
  }

  async request(input: LevelRuntimeInput, options: LevelRuntimeHostRequestOptions = {}): Promise<LevelRuntimeHostRequestResult> {
    const normalized = normalizeLevelRuntimeInput({
      ...input,
      settings: {
        ...this.settings,
        ...input.settings,
        target_counts: {
          ...this.settings?.target_counts,
          ...input.settings?.target_counts,
        },
      },
    });
    const current = await this.requestSingle(normalized, options.forceRefresh ?? false);
    const preloaded = options.preload ? await this.preloadFrom(current.output, normalized) : [];

    return {
      cache_status: current.cacheStatus,
      output: current.output,
      preloaded,
    };
  }

  getCacheEntry(cacheKey: string): LevelRuntimeCacheEntry | undefined {
    return this.cache.get(cacheKey);
  }

  getCacheSnapshot(): LevelRuntimeCacheEntry[] {
    return [...this.cache.values()].sort((left, right) => left.cache_key.localeCompare(right.cache_key));
  }

  getStats(): LevelRuntimeHostStats {
    const entries = [...this.cache.values()];

    return {
      cache_entries: entries.length,
      cache_bytes_estimate: entries.reduce((sum, entry) => sum + entry.bytes_estimate, 0),
      max_cache_entries: this.maxCacheEntries,
      max_preload_chunks: this.maxPreloadChunks,
      total_access_count: entries.reduce((sum, entry) => sum + entry.access_count, 0),
    };
  }

  clear(): void {
    this.cache.clear();
  }

  private async requestSingle(
    input: LevelRuntimeInput,
    forceRefresh: boolean,
  ): Promise<{ cacheStatus: LevelRuntimeCacheStatus; output: LevelRuntimeOutput }> {
    const cacheKey = createLevelRuntimeCacheKey(input);
    const cached = this.cache.get(cacheKey);

    if (cached && !forceRefresh) {
      cached.access_count += 1;
      cached.last_accessed_at = this.now();

      return { cacheStatus: "hit", output: cached.output };
    }

    const output = await runLevelRuntime(input, { generate: this.generate });
    this.cache.set(cacheKey, {
      access_count: 1,
      bytes_estimate: estimateOutputBytes(output),
      cache_key: cacheKey,
      created_at: this.now(),
      input,
      last_accessed_at: this.now(),
      output,
    });
    this.evictIfNeeded();

    return { cacheStatus: cached ? "refresh" : "miss", output };
  }

  private async preloadFrom(output: LevelRuntimeOutput, sourceInput: LevelRuntimeInput): Promise<LevelRuntimeOutput[]> {
    const chunks = output.chunk_hints.preload.slice(0, this.maxPreloadChunks);
    const preloaded: LevelRuntimeOutput[] = [];

    for (const chunk of chunks) {
      const result = await this.requestSingle(
        {
          ...sourceInput,
          chunk,
          context: {
            ...sourceInput.context,
            preload_for: output.chunk.key,
          },
        },
        false,
      );

      preloaded.push(result.output);
    }

    return preloaded;
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxCacheEntries) {
      const evictable = [...this.cache.values()].sort((left, right) => {
        if (left.access_count !== right.access_count) {
          return left.access_count - right.access_count;
        }

        return left.last_accessed_at.localeCompare(right.last_accessed_at);
      })[0];

      if (!evictable) {
        return;
      }

      this.cache.delete(evictable.cache_key);
    }
  }
}

export function createLevelChunkKey(x = 0, y = 0, ring = 0, z?: number): LevelChunkKey {
  return {
    x,
    y,
    z,
    ring,
    key: `${x}:${y}:${z ?? 0}:${ring}`,
  };
}

export async function runLevelRuntime(input: LevelRuntimeInput, options: LevelRuntimeOptions = {}): Promise<LevelRuntimeOutput> {
  const normalized = normalizeLevelRuntimeInput(input);
  const moduleDefinition = getLevelModule(normalized);
  const generator = options.generate ?? ((generationInput: CartographerGenerationInput, generateOptions?: AiRequestOptions) =>
    new MockAiModelProvider().generate(generationInput, generateOptions));
  const generation = await generator(toCartographerInput(normalized, moduleDefinition), { signal: options.signal });

  if (generation.status !== "ok") {
    return {
      status: generation.status,
      mode: normalized.mode,
      model: generation.model,
      level_id: normalized.level_id,
      provider_id: generation.provider_id,
      seed: normalized.seed,
      chunk: normalized.chunk,
      chunk_policy: normalized.settings?.chunk_policy,
      nodes: [],
      relations: [],
      source_candidates: [],
      chunk_hints: createChunkHints(normalized.chunk, normalized.settings),
      diagnostics: generation.diagnostics,
      telemetry: generation.telemetry,
      generated_at: generation.generated_at,
    };
  }

  const nodes = dedupeNodes(generation.nodes)
    .slice(0, getTargetCount(normalized.level_id, normalized.settings))
    .map((node, index) => toLevelNodeDraft(node, normalized, moduleDefinition, index));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relations = shouldOwnVisibleLayout(moduleDefinition)
    ? createLocalAdjacencyRelations(nodes, normalized)
    : generation.relations.flatMap((relation, index) => toLevelRelationDraft(relation, normalized, index, nodeIds));
  const sourceCandidates =
    moduleDefinition.source_candidate_policy === "none"
      ? []
      : dedupeSourceCandidates(generation.source_candidates).map((candidate, index) => toLevelSourceCandidateDraft(candidate, normalized, index));

  return {
    status: "ok",
    mode: normalized.mode,
    model: generation.model,
    level_id: normalized.level_id,
    provider_id: generation.provider_id,
    seed: normalized.seed,
    chunk: normalized.chunk,
    chunk_policy: normalized.settings?.chunk_policy,
    nodes,
    relations,
    source_candidates: sourceCandidates,
    chunk_hints: createChunkHints(normalized.chunk, normalized.settings),
    diagnostics: generation.diagnostics,
    telemetry: generation.telemetry,
    generated_at: generation.generated_at,
  };
}

export function normalizeLevelRuntimeInput(input: LevelRuntimeInput): LevelRuntimeInput {
  const promptProfileId = normalizePromptProfileId(input.settings?.prompt_profile_id);

  return {
    mode: input.mode,
    level_id: input.level_id,
    seed: input.seed.trim() || "New Seek",
    chunk: input.chunk.key ? input.chunk : createLevelChunkKey(input.chunk.x, input.chunk.y, input.chunk.ring, input.chunk.z),
    focus: input.focus,
    settings: {
      ...DEFAULT_LEVEL_RUNTIME_SETTINGS,
      ...input.settings,
      target_counts: {
        ...DEFAULT_LEVEL_RUNTIME_SETTINGS.target_counts,
        ...createPromptProfileTargetCounts(input.settings?.prompt_profile),
        ...input.settings?.target_counts,
      },
      chunk_policy: normalizeLevelRuntimeChunkPolicy(input.settings?.chunk_policy),
      prompt_profile_id: promptProfileId,
    },
    context: input.context,
  };
}

export function validateLevelRuntimeOutput(output: LevelRuntimeOutput): { valid: boolean; diagnostics: CartographerDiagnostic[] } {
  const diagnostics: CartographerDiagnostic[] = [];

  if (!output.seed.trim()) {
    diagnostics.push({ severity: "error", code: "level_runtime.missing_seed", message: "Level output seed is required." });
  }

  if (!output.chunk.key.trim()) {
    diagnostics.push({ severity: "error", code: "level_runtime.missing_chunk_key", message: "Level output chunk key is required." });
  }

  for (const [index, node] of output.nodes.entries()) {
    if (node.source_state === "source_backed") {
      diagnostics.push({
        severity: "error",
        code: "level_runtime.source_backed_node",
        message: "Level Runtime may not produce source-backed nodes directly.",
        path: `nodes.${index}.source_state`,
      });
    }
  }

  for (const [index, candidate] of output.source_candidates.entries()) {
    if (candidate.source_state !== "cartographer_unverified_source") {
      diagnostics.push({
        severity: "error",
        code: "level_runtime.invalid_candidate_state",
        message: "Source candidates must stay cartographer_unverified_source until DataService validates them.",
        path: `source_candidates.${index}.source_state`,
      });
    }
  }

  return { valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"), diagnostics };
}

export function createLevelRuntimeCacheKey(input: LevelRuntimeInput): string {
  const normalized = normalizeLevelRuntimeInput(input);
  const focusKey = normalized.focus?.id ?? normalized.focus?.title ?? "none";
  const profile = createPromptProfileCacheKey(normalized.settings);

  return [
    "level-runtime",
    normalized.mode,
    normalized.level_id,
    slugify(normalized.seed),
    normalized.chunk.key,
    slugify(focusKey),
    slugify(profile),
    slugify(createChunkPolicyCacheKey(normalized.settings)),
  ].join(":");
}

function toCartographerInput(input: LevelRuntimeInput, moduleDefinition: LevelModuleDefinition): CartographerGenerationInput {
  const profile = resolvePromptProfileSettings(input.settings);

  return {
    mode: input.mode,
    level_id: input.level_id,
    seed: input.seed,
    chunk: input.chunk,
    focus: input.focus,
    settings: {
      ...(input.settings as Record<string, unknown>),
      prompt_profile_id: profile.id,
      chunk_policy: createChunkPolicyCacheKey(input.settings),
      language: profile.language,
      density: profile.density,
      target_node_count: getTargetCount(input.level_id, input.settings),
      source_candidate_policy: moduleDefinition.source_candidate_policy,
      layout_family: moduleDefinition.layout_family,
      default_node_type: moduleDefinition.default_node_type,
    },
    context: {
      ...input.context,
      level_module: {
        level_id: moduleDefinition.level_id,
        label: moduleDefinition.label,
        role: moduleDefinition.role,
        prompt_brief: moduleDefinition.prompt_brief,
        prompt_constraints: moduleDefinition.prompt_constraints,
      },
    },
  };
}

function toLevelNodeDraft(
  node: CartographerGeneratedNode,
  input: LevelRuntimeInput,
  moduleDefinition: LevelModuleDefinition,
  index: number,
): LevelNodeDraft {
  const position = createLevelPosition(index, getTargetCount(input.level_id, input.settings), moduleDefinition);

  return {
    id: node.id?.trim() || `level-${slugify(input.level_id)}-${slugify(input.seed)}-${slugify(input.chunk.key)}-${index + 1}`,
    title: node.title,
    level_id: input.level_id,
    node_type: node.node_type ?? moduleDefinition.default_node_type,
    source_state: node.source_state === "source_backed" ? "cartographer_unverified_source" : node.source_state ?? "cartographer_primary",
    summary: node.summary,
    confidence: clamp01(node.confidence ?? 0.72),
    importance: clamp01(node.importance ?? 0.65),
    tags: Array.from(new Set([input.level_id, moduleDefinition.layout_family, ...(node.tags ?? [])])),
    position_hint: position,
    can_create_seed: node.can_create_seed ?? true,
  };
}

function toLevelRelationDraft(
  relation: CartographerGeneratedRelation,
  input: LevelRuntimeInput,
  index: number,
  nodeIds: Set<string>,
): LevelRelationDraft[] {
  if (!nodeIds.has(relation.from) || !nodeIds.has(relation.to)) {
    return [];
  }

  return [
    {
      id: relation.id?.trim() || `level-rel-${slugify(input.chunk.key)}-${index + 1}`,
      from: relation.from,
      to: relation.to,
      type: relation.type ?? "semantic_similarity",
      confidence: clamp01(relation.confidence ?? 0.58),
      explanation: relation.explanation ?? "AI Cartographer level relation.",
    },
  ];
}

function toLevelSourceCandidateDraft(
  candidate: CartographerGeneratedSourceCandidate,
  input: LevelRuntimeInput,
  index: number,
): LevelSourceCandidateDraft {
  return {
    id: candidate.id?.trim() || `level-candidate-${slugify(input.seed)}-${slugify(input.chunk.key)}-${index + 1}`,
    title: candidate.title,
    url: candidate.url,
    source_state: "cartographer_unverified_source",
    source_type: candidate.source_type ?? "webpage",
    provider_id: candidate.provider_id,
    snippet: candidate.snippet,
    reason: candidate.reason,
    confidence: clamp01(candidate.confidence ?? 0.5),
  };
}

function createLocalAdjacencyRelations(nodes: LevelNodeDraft[], input: LevelRuntimeInput): LevelRelationDraft[] {
  return nodes.flatMap((node, index) => {
    if (index === 0) {
      return [];
    }

    const previous = nodes[index - 1];

    if (!previous) {
      return [];
    }

    return [
      {
        id: `level-local-rel-${slugify(input.chunk.key)}-${index}`,
        from: previous.id,
        to: node.id,
        type: "semantic_similarity",
        confidence: 0.48,
        explanation: "Local adjacency in the visible level field.",
      },
    ];
  });
}

function dedupeNodes(nodes: CartographerGeneratedNode[]): CartographerGeneratedNode[] {
  const seen = new Set<string>();
  const deduped: CartographerGeneratedNode[] = [];

  for (const node of nodes) {
    const key = node.title.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(node);
  }

  return deduped;
}

function dedupeSourceCandidates(candidates: CartographerGeneratedSourceCandidate[]): CartographerGeneratedSourceCandidate[] {
  const seen = new Set<string>();
  const deduped: CartographerGeneratedSourceCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.url.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function createChunkHints(chunk: LevelChunkKey, settings?: LevelRuntimeSettings): LevelChunkHints {
  const rings = Math.max(0, settings?.preload_rings ?? DEFAULT_LEVEL_RUNTIME_SETTINGS.preload_rings);
  const preload: LevelChunkKey[] = [];

  for (let dx = -rings; dx <= rings; dx += 1) {
    for (let dy = -rings; dy <= rings; dy += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      preload.push(createLevelChunkKey(chunk.x + dx, chunk.y + dy, Math.max(Math.abs(dx), Math.abs(dy)), chunk.z));
    }
  }

  return { active: chunk, preload };
}

function shouldOwnVisibleLayout(moduleDefinition: LevelModuleDefinition): boolean {
  return moduleDefinition.layout_family === "bubble_gallery" || moduleDefinition.layout_family === "source_compass" || moduleDefinition.layout_family === "tile_field";
}

function createLevelPosition(
  index: number,
  count: number,
  moduleDefinition: LevelModuleDefinition,
): { x: number; y: number; z?: number } {
  if (moduleDefinition.layout_family === "bubble_gallery" || moduleDefinition.layout_family === "recursive_seed") {
    return createGalleryPosition(index, count);
  }

  if (moduleDefinition.layout_family === "tile_field") {
    const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
    const row = Math.floor(index / columns);
    const column = index % columns;
    const tileWidth = 260;
    const tileHeight = 170;

    return {
      x: Math.round((column - (columns - 1) / 2) * tileWidth),
      y: Math.round((row - Math.floor(count / columns) / 2) * tileHeight),
    };
  }

  if (moduleDefinition.layout_family === "source_compass") {
    const columns = 3;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const laneOffset = column === 0 ? -280 : column === 1 ? 0 : 280;

    return {
      x: laneOffset + (((index * 23) % 21) - 10),
      y: Math.round((row - Math.floor((count - 1) / columns) / 2) * 148 + (((index * 31) % 19) - 9)),
    };
  }

  const columns = 2;
  const row = Math.floor(index / columns);
  const column = index % columns;

  return {
    x: Math.round((column - 0.5) * 320),
    y: Math.round((row - Math.floor((count - 1) / columns) / 2) * 120),
  };
}

function createGalleryPosition(index: number, count: number): { x: number; y: number; z?: number } {
  const shell = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, count))));
  const columns = shell + 2;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const spacingX = 122;
  const spacingY = 106;
  const centeredColumn = column - (columns - 1) / 2;
  const centeredRow = row - Math.floor((count - 1) / columns) / 2;
  const stagger = row % 2 === 0 ? 0 : spacingX / 2;
  const serpentineJitter = ((index * 37) % 17) - 8;

  return {
    x: Math.round(centeredColumn * spacingX + stagger + serpentineJitter),
    y: Math.round(centeredRow * spacingY + (((index * 19) % 13) - 6)),
  };
}

function getTargetCount(levelId: LevelBandId, settings?: LevelRuntimeSettings): number {
  return settings?.target_counts?.[levelId] ?? getLevelModule({ level_id: levelId, settings } as LevelRuntimeInput).default_target_count;
}

function getLevelModule(input: LevelRuntimeInput): LevelModuleDefinition {
  const base = resolveLevelModuleDefinition(input.level_id, input.settings?.prompt_profile_id);
  const override = input.settings?.prompt_profile?.modules?.[input.level_id];

  if (!override) {
    return base;
  }

  const promptBrief = normalizePromptText(override.prompt_brief, base.prompt_brief);
  const promptConstraints = normalizePromptConstraints(override.prompt_constraints, base.prompt_constraints);
  const targetCount = normalizeTargetCount(override.target_count, base.default_target_count);

  return {
    ...base,
    default_target_count: targetCount,
    prompt_brief: promptBrief,
    prompt_constraints: promptConstraints,
  };
}

function resolvePromptProfileSettings(settings?: LevelRuntimeSettings): { density: "compact" | "normal" | "rich"; id: string; language: string } {
  const base = resolveLevelRuntimeProfile(settings?.prompt_profile_id);
  const override = settings?.prompt_profile;

  return {
    density: override?.density === "compact" || override?.density === "rich" || override?.density === "normal" ? override.density : base.density,
    id: normalizePromptText(override?.id, base.id),
    language: normalizePromptText(override?.language, base.language),
  };
}

function createPromptProfileCacheKey(settings?: LevelRuntimeSettings): string {
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
  const normalized = normalizePromptText(profileId, DEFAULT_LEVEL_RUNTIME_SETTINGS.prompt_profile_id);

  return normalized === "seekstar-default-p6" || normalized === "seekstar-default-p6-gallery-v2"
    ? DEFAULT_LEVEL_RUNTIME_SETTINGS.prompt_profile_id
    : normalized;
}

function createChunkPolicyCacheKey(settings?: LevelRuntimeSettings): string {
  const policy = normalizeLevelRuntimeChunkPolicy(settings?.chunk_policy);

  return policy.policy_revision ?? [
    "chunk-policy",
    `w${policy.chunk_width}`,
    `h${policy.chunk_height}`,
    `ring${policy.auto_preload_ring ?? 1}`,
    `manual${policy.manual_preload_range ?? 1}`,
  ].join(":");
}

function normalizeLevelRuntimeChunkPolicy(policy?: Partial<LevelRuntimeChunkPolicy>): LevelRuntimeChunkPolicy {
  const chunkWidth = clampInteger(policy?.chunk_width, 480, 3_200, DEFAULT_LEVEL_RUNTIME_SETTINGS.chunk_policy.chunk_width);
  const chunkHeight = clampInteger(policy?.chunk_height, 480, 3_200, DEFAULT_LEVEL_RUNTIME_SETTINGS.chunk_policy.chunk_height);
  const autoPreloadRing = clampInteger(policy?.auto_preload_ring, 0, 2, DEFAULT_LEVEL_RUNTIME_SETTINGS.chunk_policy.auto_preload_ring ?? 1);
  const manualPreloadRange = clampInteger(policy?.manual_preload_range, 1, 3, DEFAULT_LEVEL_RUNTIME_SETTINGS.chunk_policy.manual_preload_range ?? 1);
  const boundaryDebounceMs = clampInteger(
    policy?.boundary_debounce_ms,
    120,
    5_000,
    DEFAULT_LEVEL_RUNTIME_SETTINGS.chunk_policy.boundary_debounce_ms ?? 360,
  );
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

function normalizeTargetCount(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(80, Math.round(value)));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function createPromptProfileTargetCounts(profile?: LevelRuntimePromptProfileOverride): Partial<Record<LevelBandId, number>> {
  const counts: Partial<Record<LevelBandId, number>> = {};

  for (const [levelId, module] of Object.entries(profile?.modules ?? {}) as Array<[LevelBandId, LevelRuntimePromptModuleOverride | undefined]>) {
    if (!module || typeof module.target_count !== "number" || !Number.isFinite(module.target_count)) {
      continue;
    }

    counts[levelId] = normalizeTargetCount(module.target_count, DEFAULT_LEVEL_RUNTIME_SETTINGS.target_counts[levelId]);
  }

  return counts;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function estimateOutputBytes(output: LevelRuntimeOutput): number {
  return JSON.stringify(output).length;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
