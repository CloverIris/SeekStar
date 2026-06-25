import { CANONICAL_LAYER_DEFINITIONS } from "@seekstar/core-schema";
import type { Backlink, ExplorationTab, LayerId, TerrainLayer, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";
import type { DomainLexicon } from "./domainLexicon.js";

let seedSceneCounter = 0;

export interface SeedSceneOptions {
  domainLexicon?: DomainLexicon;
  parentBacklink?: Backlink;
  sceneId?: string;
  sourceMode?: ExplorationTab["source_mode"];
  tabId?: string;
  timestamp?: string;
}

export function createSeedScene(seedText: string, options: SeedSceneOptions = {}): TerrainScene {
  seedSceneCounter += 1;

  const seed = seedText.trim() || "Untitled exploration";
  const slug = toSlug(seed);
  const createdAt = options.timestamp ?? new Date().toISOString();
  const stamp = `${Date.now()}-${seedSceneCounter}`;
  const sceneId = options.sceneId ?? `scene-${slug}-${stamp}`;
  const tabId = options.tabId ?? `tab-${slug}-${stamp}`;
  const ids = {
    seed: `node-${slug}-seed-${stamp}`,
    context: `node-${slug}-context-${stamp}`,
    terms: `node-${slug}-terms-${stamp}`,
    frontier: `node-${slug}-frontier-${stamp}`,
    source: `node-${slug}-source-intake-${stamp}`,
    document: `node-${slug}-document-tile-${stamp}`,
    section: `node-${slug}-section-${stamp}`,
    paragraph: `node-${slug}-paragraph-${stamp}`,
    sentence: `node-${slug}-sentence-${stamp}`,
    phrase: `node-${slug}-phrase-${stamp}`,
    word: `node-${slug}-word-${stamp}`,
    character: `node-${slug}-character-${stamp}`,
    unicode: `node-${slug}-unicode-${stamp}`,
    seedLoop: `node-${slug}-seed-loop-${stamp}`,
  };
  const terms = deriveSeedTerms(seed);
  const phrase = terms.slice(0, 2).join(" ") || seed;
  const word = terms[0] ?? seed;
  const character = Array.from(word)[0] ?? Array.from(seed)[0] ?? "?";
  const codePoint = character.codePointAt(0) ?? 0;
  const unicodeTitle = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} ${character}`;
  const domainTerms = (options.domainLexicon?.terms ?? []).filter((term) => term.enabled).slice(0, 24);
  const domainNodeIds = domainTerms.map((term, index) => {
    const termKey = term.id.trim() || term.canonical.trim() || `term-${index + 1}`;

    return `node-${slug}-domain-${toSlug(termKey)}-${index + 1}-${stamp}`;
  });
  const domainNodes: TerrainNode[] = domainTerms.map((term, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(domainTerms.length, 1) - Math.PI / 2;
    const ring = 390 + (index % 2) * 90;
    const title = term.labels["zh-Hans"]?.trim() || term.labels.en?.trim() || term.canonical;
    const labelSummary = Object.entries(term.labels)
      .filter(([, label]) => label.trim())
      .map(([language, label]) => `${language}: ${label}`)
      .join(", ");

    return node({
      id: domainNodeIds[index],
      title,
      type: "domain",
      layer: "L0",
      state: "local_only",
      confidence: 0.66,
      importance: 0.82,
      tags: ["domain", "lexicon", ...(term.tags ?? [])],
      summary: `${term.canonical} is a configurable L0 domain seed. ${labelSummary ? `Language labels: ${labelSummary}.` : "No language labels configured."}`,
      position: { x: Math.round(Math.cos(angle) * ring), y: Math.round(Math.sin(angle) * ring) },
      parentId: ids.seed,
      zoomTarget: { layer: "L1", node_id: ids.context, zoom: 1.14 },
      breadcrumb: [seed, "领域", title],
      tabId,
      createdAt,
      canCreateSeed: true,
    });
  });
  const nodes: TerrainNode[] = [
    node({
      id: ids.seed,
      title: seed,
      type: "concept",
      layer: "L0",
      state: "local_only",
      confidence: 0.72,
      importance: 1,
      tags: ["seed", "local", "telescope-origin"],
      summary: `Local seed object for exploring "${seed}". It starts the telescope without pretending that external evidence or AI synthesis exists yet.`,
      position: { x: 0, y: 0 },
      childIds: [ids.context, ids.terms, ids.frontier, ids.source, ...domainNodeIds],
      zoomTarget: { layer: "L1", node_id: ids.context, zoom: 1.14 },
      breadcrumb: [seed, "领域"],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    ...domainNodes,
    node({
      id: ids.context,
      title: `${seed} context`,
      type: "concept",
      layer: "L1",
      state: "local_only",
      confidence: 0.48,
      importance: 0.74,
      tags: ["local-candidate", "context"],
      summary: "A local heuristic context candidate derived from the seed text. It is a direction to inspect, not a model conclusion.",
      position: { x: -240, y: -80 },
      parentId: ids.seed,
      zoomTarget: { layer: "L2", node_id: ids.source, zoom: 1.28 },
      breadcrumb: [seed, "主题", "Context"],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.terms,
      title: `${seed} terms`,
      type: "concept",
      layer: "L1",
      state: "local_only",
      confidence: 0.52,
      importance: 0.7,
      tags: ["local-candidate", "terms"],
      summary: `Seed terms detected locally: ${terms.join(", ") || seed}.`,
      position: { x: 230, y: -90 },
      parentId: ids.seed,
      zoomTarget: { layer: "L7", node_id: ids.phrase, zoom: 1.98 },
      breadcrumb: [seed, "主题", "Terms"],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.frontier,
      title: `${seed} frontier`,
      type: "fog_region",
      layer: "L1",
      state: "fog",
      confidence: 0.24,
      importance: 0.68,
      tags: ["frontier", "fog", "needs-scout"],
      summary: "Unexplored same-layer frontier. Moving the telescope toward this edge can request Scout observations.",
      position: { x: 0, y: -280 },
      parentId: ids.seed,
      breadcrumb: [seed, "主题", "Frontier"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.source,
      title: "Source intake",
      type: "source",
      layer: "L2",
      state: "local_only",
      confidence: 0.4,
      importance: 0.72,
      tags: ["source-intake", "awaiting-scout"],
      summary: "No source has been attached yet. Add text, Scout a direct URL, or confirm a Scout observation to create source-backed terrain.",
      position: { x: 0, y: 0 },
      parentId: ids.context,
      childIds: [ids.document],
      zoomTarget: { layer: "L3", node_id: ids.document, zoom: 1.42 },
      breadcrumb: [seed, "来源", "Source intake"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.document,
      title: "Document tile intake",
      type: "document",
      layer: "L3",
      state: "local_only",
      confidence: 0.38,
      importance: 0.66,
      tags: ["tile-field", "awaiting-source"],
      summary: "The tile field is ready, but real webpage or document content must enter through source intake.",
      position: { x: 0, y: 0 },
      parentId: ids.source,
      childIds: [ids.section],
      zoomTarget: { layer: "L4", node_id: ids.section, zoom: 1.56 },
      breadcrumb: [seed, "网页 / 文档"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.section,
      title: "Section grain pending",
      type: "section",
      layer: "L4",
      state: "local_only",
      confidence: 0.34,
      importance: 0.6,
      tags: ["section", "awaiting-source"],
      summary: "Section-level terrain will be created from confirmed source snapshots.",
      position: { x: 0, y: 0 },
      parentId: ids.document,
      childIds: [ids.paragraph],
      zoomTarget: { layer: "L5", node_id: ids.paragraph, zoom: 1.7 },
      breadcrumb: [seed, "章节"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.paragraph,
      title: "Paragraph grain pending",
      type: "paragraph",
      layer: "L5",
      state: "local_only",
      confidence: 0.34,
      importance: 0.6,
      tags: ["paragraph", "awaiting-source"],
      summary: "Paragraph terrain stays empty until a real source snapshot provides text ranges.",
      position: { x: 0, y: 0 },
      parentId: ids.section,
      childIds: [ids.sentence],
      zoomTarget: { layer: "L6", node_id: ids.sentence, zoom: 1.84 },
      breadcrumb: [seed, "段落"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.sentence,
      title: "Sentence grain pending",
      type: "sentence",
      layer: "L6",
      state: "local_only",
      confidence: 0.34,
      importance: 0.58,
      tags: ["sentence", "awaiting-source"],
      summary: "Sentence grains will preserve source ranges after source terrain is confirmed.",
      position: { x: 0, y: 0 },
      parentId: ids.paragraph,
      childIds: [ids.phrase],
      zoomTarget: { layer: "L7", node_id: ids.phrase, zoom: 1.98 },
      breadcrumb: [seed, "句子"],
      tabId,
      createdAt,
    }),
    node({
      id: ids.phrase,
      title: phrase,
      type: "phrase",
      layer: "L7",
      state: "local_only",
      confidence: 0.54,
      importance: 0.68,
      tags: ["phrase", "seedable", "local-token"],
      summary: "A seed-derived phrase grain. It can become a new exploration seed before any external source is attached.",
      position: { x: 0, y: 0 },
      parentId: ids.sentence,
      childIds: [ids.word],
      zoomTarget: { layer: "L8", node_id: ids.word, zoom: 2.12 },
      breadcrumb: [seed, "短语", phrase],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.word,
      title: word,
      type: "word",
      layer: "L8",
      state: "local_only",
      confidence: 0.58,
      importance: 0.68,
      tags: ["word", "seedable", "local-token"],
      summary: "A local word grain extracted from the seed text.",
      position: { x: 0, y: 0 },
      parentId: ids.phrase,
      childIds: [ids.character],
      zoomTarget: { layer: "L9", node_id: ids.character, zoom: 2.28 },
      breadcrumb: [seed, "词语", word],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.character,
      title: character,
      type: "character",
      layer: "L9",
      state: "local_only",
      confidence: 0.62,
      importance: 0.62,
      tags: ["character", "seedable", "local-token"],
      summary: "A local character grain extracted from the seed text.",
      position: { x: 0, y: 0 },
      parentId: ids.word,
      childIds: [ids.unicode],
      zoomTarget: { layer: "L10", node_id: ids.unicode, zoom: 2.45 },
      breadcrumb: [seed, "字符", character],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.unicode,
      title: unicodeTitle,
      type: "unicode",
      layer: "L10",
      state: "local_only",
      confidence: 0.7,
      importance: 0.6,
      tags: ["unicode", "local-deterministic", "seedable"],
      summary: "Deterministic Unicode detail from the selected character. It is local computation, not an external dictionary claim.",
      position: { x: 0, y: 0 },
      parentId: ids.character,
      childIds: [ids.seedLoop],
      zoomTarget: { layer: "L11", node_id: ids.seedLoop, zoom: 2.64 },
      breadcrumb: [seed, "Unicode / 字典", unicodeTitle],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
    node({
      id: ids.seedLoop,
      title: `Explore ${character} as seed`,
      type: "question",
      layer: "L11",
      state: "local_only",
      confidence: 0.66,
      importance: 0.64,
      tags: ["recursive-seed", "seedable", "local-token"],
      summary: "Recursive seed loop. This grain can open an independent SeekStar tab and become the center of a new 12-level map.",
      position: { x: 0, y: 0 },
      parentId: ids.unicode,
      breadcrumb: [seed, "新的探索 seed", character],
      tabId,
      createdAt,
      canCreateSeed: true,
    }),
  ];
  const relations: TerrainRelation[] = [
    relation(ids.seed, ids.context, "parent_child", 0.5, createdAt, slug, "context"),
    relation(ids.seed, ids.terms, "semantic_similarity", 0.48, createdAt, slug, "terms"),
    relation(ids.seed, ids.frontier, "agent_inferred", 0.28, createdAt, slug, "frontier", "fog"),
    ...domainNodeIds.map((domainNodeId, index) =>
      relation(ids.seed, domainNodeId, "semantic_similarity", 0.52, createdAt, slug, `domain-${index}`),
    ),
    relation(ids.context, ids.source, "parent_child", 0.42, createdAt, slug, "source"),
    relation(ids.source, ids.document, "source_contains", 0.36, createdAt, slug, "document"),
    relation(ids.document, ids.section, "source_contains", 0.34, createdAt, slug, "section"),
    relation(ids.section, ids.paragraph, "source_contains", 0.34, createdAt, slug, "paragraph"),
    relation(ids.paragraph, ids.sentence, "source_contains", 0.34, createdAt, slug, "sentence"),
    relation(ids.sentence, ids.phrase, "token_contains", 0.5, createdAt, slug, "phrase"),
    relation(ids.phrase, ids.word, "token_contains", 0.58, createdAt, slug, "word"),
    relation(ids.word, ids.character, "token_contains", 0.62, createdAt, slug, "character"),
    relation(ids.character, ids.unicode, "translation", 0.66, createdAt, slug, "unicode"),
    relation(ids.unicode, ids.seedLoop, "parent_child", 0.58, createdAt, slug, "seed-loop"),
  ];

  return {
    id: sceneId,
    active_tab_id: tabId,
    tabs: [
      {
        id: tabId,
        title: seed,
        seed,
        source_mode: options.sourceMode ?? "new_seed",
        parent_backlink: options.parentBacklink,
        current_layer: "L0",
        viewport: { x: 0, y: 0, zoom: 1, layer: "L0" },
        node_ids: nodes.map((candidate) => candidate.id),
        relation_ids: relations.map((candidate) => candidate.id),
        source_ids: [],
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    layers: createCanonicalSeedLayers(seed),
    nodes,
    relations,
    sources: [],
    viewport: { x: 0, y: 0, zoom: 1, layer: "L0" },
    selection: {
      id: `selection-${slug}-${stamp}`,
      tab_id: tabId,
      node_ids: [],
      source_ids: [],
      text_ranges: [],
      created_at: createdAt,
    },
    agent_jobs: [],
    cartographer_outputs: [],
    scout_observations: [],
    runtime: {
      focused_node_id: undefined,
      browser_absorption: {
        status: "idle",
        exit_layer: "L4",
      },
      updated_at: createdAt,
    },
    metadata: {
      title: seed,
      description: `Local telescope seed for "${seed}". It has object-pool structure and the canonical L0-L11 12Level depth, but no source-backed facts until Scout or source intake confirms material.`,
      source_state: "local_only",
      generated_by: "user",
      created_at: createdAt,
      updated_at: createdAt,
    },
  };
}

function node(input: {
  breadcrumb: string[];
  canCreateSeed?: boolean;
  childIds?: string[];
  confidence: number;
  createdAt: string;
  id: string;
  importance: number;
  layer: LayerId;
  parentId?: string;
  position: { x: number; y: number };
  state: TerrainNode["source_state"];
  summary: string;
  tabId: string;
  tags: string[];
  title: string;
  type: TerrainNode["type"];
  zoomTarget?: TerrainNode["zoom_target"];
}): TerrainNode {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    layer: input.layer,
    source_state: input.state,
    confidence: input.confidence,
    importance: input.importance,
    tags: input.tags,
    summary: input.summary,
    parent_id: input.parentId,
    child_ids: input.childIds,
    semantic_breadcrumb: input.breadcrumb,
    zoom_target: input.zoomTarget,
    child_layer_id: input.zoomTarget?.layer,
    can_create_seed: input.canCreateSeed,
    created_from: {
      tab_id: input.tabId,
      node_id: input.parentId,
      layer: input.layer,
      label: input.breadcrumb.join(" / "),
      excerpt: input.summary,
    },
    position_hint: input.position,
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function relation(
  from: string,
  to: string,
  type: TerrainRelation["type"],
  confidence: number,
  createdAt: string,
  slug: string,
  suffix: string,
  state: TerrainRelation["source_state"] = "local_only",
): TerrainRelation {
  return {
    id: `rel-${slug}-${suffix}-${createdAt.replace(/[^0-9]/g, "")}`,
    from,
    to,
    type,
    confidence,
    explanation: "Local deterministic relation in the seed scene. It is an exploration affordance, not a factual claim.",
    source_state: state,
  };
}

function createCanonicalSeedLayers(seed: string): TerrainLayer[] {
  const definitions = CANONICAL_LAYER_DEFINITIONS;

  return definitions.map((definition, index) => ({
    id: definition.id,
    label: definition.label,
    parent_layer_id: index > 0 ? definitions[index - 1].id : undefined,
    child_layer_ids: definitions[index + 1] ? [definitions[index + 1].id] : [],
    breadcrumb: [seed, ...definitions.slice(0, index + 1).map((candidate) => candidate.label)],
  }));
}

function deriveSeedTerms(seed: string): string[] {
  const normalized = seed
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  const seen = new Set<string>();

  return normalized.filter((term) => {
    const key = term.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "seed";
}
