import type { LayerId, NodeType } from "./index.js";

export interface SemanticLayerDefinition {
  id: LayerId;
  order: number;
  label: string;
  description: string;
  primary_node_types: readonly NodeType[];
  zoom: number;
}

export const CANONICAL_LAYER_DEFINITIONS = [
  {
    id: "L0",
    order: 0,
    label: "领域",
    description: "用于建立方向感的领域、边界与主要区域。",
    primary_node_types: ["domain", "topic", "concept", "question", "fog_region", "constellation_anchor"],
    zoom: 0.82,
  },
  {
    id: "L1",
    order: 1,
    label: "主题",
    description: "领域内的主题邻域、线程、交界与问题簇。",
    primary_node_types: ["topic", "subtopic", "concept", "question", "fog_region"],
    zoom: 1,
  },
  {
    id: "L2",
    order: 2,
    label: "解释",
    description: "机制、比较、争议、实践与证据方向等可理解的解释对象。",
    primary_node_types: ["concept", "question", "generated_summary"],
    zoom: 1.2,
  },
  {
    id: "L3",
    order: 3,
    label: "来源",
    description: "经 Scout 验证并观察成功的网页、文章、PDF 或文档来源。",
    primary_node_types: ["webpage", "document"],
    zoom: 1.42,
  },
] as const satisfies readonly SemanticLayerDefinition[];

const layerDefinitionsById = new Map<LayerId, SemanticLayerDefinition>(
  CANONICAL_LAYER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getLayerDefinition(layer: LayerId): SemanticLayerDefinition | undefined {
  return layerDefinitionsById.get(layer);
}

export function getLayerOrder(layer: LayerId): number {
  return getLayerDefinition(layer)?.order ?? Number.POSITIVE_INFINITY;
}

export function getDeepZoomLayerStops(): Array<{ id: LayerId; zoom: number }> {
  return CANONICAL_LAYER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    zoom: definition.zoom,
  }));
}
