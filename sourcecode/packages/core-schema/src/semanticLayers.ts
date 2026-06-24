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
    id: "L-3",
    order: -3,
    label: "Global field",
    focal_band: "macro_gallery",
    description: "The widest orientation field for broad domains and unknown regions.",
    primary_node_types: ["domain", "fog_region", "constellation_anchor"],
    zoom: 0.55,
  },
  {
    id: "L-2",
    order: -2,
    label: "Domain constellation",
    focal_band: "macro_gallery",
    description: "Domain-level constellation shapes and macro gallery bubbles.",
    primary_node_types: ["domain", "topic", "fog_region", "constellation_anchor"],
    zoom: 0.68,
  },
  {
    id: "L-1",
    order: -1,
    label: "Topic region",
    focal_band: "macro_gallery",
    description: "Topic neighborhoods, adjacent fields, and scout-pending regions.",
    primary_node_types: ["topic", "subtopic", "concept", "fog_region"],
    zoom: 0.84,
  },
  {
    id: "L0",
    order: 0,
    label: "领域",
    focal_band: "macro_gallery",
    description: "The domain-level gallery where a new exploration starts before narrowing into concepts and sources.",
    primary_node_types: ["domain", "topic", "concept", "question", "fog_region"],
    zoom: 1,
  },
  {
    id: "L1",
    order: 1,
    label: "Concept neighborhood",
    focal_band: "macro_gallery",
    description: "Parent, sibling, child, and adjacent concepts around the seed.",
    primary_node_types: ["topic", "subtopic", "concept", "question"],
    zoom: 1.14,
  },
  {
    id: "L2",
    order: 2,
    label: "Source cluster",
    focal_band: "tile_field",
    description: "Source cards, evidence clusters, and source-backed entry points.",
    primary_node_types: ["source", "webpage", "document"],
    zoom: 1.28,
  },
  {
    id: "L3",
    order: 3,
    label: "Document tile",
    focal_band: "tile_field",
    description: "Webpage, article, PDF, or document tiles arranged on the content plane.",
    primary_node_types: ["webpage", "document"],
    zoom: 1.42,
  },
  {
    id: "L4",
    order: 4,
    label: "Section",
    focal_band: "tile_field",
    description: "HTML sections or document regions inside a tile.",
    primary_node_types: ["section"],
    zoom: 1.56,
  },
  {
    id: "L5",
    order: 5,
    label: "Paragraph",
    focal_band: "text_grain",
    description: "Paragraph blocks with source position mapping.",
    primary_node_types: ["paragraph"],
    zoom: 1.7,
  },
  {
    id: "L6",
    order: 6,
    label: "Sentence",
    focal_band: "text_grain",
    description: "Sentence-level grains that preserve paragraph and source range context.",
    primary_node_types: ["sentence"],
    zoom: 1.84,
  },
  {
    id: "L7",
    order: 7,
    label: "Phrase or term",
    focal_band: "text_grain",
    description: "Phrases and terms that can be inspected or promoted into new seeds.",
    primary_node_types: ["phrase"],
    zoom: 1.98,
  },
  {
    id: "L8",
    order: 8,
    label: "Word",
    focal_band: "text_grain",
    description: "Word-level grains with token mapping and seedability.",
    primary_node_types: ["word"],
    zoom: 2.12,
  },
  {
    id: "L9",
    order: 9,
    label: "Character",
    focal_band: "text_grain",
    description: "Character-level grains for close reading and language exploration.",
    primary_node_types: ["character"],
    zoom: 2.28,
  },
  {
    id: "L10",
    order: 10,
    label: "Unicode or dictionary",
    focal_band: "text_grain",
    description: "Unicode, dictionary, and glyph detail that can loop into a new seed.",
    primary_node_types: ["unicode", "dictionary_entry"],
    zoom: 2.45,
  },
  {
    id: "L11",
    order: 11,
    label: "Dictionary entry",
    focal_band: "recursive_seed",
    description: "Expanded dictionary, usage, translation, and etymology surface.",
    primary_node_types: ["dictionary_entry"],
    zoom: 2.45,
  },
  {
    id: "L12",
    order: 12,
    label: "New seed loop",
    focal_band: "recursive_seed",
    description: "A selected grain becomes an independent exploration universe.",
    primary_node_types: ["question", "concept"],
    zoom: 2.45,
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
  return CANONICAL_LAYER_DEFINITIONS.filter((definition) => definition.order >= 0 && definition.order <= 10).map((definition) => ({
    id: definition.id,
    zoom: definition.zoom,
  }));
}
