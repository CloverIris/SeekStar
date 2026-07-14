import { getLayerDefinition } from "@seekstar/core-schema";
import type { AgentJob, AgentJobStatus, ExplorationTab, SourceRef, SourceState, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";
export type PersistenceStatus = "loading" | "saving" | "saved" | "error" | "unavailable";
export type { ScoutObservationPlacement } from "@seekstar/constellation-engine";

export function formatPersistenceStatus(status: PersistenceStatus): string {
  if (status === "loading") {
    return "Loading local trail";
  }

  if (status === "saving") {
    return "Saving trail";
  }

  if (status === "saved") {
    return "Saved trail";
  }

  if (status === "error") {
    return "Trail save issue";
  }

  if (status === "unavailable") {
    return "Trail local only";
  }

  return "Unsaved changes";
}

export function getActiveTab(scene: TerrainScene): ExplorationTab {
  return scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];
}

export function getActiveLayer(scene: TerrainScene): TerrainScene["layers"][number] | undefined {
  return scene.layers.find((layer) => layer.id === scene.viewport.layer);
}

export function getActiveLayerLabel(scene: TerrainScene): string {
  return getVisibleLayerLabel(scene.viewport.layer);
}

export function getActiveLayerBreadcrumb(scene: TerrainScene): string[] {
  const activeTab = getActiveTab(scene);
  const label = getActiveLayerLabel(scene);
  return scene.layers.find((layer) => layer.id === scene.viewport.layer)?.breadcrumb ?? [activeTab.seed, label];
}

export function getVisibleLayerLabel(layer: TerrainScene["viewport"]["layer"]): string {
  return getLayerDefinition(layer)?.label ?? layer;
}

export function getRelationNodes(scene: TerrainScene, relation: TerrainRelation): { from?: TerrainNode; to?: TerrainNode } {
  return {
    from: scene.nodes.find((node) => node.id === relation.from),
    to: scene.nodes.find((node) => node.id === relation.to),
  };
}

export function getSourceForNode(scene: TerrainScene, node: TerrainNode): SourceRef | undefined {
  if (node.source_id) {
    return scene.sources.find((source) => source.id === node.source_id);
  }

  return scene.sources.find((source) => {
    if (node.source_url && source.url === node.source_url) {
      return true;
    }

    return Boolean(node.source_title && source.title === node.source_title);
  });
}

export function getSourceRelationsForNode(scene: TerrainScene, node: TerrainNode): TerrainRelation[] {
  return scene.relations.filter((relation) => relation.from === node.id || relation.to === node.id);
}

export function getSourceStateCounts(nodes: TerrainNode[]): Partial<Record<SourceState, number>> {
  return nodes.reduce<Partial<Record<SourceState, number>>>((counts, node) => {
    counts[node.source_state] = (counts[node.source_state] ?? 0) + 1;
    return counts;
  }, {});
}

export function getJobStatusCounts(jobs: AgentJob[]): Partial<Record<AgentJobStatus, number>> {
  return jobs.reduce<Partial<Record<AgentJobStatus, number>>>((counts, job) => {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
    return counts;
  }, {});
}

export function formatSourceState(state: SourceState): string {
  return state.replace(/_/g, " ");
}

export function getAgentJobState(statuses: AgentJobStatus[]): string {
  if (statuses.length === 0) {
    return "Idle";
  }

  if (statuses.some((status) => status === "running")) {
    return "Running";
  }

  if (statuses.some((status) => status === "queued")) {
    return "Queued";
  }

  if (statuses.some((status) => status === "failed")) {
    return "Needs review";
  }

  return "Complete";
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
