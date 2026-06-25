import { isMacroLayer } from "@seekstar/core-schema";
import type { ScoutObservation, ScoutPlan, TerrainScene } from "@seekstar/core-schema";
import type { FrontierDirection, FrontierTrigger, ScoutObservationPlacement } from "./types.js";

export function resolveFrontierTrigger(scene: TerrainScene, viewport: TerrainScene["viewport"]): FrontierTrigger | undefined {
  if (!isMacroLayer(viewport.layer)) {
    return undefined;
  }

  const positionedNodes = scene.nodes.filter((node) => node.layer === viewport.layer && node.position_hint);

  if (positionedNodes.length === 0) {
    return undefined;
  }

  const xs = positionedNodes.map((node) => node.position_hint?.x ?? 0);
  const ys = positionedNodes.map((node) => node.position_hint?.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const margin = 520;
  let direction: FrontierDirection | undefined;

  if (viewport.x > maxX + margin) {
    direction = "east";
  } else if (viewport.x < minX - margin) {
    direction = "west";
  } else if (viewport.y > maxY + margin) {
    direction = "south";
  } else if (viewport.y < minY - margin) {
    direction = "north";
  }

  if (!direction) {
    return undefined;
  }

  const bucketX = Math.round(viewport.x / 900);
  const bucketY = Math.round(viewport.y / 900);

  return {
    id: `${scene.active_tab_id}-${viewport.layer}-${direction}-${bucketX}-${bucketY}`,
    direction,
    layer: viewport.layer,
    viewport,
  };
}

export function createFrontierScoutPlan(scene: TerrainScene, trigger: FrontierTrigger, createdAt: string): ScoutPlan {
  const activeTab = scene.tabs.find((tab) => tab.id === scene.active_tab_id) ?? scene.tabs[0];
  const layer = scene.layers.find((candidate) => candidate.id === trigger.layer);
  const seed = activeTab.seed || scene.metadata.title;
  const query = `${seed} ${layer?.label ?? trigger.layer} ${trigger.direction} adjacent sources`;

  return {
    id: `scout-plan-frontier-${trigger.id}-${Date.now()}`,
    title: `Frontier Scout: ${trigger.direction} ${trigger.layer}`,
    target_node_ids: scene.nodes
      .filter((node) => node.layer === trigger.layer)
      .slice(0, 3)
      .map((node) => node.id),
    candidate_queries: [query],
    discovery_mode: "frontier_web_search",
    source_type_targets: ["webpage", "article"],
    priority: "medium",
    stop_conditions: ["Return candidate observations only; do not create terrain facts."],
    deduplication_notes: [`Frontier ${trigger.id} should run once per viewport bucket.`],
    created_at: createdAt,
  };
}

export function createKeywordScoutPlan(query: string, targetNodeIds: string[], createdAt: string): ScoutPlan {
  const normalizedQuery = query.trim();

  return {
    id: `scout-plan-keyword-${toPlanSlug(normalizedQuery)}-${Date.now()}`,
    title: `Source discovery: ${normalizedQuery}`,
    target_node_ids: targetNodeIds,
    candidate_queries: [normalizedQuery],
    discovery_mode: "frontier_web_search",
    source_type_targets: ["webpage", "article", "document"],
    priority: "medium",
    stop_conditions: ["Return URL candidates only; do not create source-backed terrain automatically."],
    deduplication_notes: [`Keyword source discovery for ${normalizedQuery}.`],
    created_at: createdAt,
  };
}

export function createDirectUrlScoutPlan(url: string, targetNodeIds: string[], createdAt: string): ScoutPlan {
  return {
    id: `scout-plan-direct-url-${Date.now()}`,
    title: `Direct URL Scout: ${url}`,
    target_node_ids: targetNodeIds,
    candidate_queries: [url],
    discovery_mode: "direct_url",
    source_type_targets: ["webpage"],
    priority: "medium",
    stop_conditions: ["Observe the page once and return structured intake only."],
    deduplication_notes: ["Do not create source-backed terrain until the user confirms conversion."],
    created_at: createdAt,
  };
}

function toPlanSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "query";
}

export function createPageOutlinksScoutPlan(nodeId: string, sourceUrl: string, sourceTitle: string, createdAt: string): ScoutPlan {
  return {
    id: `scout-plan-outlinks-${nodeId}-${Date.now()}`,
    title: `Linked frontier Scout: ${sourceTitle}`,
    target_node_ids: [nodeId],
    candidate_queries: [sourceUrl],
    discovery_mode: "page_outlinks",
    source_type_targets: ["webpage", "article"],
    priority: "medium",
    stop_conditions: ["Extract candidate links only; do not create source-backed terrain automatically."],
    deduplication_notes: [`Use source node ${nodeId} as the telescope anchor for this outlink frontier.`],
    created_at: createdAt,
  };
}

export function positionFrontierObservations(
  observations: ScoutObservation[],
  scene: TerrainScene,
  trigger: FrontierTrigger,
): ScoutObservation[] {
  const directionVector = getFrontierDirectionVector(trigger.direction);
  const perpendicular = {
    x: -directionVector.y,
    y: directionVector.x,
  };
  const baseDistance = 420;
  const spacing = 96;
  const centerOffset = (observations.length - 1) / 2;

  return observations.map((observation, index) => ({
    ...observation,
    layer: trigger.layer,
    frontier_id: trigger.id,
    discovery_mode: observation.discovery_mode ?? "frontier_web_search",
    confidence: observation.confidence ?? (observation.status === "failed" ? 0.2 : 0.62),
    position_hint: {
      x:
        trigger.viewport.x +
        directionVector.x * (baseDistance + (index % 3) * 42) +
        perpendicular.x * (index - centerOffset) * spacing,
      y:
        trigger.viewport.y +
        directionVector.y * (baseDistance + (index % 3) * 42) +
        perpendicular.y * (index - centerOffset) * spacing,
    },
    updated_at: new Date().toISOString(),
    tab_id: scene.active_tab_id,
  }));
}

export function positionAnchoredScoutObservations(
  observations: ScoutObservation[],
  scene: TerrainScene,
  placement: ScoutObservationPlacement,
): ScoutObservation[] {
  const radius = placement.radius ?? 300;
  const angleStep = (Math.PI * 2) / Math.max(1, observations.length);

  return observations.map((observation, index) => {
    const angle = -Math.PI / 2 + angleStep * index;
    const ringOffset = Math.floor(index / 8) * 88;

    return {
      ...observation,
      layer: placement.layer,
      frontier_id: placement.frontierId,
      discovery_mode: observation.discovery_mode ?? placement.discoveryMode,
      confidence: observation.confidence ?? (observation.status === "failed" ? 0.2 : 0.66),
      position_hint: {
        x: placement.anchor.x + Math.cos(angle) * (radius + ringOffset),
        y: placement.anchor.y + Math.sin(angle) * (radius + ringOffset),
      },
      tab_id: scene.active_tab_id,
      updated_at: new Date().toISOString(),
    };
  });
}

export function createFailedScoutObservation(input: {
  tabId: string;
  plan: ScoutPlan;
  adapter?: ScoutObservation["adapter"];
  discoveryMode?: ScoutObservation["discovery_mode"];
  title: string;
  failureReason: string;
  timestamp: string;
  suffix?: string;
}): ScoutObservation {
  return {
    id: `observation-${input.plan.id}-failed-${input.suffix ?? Date.now()}`,
    tab_id: input.tabId,
    plan_id: input.plan.id,
    status: "failed",
    adapter: input.adapter ?? "playwright",
    discovery_mode: input.discoveryMode ?? input.plan.discovery_mode,
    query: input.plan.candidate_queries[0] ?? input.plan.title,
    title: input.title,
    target_node_ids: input.plan.target_node_ids,
    failure_reason: input.failureReason,
    created_at: input.timestamp,
    updated_at: input.timestamp,
  };
}

export function isDirectHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  const candidate = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getFrontierDirectionVector(direction: FrontierDirection): { x: number; y: number } {
  if (direction === "east") {
    return { x: 1, y: 0 };
  }

  if (direction === "west") {
    return { x: -1, y: 0 };
  }

  if (direction === "south") {
    return { x: 0, y: 1 };
  }

  return { x: 0, y: -1 };
}
