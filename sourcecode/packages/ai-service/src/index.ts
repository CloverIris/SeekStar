import type { AgentJob, CartographerOutput, NodeType, SourceState, SourceType, TerrainNode, TerrainScene } from "@seekstar/core-schema";

export type AiServiceStatus = "available" | "missing_key" | "disabled" | "error";
export type AiProviderKind = "openai_compatible" | "mock";
export type AiModelResponseStatus = "completed" | "missing_key" | "provider_error" | "invalid_json" | "timeout";
export type CartographerGenerationMode =
  | "bootstrap_seed"
  | "expand_horizontal"
  | "decompose_down"
  | "summarize_up"
  | "replace_failed_source";
export type CartographerGenerationStatus = "ok" | "missing_key" | "provider_error" | "invalid_output";
export type CartographerDiagnosticSeverity = "info" | "warning" | "error";

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
  api_key_env?: string;
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
  timeout_ms?: number;
}

export interface AiModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
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
  diagnostics: CartographerDiagnostic[];
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
  title: string;
  summary?: string;
  node_type?: NodeType;
  source_state?: SourceState;
  confidence?: number;
  importance?: number;
  tags?: string[];
  level_id?: string;
  position_hint?: {
    x: number;
    y: number;
    z?: number;
  };
  can_create_seed?: boolean;
}

export interface CartographerGeneratedRelation {
  id?: string;
  from: string;
  to: string;
  type?: string;
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

export class AiCartographerService implements AiService {
  private readonly provider: AiModelProvider;
  private readonly config: AiProviderConfig;

  constructor(config: Partial<AiProviderConfig> = {}) {
    this.config = resolveAiProviderConfig(config);
    this.provider = this.config.kind === "mock" ? new MockAiModelProvider(this.config) : new OpenAiCompatibleProvider(this.config);
  }

  async status(): Promise<AiServiceStatus> {
    if (this.config.kind === "mock") {
      return "available";
    }

    return resolveApiKey(this.config).key ? "available" : "missing_key";
  }

  buildContext(scene: TerrainScene, selectedNodeIds: string[], userPrompt?: string): CartographerContextPacket {
    return buildCartographerContext(scene, selectedNodeIds, userPrompt);
  }

  async generate(input: CartographerGenerationInput): Promise<CartographerGenerationOutput> {
    return this.provider.generate(input);
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
  generate(input: CartographerGenerationInput): Promise<CartographerGenerationOutput>;
}

export class MockAiModelProvider implements AiModelProvider {
  private readonly config: AiProviderConfig;

  constructor(config: Partial<AiProviderConfig> = {}) {
    this.config = resolveAiProviderConfig({ ...config, kind: "mock" });
  }

  async generate(input: CartographerGenerationInput): Promise<CartographerGenerationOutput> {
    return normalizeCartographerGenerationOutput(createMockCartographerOutput(input), input, this.config);
  }
}

export class OpenAiCompatibleProvider implements AiModelProvider {
  private readonly config: AiProviderConfig;

  constructor(config: Partial<AiProviderConfig> = {}) {
    this.config = resolveAiProviderConfig({ ...config, kind: "openai_compatible" });
  }

  async generate(input: CartographerGenerationInput): Promise<CartographerGenerationOutput> {
    const key = resolveApiKey(this.config);

    if (!key.key) {
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
        messages: buildCartographerMessages(input),
        response_format: "json_object",
        temperature: 0.4,
        max_tokens: 1800,
        timeout_ms: this.config.timeout_ms,
      },
      key.key,
    );

    if (modelResponse.status !== "completed") {
      return createFailedGenerationOutput(
        input,
        modelResponse.status === "missing_key" ? "missing_key" : "provider_error",
        modelResponse.diagnostics,
        this.config,
      );
    }

    const validation = validateCartographerGenerationOutput(modelResponse.json, input, this.config);

    if (!validation.valid) {
      return createFailedGenerationOutput(input, "invalid_output", validation.diagnostics, this.config);
    }

    return validation.output;
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
  const kind = config.kind ?? "openai_compatible";

  return {
    id: config.id ?? (kind === "mock" ? "mock-cartographer" : "openai-compatible"),
    kind,
    base_url: config.base_url ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    model: config.model ?? (kind === "mock" ? "mock-cartographer-v1" : DEFAULT_OPENAI_COMPATIBLE_MODEL),
    api_key_ref: config.api_key_ref,
    api_key_env: config.api_key_env,
    timeout_ms: config.timeout_ms ?? 30_000,
    retry: config.retry ?? { attempts: 1, backoff_ms: 250 },
    headers: config.headers,
  };
}

export function resolveApiKey(config: AiProviderConfig): { key?: string; source?: string } {
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
        type: typeof relation.type === "string" ? relation.type : "semantic_similarity",
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
      generated_at: typeof value.generated_at === "string" ? value.generated_at : new Date().toISOString(),
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
    generated_at: new Date().toISOString(),
  };
}

async function requestOpenAiCompatibleModel(request: AiModelRequest, apiKey: string): Promise<AiModelResponse> {
  const provider = resolveAiProviderConfig(request.provider);
  const endpoint = `${(provider.base_url ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL).replace(/\/$/, "")}/chat/completions`;
  const attempts = Math.max(1, provider.retry?.attempts ?? 1);
  const backoffMs = Math.max(0, provider.retry?.backoff_ms ?? 0);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), request.timeout_ms ?? provider.timeout_ms ?? 30_000);
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

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 240)}`);
      }

      const payload = (await response.json()) as unknown;
      const text = extractOpenAiText(payload);
      const parsed = parseJsonObject(text);

      if (!parsed.ok) {
        return {
          status: "invalid_json",
          provider_id: provider.id,
          model: provider.model,
          text,
          diagnostics: [
            {
              severity: "error",
              code: "ai.invalid_json",
              message: parsed.message,
              provider_id: provider.id,
            },
          ],
          completed_at: new Date().toISOString(),
        };
      }

      return {
        status: "completed",
        provider_id: provider.id,
        model: provider.model,
        text,
        json: parsed.value,
        diagnostics: [],
        usage: extractOpenAiUsage(payload),
        completed_at: new Date().toISOString(),
      };
    } catch (error) {
      const isLastAttempt = attempt === attempts;
      const aborted = error instanceof Error && error.name === "AbortError";

      if (isLastAttempt) {
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
          completed_at: new Date().toISOString(),
        };
      }

      await sleep(backoffMs * attempt);
    }
  }

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
    completed_at: new Date().toISOString(),
  };
}

function buildCartographerMessages(input: CartographerGenerationInput): AiModelMessage[] {
  return [
    {
      role: "system",
      content:
        "You are SeekStar AI Cartographer. Return only strict JSON with keys: mode, level_id, seed, nodes, relations, source_candidates. " +
        "AI terrain is cartographer_primary. URL candidates are unverified and must not be called source-backed.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: input.mode,
        level_id: input.level_id,
        seed: input.seed,
        chunk: input.chunk,
        focus: input.focus,
        settings: input.settings,
        context: input.context,
      }),
    },
  ];
}

function createMockCartographerOutput(input: CartographerGenerationInput): CartographerGenerationOutput {
  const count = getMockCount(input.level_id);
  const seed = input.seed.trim() || "New Seek";
  const baseTitles = createMockTitles(seed, input.level_id, input.mode, count);
  const nodes = baseTitles.map((title, index): CartographerGeneratedNode => {
    const angle = (Math.PI * 2 * index) / Math.max(1, baseTitles.length);

    return {
      id: `mock-${slugify(input.level_id)}-${slugify(seed)}-${index + 1}`,
      title,
      summary: `${title} as ${input.level_id} cartographer terrain for ${seed}.`,
      node_type: getNodeTypeForLevel(input.level_id),
      source_state: "cartographer_primary",
      confidence: 0.74,
      importance: index === 0 ? 0.9 : 0.62,
      tags: [input.level_id, input.mode],
      level_id: input.level_id,
      position_hint: {
        x: Math.round(Math.cos(angle) * (260 + index * 8)),
        y: Math.round(Math.sin(angle) * (180 + index * 6)),
      },
      can_create_seed: true,
    };
  });

  const relations = nodes.slice(1).map((node): CartographerGeneratedRelation => ({
    from: nodes[0]?.id ?? node.id ?? "center",
    to: node.id ?? node.title,
    type: "semantic_similarity",
    confidence: 0.58,
    explanation: `Mock cartographer adjacency around ${seed}.`,
  }));

  const sourceCandidates =
    input.level_id === "L3" || input.mode === "decompose_down"
      ? [
          {
            id: `mock-source-${slugify(seed)}-official`,
            title: `${seed} official documentation`,
            url: `https://www.google.com/search?q=${encodeURIComponent(`${seed} official documentation`)}`,
            snippet: `Candidate URL for observing source-backed material about ${seed}.`,
            provider_id: "mock-cartographer",
            source_type: "webpage" as SourceType,
            confidence: 0.42,
            reason: "Mock provider keeps source URLs unverified for DataService probing.",
          },
        ]
      : [];

  return {
    status: "ok",
    mode: input.mode,
    level_id: input.level_id,
    seed,
    nodes,
    relations,
    source_candidates: sourceCandidates,
    diagnostics: [
      {
        severity: "info",
        code: "ai.mock_provider",
        message: "Deterministic mock Cartographer output. Use only for tests and CLI debugging.",
        provider_id: "mock-cartographer",
      },
    ],
    provider_id: "mock-cartographer",
    model: "mock-cartographer-v1",
    generated_at: new Date().toISOString(),
  };
}

function normalizeCartographerGenerationOutput(
  output: CartographerGenerationOutput,
  input: CartographerGenerationInput,
  providerConfig: AiProviderConfig,
): CartographerGenerationOutput {
  const validation = validateCartographerGenerationOutput(output, input, providerConfig);

  return validation.valid ? validation.output : createFailedGenerationOutput(input, "invalid_output", validation.diagnostics, providerConfig);
}

function createMockTitles(seed: string, levelId: string, mode: CartographerGenerationMode, count: number): string[] {
  const normalizedSeed = seed.trim() || "New Seek";
  const levelVocabulary: Record<string, string[]> = {
    supra_macro: ["civilization context", "knowledge systems", "material substrate", "human practice", "future frontier"],
    L0: ["Computing", "Natural sciences", "Engineering", "Mathematics", "Social systems", "Design", "Medicine", "History"],
    L1: ["Architecture", "Core concepts", "Tooling", "Research threads", "Learning paths", "Applications"],
    L2: ["Official docs", "Canonical references", "Community hubs", "Paper trails", "Open repositories", "Tutorial families"],
    L3: ["Primary webpage", "Reference article", "Documentation tile", "Repository tile", "Paper tile", "Image/document tile"],
    deep_lens: ["section", "paragraph", "sentence", "phrase", "term", "character"],
    recursive_seed: ["upward parent", "same-band neighbor", "downward detail", "source trail"],
  };
  const vocabulary = levelVocabulary[levelId] ?? levelVocabulary.L0;
  const suffix = mode === "expand_horizontal" ? "neighbor" : mode === "summarize_up" ? "parent" : mode === "decompose_down" ? "detail" : "seed";

  return Array.from({ length: count }, (_, index) => {
    const cycle = Math.floor(index / vocabulary.length);
    const titleSuffix = cycle > 0 ? ` ${cycle + 1}` : "";

    return `${normalizedSeed} ${vocabulary[index % vocabulary.length]}${titleSuffix} ${suffix}`;
  });
}

function getMockCount(levelId: string): number {
  const counts: Record<string, number> = {
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

function getNodeTypeForLevel(levelId: string): NodeType {
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

function parseJsonObject(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
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

function isProbablyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toUnitNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}
