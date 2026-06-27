import type { LayerId, NodeType } from "./index.js";

export type SemanticFocalBand = "macro_gallery" | "tile_field" | "text_grain" | "recursive_seed";

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
  {
    id: "L4",
    order: 4,
    label: "Deep Lens",
    focal_band: "text_grain",
    description: "Continuous close-reading lens over sections, paragraphs, sentences, phrases, words, and characters.",
    primary_node_types: ["section"],
    zoom: 1.62,
  },
  {
    id: "L5",
    order: 5,
    label: "Paragraph",
    focal_band: "text_grain",
    description: "Internal Deep Lens paragraph address with source position mapping.",
    primary_node_types: ["paragraph"],
    zoom: 1.76,
  },
  {
    id: "L6",
    order: 6,
    label: "Sentence",
    focal_band: "text_grain",
    description: "Internal Deep Lens sentence address that preserves paragraph and source range context.",
    primary_node_types: ["sentence"],
    zoom: 1.9,
  },
  {
    id: "L7",
    order: 7,
    label: "Phrase",
    focal_band: "text_grain",
    description: "Internal Deep Lens phrase address that can be inspected or promoted into a new seed.",
    primary_node_types: ["phrase"],
    zoom: 2.04,
  },
  {
    id: "L8",
    order: 8,
    label: "Word",
    focal_band: "text_grain",
    description: "Internal Deep Lens word address with token mapping and seedability.",
    primary_node_types: ["word"],
    zoom: 2.18,
  },
  {
    id: "L9",
    order: 9,
    label: "Character",
    focal_band: "text_grain",
    description: "Internal Deep Lens character address for close reading and language exploration.",
    primary_node_types: ["character"],
    zoom: 2.32,
  },
  {
    id: "L10",
    order: 10,
    label: "Unicode / Dictionary",
    focal_band: "text_grain",
    description: "Internal Unicode, dictionary, glyph, translation, and usage detail for the selected character or word.",
    primary_node_types: ["unicode", "dictionary_entry"],
    zoom: 2.48,
  },
  {
    id: "L11",
    order: 11,
    label: "Recursive Seed",
    focal_band: "recursive_seed",
    description: "The selected grain becomes an independent exploration universe.",
    primary_node_types: ["question", "concept"],
    zoom: 2.64,
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

export function isTextGrainLayer(layer: LayerId): boolean {
  return getLayerFocalBand(layer) === "text_grain";
}

export function getDeepZoomLayerStops(): Array<{ id: LayerId; zoom: number }> {
  return CANONICAL_LAYER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    zoom: definition.zoom,
  }));
}
