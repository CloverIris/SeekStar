import type { LayerId, TerrainLayer, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";

const createdAt = "2026-06-23T00:00:00.000Z";
const sceneId = "scene-unknown-unknowns-deep-zoom";
const tabId = "tab-unknown-unknowns-deep-zoom";

const layerDefinitions: Array<[LayerId, string]> = [
  ["L0", "Seed Field"],
  ["L1", "Topic Neighborhood"],
  ["L2", "Source Orientation"],
  ["L3", "Document Tile"],
  ["L4", "Section"],
  ["L5", "Paragraph"],
  ["L6", "Sentence"],
  ["L7", "Phrase / Word"],
  ["L8", "Character"],
  ["L9", "Unicode / Dictionary"],
  ["L10", "New Seed Loop"],
];

const spineNodeIds = [
  "node-duz-seed",
  "node-duz-question-discovery",
  "node-duz-mock-source",
  "node-duz-document",
  "node-duz-section",
  "node-duz-paragraph",
  "node-duz-sentence",
  "node-duz-word",
  "node-duz-character",
  "node-duz-unicode",
  "node-duz-new-seed-loop",
];

export const unknownUnknownsDeepZoomScene: TerrainScene = {
  id: sceneId,
  active_tab_id: tabId,
  tabs: [
    {
      id: tabId,
      title: "Unknown Unknowns",
      seed: "Unknown Unknowns",
      source_mode: "opening_sky",
      current_layer: "L0",
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
        layer: "L0",
      },
      node_ids: spineNodeIds,
      relation_ids: [
        "rel-duz-seed-topic",
        "rel-duz-topic-source",
        "rel-duz-source-document",
        "rel-duz-document-section",
        "rel-duz-section-paragraph",
        "rel-duz-paragraph-sentence",
        "rel-duz-sentence-word",
        "rel-duz-word-character",
        "rel-duz-character-unicode",
        "rel-duz-unicode-loop",
      ],
      source_ids: [],
      created_at: createdAt,
      updated_at: createdAt,
    },
  ],
  layers: createDeepLayers(),
  nodes: createDeepNodes(),
  relations: createDeepRelations(),
  sources: [],
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
    layer: "L0",
  },
  selection: {
    id: "selection-empty-unknown-unknowns",
    tab_id: tabId,
    node_ids: [],
    source_ids: [],
    text_ranges: [],
    created_at: createdAt,
  },
  agent_jobs: [],
  cartographer_outputs: [],
  metadata: {
    title: "Unknown Unknowns",
    description: "Mock-only deep zoom spine from seed to text grain, Unicode/dictionary, and new seed loop.",
    source_state: "generated",
    generated_by: "fixture",
    created_at: createdAt,
    updated_at: createdAt,
  },
};

function createDeepLayers(): TerrainLayer[] {
  return layerDefinitions.map(([id, label], index) => ({
    id,
    label,
    parent_layer_id: index > 0 ? layerDefinitions[index - 1][0] : undefined,
    child_layer_ids: index < layerDefinitions.length - 1 ? [layerDefinitions[index + 1][0]] : [],
    breadcrumb: ["Unknown Unknowns", ...layerDefinitions.slice(0, index + 1).map(([, layerLabel]) => layerLabel)],
  }));
}

function createDeepNodes(): TerrainNode[] {
  const breadcrumbBase = ["Unknown Unknowns"];

  return [
    createNode({
      id: "node-duz-seed",
      type: "concept",
      title: "Unknown Unknowns",
      layer: "L0",
      state: "generated",
      tags: ["seed", "deep-zoom", "mock-generated"],
      summary: "A mock seed for proving recursive semantic zoom before real cartographer output exists.",
      childIds: ["node-duz-question-discovery"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Seed Field"],
      zoomTarget: { layer: "L1", node_id: "node-duz-question-discovery", zoom: 1.18 },
    }),
    createNode({
      id: "node-duz-question-discovery",
      type: "topic",
      title: "Question discovery",
      layer: "L1",
      state: "agent_inferred",
      tags: ["topic", "orientation", "mock-inferred"],
      summary: "The user may not know the question yet; the map should reveal where questions can be born.",
      parentId: "node-duz-seed",
      childIds: ["node-duz-mock-source"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Topic Neighborhood", "Question discovery"],
      zoomTarget: { layer: "L2", node_id: "node-duz-mock-source", zoom: 1.3 },
    }),
    createNode({
      id: "node-duz-mock-source",
      type: "source",
      title: "Mock article source",
      layer: "L2",
      state: "generated",
      tags: ["source-orientation", "mock-source", "not-retrieved"],
      summary: "A generated source-orientation card. It is not a fetched page and has no external provenance.",
      parentId: "node-duz-question-discovery",
      childIds: ["node-duz-document"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Source Orientation", "Mock article source"],
      zoomTarget: { layer: "L3", node_id: "node-duz-document", zoom: 1.42 },
    }),
    createNode({
      id: "node-duz-document",
      type: "document",
      title: "Mock article card",
      layer: "L3",
      state: "generated",
      tags: ["document-tile", "mock-article", "not-a-browser"],
      summary: "A document tile placeholder for future webpage/document planes. It is a local mock card, not a browser view.",
      parentId: "node-duz-mock-source",
      childIds: ["node-duz-section"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Document Tile", "Mock article card"],
      zoomTarget: { layer: "L4", node_id: "node-duz-section", zoom: 1.54 },
    }),
    createNode({
      id: "node-duz-section",
      type: "section",
      title: "Why input boxes fail exploration",
      layer: "L4",
      state: "generated",
      tags: ["section", "mock-text"],
      summary: "A mock section showing why prompt-first interfaces collapse exploration too early.",
      parentId: "node-duz-document",
      childIds: ["node-duz-paragraph"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Section", "Why input boxes fail exploration"],
      zoomTarget: { layer: "L5", node_id: "node-duz-paragraph", zoom: 1.66 },
    }),
    createNode({
      id: "node-duz-paragraph",
      type: "paragraph",
      title: "A map should hold uncertainty open",
      layer: "L5",
      state: "generated",
      tags: ["paragraph", "mock-text-grain"],
      summary:
        "When an interface begins with an input box, it asks the user to compress uncertainty into a phrase before the terrain is visible.",
      parentId: "node-duz-section",
      childIds: ["node-duz-sentence"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Paragraph", "A map should hold uncertainty open"],
      sourceRange: {
        locator: "mock-article#paragraph-1",
        start: 0,
        end: 117,
        excerpt:
          "When an interface begins with an input box, it asks the user to compress uncertainty into a phrase before the terrain is visible.",
      },
      tokenRange: { start_token: 0, end_token: 18, text: "When an interface begins with an input box..." },
      zoomTarget: { layer: "L6", node_id: "node-duz-sentence", zoom: 1.78 },
    }),
    createNode({
      id: "node-duz-sentence",
      type: "sentence",
      title: "The terrain should appear before the question is finished.",
      layer: "L6",
      state: "generated",
      tags: ["sentence", "mock-text-grain"],
      summary: "A mock sentence grain proving that document text can become map terrain.",
      parentId: "node-duz-paragraph",
      childIds: ["node-duz-word"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Sentence", "The terrain should appear before the question is finished."],
      sourceRange: {
        locator: "mock-article#sentence-1",
        start: 118,
        end: 171,
        excerpt: "The terrain should appear before the question is finished.",
      },
      tokenRange: { start_token: 19, end_token: 27, text: "The terrain should appear before the question is finished." },
      zoomTarget: { layer: "L7", node_id: "node-duz-word", zoom: 1.9 },
    }),
    createNode({
      id: "node-duz-word",
      type: "phrase",
      title: "unknown unknowns",
      layer: "L7",
      state: "agent_inferred",
      tags: ["phrase", "word-chip", "seedable"],
      summary: "A phrase chip that can be inspected, split into characters, or become a new seed.",
      parentId: "node-duz-sentence",
      childIds: ["node-duz-character"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Phrase / Word", "unknown unknowns"],
      tokenRange: { start_token: 7, end_token: 9, text: "unknown unknowns" },
      zoomTarget: { layer: "L8", node_id: "node-duz-character", zoom: 2.02 },
      canCreateSeed: true,
    }),
    createNode({
      id: "node-duz-character",
      type: "character",
      title: "u",
      layer: "L8",
      state: "generated",
      tags: ["character", "glyph", "seedable"],
      summary: "A character tile from the phrase 'unknown unknowns'.",
      parentId: "node-duz-word",
      childIds: ["node-duz-unicode"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Character", "u"],
      tokenRange: { start_token: 7, end_token: 7, text: "u" },
      zoomTarget: { layer: "L9", node_id: "node-duz-unicode", zoom: 2.14 },
      canCreateSeed: true,
    }),
    createNode({
      id: "node-duz-unicode",
      type: "dictionary_entry",
      title: "U+0075 LATIN SMALL LETTER U",
      layer: "L9",
      state: "generated",
      tags: ["unicode", "dictionary", "seedable", "mock-definition"],
      summary: "Mock Unicode/dictionary card: lowercase letter u, used here as a language-grain endpoint before looping into a new seed.",
      parentId: "node-duz-character",
      childIds: ["node-duz-new-seed-loop"],
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "Unicode / Dictionary", "U+0075"],
      zoomTarget: { layer: "L10", node_id: "node-duz-new-seed-loop", zoom: 2.26 },
      canCreateSeed: true,
    }),
    createNode({
      id: "node-duz-new-seed-loop",
      type: "constellation_anchor",
      title: "Loop this grain into a new seed",
      layer: "L10",
      state: "weak_hypothesis",
      tags: ["new-seed-loop", "recursive-depth", "mock-only"],
      summary: "The spine ends by turning a selected word, character, or dictionary card into a fresh L0 exploration universe.",
      parentId: "node-duz-unicode",
      position: { x: 0, y: 0 },
      breadcrumb: [...breadcrumbBase, "New Seed Loop"],
      canCreateSeed: true,
    }),
  ];
}

function createDeepRelations(): TerrainRelation[] {
  return [
    relation("rel-duz-seed-topic", "node-duz-seed", "node-duz-question-discovery"),
    relation("rel-duz-topic-source", "node-duz-question-discovery", "node-duz-mock-source"),
    relation("rel-duz-source-document", "node-duz-mock-source", "node-duz-document"),
    relation("rel-duz-document-section", "node-duz-document", "node-duz-section"),
    relation("rel-duz-section-paragraph", "node-duz-section", "node-duz-paragraph"),
    relation("rel-duz-paragraph-sentence", "node-duz-paragraph", "node-duz-sentence"),
    relation("rel-duz-sentence-word", "node-duz-sentence", "node-duz-word"),
    relation("rel-duz-word-character", "node-duz-word", "node-duz-character"),
    relation("rel-duz-character-unicode", "node-duz-character", "node-duz-unicode"),
    relation("rel-duz-unicode-loop", "node-duz-unicode", "node-duz-new-seed-loop", "weak_hypothesis"),
  ];
}

function createNode({
  breadcrumb,
  canCreateSeed = false,
  childIds,
  id,
  layer,
  parentId,
  position,
  sourceRange,
  state,
  summary,
  tags,
  title,
  tokenRange,
  type,
  zoomTarget,
}: {
  breadcrumb: string[];
  canCreateSeed?: boolean;
  childIds?: string[];
  id: string;
  layer: LayerId;
  parentId?: string;
  position: { x: number; y: number };
  sourceRange?: TerrainNode["source_range"];
  state: TerrainNode["source_state"];
  summary: string;
  tags: string[];
  title: string;
  tokenRange?: TerrainNode["token_range"];
  type: TerrainNode["type"];
  zoomTarget?: TerrainNode["zoom_target"];
}): TerrainNode {
  return {
    id,
    type,
    title,
    layer,
    source_state: state,
    confidence: state === "weak_hypothesis" ? 0.32 : 0.58,
    importance: layer === "L0" ? 1 : 0.72,
    tags,
    summary,
    parent_id: parentId,
    child_ids: childIds,
    semantic_breadcrumb: breadcrumb,
    source_range: sourceRange,
    token_range: tokenRange,
    zoom_target: zoomTarget,
    child_layer_id: zoomTarget?.layer,
    can_create_seed: canCreateSeed,
    created_from: {
      tab_id: tabId,
      node_id: parentId,
      layer,
      label: breadcrumb.join(" / "),
      excerpt: summary,
    },
    position_hint: position,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function relation(
  id: string,
  from: string,
  to: string,
  sourceState: TerrainRelation["source_state"] = "agent_inferred",
): TerrainRelation {
  return {
    id,
    from,
    to,
    type: "parent_child",
    confidence: sourceState === "weak_hypothesis" ? 0.34 : 0.52,
    explanation: "Mock deep zoom spine relation. It preserves semantic depth orientation and is not source-backed evidence.",
    source_state: sourceState,
  };
}
