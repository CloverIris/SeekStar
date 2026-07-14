import type { LayerId, NodeType } from "./index.js";

export type SemanticFocalBand = "macro_gallery" | "tile_field";

export interface SemanticLayerDefinition {
  id: LayerId;
  order: number;
  label: string;
  focal_band: SemanticFocalBand;
  description: string;
  primary_node_types: readonly NodeType[];
  zoom: number;
}

export const CANONICAL_LAYER_DEFINITIONS = [
  {
    id: "supra_macro",
    order: -1,
    label: "Supra Macro",
    focal_band: "macro_gallery",
    description: "Broader systems, parent domains, and high-level orientation above the Star Gallery.",
    primary_node_types: ["domain", "topic", "concept", "fog_region", "constellation_anchor"],
    zoom: 0.86,
  },
  {
    id: "L0",
    order: 0,
    label: "Star Gallery",
    focal_band: "macro_gallery",
    description: "Domain seed pool, configurable domain seeds, fog, and scout-pending regions.",
    primary_node_types: ["domain", "topic", "concept", "question", "fog_region", "constellation_anchor"],
    zoom: 1,
  },
  {
    id: "L1",
    order: 1,
    label: "Topic Field",
    focal_band: "macro_gallery",
    description: "Topic neighborhoods, adjacent concepts, and same-layer unknown frontiers around the selected domain or seed.",
    primary_node_types: ["topic", "subtopic", "concept", "question", "fog_region"],
    zoom: 1.14,
  },
  {
    id: "L2",
    order: 2,
    label: "Source Orientation",
    focal_band: "tile_field",
    description: "Source clusters, observations, and source-backed entry points before a full tile surface.",
    primary_node_types: ["source", "webpage", "document"],
    zoom: 1.28,
  },
  {
    id: "L3",
    order: 3,
    label: "Tile Field",
    focal_band: "tile_field",
    description: "Webpage, article, PDF, image, or document tiles arranged on the content plane.",
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

export function getLayerFocalBand(layer: LayerId): SemanticFocalBand | undefined {
  return getLayerDefinition(layer)?.focal_band;
}

export function isMacroLayer(layer: LayerId): boolean {
  return getLayerFocalBand(layer) === "macro_gallery";
}

export function isTileLayer(layer: LayerId): boolean {
  return getLayerFocalBand(layer) === "tile_field";
}

export function getDeepZoomLayerStops(): Array<{ id: LayerId; zoom: number }> {
  return CANONICAL_LAYER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    zoom: definition.zoom,
  }));
}
