export type SourceState =
  | "source_backed"
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
  | "L-3"
  | "L-2"
  | "L-1"
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
  | "L12"
  | (string & {});

export type SourceType =
  | "webpage"
  | "document"
  | "article"
  | "local_file"
  | "dictionary"
  | "generated_summary"
  | "unknown";

export type AgentJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface PositionHint {
  x: number;
  y: number;
  z?: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
  layer: LayerId;
}

export type CameraState = ViewportState;

export interface Workspace {
  id: string;
  name: string;
  active_tab_id: string;
  tabs: ExplorationTab[];
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
  source_title?: string;
  source_type?: SourceType;
  retrieved_at?: string;
  parent_id?: string;
  child_ids?: string[];
  relation_ids?: string[];
  semantic_axes?: string[];
  position_hint?: PositionHint;
  quote?: string;
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
    | "region_explainer"
    | "markdown_export";
  status: AgentJobStatus;
  input_summary: string;
  created_at: string;
  updated_at: string;
}

export interface TerrainSceneMetadata {
  title: string;
  description?: string;
  source_state: SourceState;
  generated_by: "fixture" | "agent" | "user" | "import";
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
  metadata: TerrainSceneMetadata;
}
