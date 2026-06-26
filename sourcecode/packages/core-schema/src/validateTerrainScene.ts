import type { TerrainNode, TerrainRelation, TerrainScene, ViewportState } from "./index.js";

export type TerrainValidationSeverity = "error" | "warning";

export interface TerrainValidationIssue {
  code: string;
  message: string;
  severity: TerrainValidationSeverity;
  path?: string;
}

export interface TerrainValidationResult {
  valid: boolean;
  issues: TerrainValidationIssue[];
}

const SOURCE_STATES = new Set([
  "source_backed",
  "cartographer_primary",
  "cartographer_unverified_source",
  "cartographer_failed",
  "user_seed",
  "local_scaffold",
  "agent_inferred",
  "weak_hypothesis",
  "generated",
  "user_note",
  "local_only",
  "fog",
]);

export function validateTerrainScene(scene: TerrainScene): TerrainValidationResult {
  const issues: TerrainValidationIssue[] = [];

  if (!scene.id?.trim()) {
    issues.push({ code: "scene.missing_id", message: "TerrainScene.id is required.", severity: "error", path: "id" });
  }

  if (!scene.active_tab_id?.trim()) {
    issues.push({
      code: "scene.missing_active_tab",
      message: "TerrainScene.active_tab_id is required.",
      severity: "error",
      path: "active_tab_id",
    });
  }

  if (!Array.isArray(scene.tabs) || scene.tabs.length === 0) {
    issues.push({ code: "scene.missing_tabs", message: "TerrainScene.tabs must contain at least one tab.", severity: "error", path: "tabs" });
  } else if (!scene.tabs.some((tab) => tab.id === scene.active_tab_id)) {
    issues.push({
      code: "scene.active_tab_missing",
      message: "active_tab_id must reference an existing tab.",
      severity: "error",
      path: "active_tab_id",
    });
  }

  if (!Array.isArray(scene.layers) || scene.layers.length === 0) {
    issues.push({ code: "scene.missing_layers", message: "TerrainScene.layers must contain at least one layer.", severity: "error", path: "layers" });
  }

  if (!isViewportState(scene.viewport)) {
    issues.push({ code: "scene.invalid_viewport", message: "TerrainScene.viewport is invalid.", severity: "error", path: "viewport" });
  }

  if (!Array.isArray(scene.nodes)) {
    issues.push({ code: "scene.invalid_nodes", message: "TerrainScene.nodes must be an array.", severity: "error", path: "nodes" });
  }

  if (!Array.isArray(scene.relations)) {
    issues.push({ code: "scene.invalid_relations", message: "TerrainScene.relations must be an array.", severity: "error", path: "relations" });
  }

  if (!Array.isArray(scene.sources)) {
    issues.push({ code: "scene.invalid_sources", message: "TerrainScene.sources must be an array.", severity: "error", path: "sources" });
  }

  if (!scene.selection?.id || !scene.selection.tab_id) {
    issues.push({ code: "scene.invalid_selection", message: "TerrainScene.selection is invalid.", severity: "error", path: "selection" });
  }

  if (!scene.metadata?.title) {
    issues.push({ code: "scene.invalid_metadata", message: "TerrainScene.metadata.title is required.", severity: "error", path: "metadata.title" });
  }

  const nodeIds = new Set<string>();

  for (const [index, node] of (scene.nodes ?? []).entries()) {
    validateNode(node, `nodes[${index}]`, nodeIds, issues);
  }

  for (const [index, relation] of (scene.relations ?? []).entries()) {
    validateRelation(relation, nodeIds, `relations[${index}]`, issues);
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

export function normalizeTerrainScene(scene: TerrainScene): TerrainScene {
  return {
    ...scene,
    tabs: scene.tabs ?? [],
    layers: scene.layers ?? [],
    nodes: scene.nodes ?? [],
    relations: scene.relations ?? [],
    sources: scene.sources ?? [],
    agent_jobs: scene.agent_jobs ?? [],
    cartographer_outputs: scene.cartographer_outputs ?? [],
    scout_observations: scene.scout_observations ?? [],
    selection: {
      ...scene.selection,
      node_ids: scene.selection?.node_ids ?? [],
      source_ids: scene.selection?.source_ids ?? [],
      text_ranges: scene.selection?.text_ranges ?? [],
    },
    viewport: scene.viewport ?? { x: 0, y: 0, zoom: 1, layer: "L0" },
    runtime: normalizeRuntimeState(scene.runtime),
  };
}

export function assertValidTerrainScene(scene: TerrainScene, context: string): TerrainScene {
  const normalized = normalizeTerrainScene(scene);
  const result = validateTerrainScene(normalized);

  if (!result.valid) {
    const summary = result.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid TerrainScene (${context}): ${summary}`);
  }

  return normalized;
}

function validateNode(node: TerrainNode, path: string, nodeIds: Set<string>, issues: TerrainValidationIssue[]): void {
  if (!node.id?.trim()) {
    issues.push({ code: "node.missing_id", message: "TerrainNode.id is required.", severity: "error", path: `${path}.id` });
    return;
  }

  if (nodeIds.has(node.id)) {
    issues.push({ code: "node.duplicate_id", message: `Duplicate node id: ${node.id}`, severity: "error", path: `${path}.id` });
  } else {
    nodeIds.add(node.id);
  }

  if (!node.title?.trim()) {
    issues.push({ code: "node.missing_title", message: `Node ${node.id} is missing title.`, severity: "warning", path: `${path}.title` });
  }

  if (!node.layer) {
    issues.push({ code: "node.missing_layer", message: `Node ${node.id} is missing layer.`, severity: "error", path: `${path}.layer` });
  }

  if (!SOURCE_STATES.has(node.source_state)) {
    issues.push({
      code: "node.invalid_source_state",
      message: `Node ${node.id} has invalid source_state.`,
      severity: "error",
      path: `${path}.source_state`,
    });
  }

  if (node.confidence < 0 || node.confidence > 1) {
    issues.push({
      code: "node.invalid_confidence",
      message: `Node ${node.id} confidence must be between 0 and 1.`,
      severity: "warning",
      path: `${path}.confidence`,
    });
  }
}

function validateRelation(
  relation: TerrainRelation,
  nodeIds: Set<string>,
  path: string,
  issues: TerrainValidationIssue[],
): void {
  if (!relation.id?.trim()) {
    issues.push({ code: "relation.missing_id", message: "TerrainRelation.id is required.", severity: "error", path: `${path}.id` });
    return;
  }

  if (!nodeIds.has(relation.from)) {
    issues.push({
      code: "relation.missing_from",
      message: `Relation ${relation.id} references missing from node ${relation.from}.`,
      severity: "error",
      path: `${path}.from`,
    });
  }

  if (!nodeIds.has(relation.to)) {
    issues.push({
      code: "relation.missing_to",
      message: `Relation ${relation.id} references missing to node ${relation.to}.`,
      severity: "error",
      path: `${path}.to`,
    });
  }
}

function isViewportState(value: unknown): value is ViewportState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ViewportState>;
  return (
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.zoom === "number" &&
    typeof candidate.layer === "string"
  );
}

function normalizeRuntimeState(value: unknown): TerrainScene["runtime"] {
  const candidate = typeof value === "object" && value !== null ? (value as Partial<TerrainScene["runtime"]>) : {};
  const absorption =
    typeof candidate.browser_absorption === "object" && candidate.browser_absorption !== null
      ? candidate.browser_absorption
      : undefined;
  const now = new Date().toISOString();
  const status = absorption?.status === "absorbed" ? "absorbed" : "idle";

  return {
    focused_node_id:
      typeof candidate.focused_node_id === "string" && candidate.focused_node_id.trim()
        ? candidate.focused_node_id.trim()
        : undefined,
    browser_absorption: {
      status,
      node_id: typeof absorption?.node_id === "string" && absorption.node_id.trim() ? absorption.node_id.trim() : undefined,
      source_id: typeof absorption?.source_id === "string" && absorption.source_id.trim() ? absorption.source_id.trim() : undefined,
      source_url: typeof absorption?.source_url === "string" && absorption.source_url.trim() ? absorption.source_url.trim() : undefined,
      entered_at: typeof absorption?.entered_at === "string" ? absorption.entered_at : undefined,
      exit_layer: typeof absorption?.exit_layer === "string" ? absorption.exit_layer : "L3",
      trigger:
        absorption?.trigger === "threshold" || absorption?.trigger === "click" || absorption?.trigger === "command"
          ? absorption.trigger
          : undefined,
    },
    updated_at: typeof candidate.updated_at === "string" ? candidate.updated_at : now,
  };
}

