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
    id: "L0",
    order: 0,
    label: "领域",
    focal_band: "macro_gallery",
    description: "Star Gallery and seed pool: broad domains, configurable domain seeds, fog, and scout-pending regions.",
    primary_node_types: ["domain", "topic", "concept", "question", "fog_region", "constellation_anchor"],
    zoom: 1,
  },
  {
    id: "L1",
    order: 1,
    label: "主题",
    focal_band: "macro_gallery",
    description: "Topic neighborhoods, adjacent concepts, and same-layer unknown frontiers around the selected domain or seed.",
    primary_node_types: ["topic", "subtopic", "concept", "question", "fog_region"],
    zoom: 1.14,
  },
  {
    id: "L2",
    order: 2,
    label: "来源",
    focal_band: "tile_field",
    description: "Source clusters, Scout observations, and source-backed entry points before opening a full tile surface.",
    primary_node_types: ["source", "webpage", "document"],
    zoom: 1.28,
  },
  {
    id: "L3",
    order: 3,
    label: "网页 / 文档",
    focal_band: "tile_field",
    description: "Webpage, article, PDF, image, or document tiles arranged on the content plane.",
    primary_node_types: ["webpage", "document"],
    zoom: 1.42,
  },
  {
    id: "L4",
    order: 4,
    label: "章节",
    focal_band: "tile_field",
    description: "HTML sections or document regions inside a tile.",
    primary_node_types: ["section"],
    zoom: 1.56,
  },
  {
    id: "L5",
    order: 5,
    label: "段落",
    focal_band: "text_grain",
    description: "Paragraph blocks with source position mapping.",
    primary_node_types: ["paragraph"],
    zoom: 1.7,
  },
  {
    id: "L6",
    order: 6,
    label: "句子",
    focal_band: "text_grain",
    description: "Sentence-level grains that preserve paragraph and source range context.",
    primary_node_types: ["sentence"],
    zoom: 1.84,
  },
  {
    id: "L7",
    order: 7,
    label: "短语",
    focal_band: "text_grain",
    description: "Phrases and terms that can be inspected or promoted into new seeds.",
    primary_node_types: ["phrase"],
    zoom: 1.98,
  },
  {
    id: "L8",
    order: 8,
    label: "词语",
    focal_band: "text_grain",
    description: "Word-level grains with token mapping and seedability.",
    primary_node_types: ["word"],
    zoom: 2.12,
  },
  {
    id: "L9",
    order: 9,
    label: "字符",
    focal_band: "text_grain",
    description: "Character-level grains for close reading and language exploration.",
    primary_node_types: ["character"],
    zoom: 2.28,
  },
  {
    id: "L10",
    order: 10,
    label: "Unicode / 字典",
    focal_band: "text_grain",
    description: "Unicode, dictionary, glyph, translation, and usage detail for the selected character or word.",
    primary_node_types: ["unicode", "dictionary_entry"],
    zoom: 2.45,
  },
  {
    id: "L11",
    order: 11,
    label: "新的探索 seed",
    focal_band: "recursive_seed",
    description: "The selected grain becomes an independent exploration universe and starts a new 12-level telescope chain.",
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
