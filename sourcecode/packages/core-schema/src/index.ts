export type SourceState =
  | "source_backed"
  | "cartographer_primary"
  | "cartographer_unverified_source"
  | "cartographer_failed"
  | "user_seed"
  | "local_scaffold"
  | "agent_inferred"
  | "weak_hypothesis"
  | "generated"
  | "user_note"
  | "local_only"
  | "fog";

export type NodeType =
  | "domain"
  | "topic"
  | "subtopic"
  | "concept"
  | "question"
  | "source"
  | "webpage"
  | "document"
  | "section"
  | "paragraph"
  | "sentence"
  | "phrase"
  | "word"
  | "character"
  | "unicode"
  | "dictionary_entry"
  | "annotation"
  | "user_note"
  | "generated_summary"
  | "fog_region"
  | "constellation_anchor";

export type RelationType =
  | "semantic_similarity"
  | "parent_child"
  | "sibling"
  | "citation"
  | "hyperlink"
  | "same_author"
  | "same_institution"
  | "same_event"
  | "chronological_sequence"
  | "contradiction"
  | "supports"
  | "critiques"
  | "toolchain"
  | "prerequisite"
  | "translation"
  | "etymology"
  | "token_contains"
  | "source_contains"
  | "user_selected"
  | "agent_inferred";

export type LayerId =
  | "L0"
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "L6"
  | "L7"
  | "L8"
  | "L9"
  | "L10"
  | "L11"
  | (string & {});

export type SourceType =
  | "webpage"
  | "document"
  | "article"
  | "local_file"
  | "dictionary"
  | "generated_summary"
  | "unknown";

export interface SourceSnapshotOutlink {
  title: string;
  url: string;
  snippet?: string;
}

export interface SourceSnapshotMedia {
  kind: "image" | "video" | "audio" | "pdf" | "unknown";
  url: string;
  title?: string;
  alt?: string;
  mime_type?: string;
}

export interface SourceSnapshot {
  url: string;
  final_url: string;
  title: string;
  content_type?: string;
  visible_text: string;
  excerpt?: string;
  outlinks: SourceSnapshotOutlink[];
  media: SourceSnapshotMedia[];
  source_type: SourceType;
  retrieved_at: string;
  failure_reason?: string;
}

export type AgentJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ScoutObservationStatus =
  | "pending"
  | "observed"
  | "source_candidate"
  | "converted"
  | "failed"
  | "duplicate"
  | "expired";

export interface PositionHint {
  x: number;
  y: number;
  z?: number;
}

export interface SourcePositionRange {
  source_id?: string;
  locator?: string;
  start: number;
  end: number;
  excerpt?: string;
}

export interface TokenRangeRef {
  source_id?: string;
  node_id?: string;
  start_token: number;
  end_token: number;
  text?: string;
}

export interface ZoomTarget {
  layer: LayerId;
  node_id?: string;
  scene_id?: string;
  zoom?: number;
}

export interface CreatedFromRef {
  tab_id?: string;
  node_id?: string;
  source_id?: string;
  layer?: LayerId;
  label: string;
  excerpt?: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  layer: LayerId;
}

export type CameraState = ViewportState;

export type TileAbsorptionTrigger = "threshold" | "click" | "command";
export type TileAbsorptionStatus = "idle" | "absorbed";

export interface BrowserTileAbsorptionState {
  status: TileAbsorptionStatus;
  node_id?: string;
  source_id?: string;
  source_url?: string;
  entered_at?: string;
  exit_layer: LayerId;
  trigger?: TileAbsorptionTrigger;
}

export interface TerrainRuntimeState {
  focused_node_id?: string;
  browser_absorption: BrowserTileAbsorptionState;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  active_tab_id: string;
  tabs: ExplorationTab[];
  tab_records?: TabRecord[];
  folders?: WorkspaceFolder[];
  created_at: string;
  updated_at: string;
}

export type TabRuntimeStatus =
  | "booting"
  | "active"
  | "inactive"
  | "suspended"
  | "crashed"
  | "closing";

export type TabWindowState =
  | "main"
  | "detached"
  | "hidden";

export interface TabCachePolicy {
  max_bytes: number;
  inactive_grace_ms: number;
  eviction: "lru_lfu";
}

export interface TabCrashReport {
  tab_id: string;
  reason: string;
  exit_code?: number;
  last_event?: string;
  occurred_at: string;
  details?: string;
}

export interface TabRecord {
  id: string;
  title: string;
  seed: string;
  order: number;
  pinned: boolean;
  favorite: boolean;
  folder_id?: string;
  workspace_id?: string;
  window_state: TabWindowState;
  runtime_status: TabRuntimeStatus;
  session_partition: string;
  cache_policy: TabCachePolicy;
  cache_bytes: number;
  last_accessed_at: string;
  crash_report?: TabCrashReport;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFolder {
  id: string;
  title: string;
  parent_id?: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface ExplorationTab {
  id: string;
  title: string;
  seed: string;
  source_mode: "opening_sky" | "new_seed" | "hyperlink" | "selection" | "saved_collection";
  parent_backlink?: Backlink;
  current_layer: LayerId;
  viewport: ViewportState;
  node_ids: string[];
  relation_ids: string[];
  source_ids: string[];
  created_at: string;
  updated_at: string;
}

export type Tab = ExplorationTab;

export interface Backlink {
  tab_id: string;
  node_id?: string;
  source_id?: string;
  label: string;
  excerpt?: string;
}

export interface TerrainNode {
  id: string;
  type: NodeType;
  title: string;
  layer: LayerId;
  source_state: SourceState;
  confidence: number;
  importance: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  summary?: string;
  source_url?: string;
  source_id?: string;
  source_title?: string;
  source_type?: SourceType;
  retrieved_at?: string;
  parent_id?: string;
  child_ids?: string[];
  relation_ids?: string[];
  semantic_axes?: string[];
  position_hint?: PositionHint;
  quote?: string;
  source_range?: SourcePositionRange;
  token_range?: TokenRangeRef;
  semantic_breadcrumb?: string[];
  zoom_target?: ZoomTarget;
  can_create_seed?: boolean;
  created_from?: CreatedFromRef;
  child_scene_id?: string;
  child_layer_id?: LayerId;
}

export type Node = TerrainNode;

export interface TerrainRelation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  confidence: number;
  explanation: string;
  source_state: SourceState;
}

export type Relation = TerrainRelation;

export interface TerrainLayer {
  id: LayerId;
  label: string;
  parent_layer_id?: LayerId;
  child_layer_ids: LayerId[];
  breadcrumb: string[];
}

export type Layer = TerrainLayer;

export interface SourceRef {
  id: string;
  url?: string;
  local_ref?: string;
  title: string;
  source_type: SourceType;
  retrieved_at?: string;
  snippet?: string;
  reliability_hints: string[];
  created_from_observation_id?: string;
  source_snapshot?: SourceSnapshot;
}

export type Source = SourceRef;

export interface SelectionState {
  id: string;
  tab_id: string;
  node_ids: string[];
  source_ids: string[];
  text_ranges: TextRangeRef[];
  created_at: string;
}

export type Selection = SelectionState;

export interface TextRangeRef {
  source_id: string;
  node_id?: string;
  start: number;
  end: number;
  excerpt: string;
}

export interface AgentJob {
  id: string;
  tab_id: string;
  mode:
    | "seed_mapper"
    | "web_scout_planner"
    | "source_distiller"
    | "layer_cartographer"
    | "question_generator"
    | "learning_path_mapper"
    | "region_explainer"
    | "markdown_export";
  status: AgentJobStatus;
  input_summary: string;
  title?: string;
  progress?: number;
  target_node_ids?: string[];
  target_source_ids?: string[];
  error_message?: string;
  output_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface TerrainPatch {
  nodes: TerrainNode[];
  relations: TerrainRelation[];
  sources: SourceRef[];
}

export interface ScoutPlan {
  id: string;
  title: string;
  target_node_ids: string[];
  candidate_queries: string[];
  source_type_targets: SourceType[];
  discovery_mode?: ScoutDiscoveryMode;
  priority: "low" | "medium" | "high";
  stop_conditions: string[];
  deduplication_notes: string[];
  created_at: string;
}

export type ScoutDiscoveryMode = "direct_url" | "frontier_web_search" | "page_outlinks";

export type DataServiceProviderKind =
  | "authority"
  | "search_api"
  | "url_only"
  | "browser_search"
  | "browser_observer"
  | "extractor"
  | "page_outlinks"
  | "cache";

export type SearchCandidateDiscoveryMode = "frontier_web_search" | "page_outlinks";

export type ContentProviderGroup =
  | "authority"
  | "search_api"
  | "browser_assisted"
  | "url_only";

export type ContentProviderHealthStatus =
  | "ready"
  | "requires_key"
  | "unavailable"
  | "disabled";

export interface ContentProviderDefinition {
  id: string;
  label: string;
  group: ContentProviderGroup;
  provider_kind: DataServiceProviderKind;
  default_enabled: boolean;
  default_priority: number;
  requires_api_key?: boolean;
  api_key_env_var?: string;
  default_languages?: string[];
  supported_languages?: string[];
  domains?: string[];
  homepage_url?: string;
  documentation_url?: string;
  rate_limit_note?: string;
}

export interface ContentProviderSettings {
  id: string;
  enabled: boolean;
  priority: number;
  languages?: string[];
  region?: string;
  base_url?: string;
  api_key_env_var?: string;
  health_status?: ContentProviderHealthStatus;
  health_message?: string;
}

export const BUILT_IN_CONTENT_PROVIDER_DEFINITIONS = [
  {
    id: "arxiv",
    label: "arXiv",
    group: "authority",
    provider_kind: "authority",
    default_enabled: true,
    default_priority: 10,
    default_languages: ["en"],
    supported_languages: ["en"],
    domains: ["arxiv.org"],
    homepage_url: "https://arxiv.org/",
    documentation_url: "https://info.arxiv.org/help/api/index.html",
    rate_limit_note: "Free Atom API. Keep repeated calls polite and low frequency.",
  },
  {
    id: "github",
    label: "GitHub",
    group: "authority",
    provider_kind: "authority",
    default_enabled: true,
    default_priority: 20,
    api_key_env_var: "GITHUB_TOKEN",
    default_languages: ["en"],
    domains: ["github.com"],
    homepage_url: "https://github.com/",
    documentation_url: "https://docs.github.com/en/rest/search/search",
    rate_limit_note: "REST Search API. Unauthenticated use is rate limited; token is optional.",
  },
  {
    id: "wikipedia",
    label: "Wikipedia",
    group: "authority",
    provider_kind: "authority",
    default_enabled: true,
    default_priority: 30,
    default_languages: ["zh", "en"],
    supported_languages: ["zh", "en"],
    domains: ["wikipedia.org"],
    homepage_url: "https://www.wikipedia.org/",
    documentation_url: "https://www.mediawiki.org/wiki/API:Search",
    rate_limit_note: "MediaWiki API. Send a clear User-Agent and obey throttling.",
  },
  {
    id: "wikidata",
    label: "Wikidata",
    group: "authority",
    provider_kind: "authority",
    default_enabled: true,
    default_priority: 40,
    default_languages: ["zh", "en"],
    supported_languages: ["zh", "en"],
    domains: ["wikidata.org"],
    homepage_url: "https://www.wikidata.org/",
    documentation_url: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    rate_limit_note: "Entity search for authority discovery; SPARQL is not used for text search.",
  },
  {
    id: "browser-assisted-playwright",
    label: "Browser-assisted search",
    group: "browser_assisted",
    provider_kind: "browser_search",
    default_enabled: true,
    default_priority: 90,
    domains: ["duckduckgo.com", "bing.com"],
    rate_limit_note: "Local Playwright search fallback. Candidate discovery only.",
  },
  {
    id: "runoob-url",
    label: "菜鸟教程",
    group: "url_only",
    provider_kind: "url_only",
    default_enabled: false,
    default_priority: 110,
    default_languages: ["zh"],
    supported_languages: ["zh"],
    domains: ["runoob.com"],
    homepage_url: "https://www.runoob.com/",
    rate_limit_note: "URL-only site-restricted discovery. No HTML body extraction in search.",
  },
  {
    id: "zhihu-url",
    label: "知乎",
    group: "url_only",
    provider_kind: "url_only",
    default_enabled: false,
    default_priority: 120,
    default_languages: ["zh"],
    supported_languages: ["zh"],
    domains: ["zhihu.com", "zhida.zhihu.com"],
    homepage_url: "https://www.zhihu.com/",
    rate_limit_note: "URL-only provider until a stable official public API is confirmed.",
  },
] as const satisfies readonly ContentProviderDefinition[];

export const DEFAULT_CONTENT_PROVIDER_SETTINGS = BUILT_IN_CONTENT_PROVIDER_DEFINITIONS.map((provider): ContentProviderSettings => {
  const definition: ContentProviderDefinition = provider;

  return {
    id: definition.id,
    enabled: definition.default_enabled,
    priority: definition.default_priority,
    languages: definition.default_languages ? [...definition.default_languages] : undefined,
    api_key_env_var: definition.api_key_env_var,
    health_status: definition.default_enabled ? "ready" : "disabled",
  };
});

export interface SearchCandidate {
  id: string;
  provider_id: string;
  provider_kind: DataServiceProviderKind;
  discovery_mode: SearchCandidateDiscoveryMode;
  query: string;
  title: string;
  url: string;
  snippet?: string;
  rank: number;
  confidence: number;
  source_type: SourceType;
  discovered_at: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchCandidateProviderRun {
  provider_id: string;
  provider_kind: DataServiceProviderKind;
  status: "completed" | "failed" | "skipped";
  candidate_count: number;
  failure_reason?: string;
}

export interface SearchCandidateRequest {
  tab_id: string;
  query: string;
  discovery_mode: SearchCandidateDiscoveryMode;
  limit?: number;
  provider_ids?: string[];
  source_url?: string;
  requested_at: string;
}

export interface SearchCandidateResult {
  candidates: SearchCandidate[];
  provider_runs: SearchCandidateProviderRun[];
  completed_at: string;
}

export interface SourceObservationRequest {
  tab_id: string;
  url: string;
  provider_id?: string;
  requested_at: string;
}

export interface SourceObservationResult {
  provider_id: string;
  provider_kind: DataServiceProviderKind;
  snapshot?: SourceSnapshot;
  failure_reason?: string;
  completed_at: string;
}

export interface ScoutObservation {
  id: string;
  tab_id: string;
  status: ScoutObservationStatus;
  adapter?: "playwright";
  layer?: LayerId;
  position_hint?: PositionHint;
  frontier_id?: string;
  discovery_mode?: ScoutDiscoveryMode;
  provider_id?: string;
  provider_kind?: DataServiceProviderKind;
  confidence?: number;
  query: string;
  title: string;
  plan_id?: string;
  target_node_ids: string[];
  url?: string;
  snippet?: string;
  source_snapshot?: SourceSnapshot;
  source_type?: SourceType;
  retrieved_at?: string;
  failure_reason?: string;
  duplicate_of?: string;
  created_at: string;
  updated_at: string;
}

export interface ScoutRunRequest {
  tab_id: string;
  plan: ScoutPlan;
  requested_at: string;
}

export interface ScoutRunResult {
  adapter: "playwright";
  observations: ScoutObservation[];
  completed_at: string;
}

export interface CartographerOutput {
  id: string;
  job_id: string;
  tab_id: string;
  mode: AgentJob["mode"];
  title: string;
  summary: string;
  source_state: SourceState;
  target_node_ids: string[];
  target_source_ids: string[];
  notes: string[];
  patch?: TerrainPatch;
  scout_plan?: ScoutPlan;
  created_at: string;
}

export interface TerrainSceneMetadata {
  title: string;
  description?: string;
  source_state: SourceState;
  generated_by: "agent" | "user" | "import";
  created_at: string;
  updated_at: string;
}

export interface TerrainScene {
  id: string;
  active_tab_id: string;
  tabs: ExplorationTab[];
  layers: TerrainLayer[];
  nodes: TerrainNode[];
  relations: TerrainRelation[];
  sources: SourceRef[];
  viewport: ViewportState;
  selection: SelectionState;
  agent_jobs: AgentJob[];
  cartographer_outputs: CartographerOutput[];
  scout_observations?: ScoutObservation[];
  runtime: TerrainRuntimeState;
  metadata: TerrainSceneMetadata;
}

export {
  assertValidTerrainScene,
  normalizeTerrainScene,
  validateTerrainScene,
  type TerrainValidationIssue,
  type TerrainValidationResult,
  type TerrainValidationSeverity,
} from "./validateTerrainScene.js";

export {
  CANONICAL_LAYER_DEFINITIONS,
  getDeepZoomLayerStops,
  getLayerDefinition,
  getLayerFocalBand,
  getLayerOrder,
  isMacroLayer,
  isTextGrainLayer,
  isTileLayer,
  type SemanticFocalBand,
  type SemanticLayerDefinition,
} from "./semanticLayers.js";
