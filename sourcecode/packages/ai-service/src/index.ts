import type {
  AgentJob,
  CartographerOutput,
  NodeType,
  RelationType,
  SemanticRole,
  SourceState,
  SourceType,
  TerrainNode,
  TerrainScene,
} from "@seekstar/core-schema";

export type AiServiceStatus = "available" | "missing_key" | "disabled" | "error";
export type AiProviderKind = "openai_compatible";
export type AiModelResponseStatus = "completed" | "missing_key" | "provider_error" | "invalid_json" | "timeout" | "cancelled";
export type CartographerGenerationMode =
  | "bootstrap_seed"
  | "expand_horizontal"
  | "decompose_down"
  | "summarize_up"
  | "replace_failed_source";
export type CartographerGenerationStatus = "ok" | "missing_key" | "provider_error" | "invalid_output" | "cancelled";
export type CartographerDiagnosticSeverity = "info" | "warning" | "error";
export type AiAssistantIntent = "answer_question" | "navigate" | "expand_map" | "summarize_selection" | "explain_source";
export type AiAssistantStatus = "ok" | "missing_key" | "provider_error" | "invalid_output" | "cancelled";
export type AiAssistantActionType = "none" | "focus_node" | "request_chunk" | "observe_source" | "create_seed" | "open_settings";

export interface AiKeyEnvelope {
  provider: "openai";
  encryptedKey: string;
  updatedAt: string;
}

export interface AiApiKeyRef {
  kind: "env";
  name: string;
}

export interface AiRetryPolicy {
  attempts: number;
  backoff_ms: number;
}

export interface AiProviderConfig {
  id: string;
  kind: AiProviderKind;
  base_url?: string;
  model?: string;
  api_key_ref?: AiApiKeyRef;
  api_key_value?: string;
  api_key_env?: string;
  input_cost_per_million_tokens_usd?: number;
  output_cost_per_million_tokens_usd?: number;
  timeout_ms?: number;
  retry?: AiRetryPolicy;
  headers?: Record<string, string>;
}

export interface AiModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiModelRequest {
  provider: AiProviderConfig;
  messages: AiModelMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: "json_object";
  signal?: AbortSignal;
  timeout_ms?: number;
}

export interface AiRequestOptions {
  signal?: AbortSignal;
}

export interface AiModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface AiModelTelemetry {
  attempts: number;
  completed_at: string;
  duration_ms: number;
  estimated_cost_usd?: number;
  started_at: string;
  usage?: AiModelUsage;
}

export interface CartographerDiagnostic {
  severity: CartographerDiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
  provider_id?: string;
  retryable?: boolean;
  details?: Record<string, string | number | boolean>;
}

export interface AiModelResponse {
  status: AiModelResponseStatus;
  provider_id: string;
  model?: string;
  text?: string;
  json?: unknown;
  finish_reason?: string;
  diagnostics: CartographerDiagnostic[];
  telemetry?: AiModelTelemetry;
  usage?: AiModelUsage;
  completed_at: string;
}

export interface CartographerGenerationFocus {
  id?: string;
  title: string;
  level_id?: string;
  excerpt?: string;
}

export interface CartographerGenerationInput {
  mode: CartographerGenerationMode;
  level_id: string;
  seed: string;
  chunk?: {
    x: number;
    y: number;
    z?: number;
    key?: string;
  };
  focus?: CartographerGenerationFocus;
  settings?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface CartographerGeneratedNode {
  id?: string;
  local_id?: string;
  title: string;
  summary?: string;
  orientation_summary?: string;
  semantic_role?: SemanticRole;
  node_type?: NodeType;
  source_state?: SourceState;
  confidence?: number;
  importance?: number;
  coverage?: number;
  tags?: string[];
  level_id?: string;
  position_hint?: {
    x: number;
    y: number;
    z?: number;
  };
  can_create_seed?: boolean;
  reuse_anchor_id?: string;
}

export interface CartographerGeneratedRelation {
  id?: string;
  from: string;
  to: string;
  type?: RelationType;
  confidence?: number;
  explanation?: string;
}

export interface CartographerGeneratedSourceCandidate {
  id?: string;
  title: string;
  url: string;
  snippet?: string;
  provider_id?: string;
  source_type?: SourceType;
  confidence?: number;
  reason?: string;
  target_ref?: string;
}

export interface CartographerGenerationOutput {
  status: CartographerGenerationStatus;
  mode: CartographerGenerationMode;
  level_id: string;
  seed: string;
  nodes: CartographerGeneratedNode[];
  relations: CartographerGeneratedRelation[];
  source_candidates: CartographerGeneratedSourceCandidate[];
  diagnostics: CartographerDiagnostic[];
  telemetry?: AiModelTelemetry;
  provider_id?: string;
  model?: string;
  generated_at: string;
}

export type WorldSegmentBandId = "L0" | "L1" | "L2" | "L3";

export interface WorldSegmentGenerationInput {
  seed: string;
  segment: { key: string; x: number; y: number };
  nearby_anchors?: Array<{
    id: string;
    layer: WorldSegmentBandId;
    title: string;
    orientation_summary?: string;
    semantic_role?: SemanticRole;
    x: number;
    y: number;
  }>;
  adjacent_segment_summaries?: Array<{ key: string; titles: string[] }>;
  budget?: { L0: number; L1: number; L2: number; total: number };
  prompt_revision?: string;
}

export interface WorldSegmentBandOutput {
  nodes: CartographerGeneratedNode[];
}

export interface WorldSegmentGenerationOutput {
  status: CartographerGenerationStatus;
  seed: string;
  segment: WorldSegmentGenerationInput["segment"];
  bands: Record<WorldSegmentBandId, WorldSegmentBandOutput>;
  relations: CartographerGeneratedRelation[];
  source_candidates: CartographerGeneratedSourceCandidate[];
  diagnostics: CartographerDiagnostic[];
  telemetry?: AiModelTelemetry;
  provider_id?: string;
  model?: string;
  generated_at: string;
}

export interface AiAssistantSelectedNode {
  id: string;
  title: string;
  level_id?: string;
  summary?: string;
  source_state?: SourceState;
}

export interface AiAssistantInput {
  intent: AiAssistantIntent;
  prompt: string;
  seed?: string;
  current_level?: string;
  selected_nodes?: AiAssistantSelectedNode[];
  available_operations?: AiAssistantActionType[];
  scene_summary?: string;
  context?: Record<string, unknown>;
}

export interface AiAssistantAction {
  type: AiAssistantActionType;
  label: string;
  target_id?: string;
  level_id?: string;
  seed?: string;
  arguments?: Record<string, string | number | boolean>;
}

export interface AiAssistantOutput {
  status: AiAssistantStatus;
  intent: AiAssistantIntent;
  answer: string;
  actions: AiAssistantAction[];
  diagnostics: CartographerDiagnostic[];
  telemetry?: AiModelTelemetry;
  provider_id?: string;
  model?: string;
  generated_at: string;
}

export interface CartographerContextPacket {
  tabId: string;
  sceneId: string;
  seed: string;
  layer: string;
  selectedNodes: TerrainNode[];
  sourceSnippets: Array<{
    sourceId?: string;
    title: string;
    excerpt?: string;
  }>;
  userPrompt?: string;
}

export interface AiService {
  status(): Promise<AiServiceStatus>;
  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket;
  runCartographer(job: AgentJob, context: CartographerContextPacket): Promise<CartographerOutput>;
}

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";
const AI_TRACE_PREVIEW_LIMIT = 360;

function resolveCartographerMaxTokens(levelId: string): number {
  switch (levelId) {
    case "L0":
      return 1_800;
    case "L1":
      return 1_600;
    case "L2":
      return 1_200;
    case "L3":
      return 1_000;
    default:
      return 1_000;
  }
}

export class AiCartographerService implements AiService {
  private readonly provider: AiModelProvider;
  private readonly config: AiProviderConfig;

  constructor(config: Partial<AiProviderConfig> = {}) {
    this.config = resolveAiProviderConfig(config);
    this.provider = new OpenAiCompatibleProvider(this.config);
  }

  async status(): Promise<AiServiceStatus> {
    return resolveApiKey(this.config).key ? "available" : "missing_key";
  }

  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket {
    return buildCartographerContext(scene, selectedNodeIds, userPrompt);
  }

  async generate(input: CartographerGenerationInput, options: AiRequestOptions = {}): Promise<CartographerGenerationOutput> {
    traceAiService("cartographer.generate.start", {
      input: summarizeGenerationInput(input),
      provider: summarizeProviderConfig(this.config),
    });

    const output = await this.provider.generate(input, options);

    traceAiService("cartographer.generate.done", {
      output: summarizeGenerationOutput(output),
      provider: summarizeProviderConfig(this.config),
    });

    return output;
  }

  async generateWorldSegment(input: WorldSegmentGenerationInput, options: AiRequestOptions = {}): Promise<WorldSegmentGenerationOutput> {
    return this.provider.generateWorldSegment(input, options);
  }

  async assist(input: AiAssistantInput, options: AiRequestOptions = {}): Promise<AiAssistantOutput> {
    return this.provider.assist(input, options);
  }

  async runCartographer(job: AgentJob, context: CartographerContextPacket): Promise<CartographerOutput> {
    const output = await this.generate({
      mode: "bootstrap_seed",
      level_id: context.layer,
      seed: context.seed,
      focus: context.selectedNodes[0]
        ? {
            id: context.selectedNodes[0].id,
            title: context.selectedNodes[0].title,
            level_id: context.selectedNodes[0].layer,
            excerpt: context.selectedNodes[0].summary,
          }
        : undefined,
      context: {
        scene_id: context.sceneId,
        user_prompt: context.userPrompt,
        source_snippets: context.sourceSnippets,
      },
    });

    return {
      id: `ai-output-${job.id}-${Date.now()}`,
      job_id: job.id,
      tab_id: context.tabId,
      mode: job.mode,
      title: output.status === "ok" ? `Cartographer output for ${context.seed}` : "AI service unavailable",
      summary:
        output.status === "ok"
          ? `${output.nodes.length} nodes and ${output.source_candidates.length} source candidates generated.`
          : output.diagnostics[0]?.message ?? "AI Service could not generate structured terrain.",
      source_state: output.status === "ok" ? "cartographer_primary" : "cartographer_failed",
      target_node_ids: job.target_node_ids ?? [],
      target_source_ids: job.target_source_ids ?? [],
      notes: output.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
      created_at: output.generated_at,
    };
  }
}

export class UnconfiguredAiService implements AiService {
  async status(): Promise<AiServiceStatus> {
    return "missing_key";
  }

  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket {
    return buildCartographerContext(scene, selectedNodeIds, userPrompt);
  }

  async runCartographer(job: AgentJob, context: CartographerContextPacket): Promise<CartographerOutput> {
    return {
      id: `ai-output-unavailable-${job.id}`,
      job_id: job.id,
      tab_id: context.tabId,
      mode: job.mode,
      title: "AI service unavailable",
      summary: "No encrypted AI API key is configured for this workspace.",
      source_state: "agent_inferred",
      target_node_ids: job.target_node_ids ?? [],
      target_source_ids: job.target_source_ids ?? [],
      notes: ["Configure AI Service before requesting Cartographer synthesis."],
      created_at: new Date().toISOString(),
    };
  }
}

interface AiModelProvider {
  generate(input: CartographerGenerationInput, options?: AiRequestOptions): Promise<CartographerGenerationOutput>;
  generateWorldSegment(input: WorldSegmentGenerationInput, options?: AiRequestOptions): Promise<WorldSegmentGenerationOutput>;
  assist(input: AiAssistantInput, options?: AiRequestOptions): Promise<AiAssistantOutput>;
}

export class OpenAiCompatibleProvider implements AiModelProvider {
  private readonly config: AiProviderConfig;

  constructor(config: Partial<AiProviderConfig> = {}) {
    this.config = resolveAiProviderConfig({ ...config, kind: "openai_compatible" });
  }

  async generate(input: CartographerGenerationInput, options: AiRequestOptions = {}): Promise<CartographerGenerationOutput> {
    if (isAbortSignalCancelled(options.signal)) {
      return createCancelledGenerationOutput(input, this.config);
    }

    const key = resolveApiKey(this.config);
    const messages = buildCartographerMessages(input);

    traceAiService("cartographer.provider.prepare", {
      input: summarizeGenerationInput(input),
      key_source: key.source ?? "missing",
      message_preview: summarizeMessages(messages),
      provider: summarizeProviderConfig(this.config),
    });

    if (!key.key) {
      traceAiService("cartographer.provider.missing_key", {
        input: summarizeGenerationInput(input),
        provider: summarizeProviderConfig(this.config),
      });

      return createFailedGenerationOutput(input, "missing_key", [
        {
          severity: "error",
          code: "ai.missing_key",
          message: "No AI API key was found. Set SEEKSTAR_AI_API_KEY or OPENAI_API_KEY, or pass an env key reference.",
          provider_id: this.config.id,
        },
      ]);
    }

    const modelResponse = await requestOpenAiCompatibleModel(
      {
        provider: this.config,
        messages,
        response_format: input.level_id === "L3" ? undefined : "json_object",
        signal: options.signal,
        temperature: 0.2,
        max_tokens: resolveCartographerMaxTokens(input.level_id),
        timeout_ms: this.config.timeout_ms,
      },
      key.key,
    );

    if (modelResponse.status !== "completed") {
      traceAiService("cartographer.provider.failed", {
        input: summarizeGenerationInput(input),
        response: summarizeModelResponse(modelResponse),
      });

      return {
        ...createFailedGenerationOutput(
          input,
          modelResponse.status === "missing_key" ? "missing_key" : modelResponse.status === "cancelled" ? "cancelled" : "provider_error",
          modelResponse.diagnostics,
          this.config,
        ),
        telemetry: modelResponse.telemetry,
      };
    }

    const validation = validateCartographerGenerationOutput(modelResponse.json, input, this.config);

    if (!validation.valid) {
      traceAiService("cartographer.provider.invalid_output", {
        diagnostics: validation.diagnostics,
        input: summarizeGenerationInput(input),
        response: summarizeModelResponse(modelResponse),
      });

      return {
        ...createFailedGenerationOutput(input, "invalid_output", validation.diagnostics, this.config),
        telemetry: modelResponse.telemetry,
      };
    }

    traceAiService("cartographer.provider.valid_output", {
      output: summarizeGenerationOutput(validation.output),
      response: summarizeModelResponse(modelResponse),
    });

    return {
      ...validation.output,
      telemetry: modelResponse.telemetry,
    };
  }

  async generateWorldSegment(input: WorldSegmentGenerationInput, options: AiRequestOptions = {}): Promise<WorldSegmentGenerationOutput> {
    if (isAbortSignalCancelled(options.signal)) {
      return createFailedWorldSegmentOutput(input, "cancelled", [createAiDiagnostic("ai.cancelled", "AI world-segment generation was cancelled before completion.", this.config)]);
    }

    const key = resolveApiKey(this.config);

    if (!key.key) {
      return createFailedWorldSegmentOutput(input, "missing_key", [createAiDiagnostic("ai.missing_key", "No AI API key was found for world-segment generation.", this.config)]);
    }

    const modelResponse = await requestOpenAiCompatibleModel(
      {
        provider: this.config,
        messages: buildWorldSegmentMessages(input),
        response_format: "json_object",
        signal: options.signal,
        temperature: 0.2,
        max_tokens: 2_400,
        timeout_ms: this.config.timeout_ms,
      },
      key.key,
    );

    if (modelResponse.status !== "completed") {
      return {
        ...createFailedWorldSegmentOutput(
          input,
          modelResponse.status === "cancelled" ? "cancelled" : "provider_error",
          modelResponse.diagnostics,
          this.config,
        ),
        telemetry: modelResponse.telemetry,
      };
    }

    const validation = validateWorldSegmentGenerationOutput(modelResponse.json, input, this.config);

    if (!validation.valid) {
      return {
        ...createFailedWorldSegmentOutput(input, "invalid_output", validation.diagnostics, this.config),
        telemetry: modelResponse.telemetry,
      };
    }

    return { ...validation.output, telemetry: modelResponse.telemetry };
  }

  async assist(input: AiAssistantInput, options: AiRequestOptions = {}): Promise<AiAssistantOutput> {
    if (isAbortSignalCancelled(options.signal)) {
      return createCancelledAssistantOutput(input, this.config);
    }

    const key = resolveApiKey(this.config);

    if (!key.key) {
      return createFailedAssistantOutput(input, "missing_key", [
        {
          severity: "error",
          code: "ai.missing_key",
          message: "No AI API key was found. Set SEEKSTAR_AI_API_KEY or OPENAI_API_KEY, or pass an env key reference.",
          provider_id: this.config.id,
        },
      ]);
    }

    const modelResponse = await requestOpenAiCompatibleModel(
      {
        provider: this.config,
        messages: buildAssistantMessages(input),
        response_format: "json_object",
        signal: options.signal,
        temperature: 0.35,
        max_tokens: 1200,
        timeout_ms: this.config.timeout_ms,
      },
      key.key,
    );

    if (modelResponse.status !== "completed") {
      return {
        ...createFailedAssistantOutput(
          input,
          modelResponse.status === "missing_key" ? "missing_key" : modelResponse.status === "cancelled" ? "cancelled" : "provider_error",
          modelResponse.diagnostics,
          this.config,
        ),
        telemetry: modelResponse.telemetry,
      };
    }

    const validation = validateAssistantOutput(modelResponse.json, input, this.config);

    if (!validation.valid) {
      return {
        ...createFailedAssistantOutput(input, "invalid_output", validation.diagnostics, this.config),
        telemetry: modelResponse.telemetry,
      };
    }

    return {
      ...validation.output,
      telemetry: modelResponse.telemetry,
    };
  }
}

export function buildCartographerContext(
  scene: TerrainScene,
  selectedNodeIds: string[],
  userPrompt?: string,
): CartographerContextPacket {
  const selected = new Set(selectedNodeIds);
  const selectedNodes = scene.nodes.filter((node) => selected.has(node.id));
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];

  return {
    tabId: scene.active_tab_id,
    sceneId: scene.id,
    seed: activeTab?.seed ?? scene.metadata.title,
    layer: scene.viewport.layer,
    selectedNodes,
    sourceSnippets: selectedNodes.map((node) => ({
      sourceId: node.source_id,
      title: node.source_title ?? node.title,
      excerpt: node.quote ?? node.summary,
    })),
    userPrompt,
  };
}

export function resolveAiProviderConfig(config: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    id: config.id ?? "openai-compatible",
    kind: "openai_compatible",
    base_url: config.base_url ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    model: config.model ?? DEFAULT_OPENAI_COMPATIBLE_MODEL,
    api_key_ref: config.api_key_ref,
    api_key_value: config.api_key_value,
    api_key_env: config.api_key_env,
    input_cost_per_million_tokens_usd: normalizeCostRate(config.input_cost_per_million_tokens_usd),
    output_cost_per_million_tokens_usd: normalizeCostRate(config.output_cost_per_million_tokens_usd),
    timeout_ms: config.timeout_ms ?? 30_000,
    retry: config.retry ?? { attempts: 1, backoff_ms: 250 },
    headers: config.headers,
  };
}

function normalizeCostRate(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function resolveApiKey(config: AiProviderConfig): { key?: string; source?: string } {
  if (config.api_key_value?.trim()) {
    return { key: config.api_key_value.trim(), source: "settings" };
  }

  const configuredEnv = config.api_key_ref?.kind === "env" ? config.api_key_ref.name : config.api_key_env;
  const candidates = [configuredEnv, "SEEKSTAR_AI_API_KEY", "OPENAI_API_KEY"].filter((candidate): candidate is string => Boolean(candidate));

  for (const envName of candidates) {
    const value = process.env[envName];

    if (value?.trim()) {
      return { key: value.trim(), source: envName };
    }
  }

  return {};
}

export function validateCartographerGenerationOutput(
  value: unknown,
  input: CartographerGenerationInput,
  providerConfig: Partial<AiProviderConfig> = {},
): { valid: true; output: CartographerGenerationOutput } | { valid: false; diagnostics: CartographerDiagnostic[] } {
  if (!isRecord(value)) {
    return {
      valid: false,
      diagnostics: [
        {
          severity: "error",
          code: "cartographer.invalid_json_shape",
          message: "Cartographer output must be a JSON object.",
        },
      ],
    };
  }

  const diagnostics: CartographerDiagnostic[] = [];
  const nodesValue = value.nodes;
  const relationsValue = value.relations;
  const sourceCandidatesValue = value.source_candidates;

  if (!Array.isArray(nodesValue)) {
    diagnostics.push({
      severity: "error",
      code: "cartographer.nodes_not_array",
      message: "Cartographer output must include a nodes array.",
      path: "nodes",
    });
  }

  if (!Array.isArray(relationsValue)) {
    diagnostics.push({
      severity: "error",
      code: "cartographer.relations_not_array",
      message: "Cartographer output must include a relations array.",
      path: "relations",
    });
  }

  if (!Array.isArray(sourceCandidatesValue)) {
    diagnostics.push({
      severity: "error",
      code: "cartographer.source_candidates_not_array",
      message: "Cartographer output must include a source_candidates array.",
      path: "source_candidates",
    });
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { valid: false, diagnostics };
  }

  const nodesArray = Array.isArray(nodesValue) ? nodesValue : [];
  const relationsArray = Array.isArray(relationsValue) ? relationsValue : [];
  const sourceCandidatesArray = Array.isArray(sourceCandidatesValue) ? sourceCandidatesValue : [];

  const nodes = nodesArray.flatMap((node, index): CartographerGeneratedNode[] => {
    if (!isRecord(node) || typeof node.title !== "string" || !node.title.trim()) {
      diagnostics.push({
        severity: "warning",
        code: "cartographer.node_skipped",
        message: "A generated node was skipped because it has no title.",
        path: `nodes.${index}`,
      });
      return [];
    }

    if (looksLikeMojibake(node.title)) {
      diagnostics.push({
        severity: "error",
        code: "cartographer.mojibake_detected",
        message: "Generated node title appears to be mojibake and was rejected before scene/cache write.",
        path: `nodes.${index}.title`,
      });
      return [];
    }

    return [
      {
        id: typeof node.id === "string" ? node.id : undefined,
        title: node.title.trim(),
        summary: typeof node.summary === "string" ? node.summary : undefined,
        node_type: isNodeType(node.node_type) ? node.node_type : undefined,
        source_state: isSourceState(node.source_state) ? node.source_state : "cartographer_primary",
        confidence: toUnitNumber(node.confidence, 0.72),
        importance: toUnitNumber(node.importance, 0.65),
        tags: Array.isArray(node.tags) ? node.tags.filter((tag): tag is string => typeof tag === "string") : [],
        level_id: typeof node.level_id === "string" ? node.level_id : input.level_id,
        position_hint: isPositionHint(node.position_hint) ? node.position_hint : undefined,
        can_create_seed: typeof node.can_create_seed === "boolean" ? node.can_create_seed : true,
      },
    ];
  });

  const relations = relationsArray.flatMap((relation, index): CartographerGeneratedRelation[] => {
    if (!isRecord(relation) || typeof relation.from !== "string" || typeof relation.to !== "string") {
      diagnostics.push({
        severity: "warning",
        code: "cartographer.relation_skipped",
        message: "A generated relation was skipped because it does not reference node ids.",
        path: `relations.${index}`,
      });
      return [];
    }

    return [
      {
        id: typeof relation.id === "string" ? relation.id : undefined,
        from: relation.from,
        to: relation.to,
        type: isRelationType(relation.type) ? relation.type : "semantic_similarity",
        confidence: toUnitNumber(relation.confidence, 0.6),
        explanation: typeof relation.explanation === "string" ? relation.explanation : "AI Cartographer relation.",
      },
    ];
  });

  const sourceCandidates = sourceCandidatesArray.flatMap((candidate, index): CartographerGeneratedSourceCandidate[] => {
    if (!isRecord(candidate) || typeof candidate.title !== "string" || typeof candidate.url !== "string" || !isProbablyUrl(candidate.url)) {
      diagnostics.push({
        severity: "warning",
        code: "cartographer.source_candidate_skipped",
        message: "A source candidate was skipped because it has no valid URL.",
        path: `source_candidates.${index}`,
      });
      return [];
    }

    if (looksLikeMojibake(candidate.title)) {
      diagnostics.push({
        severity: "error",
        code: "cartographer.mojibake_detected",
        message: "Generated source candidate title appears to be mojibake and was rejected before scene/cache write.",
        path: `source_candidates.${index}.title`,
      });
      return [];
    }

    return [
      {
        id: typeof candidate.id === "string" ? candidate.id : undefined,
        title: candidate.title.trim(),
        url: candidate.url.trim(),
        snippet: typeof candidate.snippet === "string" ? candidate.snippet : undefined,
        provider_id: typeof candidate.provider_id === "string" ? candidate.provider_id : providerConfig.id,
        source_type: isSourceType(candidate.source_type) ? candidate.source_type : "webpage",
        confidence: toUnitNumber(candidate.confidence, 0.55),
        reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
      },
    ];
  });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { valid: false, diagnostics };
  }

  return {
    valid: true,
    output: {
      status: "ok",
      mode: isCartographerGenerationMode(value.mode) ? value.mode : input.mode,
      level_id: typeof value.level_id === "string" ? value.level_id : input.level_id,
      seed: typeof value.seed === "string" ? value.seed : input.seed,
      nodes,
      relations,
      source_candidates: sourceCandidates,
      diagnostics,
      provider_id: typeof value.provider_id === "string" ? value.provider_id : providerConfig.id,
      model: typeof value.model === "string" ? value.model : providerConfig.model,
      telemetry: normalizeAiModelTelemetry(value.telemetry),
      generated_at: typeof value.generated_at === "string" ? value.generated_at : new Date().toISOString(),
    },
  };
}

export function validateWorldSegmentGenerationOutput(
  value: unknown,
  input: WorldSegmentGenerationInput,
  providerConfig: Partial<AiProviderConfig> = {},
): { valid: true; output: WorldSegmentGenerationOutput } | { valid: false; diagnostics: CartographerDiagnostic[] } {
  if (!isRecord(value) || !isRecord(value.bands)) {
    return {
      valid: false,
      diagnostics: [createAiDiagnostic("world_segment.invalid_json_shape", "World segment output must contain a bands object.", providerConfig)],
    };
  }

  const diagnostics: CartographerDiagnostic[] = [];
  const requestedBudget = input.budget ?? (input.segment.x === 0 && input.segment.y === 0
    ? { L0: 4, L1: 6, L2: 8, total: 18 }
    : { L0: 4, L1: 4, L2: 4, total: 12 });
  const limits: Record<WorldSegmentBandId, number> = {
    L0: Math.max(0, requestedBudget.L0),
    L1: Math.max(0, requestedBudget.L1),
    L2: Math.max(0, requestedBudget.L2),
    L3: 0,
  };
  const bands = {} as Record<WorldSegmentBandId, WorldSegmentBandOutput>;
  const knownReferences = new Set((input.nearby_anchors ?? []).map((anchor) => anchor.id));
  const seenLocalIds = new Set<string>();
  let remaining = Math.max(0, requestedBudget.total);

  for (const levelId of ["L0", "L1", "L2", "L3"] as const) {
    const rawNodes = readWorldSegmentBandNodes(value.bands, levelId);
    const nodes = rawNodes.flatMap((node): CartographerGeneratedNode[] => {
      if (
        !isRecord(node) ||
        typeof node.local_id !== "string" ||
        !node.local_id.trim() ||
        typeof node.title !== "string" ||
        !node.title.trim() ||
        looksLikeMojibake(node.title) ||
        typeof node.orientation_summary !== "string" ||
        !node.orientation_summary.trim() ||
        !isSemanticRole(node.semantic_role) ||
        node.semantic_role === "source" ||
        seenLocalIds.has(node.local_id.trim())
      ) {
        return [];
      }

      seenLocalIds.add(node.local_id.trim());

      return [{
        local_id: node.local_id.trim().slice(0, 64),
        title: node.title.trim(),
        orientation_summary: node.orientation_summary.trim().slice(0, 180),
        summary: node.orientation_summary.trim().slice(0, 180),
        semantic_role: node.semantic_role,
        node_type: isNodeType(node.node_type) ? node.node_type : levelId === "L0" ? "domain" : levelId === "L1" ? "topic" : "concept",
        source_state: "cartographer_primary",
        confidence: toUnitNumber(node.confidence, 0.72),
        importance: toUnitNumber(node.importance, 0.65),
        coverage: toUnitNumber(node.coverage, 0.5),
        tags: Array.isArray(node.tags) ? node.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 4) : [],
        level_id: levelId,
        can_create_seed: true,
        reuse_anchor_id:
          typeof node.reuse_anchor_id === "string" && knownReferences.has(node.reuse_anchor_id)
            ? node.reuse_anchor_id
            : undefined,
      }];
    }).slice(0, Math.min(limits[levelId], remaining));
    remaining -= nodes.length;

    bands[levelId] = { nodes };
  }

  const localIds = new Set(
    (['L0', 'L1', 'L2'] as const).flatMap((levelId) =>
      bands[levelId].nodes.flatMap((node) => node.local_id ? [node.local_id] : []),
    ),
  );
  const relations = (Array.isArray(value.relations) ? value.relations : []).flatMap((relation): CartographerGeneratedRelation[] => {
    if (
      !isRecord(relation) ||
      typeof relation.from !== "string" ||
      typeof relation.to !== "string" ||
      !isWorldRelationType(relation.type) ||
      (!localIds.has(relation.from) && !knownReferences.has(relation.from)) ||
      (!localIds.has(relation.to) && !knownReferences.has(relation.to)) ||
      relation.from === relation.to
    ) {
      return [];
    }

    return [{
      from: relation.from,
      to: relation.to,
      type: relation.type,
      confidence: toUnitNumber(relation.confidence, 0.72),
      explanation: typeof relation.explanation === "string" ? relation.explanation.trim().slice(0, 180) : "",
    }];
  }).slice(0, 48);

  const sourceCandidates = (Array.isArray(value.source_candidates) ? value.source_candidates : []).flatMap((candidate): CartographerGeneratedSourceCandidate[] => {
    if (!isRecord(candidate) || typeof candidate.title !== "string" || typeof candidate.url !== "string" || !isProbablyUrl(candidate.url) || looksLikeMojibake(candidate.title)) {
      return [];
    }

    return [{
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      title: candidate.title.trim(),
      url: candidate.url.trim(),
      snippet: typeof candidate.snippet === "string" ? candidate.snippet : undefined,
      provider_id: typeof candidate.provider_id === "string" ? candidate.provider_id : providerConfig.id,
      source_type: isSourceType(candidate.source_type) ? candidate.source_type : "webpage",
      confidence: toUnitNumber(candidate.confidence, 0.55),
      reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
      target_ref:
        typeof candidate.target_ref === "string" && (localIds.has(candidate.target_ref) || knownReferences.has(candidate.target_ref))
          ? candidate.target_ref
          : undefined,
    }];
  }).slice(0, 2);

  if (bands.L0.nodes.length === 0 && bands.L1.nodes.length === 0 && bands.L2.nodes.length === 0) {
    return { valid: false, diagnostics: [...diagnostics, createAiDiagnostic("world_segment.empty", "World segment has no usable terrain.", providerConfig)] };
  }

  return {
    valid: true,
    output: {
      status: "ok",
      seed: input.seed,
      segment: input.segment,
      bands,
      relations,
      source_candidates: sourceCandidates,
      diagnostics,
      provider_id: providerConfig.id,
      model: providerConfig.model,
      generated_at: new Date().toISOString(),
    },
  };
}

export function createFailedGenerationOutput(
  input: CartographerGenerationInput,
  status: Exclude<CartographerGenerationStatus, "ok">,
  diagnostics: CartographerDiagnostic[],
  providerConfig: Partial<AiProviderConfig> = {},
): CartographerGenerationOutput {
  return {
    status,
    mode: input.mode,
    level_id: input.level_id,
    seed: input.seed,
    nodes: [],
    relations: [],
    source_candidates: [],
    diagnostics,
    provider_id: providerConfig.id,
    model: providerConfig.model,
    telemetry: undefined,
    generated_at: new Date().toISOString(),
  };
}

function createFailedWorldSegmentOutput(
  input: WorldSegmentGenerationInput,
  status: Exclude<CartographerGenerationStatus, "ok">,
  diagnostics: CartographerDiagnostic[],
  providerConfig: Partial<AiProviderConfig> = {},
): WorldSegmentGenerationOutput {
  return {
    status,
    seed: input.seed,
    segment: input.segment,
    bands: { L0: { nodes: [] }, L1: { nodes: [] }, L2: { nodes: [] }, L3: { nodes: [] } },
    relations: [],
    source_candidates: [],
    diagnostics,
    provider_id: providerConfig.id,
    model: providerConfig.model,
    generated_at: new Date().toISOString(),
  };
}

function createAiDiagnostic(
  code: string,
  message: string,
  providerConfig: Partial<AiProviderConfig>,
  severity: CartographerDiagnostic["severity"] = "error",
): CartographerDiagnostic {
  return { severity, code, message, provider_id: providerConfig.id };
}

export function createCancelledGenerationOutput(
  input: CartographerGenerationInput,
  providerConfig: Partial<AiProviderConfig> = {},
): CartographerGenerationOutput {
  return createFailedGenerationOutput(
    input,
    "cancelled",
    [
      {
        severity: "warning",
        code: "ai.cancelled",
        message: "AI generation was cancelled before completion.",
        provider_id: providerConfig.id,
        retryable: false,
      },
    ],
    providerConfig,
  );
}

export function validateAssistantOutput(
  value: unknown,
  input: AiAssistantInput,
  providerConfig: Partial<AiProviderConfig> = {},
): { valid: true; output: AiAssistantOutput } | { valid: false; diagnostics: CartographerDiagnostic[] } {
  if (!isRecord(value)) {
    return {
      valid: false,
      diagnostics: [
        {
          severity: "error",
          code: "assistant.invalid_json_shape",
          message: "Assistant output must be a JSON object.",
        },
      ],
    };
  }

  const diagnostics: CartographerDiagnostic[] = [];
  const answer = typeof value.answer === "string" && value.answer.trim() ? value.answer.trim() : "";
  const rawActions = Array.isArray(value.actions) ? value.actions : [];

  if (!answer) {
    diagnostics.push({
      severity: "error",
      code: "assistant.missing_answer",
      message: "Assistant output must include a non-empty answer.",
      path: "answer",
    });
  }

  const actions = rawActions.flatMap((action, index): AiAssistantAction[] => {
    if (!isRecord(action) || !isAssistantActionType(action.type)) {
      diagnostics.push({
        severity: "warning",
        code: "assistant.action_skipped",
        message: "An assistant action was skipped because it has no valid type.",
        path: `actions.${index}`,
      });
      return [];
    }

    return [
      {
        type: action.type,
        label: typeof action.label === "string" && action.label.trim() ? action.label.trim() : action.type,
        target_id: typeof action.target_id === "string" ? action.target_id : undefined,
        level_id: typeof action.level_id === "string" ? action.level_id : undefined,
        seed: typeof action.seed === "string" ? action.seed : undefined,
        arguments: isStringNumberBooleanRecord(action.arguments) ? action.arguments : undefined,
      },
    ];
  });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { valid: false, diagnostics };
  }

  return {
    valid: true,
    output: {
      status: "ok",
      intent: isAssistantIntent(value.intent) ? value.intent : input.intent,
      answer,
      actions,
      diagnostics,
      provider_id: typeof value.provider_id === "string" ? value.provider_id : providerConfig.id,
      model: typeof value.model === "string" ? value.model : providerConfig.model,
      telemetry: normalizeAiModelTelemetry(value.telemetry),
      generated_at: typeof value.generated_at === "string" ? value.generated_at : new Date().toISOString(),
    },
  };
}

export function createFailedAssistantOutput(
  input: AiAssistantInput,
  status: Exclude<AiAssistantStatus, "ok">,
  diagnostics: CartographerDiagnostic[],
  providerConfig: Partial<AiProviderConfig> = {},
): AiAssistantOutput {
  return {
    status,
    intent: input.intent,
    answer: diagnostics[0]?.message ?? "AI assistant could not answer.",
    actions: [],
    diagnostics,
    provider_id: providerConfig.id,
    model: providerConfig.model,
    telemetry: undefined,
    generated_at: new Date().toISOString(),
  };
}

export function createCancelledAssistantOutput(input: AiAssistantInput, providerConfig: Partial<AiProviderConfig> = {}): AiAssistantOutput {
  return createFailedAssistantOutput(
    input,
    "cancelled",
    [
      {
        severity: "warning",
        code: "ai.cancelled",
        message: "AI assistant request was cancelled before completion.",
        provider_id: providerConfig.id,
        retryable: false,
      },
    ],
    providerConfig,
  );
}

async function requestOpenAiCompatibleModel(request: AiModelRequest, apiKey: string): Promise<AiModelResponse> {
  const provider = resolveAiProviderConfig(request.provider);
  const endpoint = `${(provider.base_url ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL).replace(/\/$/, "")}/chat/completions`;
  const attempts = Math.max(1, provider.retry?.attempts ?? 1);
  const backoffMs = Math.max(0, provider.retry?.backoff_ms ?? 0);
  const startedAt = new Date().toISOString();

  if (isAbortSignalCancelled(request.signal)) {
    return createCancelledModelResponse(provider, startedAt, startedAt, 1);
  }

  traceAiService("model.request.start", {
    attempts,
    endpoint,
    max_tokens: request.max_tokens,
    message_preview: summarizeMessages(request.messages),
    provider: summarizeProviderConfig(provider),
    response_format: request.response_format,
    temperature: request.temperature,
    timeout_ms: request.timeout_ms ?? provider.timeout_ms,
  });

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let externalAbortListener: (() => void) | undefined;

    try {
      const controller = new AbortController();
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, request.timeout_ms ?? provider.timeout_ms ?? 30_000);

      if (request.signal) {
        if (request.signal.aborted) {
          clearTimeout(timeout);
          timeout = undefined;
          return createCancelledModelResponse(provider, startedAt, new Date().toISOString(), attempt);
        }

        externalAbortListener = () => controller.abort();
        request.signal.addEventListener("abort", externalAbortListener, { once: true });
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...provider.headers,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.max_tokens ?? 1800,
          response_format: request.response_format === "json_object" ? { type: "json_object" } : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      timeout = undefined;
      if (externalAbortListener) {
        request.signal?.removeEventListener("abort", externalAbortListener);
        externalAbortListener = undefined;
      }

      traceAiService("model.request.http_status", {
        attempt,
        ok: response.ok,
        provider_id: provider.id,
        status: response.status,
        status_text: response.statusText,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        traceAiService("model.request.http_error", {
          attempt,
          body: truncateTraceText(body),
          provider_id: provider.id,
          status: response.status,
        });
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 240)}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractOpenAiText(payload);
      const parsed = parseJsonObject(text);
      const usage = extractOpenAiUsage(payload);
      const finishReason = extractOpenAiFinishReason(payload);
      const likelyTokenLimit = finishReason === "length" || (typeof request.max_tokens === "number" && usage?.output_tokens === request.max_tokens);

      traceAiService("model.response.summary", {
        attempt,
        finish_reason: finishReason,
        provider_id: provider.id,
        text_length: text.length,
        text_preview: isSeekStarVerboseTraceEnabled() ? truncateTraceText(text) : undefined,
        truncated_by_token_limit: likelyTokenLimit || undefined,
        usage,
      });

      if (isSeekStarVerboseTraceEnabled()) {
        traceAiService("model.response.text", {
          attempt,
          provider_id: provider.id,
          text: truncateTraceText(text),
          usage,
        });
      }

      if (!parsed.ok) {
        const completedAt = new Date().toISOString();

        return {
          status: "invalid_json",
          provider_id: provider.id,
          model: provider.model,
          text,
          finish_reason: finishReason,
          diagnostics: [
            {
              severity: "error",
              code: likelyTokenLimit ? "ai.output_truncated" : "ai.invalid_json",
              message: likelyTokenLimit
                ? `AI provider stopped at max_tokens before returning valid JSON: ${parsed.message}`
                : parsed.message,
              provider_id: provider.id,
            },
          ],
          telemetry: createAiModelTelemetry({
            attempts: attempt,
            completedAt,
            provider,
            startedAt,
            usage,
          }),
          usage,
          completed_at: completedAt,
        };
      }
      const completedAt = new Date().toISOString();

      return {
        status: "completed",
        provider_id: provider.id,
        model: provider.model,
        text,
        json: parsed.value,
        finish_reason: finishReason,
        diagnostics: [],
        telemetry: createAiModelTelemetry({
          attempts: attempt,
          completedAt,
          provider,
          startedAt,
          usage,
        }),
        usage,
        completed_at: completedAt,
      };
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (externalAbortListener) {
        request.signal?.removeEventListener("abort", externalAbortListener);
      }

      const isLastAttempt = attempt === attempts;
      const aborted = error instanceof Error && error.name === "AbortError";
      const cancelled = aborted && !timedOut && isAbortSignalCancelled(request.signal);

      traceAiService("model.request.error", {
        attempt,
        cancelled,
        is_last_attempt: isLastAttempt,
        message: error instanceof Error ? error.message : String(error),
        provider_id: provider.id,
        timed_out: timedOut,
      });

      if (cancelled) {
        return createCancelledModelResponse(provider, startedAt, new Date().toISOString(), attempt);
      }

      if (isLastAttempt) {
        const completedAt = new Date().toISOString();

        return {
          status: aborted ? "timeout" : "provider_error",
          provider_id: provider.id,
          model: provider.model,
          diagnostics: [
            {
              severity: "error",
              code: aborted ? "ai.timeout" : "ai.provider_error",
              message: error instanceof Error ? error.message : String(error),
              provider_id: provider.id,
              retryable: true,
            },
          ],
          telemetry: createAiModelTelemetry({
            attempts: attempt,
            completedAt,
            provider,
            startedAt,
          }),
          completed_at: completedAt,
        };
      }

      const slept = await sleep(backoffMs * attempt, request.signal);
      if (!slept) {
        return createCancelledModelResponse(provider, startedAt, new Date().toISOString(), attempt);
      }
    }
  }

  const completedAt = new Date().toISOString();

  return {
    status: "provider_error",
    provider_id: provider.id,
    model: provider.model,
    diagnostics: [
      {
        severity: "error",
        code: "ai.provider_error",
        message: "AI provider failed without returning a response.",
        provider_id: provider.id,
      },
    ],
    telemetry: createAiModelTelemetry({
      attempts,
      completedAt,
      provider,
      startedAt,
    }),
    completed_at: completedAt,
  };
}

function createCancelledModelResponse(provider: AiProviderConfig, startedAt: string, completedAt: string, attempts: number): AiModelResponse {
  return {
    status: "cancelled",
    provider_id: provider.id,
    model: provider.model,
    diagnostics: [
      {
        severity: "warning",
        code: "ai.cancelled",
        message: "AI provider request was cancelled.",
        provider_id: provider.id,
        retryable: false,
      },
    ],
    telemetry: createAiModelTelemetry({
      attempts,
      completedAt,
      provider,
      startedAt,
    }),
    completed_at: completedAt,
  };
}

export function estimateAiModelCostUsd(usage: AiModelUsage | undefined, provider: Partial<AiProviderConfig>): number | undefined {
  if (!usage) {
    return undefined;
  }

  const inputRate = normalizeCostRate(provider.input_cost_per_million_tokens_usd);
  const outputRate = normalizeCostRate(provider.output_cost_per_million_tokens_usd);

  if (inputRate === undefined && outputRate === undefined) {
    return undefined;
  }

  const inputCost = ((usage.input_tokens ?? 0) * (inputRate ?? 0)) / 1_000_000;
  const outputCost = ((usage.output_tokens ?? 0) * (outputRate ?? 0)) / 1_000_000;

  return Number((inputCost + outputCost).toFixed(8));
}

function createAiModelTelemetry(input: {
  attempts: number;
  completedAt: string;
  provider: Partial<AiProviderConfig>;
  startedAt: string;
  usage?: AiModelUsage;
}): AiModelTelemetry {
  return {
    attempts: Math.max(1, input.attempts),
    completed_at: input.completedAt,
    duration_ms: Math.max(0, Date.parse(input.completedAt) - Date.parse(input.startedAt)),
    estimated_cost_usd: estimateAiModelCostUsd(input.usage, input.provider),
    started_at: input.startedAt,
    usage: input.usage,
  };
}

function normalizeAiModelTelemetry(value: unknown): AiModelTelemetry | undefined {
  if (!isRecord(value) || typeof value.started_at !== "string" || typeof value.completed_at !== "string") {
    return undefined;
  }

  return {
    attempts: typeof value.attempts === "number" && Number.isFinite(value.attempts) ? Math.max(1, Math.round(value.attempts)) : 1,
    completed_at: value.completed_at,
    duration_ms: typeof value.duration_ms === "number" && Number.isFinite(value.duration_ms) ? Math.max(0, Math.round(value.duration_ms)) : 0,
    estimated_cost_usd:
      typeof value.estimated_cost_usd === "number" && Number.isFinite(value.estimated_cost_usd) && value.estimated_cost_usd >= 0
        ? value.estimated_cost_usd
        : undefined,
    started_at: value.started_at,
    usage: isRecord(value.usage)
      ? {
          input_tokens: typeof value.usage.input_tokens === "number" ? value.usage.input_tokens : undefined,
          output_tokens: typeof value.usage.output_tokens === "number" ? value.usage.output_tokens : undefined,
          total_tokens: typeof value.usage.total_tokens === "number" ? value.usage.total_tokens : undefined,
        }
      : undefined,
  };
}

export function buildCartographerMessages(input: CartographerGenerationInput): AiModelMessage[] {
  const targetNodeCount = getCartographerTargetNodeCount(input);
  const outputContract = createCartographerOutputContract(input, targetNodeCount);
  const promptSeed = createPromptSeed(input.seed);

  if (input.level_id === "L3") {
    return buildL3SourceCandidateMessages(input, targetNodeCount, outputContract);
  }

  return [
    {
      role: "system",
      content:
        "You are SeekStar AI Cartographer. Return one valid compact JSON object only; no markdown, no prose, no trailing comments. " +
        "Use exactly these top-level keys: mode, level_id, seed, nodes, relations, source_candidates. " +
        "Visible titles must be readable Simplified Chinese UTF-8; never output mojibake or garbled text. " +
        "Keep relations as an empty array because SeekStar creates local layout relations. " +
        "For nodes use only title and node_type unless output_contract explicitly asks for more; never use label, description, candidate_url, url_status, or nested objects. " +
        "AI terrain is cartographer_primary. URL candidates are unverified and must not be called source-backed. " +
        "For L3 put every URL in source_candidates and keep nodes empty. " +
        "Stop after the requested count; shorter valid JSON is better than long JSON.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: input.mode,
        level_id: input.level_id,
        seed: promptSeed,
        chunk: input.chunk,
        focus: input.focus,
        output_contract: outputContract,
        settings: input.settings,
        context: input.context,
      }),
    },
  ];
}

function getCartographerTargetNodeCount(input: CartographerGenerationInput): number {
  const value = isRecord(input.settings) ? input.settings.target_node_count : undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return input.level_id === "L3" ? 3 : 8;
  }

  const max = input.level_id === "L3" ? 3 : 24;

  return Math.max(0, Math.min(max, Math.round(value)));
}

function createCartographerOutputContract(input: CartographerGenerationInput, targetNodeCount: number): Record<string, unknown> {
  if (input.level_id === "L3") {
    return {
      max_source_candidates: targetNodeCount,
      nodes: [],
      relations: [],
      source_candidate_shape: {
        title: "short source title",
        url: "https://...",
        source_type: "webpage|pdf|image|document",
        reason: "short reason",
      },
      rule: "Return nodes:[] and relations:[]. Valid URLs only in source_candidates.",
    };
  }

  return {
    max_nodes: targetNodeCount,
    nodes_shape: {
      title: "short visible title",
      node_type: isRecord(input.settings) && typeof input.settings.default_node_type === "string" ? input.settings.default_node_type : "topic",
    },
    title_rule: "2-10 readable Simplified Chinese characters when possible; no mojibake.",
    forbidden_node_fields: ["id", "label", "description", "summary", "tags", "candidate_url", "url_status", "children"],
    relations: [],
    source_candidates: [],
    rule: "Return compact nodes with title and node_type only; relations:[]. Do not include URLs in nodes.",
  };
}

function createPromptSeed(seed: string): string {
  const withoutOpenedAt = seed.replace(/;\s*opened_at=.*$/i, "").trim();
  const normalized = withoutOpenedAt || seed.trim();

  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
}

function buildL3SourceCandidateMessages(
  input: CartographerGenerationInput,
  targetNodeCount: number,
  outputContract: Record<string, unknown>,
): AiModelMessage[] {
  const focusTitle = createPromptSeed(input.focus?.title ?? input.seed);

  return [
    {
      role: "system",
      content:
        "Return only one compact JSON object. No markdown. " +
        "Top-level keys: mode, level_id, seed, nodes, relations, source_candidates. " +
        "For L3, nodes must be [] and relations must be []. " +
        "Create 2-3 real public URL candidates that can load in a browser. " +
        "Use readable Simplified Chinese titles. Do not call candidates source-backed.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: input.mode,
        level_id: "L3",
        seed: createPromptSeed(input.seed),
        focus_title: focusTitle,
        output_contract: {
          ...outputContract,
          max_source_candidates: targetNodeCount,
        },
        required_shape: {
          mode: input.mode,
          level_id: "L3",
          seed: createPromptSeed(input.seed),
          nodes: [],
          relations: [],
          source_candidates: [
            {
              title: "short readable title",
              url: "https://...",
              source_type: "webpage",
              reason: "short reason",
            },
          ],
        },
      }),
    },
  ];
}

export function buildWorldSegmentMessages(input: WorldSegmentGenerationInput): AiModelMessage[] {
  const budget = input.budget ?? (input.segment.x === 0 && input.segment.y === 0
    ? { L0: 4, L1: 6, L2: 8, total: 18 }
    : { L0: 4, L1: 4, L2: 4, total: 12 });

  return [
    {
      role: "system",
      content:
        "You are SeekStar World Cartographer v2. Return one compact JSON object only with bands, relations, and source_candidates. " +
        "L0 means domains, L1 themes, L2 explanations, and L3 must always contain zero AI nodes. Limits are ceilings, never quotas. " +
        "Every L0-L2 node requires local_id, title, orientation_summary, semantic_role, importance, coverage, and node_type. " +
        "Allowed roles: region, landmark, frontier, topic, thread, bridge, question_cluster, mechanism, component, comparison, controversy, practice, evidence_direction. " +
        "Allowed relations: refines, overlaps, bridges, contrasts_with, depends_on, supports, critiques, documents, exemplifies. Use refines from detail to broader object. " +
        "Relations may reference local_id or an exact nearby anchor id. reuse_anchor_id must exactly match a nearby anchor. Do not return positions, footprint, parent_id, nested scenes, or markdown. " +
        "Return concise Simplified Chinese. orientation_summary is one sentence; importance and coverage are numbers from 0 to 1. URLs remain unverified candidates.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "world_segment",
        seed: createPromptSeed(input.seed),
        segment: input.segment,
        nearby_anchors: input.nearby_anchors?.slice(0, 8),
        adjacent_segment_summaries: input.adjacent_segment_summaries?.slice(0, 4),
        prompt_revision: input.prompt_revision,
        output_contract: {
          bands: {
            L0: { max_nodes: budget.L0, node_type: "domain" },
            L1: { max_nodes: budget.L1, node_type: "topic" },
            L2: { max_nodes: budget.L2, node_type: "concept|question|generated_summary" },
            L3: { nodes: [] },
          },
          total_new_nodes: budget.total,
          relation_types: ["refines", "overlaps", "bridges", "contrasts_with", "depends_on", "supports", "critiques", "documents", "exemplifies"],
          source_candidates: { max_items: 2, shape: { title: "short title", url: "https://...", source_type: "webpage", target_ref: "optional local_id" } },
        },
      }),
    },
  ];
}

/**
 * Providers occasionally return a band directly as an array, or use a lowercase
 * level key, despite an otherwise valid world-segment response. Both variants are
 * harmless structural differences, so normalize them before deciding a chunk is
 * empty. Unknown shapes still fail validation.
 */
function readWorldSegmentBandNodes(bands: Record<string, unknown>, levelId: WorldSegmentBandId): unknown[] {
  const numericLevel = levelId.slice(1);
  const rawBand = bands[levelId] ?? bands[levelId.toLowerCase()] ?? bands[`level_${numericLevel}`] ?? bands[`level${numericLevel}`];

  if (Array.isArray(rawBand)) {
    return rawBand;
  }

  return isRecord(rawBand) && Array.isArray(rawBand.nodes) ? rawBand.nodes : [];
}

export function buildAssistantMessages(input: AiAssistantInput): AiModelMessage[] {
  return [
    {
      role: "system",
      content:
        "You are SeekStar AI Map Assistant. Return only strict JSON with keys: intent, answer, actions. " +
        "Answer using the current map context. Suggest app actions only from available_operations. Do not claim source-backed evidence unless context says it exists.",
    },
    {
      role: "user",
      content: JSON.stringify({
        intent: input.intent,
        prompt: input.prompt,
        seed: input.seed,
        current_level: input.current_level,
        selected_nodes: input.selected_nodes,
        available_operations: input.available_operations,
        scene_summary: input.scene_summary,
        context: input.context,
      }),
    },
  ];
}

function extractOpenAiText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return "";
  }

  const firstChoice = payload.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message) || typeof firstChoice.message.content !== "string") {
    return "";
  }

  return firstChoice.message.content;
}

function extractOpenAiUsage(payload: unknown): AiModelUsage | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return undefined;
  }

  return {
    input_tokens: typeof payload.usage.prompt_tokens === "number" ? payload.usage.prompt_tokens : undefined,
    output_tokens: typeof payload.usage.completion_tokens === "number" ? payload.usage.completion_tokens : undefined,
    total_tokens: typeof payload.usage.total_tokens === "number" ? payload.usage.total_tokens : undefined,
  };
}

function extractOpenAiFinishReason(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return undefined;
  }

  const firstChoice = payload.choices[0];

  return isRecord(firstChoice) && typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : undefined;
}

function parseJsonObject(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    const extracted = extractJsonObjectText(text);

    if (extracted && extracted !== text) {
      try {
        return { ok: true, value: JSON.parse(extracted) };
      } catch {
        // Fall through to the original parse error so diagnostics point at the provider output.
      }
    }

    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function extractJsonObjectText(text: string): string | undefined {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return undefined;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function isCartographerGenerationMode(value: unknown): value is CartographerGenerationMode {
  return (
    value === "bootstrap_seed" ||
    value === "expand_horizontal" ||
    value === "decompose_down" ||
    value === "summarize_up" ||
    value === "replace_failed_source"
  );
}

function isAssistantIntent(value: unknown): value is AiAssistantIntent {
  return (
    value === "answer_question" ||
    value === "navigate" ||
    value === "expand_map" ||
    value === "summarize_selection" ||
    value === "explain_source"
  );
}

function isAssistantActionType(value: unknown): value is AiAssistantActionType {
  return (
    value === "none" ||
    value === "focus_node" ||
    value === "request_chunk" ||
    value === "observe_source" ||
    value === "create_seed" ||
    value === "open_settings"
  );
}

function isNodeType(value: unknown): value is NodeType {
  return (
    value === "domain" ||
    value === "topic" ||
    value === "subtopic" ||
    value === "concept" ||
    value === "question" ||
    value === "source" ||
    value === "webpage" ||
    value === "document" ||
    value === "section" ||
    value === "paragraph" ||
    value === "sentence" ||
    value === "phrase" ||
    value === "word" ||
    value === "character" ||
    value === "unicode" ||
    value === "dictionary_entry" ||
    value === "annotation" ||
    value === "user_note" ||
    value === "generated_summary" ||
    value === "fog_region" ||
    value === "constellation_anchor"
  );
}

function isSemanticRole(value: unknown): value is SemanticRole {
  return (
    value === "region" ||
    value === "landmark" ||
    value === "frontier" ||
    value === "topic" ||
    value === "thread" ||
    value === "bridge" ||
    value === "question_cluster" ||
    value === "mechanism" ||
    value === "component" ||
    value === "comparison" ||
    value === "controversy" ||
    value === "practice" ||
    value === "evidence_direction" ||
    value === "source"
  );
}

function isWorldRelationType(value: unknown): value is RelationType {
  return (
    value === "refines" ||
    value === "overlaps" ||
    value === "bridges" ||
    value === "contrasts_with" ||
    value === "depends_on" ||
    value === "supports" ||
    value === "critiques" ||
    value === "documents" ||
    value === "exemplifies"
  );
}

function isRelationType(value: unknown): value is RelationType {
  return isWorldRelationType(value) || [
    "semantic_similarity", "sibling", "citation", "hyperlink", "same_author", "same_institution",
    "same_event", "chronological_sequence", "contradiction", "toolchain", "prerequisite", "translation", "etymology",
    "token_contains", "source_contains", "user_selected", "agent_inferred",
  ].includes(String(value));
}

function isSourceState(value: unknown): value is SourceState {
  return (
    value === "source_backed" ||
    value === "cartographer_primary" ||
    value === "cartographer_unverified_source" ||
    value === "cartographer_failed" ||
    value === "user_seed" ||
    value === "local_scaffold" ||
    value === "agent_inferred" ||
    value === "weak_hypothesis" ||
    value === "generated" ||
    value === "user_note" ||
    value === "local_only" ||
    value === "fog"
  );
}

function isSourceType(value: unknown): value is SourceType {
  return (
    value === "webpage" ||
    value === "document" ||
    value === "article" ||
    value === "local_file" ||
    value === "dictionary" ||
    value === "generated_summary" ||
    value === "unknown"
  );
}

function isPositionHint(value: unknown): value is { x: number; y: number; z?: number } {
  return isRecord(value) && typeof value.x === "number" && typeof value.y === "number" && (value.z === undefined || typeof value.z === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringNumberBooleanRecord(value: unknown): value is Record<string, string | number | boolean> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean");
}

function isProbablyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeMojibake(value: string): boolean {
  const text = value.trim();

  return (
    text.includes("\uFFFD") ||
    /(?:Ã.|Â.|â[€™€œ€“]|閲忓|鑴戞|绯荤|鏂规|绠楁|璁＄|瓒呭|闅忔|杩愬|姣旂|纭|妯℃|缁艰|鍥㈤|鎺ュ|鏁版|璋锋)/u.test(text)
  );
}

function toUnitNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (ms <= 0) {
    return !isAbortSignalCancelled(signal);
  }

  if (isAbortSignalCancelled(signal)) {
    return false;
  }

  return new Promise((resolve) => {
    const abortListener = () => {
      clearTimeout(timeoutId);
      resolve(false);
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", abortListener);
      resolve(true);
    }, ms);
    signal?.addEventListener("abort", abortListener, { once: true });
  });
}

function isAbortSignalCancelled(signal: AbortSignal | undefined): boolean {
  return Boolean(signal?.aborted);
}

function traceAiService(event: string, payload?: unknown): void {
  if (!isSeekStarTraceEnabled()) {
    return;
  }

  const suffix = payload === undefined ? "" : ` ${stringifyTracePayload(payload)}`;
  console.info(`[SeekStar][ai-service] ${event}${suffix}`);
}

function isSeekStarTraceEnabled(): boolean {
  if (process.env.SEEKSTAR_TRACE === "0" || process.env.SEEKSTAR_TRACE === "false") {
    return false;
  }

  return process.env.SEEKSTAR_TRACE === "1" || process.env.SEEKSTAR_TRACE === "true";
}

function isSeekStarVerboseTraceEnabled(): boolean {
  return process.env.SEEKSTAR_TRACE_VERBOSE === "1" || process.env.SEEKSTAR_TRACE_VERBOSE === "true";
}

function stringifyTracePayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, (_key, value: unknown) => {
      if (typeof value === "string") {
        return truncateTraceText(value);
      }

      return value;
    });
  } catch (error) {
    return JSON.stringify({
      trace_error: error instanceof Error ? error.message : String(error),
    });
  }
}

function summarizeProviderConfig(provider: Partial<AiProviderConfig>): Record<string, unknown> {
  const resolved = resolveAiProviderConfig(provider);
  const key = resolveApiKey(resolved);

  return {
    base_url: resolved.base_url,
    id: resolved.id,
    key_source: key.source ?? "missing",
    kind: resolved.kind,
    model: resolved.model,
    timeout_ms: resolved.timeout_ms,
  };
}

function summarizeGenerationInput(input: CartographerGenerationInput): Record<string, unknown> {
  return {
    chunk: input.chunk,
    context_keys: input.context ? Object.keys(input.context).slice(0, 24) : [],
    focus: input.focus
      ? {
          id: input.focus.id,
          level_id: input.focus.level_id,
          title: input.focus.title,
        }
      : undefined,
    level_id: input.level_id,
    mode: input.mode,
    seed: input.seed,
    settings_keys: input.settings ? Object.keys(input.settings).slice(0, 24) : [],
  };
}

function summarizeGenerationOutput(output: CartographerGenerationOutput): Record<string, unknown> {
  return {
    diagnostics: output.diagnostics.slice(0, 4),
    generated_at: output.generated_at,
    level_id: output.level_id,
    mode: output.mode,
    model: output.model,
    node_count: output.nodes.length,
    provider_id: output.provider_id,
    relation_count: output.relations.length,
    seed: output.seed,
    source_candidate_count: output.source_candidates.length,
    status: output.status,
    telemetry: output.telemetry,
  };
}

function summarizeModelResponse(response: AiModelResponse): Record<string, unknown> {
  return {
    completed_at: response.completed_at,
    diagnostics: response.diagnostics.slice(0, 4),
    model: response.model,
    provider_id: response.provider_id,
    status: response.status,
    telemetry: response.telemetry,
    text: response.text,
    usage: response.usage,
  };
}

function summarizeMessages(messages: AiModelMessage[]): Array<{ content: string; role: AiModelMessage["role"] }> {
  return messages.map((message) => ({
    content: truncateTraceText(message.content),
    role: message.role,
  }));
}

function truncateTraceText(text: string, maxLength = AI_TRACE_PREVIEW_LIMIT): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...<truncated ${text.length - maxLength} chars>` : text;
}
