import type { CreatedFromRef, SourceRef, SourceType, TerrainNode, TerrainRelation, TerrainScene } from "@seekstar/core-schema";

export interface SourceIngestionInput {
  title: string;
  url?: string;
  body: string;
  sourceType?: SourceType;
  retrievedAt?: string;
  reliabilityHints?: string[];
  tags?: string[];
  createdFrom?: CreatedFromRef;
  observationId?: string;
}

export interface SourceTerrainPatch {
  source: SourceRef;
  nodes: TerrainNode[];
  relations: TerrainRelation[];
}

let sourceCounter = 0;

export function createSourceTerrainPatch(input: SourceIngestionInput, scene: TerrainScene): SourceTerrainPatch {
  sourceCounter += 1;

  const createdAt = input.retrievedAt ?? new Date().toISOString();
  const title = normalizeTitle(input.title);
  const excerptBlocks = createExcerptBlocks(input.body);
  const slug = toSlug(title);
  const stamp = `${Date.now()}-${sourceCounter}`;
  const sourceId = `source-${slug}-${stamp}`;
  const sourceNodeId = `node-${slug}-source-${stamp}`;
  const anchor = getSourceAnchor(scene);

  const source: SourceRef = {
    id: sourceId,
    title,
    url: input.url?.trim() || undefined,
    source_type: input.sourceType ?? (input.url?.trim() ? "webpage" : "document"),
    retrieved_at: createdAt,
    snippet: excerptBlocks[0] ?? input.body.slice(0, 220),
    reliability_hints: input.reliabilityHints ?? ["manual user-provided source", "not retrieved by Playwright"],
    created_from_observation_id: input.observationId,
  };

  const sourceNode: TerrainNode = {
    id: sourceNodeId,
    type: "source",
    title,
    layer: "L2",
    source_state: "source_backed",
    confidence: 0.86,
    importance: 0.88,
    tags: ["source", "source-backed", ...(input.tags ?? ["manual-ingest"])],
    summary: source.snippet,
    source_id: source.id,
    source_url: source.url,
    source_title: source.title,
    source_type: source.source_type,
    retrieved_at: createdAt,
    created_from: input.createdFrom,
    position_hint: anchor,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const excerptNodes = excerptBlocks.slice(0, 3).map<TerrainNode>((excerpt, index) => {
    const nodeId = `node-${slug}-excerpt-${index + 1}-${stamp}`;

    return {
      id: nodeId,
      type: index === 0 ? "section" : "paragraph",
      title: createExcerptTitle(excerpt, index),
      layer: index === 0 ? "L3" : "L4",
      source_state: "source_backed",
      confidence: 0.82,
      importance: 0.62 - index * 0.08,
      tags: ["source-excerpt", "source-backed", ...(input.tags ?? ["manual-ingest"])],
      summary: excerpt,
      source_id: source.id,
      source_url: source.url,
      source_title: source.title,
      source_type: source.source_type,
      retrieved_at: createdAt,
      created_from: input.createdFrom,
      parent_id: sourceNodeId,
      quote: excerpt,
      position_hint: {
        x: anchor.x + 260 + index * 36,
        y: anchor.y - 96 + index * 96,
      },
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  const relations: TerrainRelation[] = excerptNodes.map((node, index) => ({
    id: `rel-${slug}-contains-${index + 1}-${stamp}`,
    from: sourceNodeId,
    to: node.id,
    type: "source_contains",
    confidence: 0.88,
    explanation: input.tags?.includes("scout-observation") ? "User-confirmed Scout observation created this source-backed excerpt relation." : "Manual source ingestion created this source-backed excerpt relation.",
    source_state: "source_backed",
  }));

  return {
    source,
    nodes: [sourceNode, ...excerptNodes],
    relations,
  };
}

function getSourceAnchor(scene: TerrainScene): { x: number; y: number } {
  const existingSourceNodes = scene.nodes.filter((node) => node.type === "source" || node.source_state === "source_backed");
  const offset = existingSourceNodes.length * 130;

  return {
    x: scene.viewport.x + 360,
    y: scene.viewport.y - 160 + offset,
  };
}

function createExcerptBlocks(body: string): string[] {
  return body
    .split(/\n{2,}|\r?\n[-*]\s+/)
    .map((block) => block.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 6);
}

function createExcerptTitle(excerpt: string, index: number): string {
  const firstSentence = excerpt.split(/[.!?。！？]/)[0]?.trim();
  const title = firstSentence || `Source excerpt ${index + 1}`;

  return title.length > 52 ? `${title.slice(0, 49)}...` : title;
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  return normalized || "Untitled source";
}

function toSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "source";
}
