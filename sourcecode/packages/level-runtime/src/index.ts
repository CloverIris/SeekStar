import type {
  CartographerGenerationInput,
  CartographerGenerationMode,
  CartographerGenerationOutput,
  CartographerGeneratedNode,
  CartographerGeneratedRelation,
  CartographerGeneratedSourceCandidate,
  CartographerDiagnostic,
} from "@seekstar/ai-service";
import { MockAiModelProvider } from "@seekstar/ai-service";
import type { NodeType, SourceState, SourceType } from "@seekstar/core-schema";

export type LevelBandId = "supra_macro" | "L0" | "L1" | "L2" | "L3" | "deep_lens" | "recursive_seed";
export type LevelRuntimeStatus = "ok" | "missing_key" | "provider_error" | "invalid_output";

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
  prompt_profile_id?: string;
}

export interface LevelRuntimeInput {
  mode: CartographerGenerationMode;
  level_id: LevelBandId;
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
  level_id: LevelBandId;
  seed: string;
  chunk: LevelChunkKey;
  nodes: LevelNodeDraft[];
  relations: LevelRelationDraft[];
  source_candidates: LevelSourceCandidateDraft[];
  chunk_hints: LevelChunkHints;
  diagnostics: CartographerDiagnostic[];
  generated_at: string;
}

export interface LevelRuntimeOptions {
  generate?: (input: CartographerGenerationInput) => Promise<CartographerGenerationOutput>;
}

export const DEFAULT_LEVEL_RUNTIME_SETTINGS: Required<LevelRuntimeSettings> = {
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
  prompt_profile_id: "seekstar-default-p6",
};

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
  const generator = options.generate ?? ((generationInput: CartographerGenerationInput) => new MockAiModelProvider().generate(generationInput));
  const generation = await generator(toCartographerInput(normalized));

  if (generation.status !== "ok") {
    return {
      status: generation.status,
      mode: normalized.mode,
      level_id: normalized.level_id,
      seed: normalized.seed,
      chunk: normalized.chunk,
      nodes: [],
      relations: [],
      source_candidates: [],
      chunk_hints: createChunkHints(normalized.chunk, normalized.settings),
      diagnostics: generation.diagnostics,
      generated_at: generation.generated_at,
    };
  }

  const nodes = dedupeNodes(generation.nodes)
    .slice(0, getTargetCount(normalized.level_id, normalized.settings))
    .map((node, index) => toLevelNodeDraft(node, normalized, index));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const relations = generation.relations.flatMap((relation, index) => toLevelRelationDraft(relation, normalized, index, nodeIds));
  const sourceCandidates = dedupeSourceCandidates(generation.source_candidates).map((candidate, index) =>
    toLevelSourceCandidateDraft(candidate, normalized, index),
  );

  return {
    status: "ok",
    mode: normalized.mode,
    level_id: normalized.level_id,
    seed: normalized.seed,
    chunk: normalized.chunk,
    nodes,
    relations,
    source_candidates: sourceCandidates,
    chunk_hints: createChunkHints(normalized.chunk, normalized.settings),
    diagnostics: generation.diagnostics,
    generated_at: generation.generated_at,
  };
}

export function normalizeLevelRuntimeInput(input: LevelRuntimeInput): LevelRuntimeInput {
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
        ...input.settings?.target_counts,
      },
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

function toCartographerInput(input: LevelRuntimeInput): CartographerGenerationInput {
  return {
    mode: input.mode,
    level_id: input.level_id,
    seed: input.seed,
    chunk: input.chunk,
    focus: input.focus,
    settings: input.settings as Record<string, unknown>,
    context: input.context,
  };
}

function toLevelNodeDraft(node: CartographerGeneratedNode, input: LevelRuntimeInput, index: number): LevelNodeDraft {
  const fallbackPosition = createRadialPosition(index, getTargetCount(input.level_id, input.settings));

  return {
    id: node.id?.trim() || `level-${slugify(input.level_id)}-${slugify(input.seed)}-${slugify(input.chunk.key)}-${index + 1}`,
    title: node.title,
    level_id: input.level_id,
    node_type: node.node_type ?? getDefaultNodeType(input.level_id),
    source_state: node.source_state === "source_backed" ? "cartographer_unverified_source" : node.source_state ?? "cartographer_primary",
    summary: node.summary,
    confidence: clamp01(node.confidence ?? 0.72),
    importance: clamp01(node.importance ?? 0.65),
    tags: Array.from(new Set([input.level_id, ...(node.tags ?? [])])),
    position_hint: node.position_hint ?? fallbackPosition,
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

function createRadialPosition(index: number, count: number): { x: number; y: number; z?: number } {
  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  const radius = 180 + Math.floor(index / 8) * 110;

  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

function getTargetCount(levelId: LevelBandId, settings?: LevelRuntimeSettings): number {
  return settings?.target_counts?.[levelId] ?? DEFAULT_LEVEL_RUNTIME_SETTINGS.target_counts[levelId] ?? 8;
}

function getDefaultNodeType(levelId: LevelBandId): NodeType {
  if (levelId === "supra_macro" || levelId === "L0") {
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

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
